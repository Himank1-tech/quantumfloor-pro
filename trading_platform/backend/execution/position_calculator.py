"""
Universal Position, Pip & Lot Size Calculator.
Deterministic position sizing across Forex (Standard, Mini, Micro lots + Pip value + Margin)
and Indian Equities / F&O (Share quantity, F&O lot multipliers, STT/SEBI statutory fees).
"""

from typing import Dict, Optional, Any
from pydantic import BaseModel, Field
import math

NSE_LOT_SIZES = {
    "NIFTY50": 25,
    "BANKNIFTY": 15,
    "RELIANCE": 250,
    "TCS": 175,
    "HDFCBANK": 550,
    "ICICIBANK": 700,
    "INFY": 400,
    "TATAMOTORS": 575,
}


class PositionInput(BaseModel):
    symbol: str
    asset_class: str  # "FOREX" or "INDIAN_EQUITY" or "COMMODITY"
    account_balance: float
    risk_percentage: float = 1.0  # default 1.0% risk per trade
    entry_price: float
    stop_loss_price: float
    take_profit_price: Optional[float] = None
    leverage: float = 100.0  # default 1:100 for FX, 1:1 for cash equity


class PositionCalculationResult(BaseModel):
    symbol: str
    asset_class: str
    currency: str
    account_balance: float
    risk_percentage: float
    risk_amount: float
    entry_price: float
    stop_loss_price: float
    take_profit_price: Optional[float]
    stop_loss_distance: float
    risk_reward_ratio: float

    # Forex Specific Fields
    sl_in_pips: Optional[float] = None
    pip_value_usd: Optional[float] = None
    exact_lots: Optional[float] = None
    standard_lots: Optional[float] = None
    mini_lots: Optional[float] = None
    micro_lots: Optional[float] = None
    required_margin: Optional[float] = None

    # Indian Equity Specific Fields
    shares_quantity: Optional[int] = None
    fno_lots_count: Optional[int] = None
    fno_contract_lot_size: Optional[int] = None
    total_capital_required: Optional[float] = None
    estimated_brokerage: Optional[float] = None
    estimated_stt: Optional[float] = None
    estimated_gst_sebi: Optional[float] = None
    net_potential_profit: Optional[float] = None

    summary_text: str


def calculate_position_size(inp: PositionInput) -> PositionCalculationResult:
    """
    Computes exact institutional position sizes, pip metrics, and margin allocations.
    """
    bal = inp.account_balance
    risk_pct = max(0.1, min(inp.risk_percentage, 10.0))
    risk_amount = round(bal * (risk_pct / 100.0), 2)
    entry = inp.entry_price
    sl = inp.stop_loss_price
    tp = inp.take_profit_price

    sl_dist = abs(entry - sl)
    if sl_dist <= 0.000001:
        sl_dist = max(entry * 0.005, 0.001)

    tp_dist = abs(tp - entry) if tp else (sl_dist * 2.0)
    rr = round(tp_dist / sl_dist, 2)

    is_fx = inp.asset_class in ("FOREX", "COMMODITY") or "/" in inp.symbol or "=X" in inp.symbol

    if is_fx:
        # ==================== FOREX CALCULATION ====================
        curr = "USD"
        clean_sym = inp.symbol.upper()

        # Pip Size Definition
        if "JPY" in clean_sym:
            pip_size = 0.01
            # For USD/JPY, Pip value per standard lot = (100,000 * 0.01) / entry
            pip_value_per_std_lot = (100000.0 * 0.01) / entry if entry > 0 else 6.50
        elif "XAU" in clean_sym or "GOLD" in clean_sym or "GC=F" in clean_sym:
            pip_size = 0.10
            pip_value_per_std_lot = 10.0  # 100 oz contract * $0.10
        elif "INR" in clean_sym:
            pip_size = 0.0025
            pip_value_per_std_lot = (100000.0 * 0.0025) / entry if entry > 0 else 2.96
        else:
            # EUR/USD, GBP/USD, etc.
            pip_size = 0.0001
            pip_value_per_std_lot = 10.0

        sl_pips = round(sl_dist / pip_size, 1)
        if sl_pips <= 0:
            sl_pips = 10.0

        # Exact Lots = Risk Amount ($) / (SL Pips * Pip Value per 1.00 Lot)
        exact_lots = risk_amount / (sl_pips * pip_value_per_std_lot)
        exact_lots = max(0.01, round(exact_lots, 2))

        std_lots = round(exact_lots, 2)
        mini_lots = round(exact_lots * 10, 1)
        micro_lots = round(exact_lots * 100, 0)

        # Margin Required = (Lot Size * Contract Size * Entry) / Leverage
        contract_size = 100.0 if ("XAU" in clean_sym or "GOLD" in clean_sym) else 100000.0
        notional_value = exact_lots * contract_size * (1.0 if ("EUR" in clean_sym or "GBP" in clean_sym) else entry)
        req_margin = round(notional_value / max(1.0, inp.leverage), 2)

        potential_profit = round(risk_amount * rr, 2)

        summary = (
            f"Forex Sizing for {inp.symbol}: Risking ${risk_amount:.2f} ({risk_pct}%) with {sl_pips:.1f} pips SL. "
            f"Recommended Position: {std_lots} Standard Lots ({mini_lots} Mini / {int(micro_lots)} Micro). "
            f"Required Margin: ${req_margin:.2f} at 1:{int(inp.leverage)} leverage. Potential Profit at TP: ${potential_profit:.2f} (1:{rr} R:R)."
        )

        return PositionCalculationResult(
            symbol=inp.symbol,
            asset_class="FOREX",
            currency=curr,
            account_balance=bal,
            risk_percentage=risk_pct,
            risk_amount=risk_amount,
            entry_price=entry,
            stop_loss_price=sl,
            take_profit_price=tp or (entry + tp_dist if entry > sl else entry - tp_dist),
            stop_loss_distance=sl_dist,
            risk_reward_ratio=rr,
            sl_in_pips=sl_pips,
            pip_value_usd=round(pip_value_per_std_lot * exact_lots, 2),
            exact_lots=exact_lots,
            standard_lots=std_lots,
            mini_lots=mini_lots,
            micro_lots=micro_lots,
            required_margin=req_margin,
            net_potential_profit=potential_profit,
            summary_text=summary,
        )

    else:
        # ==================== INDIAN EQUITIES & F&O ====================
        curr = "INR"
        # Shares = Risk Amount (₹) / SL Distance (₹)
        raw_qty = risk_amount / sl_dist
        shares_qty = max(1, int(math.floor(raw_qty)))

        # Total Capital Required (for delivery/cash)
        total_cap = round(shares_qty * entry, 2)

        # F&O Lot Multiplier
        lot_size = NSE_LOT_SIZES.get(inp.symbol.upper(), 100)
        fno_lots = max(1, int(round(shares_qty / lot_size)))

        # Statutory Charges Engine (NSE Cash Equity)
        turnover = total_cap * 2  # Buy + Sell
        brokerage = min(40.0, turnover * 0.0003)
        stt = round(turnover * 0.001, 2)  # 0.1% for delivery, 0.025% intraday
        gst_sebi = round((brokerage * 0.18) + (turnover * 0.0000325), 2)
        total_fees = round(brokerage + stt + gst_sebi, 2)

        gross_profit = round(shares_qty * tp_dist, 2)
        net_profit = round(gross_profit - total_fees, 2)

        summary = (
            f"NSE Equity Sizing for {inp.symbol}: Risking ₹{risk_amount:,.2f} ({risk_pct}%) with ₹{sl_dist:.2f} SL risk. "
            f"Recommended Quantity: {shares_qty:,} shares (Capital Required: ₹{total_cap:,.2f}). "
            f"F&O Equivalent: {fno_lots} lot(s) (Lot size: {lot_size}). "
            f"Est. Statutory Fees: ₹{total_fees:.2f}. Potential Net Profit: ₹{net_profit:,.2f} (1:{rr} R:R)."
        )

        return PositionCalculationResult(
            symbol=inp.symbol,
            asset_class="INDIAN_EQUITY",
            currency=curr,
            account_balance=bal,
            risk_percentage=risk_pct,
            risk_amount=risk_amount,
            entry_price=entry,
            stop_loss_price=sl,
            take_profit_price=tp or (entry + tp_dist if entry > sl else entry - tp_dist),
            stop_loss_distance=sl_dist,
            risk_reward_ratio=rr,
            shares_quantity=shares_qty,
            fno_lots_count=fno_lots,
            fno_contract_lot_size=lot_size,
            total_capital_required=total_cap,
            estimated_brokerage=round(brokerage, 2),
            estimated_stt=stt,
            estimated_gst_sebi=gst_sebi,
            net_potential_profit=net_profit,
            summary_text=summary,
        )
