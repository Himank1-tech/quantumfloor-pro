"""
Multi-Currency Ledger and Unified Portfolio Accounting System.
Maintains separate INR (₹) and USD ($) balances, real-time FX conversion,
unified portfolio NAV, margin accounting, and historical ledger audit trail.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import datetime
import uuid


class LedgerEntry(BaseModel):
    entry_id: str = Field(default_factory=lambda: f"TX-{uuid.uuid4().hex[:8].upper()}")
    timestamp: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    currency: str  # "INR" or "USD"
    symbol: Optional[str] = None
    transaction_type: str  # "TRADE_BUY", "TRADE_SELL", "FEE", "DEPOSIT", "PNL_REALIZED"
    amount: float
    balance_after: float
    description: str


class MultiCurrencyLedger:
    """
    Multi-currency portfolio ledger managing dual-currency operations
    (NSE/BSE in INR and Forex in USD) with unified valuation.
    """

    def __init__(
        self,
        initial_inr: float = 1_000_000.0,  # ₹10,00,000 INR
        initial_usd: float = 25_000.0,     # $25,000 USD
        usd_inr_rate: float = 84.25,        # 1 USD = 84.25 INR
    ):
        self.initial_inr = initial_inr
        self.initial_usd = initial_usd
        self.usd_inr_rate = usd_inr_rate

        self.inr_cash = initial_inr
        self.usd_cash = initial_usd

        self.daily_start_nav_inr = initial_inr + (initial_usd * usd_inr_rate)
        self.high_water_mark_inr = self.daily_start_nav_inr

        self.ledger_entries: List[LedgerEntry] = []
        self._record_entry("INR", "DEPOSIT", initial_inr, "Initial institutional capital deposit (NSE/BSE)")
        self._record_entry("USD", "DEPOSIT", initial_usd, "Initial institutional capital deposit (Global FX)")

    def update_exchange_rate(self, rate: float) -> None:
        if rate > 0:
            self.usd_inr_rate = rate

    def _record_entry(
        self,
        currency: str,
        transaction_type: str,
        amount: float,
        description: str,
        symbol: Optional[str] = None,
    ) -> None:
        curr_bal = self.inr_cash if currency == "INR" else self.usd_cash
        entry = LedgerEntry(
            currency=currency,
            symbol=symbol,
            transaction_type=transaction_type,
            amount=amount,
            balance_after=curr_bal,
            description=description,
        )
        self.ledger_entries.insert(0, entry)
        if len(self.ledger_entries) > 200:
            self.ledger_entries.pop()

    def get_unified_summary(
        self,
        inr_broker_balance: Optional[Dict[str, Any]] = None,
        forex_broker_balance: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Aggregate multi-currency equity curves and compute unified portfolio NAV.
        """
        inr_equity = inr_broker_balance.get("total_equity", self.inr_cash) if inr_broker_balance else self.inr_cash
        inr_unrealized = inr_broker_balance.get("unrealized_pnl", 0.0) if inr_broker_balance else 0.0
        inr_margin_used = inr_broker_balance.get("margin_used", 0.0) if inr_broker_balance else 0.0

        usd_equity = forex_broker_balance.get("total_equity", self.usd_cash) if forex_broker_balance else self.usd_cash
        usd_unrealized = forex_broker_balance.get("unrealized_pnl", 0.0) if forex_broker_balance else 0.0
        usd_margin_used = forex_broker_balance.get("margin_used", 0.0) if forex_broker_balance else 0.0

        # Unified NAV
        total_nav_inr = inr_equity + (usd_equity * self.usd_inr_rate)
        total_nav_usd = usd_equity + (inr_equity / self.usd_inr_rate if self.usd_inr_rate > 0 else 0.0)

        # High Water Mark & Drawdown calculation
        if total_nav_inr > self.high_water_mark_inr:
            self.high_water_mark_inr = total_nav_inr

        drawdown_pct = 0.0
        if self.high_water_mark_inr > 0:
            drawdown_pct = ((self.high_water_mark_inr - total_nav_inr) / self.high_water_mark_inr) * 100.0

        # Daily Return
        daily_pnl_inr = total_nav_inr - self.daily_start_nav_inr
        daily_pnl_pct = (daily_pnl_inr / self.daily_start_nav_inr) * 100.0 if self.daily_start_nav_inr > 0 else 0.0

        # Total Return from baseline
        baseline_inr = self.initial_inr + (self.initial_usd * self.usd_inr_rate)
        total_return_pct = ((total_nav_inr - baseline_inr) / baseline_inr) * 100.0 if baseline_inr > 0 else 0.0

        # Allocation weights
        inr_weight_pct = round((inr_equity / total_nav_inr) * 100.0, 1) if total_nav_inr > 0 else 50.0
        usd_weight_pct = round(100.0 - inr_weight_pct, 1)

        return {
            "total_nav_inr": round(total_nav_inr, 2),
            "total_nav_usd": round(total_nav_usd, 2),
            "usd_inr_rate": self.usd_inr_rate,
            "daily_pnl_inr": round(daily_pnl_inr, 2),
            "daily_pnl_pct": round(daily_pnl_pct, 2),
            "total_return_pct": round(total_return_pct, 2),
            "current_drawdown_pct": round(drawdown_pct, 2),
            "high_water_mark_inr": round(self.high_water_mark_inr, 2),
            "inr_account": {
                "currency": "INR",
                "symbol": "₹",
                "cash": round(inr_broker_balance.get("cash", self.inr_cash) if inr_broker_balance else self.inr_cash, 2),
                "margin_used": round(inr_margin_used, 2),
                "unrealized_pnl": round(inr_unrealized, 2),
                "total_equity": round(inr_equity, 2),
                "allocation_pct": inr_weight_pct,
            },
            "usd_account": {
                "currency": "USD",
                "symbol": "$",
                "cash": round(forex_broker_balance.get("cash", self.usd_cash) if forex_broker_balance else self.usd_cash, 2),
                "margin_used": round(usd_margin_used, 2),
                "unrealized_pnl": round(usd_unrealized, 2),
                "total_equity": round(usd_equity, 2),
                "allocation_pct": usd_weight_pct,
            },
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    def get_ledger_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [entry.model_dump() for entry in self.ledger_entries[:limit]]
