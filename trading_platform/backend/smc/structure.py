"""
Market Structure Engine.
Detects Swing Highs, Swing Lows, Break of Structure (BOS),
Change of Character (CHoCH), and Trendline / Liquidity Grab Levels (TGL).
"""

from typing import List, Dict, Optional, Any
from enum import Enum
from pydantic import BaseModel, Field

from ..market_data.historical import Candle


class SwingType(str, Enum):
    SWING_HIGH = "SWING_HIGH"
    SWING_LOW = "SWING_LOW"


class StructureType(str, Enum):
    BOS = "BOS"      # Break of Structure (Trend Continuation)
    CHOCH = "CHOCH"  # Change of Character (Trend Reversal)
    TGL = "TGL"      # Trendline / Liquidity Grab Level (False Breakout & Sweep)


class SwingPoint(BaseModel):
    index: int
    timestamp: str
    swing_type: SwingType
    price: float
    confirmed: bool = True


class StructureBreak(BaseModel):
    structure_type: StructureType
    direction: str  # "BULLISH" or "BEARISH"
    break_price: float
    broken_swing_price: float
    candle_index: int
    timestamp: str
    description: str


class MarketStructureResult(BaseModel):
    active_trend: str  # "BULLISH", "BEARISH", "RANGING"
    swing_highs: List[SwingPoint]
    swing_lows: List[SwingPoint]
    structure_breaks: List[StructureBreak]
    last_bos: Optional[StructureBreak] = None
    last_choch: Optional[StructureBreak] = None


def detect_market_structure(candles: List[Candle], pivot_depth: int = 3) -> MarketStructureResult:
    """
    Analyzes candlestick sequence to extract structural swing points and identify BOS / CHoCH / TGL events.
    """
    n = len(candles)
    if n < (pivot_depth * 2 + 1):
        return MarketStructureResult(
            active_trend="RANGING",
            swing_highs=[],
            swing_lows=[],
            structure_breaks=[],
        )

    swing_highs: List[SwingPoint] = []
    swing_lows: List[SwingPoint] = []

    # 1. Detect Swing Highs and Lows using pivot depth
    for i in range(pivot_depth, n - pivot_depth):
        cur = candles[i]
        
        # Check Swing High
        is_high = True
        for left in range(1, pivot_depth + 1):
            if candles[i - left].high >= cur.high:
                is_high = False
                break
        if is_high:
            for right in range(1, pivot_depth + 1):
                if candles[i + right].high > cur.high:
                    is_high = False
                    break
        if is_high:
            swing_highs.append(SwingPoint(
                index=i,
                timestamp=cur.timestamp,
                swing_type=SwingType.SWING_HIGH,
                price=cur.high,
            ))

        # Check Swing Low
        is_low = True
        for left in range(1, pivot_depth + 1):
            if candles[i - left].low <= cur.low:
                is_low = False
                break
        if is_low:
            for right in range(1, pivot_depth + 1):
                if candles[i + right].low < cur.low:
                    is_low = False
                    break
        if is_low:
            swing_lows.append(SwingPoint(
                index=i,
                timestamp=cur.timestamp,
                swing_type=SwingType.SWING_LOW,
                price=cur.low,
            ))

    # 2. Iterate through candles to flag BOS, CHoCH, and TGL Sweeps
    structure_breaks: List[StructureBreak] = []
    current_trend = "RANGING"
    last_bos = None
    last_choch = None

    # Merge swings chronologically
    all_swings = sorted(swing_highs + swing_lows, key=lambda s: s.index)

    last_high_swing: Optional[SwingPoint] = None
    last_low_swing: Optional[SwingPoint] = None

    for i, c in enumerate(candles):
        # Update latest confirmed swings up to index i
        active_highs = [s for s in swing_highs if s.index < i]
        active_lows = [s for s in swing_lows if s.index < i]
        if active_highs:
            last_high_swing = active_highs[-1]
        if active_lows:
            last_low_swing = active_lows[-1]

        if not last_high_swing or not last_low_swing:
            continue

        # Check Bullish Breakout above last swing high
        if c.close > last_high_swing.price:
            # Body close confirmed above prior swing high
            if current_trend == "BEARISH":
                # Reversal: CHoCH
                sb = StructureBreak(
                    structure_type=StructureType.CHOCH,
                    direction="BULLISH",
                    break_price=c.close,
                    broken_swing_price=last_high_swing.price,
                    candle_index=i,
                    timestamp=c.timestamp,
                    description=f"Bullish CHoCH: Candle body closed ({c.close:.2f}) above prior Lower-High ({last_high_swing.price:.2f})"
                )
                structure_breaks.append(sb)
                last_choch = sb
                current_trend = "BULLISH"
            elif current_trend == "BULLISH":
                # Continuation: BOS
                sb = StructureBreak(
                    structure_type=StructureType.BOS,
                    direction="BULLISH",
                    break_price=c.close,
                    broken_swing_price=last_high_swing.price,
                    candle_index=i,
                    timestamp=c.timestamp,
                    description=f"Bullish BOS: Body close ({c.close:.2f}) continued above structural Higher-High ({last_high_swing.price:.2f})"
                )
                structure_breaks.append(sb)
                last_bos = sb
            else:
                current_trend = "BULLISH"

        # Check Bearish Breakout below last swing low
        elif c.close < last_low_swing.price:
            # Body close confirmed below prior swing low
            if current_trend == "BULLISH":
                # Reversal: CHoCH
                sb = StructureBreak(
                    structure_type=StructureType.CHOCH,
                    direction="BEARISH",
                    break_price=c.close,
                    broken_swing_price=last_low_swing.price,
                    candle_index=i,
                    timestamp=c.timestamp,
                    description=f"Bearish CHoCH: Candle body closed ({c.close:.2f}) below prior Higher-Low ({last_low_swing.price:.2f})"
                )
                structure_breaks.append(sb)
                last_choch = sb
                current_trend = "BEARISH"
            elif current_trend == "BEARISH":
                # Continuation: BOS
                sb = StructureBreak(
                    structure_type=StructureType.BOS,
                    direction="BEARISH",
                    break_price=c.close,
                    broken_swing_price=last_low_swing.price,
                    candle_index=i,
                    timestamp=c.timestamp,
                    description=f"Bearish BOS: Body close ({c.close:.2f}) continued below structural Lower-Low ({last_low_swing.price:.2f})"
                )
                structure_breaks.append(sb)
                last_bos = sb
            else:
                current_trend = "BEARISH"

        # Check TGL (Liquidity Grab / Wick Sweep with failure to close outside)
        else:
            # Bullish wick sweep above swing high, but closed below it
            if c.high > last_high_swing.price and c.close < last_high_swing.price:
                # Displaced downward
                if c.close < c.open:
                    sb = StructureBreak(
                        structure_type=StructureType.TGL,
                        direction="BEARISH",
                        break_price=c.high,
                        broken_swing_price=last_high_swing.price,
                        candle_index=i,
                        timestamp=c.timestamp,
                        description=f"TGL BSL Sweep: Wick grabbed liquidity at {c.high:.2f} but closed back inside ({c.close:.2f})"
                    )
                    structure_breaks.append(sb)

            # Bearish wick sweep below swing low, but closed above it
            elif c.low < last_low_swing.price and c.close > last_low_swing.price:
                # Displaced upward
                if c.close > c.open:
                    sb = StructureBreak(
                        structure_type=StructureType.TGL,
                        direction="BULLISH",
                        break_price=c.low,
                        broken_swing_price=last_low_swing.price,
                        candle_index=i,
                        timestamp=c.timestamp,
                        description=f"TGL SSL Sweep: Wick grabbed liquidity at {c.low:.2f} but closed back inside ({c.close:.2f})"
                    )
                    structure_breaks.append(sb)

    if current_trend == "RANGING" and structure_breaks:
        current_trend = structure_breaks[-1].direction

    return MarketStructureResult(
        active_trend=current_trend,
        swing_highs=swing_highs[-10:],
        swing_lows=swing_lows[-10:],
        structure_breaks=structure_breaks[-15:],
        last_bos=last_bos,
        last_choch=last_choch,
    )
