"""
Deterministic Quantitative Risk Governor.
Enforces Kelly Criterion position sizing, single-asset concentration limits,
volatility brakes, and multi-tier automated drawdown circuit breakers.
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import datetime
import math
from ..analytics.quant import calculate_kelly_criterion


class CircuitBreakerState(str, Enum):
    NORMAL = "NORMAL"
    SOFT_BRAKE = "SOFT_BRAKE"        # Volatility or 3% daily drawdown: 50% size reduction
    HARD_HALT = "HARD_HALT"          # 5% daily drawdown or 10% total drawdown: trading blocked
    MANUAL_OVERRIDE = "MANUAL_OVERRIDE"


class RiskAssessmentResult(BaseModel):
    approved: bool
    symbol: str
    original_quantity: float
    approved_quantity: float
    risk_score: float  # 0 to 100 (lower is safer)
    circuit_breaker_state: CircuitBreakerState
    kelly_suggested_fraction: float
    max_capital_allowed: float
    audit_trail: List[str] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class RiskGovernor:
    """
    Deterministic Quantitative Risk Governor.
    All agent proposals must pass through this governor before hitting broker execution.
    """

    def __init__(
        self,
        max_asset_concentration_pct: float = 15.0,  # Max 15% NAV per asset
        soft_daily_drawdown_limit_pct: float = 3.0, # 3% daily loss = soft brake
        hard_daily_drawdown_limit_pct: float = 5.0, # 5% daily loss = hard halt
        max_total_drawdown_limit_pct: float = 10.0, # 10% total DD = hard halt
        volatility_brake_multiplier: float = 2.5,   # Volatility 2.5x above baseline triggers brake
        kelly_fraction: float = 0.5,                # Half-Kelly for stability
        max_leverage_equity: float = 2.0,           # Max 2x leverage for Indian cash
        max_leverage_forex: float = 20.0,           # Max 20x leverage for FX
    ):
        self.max_asset_concentration_pct = max_asset_concentration_pct
        self.soft_daily_drawdown_limit_pct = soft_daily_drawdown_limit_pct
        self.hard_daily_drawdown_limit_pct = hard_daily_drawdown_limit_pct
        self.max_total_drawdown_limit_pct = max_total_drawdown_limit_pct
        self.volatility_brake_multiplier = volatility_brake_multiplier
        self.kelly_fraction = kelly_fraction
        self.max_leverage_equity = max_leverage_equity
        self.max_leverage_forex = max_leverage_forex

        # State tracking
        self.circuit_breaker_state = CircuitBreakerState.NORMAL
        self.daily_start_nav: Optional[float] = None
        self.historical_peak_nav: Optional[float] = None
        self.risk_events_log: List[Dict[str, Any]] = []

    def update_portfolio_state(self, current_nav: float, daily_pnl_pct: float, total_drawdown_pct: float) -> CircuitBreakerState:
        """
        Evaluate and update circuit breaker state based on portfolio drawdown metrics.
        """
        if self.circuit_breaker_state == CircuitBreakerState.MANUAL_OVERRIDE:
            return self.circuit_breaker_state

        # Check Hard Halt condition: daily loss >= 5% or total drawdown >= 10%
        if daily_pnl_pct <= -self.hard_daily_drawdown_limit_pct or total_drawdown_pct >= self.max_total_drawdown_limit_pct:
            if self.circuit_breaker_state != CircuitBreakerState.HARD_HALT:
                self.circuit_breaker_state = CircuitBreakerState.HARD_HALT
                self._record_event(
                    "CIRCUIT_BREAKER_HARD_HALT",
                    f"Trading halted! Daily drawdown: {daily_pnl_pct:.2f}%, Total DD: {total_drawdown_pct:.2f}%"
                )
        # Check Soft Brake condition: daily loss >= 3%
        elif daily_pnl_pct <= -self.soft_daily_drawdown_limit_pct:
            if self.circuit_breaker_state != CircuitBreakerState.SOFT_BRAKE:
                self.circuit_breaker_state = CircuitBreakerState.SOFT_BRAKE
                self._record_event(
                    "CIRCUIT_BREAKER_SOFT_BRAKE",
                    f"Soft brake activated! Daily drawdown: {daily_pnl_pct:.2f}%. Position sizes reduced by 50%."
                )
        else:
            if self.circuit_breaker_state in (CircuitBreakerState.SOFT_BRAKE, CircuitBreakerState.HARD_HALT):
                self._record_event("CIRCUIT_BREAKER_RESET", "Drawdown normalized. Trading floor state set to NORMAL.")
            self.circuit_breaker_state = CircuitBreakerState.NORMAL

        return self.circuit_breaker_state

    def reset_circuit_breaker(self) -> None:
        """Manual reset for administrative authority."""
        self.circuit_breaker_state = CircuitBreakerState.NORMAL
        self._record_event("MANUAL_RESET", "Circuit breaker manually reset by floor manager.")

    def _record_event(self, event_type: str, details: str) -> None:
        event = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "event_type": event_type,
            "details": details,
            "state": self.circuit_breaker_state.value,
        }
        self.risk_events_log.append(event)

    def validate_trade_proposal(
        self,
        symbol: str,
        asset_class: str,
        side: str,
        proposed_quantity: float,
        price: float,
        total_portfolio_nav: float,
        current_asset_exposure: float,
        current_volatility_ratio: float = 1.0,  # current ATR / 20-period ATR
        win_rate: float = 0.55,                 # agent confidence or historical win rate
        payoff_ratio: float = 1.8,              # expected reward/risk
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
    ) -> RiskAssessmentResult:
        """
        Deterministic Multi-Tier Pre-Trade Risk Validation Pipeline.
        """
        audit_trail: List[str] = []
        is_approved = True
        adjusted_qty = float(proposed_quantity)
        risk_score = 20.0  # Base nominal risk score

        # Tier 1: Circuit Breaker Gate
        if self.circuit_breaker_state == CircuitBreakerState.HARD_HALT:
            audit_trail.append("REJECTED: Circuit Breaker HARD_HALT active. New risk deployment prohibited.")
            return RiskAssessmentResult(
                approved=False,
                symbol=symbol,
                original_quantity=proposed_quantity,
                approved_quantity=0.0,
                risk_score=100.0,
                circuit_breaker_state=self.circuit_breaker_state,
                kelly_suggested_fraction=0.0,
                max_capital_allowed=0.0,
                audit_trail=audit_trail,
            )

        # Tier 2: Volatility Brake Check
        if current_volatility_ratio >= self.volatility_brake_multiplier:
            risk_score += 35.0
            audit_trail.append(f"WARNING: Volatility Brake triggered (Ratio {current_volatility_ratio:.2f}x >= {self.volatility_brake_multiplier}x). Trimming size by 50%.")
            adjusted_qty *= 0.5

        if self.circuit_breaker_state == CircuitBreakerState.SOFT_BRAKE:
            risk_score += 25.0
            audit_trail.append("WARNING: Soft Drawdown Brake active. Trimming size by 50%.")
            adjusted_qty *= 0.5

        # Tier 3: Kelly Criterion Sizing Calculation
        # f* = p - (1-p)/b
        kelly_fraction = calculate_kelly_criterion(
            win_rate=win_rate,
            avg_win=payoff_ratio,
            avg_loss=1.0,
            fraction=self.kelly_fraction,
            max_cap=self.max_asset_concentration_pct / 100.0,
        )
        max_kelly_capital = total_portfolio_nav * kelly_fraction
        proposed_trade_capital = proposed_quantity * price

        audit_trail.append(f"Kelly sizing calculated: {kelly_fraction * 100.0:.2f}% (max capital: {max_kelly_capital:,.2f})")

        # Tier 4: Single-Asset Concentration Limit
        max_allowed_concentration = total_portfolio_nav * (self.max_asset_concentration_pct / 100.0)
        remaining_asset_capacity = max(0.0, max_allowed_concentration - current_asset_exposure)

        audit_trail.append(f"Asset concentration limit: {self.max_asset_concentration_pct}% ({max_allowed_concentration:,.2f}). Remaining headroom: {remaining_asset_capacity:,.2f}")

        # Deterministic bound on order capital
        effective_capital_ceiling = min(max_kelly_capital, remaining_asset_capacity)
        if effective_capital_ceiling <= 0:
            audit_trail.append("REJECTED: Single-asset concentration cap or Kelly limit already reached.")
            return RiskAssessmentResult(
                approved=False,
                symbol=symbol,
                original_quantity=proposed_quantity,
                approved_quantity=0.0,
                risk_score=95.0,
                circuit_breaker_state=self.circuit_breaker_state,
                kelly_suggested_fraction=kelly_fraction,
                max_capital_allowed=0.0,
                audit_trail=audit_trail,
            )

        if proposed_trade_capital > effective_capital_ceiling:
            max_qty_by_capital = effective_capital_ceiling / price if price > 0 else 0
            if max_qty_by_capital < adjusted_qty:
                audit_trail.append(f"SCALED DOWN: Quantity trimmed from {adjusted_qty:.2f} to {max_qty_by_capital:.2f} to respect Kelly/Concentration ceiling.")
                adjusted_qty = max_qty_by_capital

        # Tier 5: Stop-Loss & Risk/Reward Validation
        if stop_loss is not None and take_profit is not None:
            if side.upper() == "BUY":
                if stop_loss >= price:
                    audit_trail.append("REJECTED: For BUY order, Stop-Loss must be below entry price.")
                    is_approved = False
                elif take_profit <= price:
                    audit_trail.append("REJECTED: For BUY order, Take-Profit must be above entry price.")
                    is_approved = False
                else:
                    risk = price - stop_loss
                    reward = take_profit - price
                    rr_ratio = reward / risk if risk > 0 else 0.0
                    audit_trail.append(f"Risk/Reward validated: 1:{rr_ratio:.2f}")
                    if rr_ratio < 1.2:
                        risk_score += 15.0
                        audit_trail.append("NOTE: Risk/Reward ratio is below institutional preference (1:1.5).")
            elif side.upper() == "SELL":
                if stop_loss <= price:
                    audit_trail.append("REJECTED: For SELL order, Stop-Loss must be above entry price.")
                    is_approved = False
                elif take_profit >= price:
                    audit_trail.append("REJECTED: For SELL order, Take-Profit must be below entry price.")
                    is_approved = False

        # Tier 6: Minimum Order Lot Sizing
        if asset_class == "INDIAN_EQUITY":
            adjusted_qty = math.floor(adjusted_qty)
            if adjusted_qty < 1:
                audit_trail.append("REJECTED: Adjusted quantity fell below 1 share minimum lot for Indian equities.")
                is_approved = False
        elif asset_class == "FOREX":
            adjusted_qty = round(adjusted_qty, -2)  # Nearest 100 units
            if adjusted_qty < 1000:
                audit_trail.append("REJECTED: Forex trade below 1,000 units (1 Micro lot).")
                is_approved = False

        if is_approved and adjusted_qty > 0:
            audit_trail.append(f"APPROVED: Risk Governor validated execution for {adjusted_qty:,.2f} {symbol}.")
        else:
            is_approved = False

        return RiskAssessmentResult(
            approved=is_approved,
            symbol=symbol,
            original_quantity=proposed_quantity,
            approved_quantity=adjusted_qty if is_approved else 0.0,
            risk_score=min(100.0, round(risk_score, 1)),
            circuit_breaker_state=self.circuit_breaker_state,
            kelly_suggested_fraction=kelly_fraction,
            max_capital_allowed=round(effective_capital_ceiling, 2),
            audit_trail=audit_trail,
        )

    def get_status(self) -> Dict[str, Any]:
        return {
            "circuit_breaker_state": self.circuit_breaker_state.value,
            "max_asset_concentration_pct": self.max_asset_concentration_pct,
            "soft_daily_drawdown_limit_pct": self.soft_daily_drawdown_limit_pct,
            "hard_daily_drawdown_limit_pct": self.hard_daily_drawdown_limit_pct,
            "max_total_drawdown_limit_pct": self.max_total_drawdown_limit_pct,
            "volatility_brake_multiplier": self.volatility_brake_multiplier,
            "kelly_fraction": self.kelly_fraction,
            "recent_events": self.risk_events_log[-10:],
        }
