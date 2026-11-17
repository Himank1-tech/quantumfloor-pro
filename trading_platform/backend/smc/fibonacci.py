"""
Auto-Fibonacci & Premium/Discount Engine.
Calculates automated Fibonacci retracement and expansion levels from structural swing points,
locating the 50% Equilibrium, Discount Zone (<50%), Premium Zone (>50%),
and the institutional Optimal Trade Entry (OTE: 0.618, 0.705, 0.786) pocket.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

from .structure import SwingPoint, SwingType
from ..market_data.historical import Candle


class FibLevel(BaseModel):
    ratio: float
    price: float
    label: str
    is_ote: bool = False


class FibLevels(BaseModel):
    anchor_low: float
    anchor_high: float
    impulse_direction: str  # "BULLISH" or "BEARISH"
    equilibrium_price: float  # 0.500
    ote_pocket_low: float     # 0.618 or 0.786 depending on direction
    ote_pocket_high: float
    ote_sweet_spot: float     # 0.705
    is_price_in_ote: bool
    is_price_in_discount: bool
    is_price_in_premium: bool
    current_price: float
    levels: List[FibLevel]


def calculate_auto_fibonacci(
    candles: List[Candle],
    swing_highs: List[SwingPoint],
    swing_lows: List[SwingPoint],
    active_trend: str = "BULLISH"
) -> FibLevels:
    """
    Computes automated institutional Fibonacci levels anchored on the most recent swing impulse.
    """
    if not candles:
        return FibLevels(
            anchor_low=0.0, anchor_high=0.0, impulse_direction=active_trend,
            equilibrium_price=0.0, ote_pocket_low=0.0, ote_pocket_high=0.0,
            ote_sweet_spot=0.0, is_price_in_ote=False, is_price_in_discount=False,
            is_price_in_premium=False, current_price=0.0, levels=[]
        )

    cur_price = candles[-1].close

    # Select latest swing high and swing low
    if swing_highs and swing_lows:
        last_high = swing_highs[-1].price
        last_low = swing_lows[-1].price
    else:
        # Fallback to candle sequence extrema
        last_high = max(c.high for c in candles[-40:])
        last_low = min(c.low for c in candles[-40:])

    # Ensure high > low
    if last_high <= last_low:
        last_high = cur_price * 1.02
        last_low = cur_price * 0.98

    span = last_high - last_low
    direction = "BULLISH" if active_trend == "BULLISH" else "BEARISH"

    # Standard institutional Fibonacci ratios
    ratios = [
        (0.000, "0.0% Swing Extrema"),
        (0.236, "23.6% Shallow Pullback"),
        (0.382, "38.2% Minor Retracement"),
        (0.500, "50.0% Equilibrium (EQ)"),
        (0.618, "61.8% OTE Upper Boundary"),
        (0.705, "70.5% OTE Sweet Spot"),
        (0.786, "78.6% OTE Lower Boundary"),
        (1.000, "100.0% Swing Anchor"),
        (1.272, "127.2% Target Extension (TP1)"),
        (1.618, "161.8% Golden Ratio Target (TP2)"),
    ]

    levels: List[FibLevel] = []

    if direction == "BULLISH":
        # Upward impulse from Low to High: Pullback moves down from High towards Low
        # 0.0 is High, 1.0 is Low
        for r, lbl in ratios:
            price = round(last_high - (span * r), 4)
            levels.append(FibLevel(
                ratio=r,
                price=price,
                label=lbl,
                is_ote=(0.618 <= r <= 0.786),
            ))
        eq_price = round(last_high - (span * 0.50), 4)
        ote_low = round(last_high - (span * 0.786), 4)
        ote_high = round(last_high - (span * 0.618), 4)
        ote_sweet = round(last_high - (span * 0.705), 4)
        in_discount = cur_price < eq_price
        in_premium = cur_price >= eq_price
        in_ote = ote_low <= cur_price <= ote_high

    else:
        # Downward impulse from High to Low: Retracement moves up from Low towards High
        # 0.0 is Low, 1.0 is High
        for r, lbl in ratios:
            price = round(last_low + (span * r), 4)
            levels.append(FibLevel(
                ratio=r,
                price=price,
                label=lbl,
                is_ote=(0.618 <= r <= 0.786),
            ))
        eq_price = round(last_low + (span * 0.50), 4)
        ote_low = round(last_low + (span * 0.618), 4)
        ote_high = round(last_low + (span * 0.786), 4)
        ote_sweet = round(last_low + (span * 0.705), 4)
        in_premium = cur_price > eq_price
        in_discount = cur_price <= eq_price
        in_ote = ote_low <= cur_price <= ote_high

    return FibLevels(
        anchor_low=round(last_low, 4),
        anchor_high=round(last_high, 4),
        impulse_direction=direction,
        equilibrium_price=eq_price,
        ote_pocket_low=min(ote_low, ote_high),
        ote_pocket_high=max(ote_low, ote_high),
        ote_sweet_spot=ote_sweet,
        is_price_in_ote=in_ote,
        is_price_in_discount=in_discount,
        is_price_in_premium=in_premium,
        current_price=round(cur_price, 4),
        levels=levels,
    )
