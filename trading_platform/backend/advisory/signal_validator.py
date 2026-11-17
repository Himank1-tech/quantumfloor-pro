"""
Deterministic Signal Validator.
Enforces institutional mathematical standards: minimum 1:2 Risk/Reward ratio,
slippage buffer absorption, verifiable citation thresholds, and invalidation rules.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from .grounded_engine import GroundedAdviceSignal


class ValidationResult(BaseModel):
    is_valid: bool
    signal_id: str
    symbol: str
    calculated_risk_reward: float
    effective_entry_buffer: float
    approved_allocation_pct: float
    audit_notes: List[str]


class SignalValidator:
    """
    Quantitative Validator for AI Advisory Signals.
    """

    def __init__(self, min_risk_reward: float = 2.0, max_allocation_cap_pct: float = 15.0):
        self.min_risk_reward = min_risk_reward
        self.max_allocation_cap_pct = max_allocation_cap_pct

    def validate_signal(self, signal: GroundedAdviceSignal) -> ValidationResult:
        audit_notes: List[str] = []
        is_valid = True

        entry = (signal.entry_range[0] + signal.entry_range[1]) / 2.0 if signal.entry_range else signal.current_price
        target = signal.target_price
        stop = signal.invalidation_stop

        # 1. Direction and Invalidation check
        if signal.action in ("STRONG_BUY", "ACCUMULATE", "BREAKOUT_BUY"):
            if stop >= entry:
                audit_notes.append("REJECTED: Stop loss must be strictly below entry price for long advisory.")
                is_valid = False
            if target <= entry:
                audit_notes.append("REJECTED: Target price must be strictly above entry price for long advisory.")
                is_valid = False

            risk = entry - stop
            reward = target - entry
        else:
            if stop <= entry:
                audit_notes.append("REJECTED: Stop loss must be strictly above entry price for short advisory.")
                is_valid = False
            if target >= entry:
                audit_notes.append("REJECTED: Target price must be strictly below entry price for short advisory.")
                is_valid = False

            risk = stop - entry
            reward = entry - target

        # 2. Risk/Reward validation
        rr = round(reward / risk, 2) if risk > 0 else 0.0
        if rr < self.min_risk_reward:
            audit_notes.append(f"REJECTED: Risk/Reward ratio (1:{rr}) is below institutional minimum (1:{self.min_risk_reward}).")
            is_valid = False
        else:
            audit_notes.append(f"PASSED: Risk/Reward ratio confirmed at 1:{rr} (>= 1:{self.min_risk_reward}).")

        # 3. Slippage buffer check (0.05% slippage allowance)
        slippage_buffer = entry * 0.0005
        net_reward = reward - slippage_buffer
        effective_rr = round(net_reward / (risk + slippage_buffer), 2) if (risk + slippage_buffer) > 0 else 0.0
        audit_notes.append(f"Slippage buffer modeled (₹{slippage_buffer:.2f}); Effective net R:R is 1:{effective_rr}.")

        # 4. Verifiable proof check
        proof_count = len(signal.verifiable_proof)
        if proof_count < 2:
            audit_notes.append(f"REJECTED: Signal provides only {proof_count} verifiable citations. Institutional standard requires >= 2.")
            is_valid = False
        else:
            audit_notes.append(f"PASSED: Signal backed by {proof_count} verifiable evidence citations.")

        # 5. Suggested allocation cap
        approved_alloc = min(signal.suggested_portfolio_allocation_pct, self.max_allocation_cap_pct)
        if signal.suggested_portfolio_allocation_pct > self.max_allocation_cap_pct:
            audit_notes.append(f"SCALED DOWN: Proposed allocation {signal.suggested_portfolio_allocation_pct}% capped at {self.max_allocation_cap_pct}%.")

        return ValidationResult(
            is_valid=is_valid,
            signal_id=signal.signal_id,
            symbol=signal.symbol,
            calculated_risk_reward=rr,
            effective_entry_buffer=round(slippage_buffer, 4),
            approved_allocation_pct=approved_alloc,
            audit_notes=audit_notes,
        )
