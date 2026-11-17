"""
Candlestick Anatomy & Pattern Detection Engine.
Identifies institutional candlestick patterns: Bullish/Bearish Engulfing,
Pin Bar / Hammer / Shooting Star (wick > 65% of candle range), Inside Bar Breakouts,
and Morning/Evening Stars.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

from ..market_data.historical import Candle


class CandlePattern(BaseModel):
    candle_index: int
    timestamp: str
    pattern_name: str
    direction: str  # "BULLISH", "BEARISH", "NEUTRAL"
    confidence_score: float  # 0 to 100
    description: str
    body_ratio: float
    upper_wick_ratio: float
    lower_wick_ratio: float


def detect_candlestick_patterns(candles: List[Candle]) -> List[CandlePattern]:
    """
    Evaluates candle anatomy and scans for institutional candlestick confirmation signatures.
    """
    n = len(candles)
    if n < 3:
        return []

    patterns: List[CandlePattern] = []

    for i in range(1, n):
        c = candles[i]
        prev = candles[i - 1]

        total_range = c.high - c.low
        if total_range <= 0.00001:
            continue

        body = abs(c.close - c.open)
        upper_wick = c.high - max(c.open, c.close)
        lower_wick = min(c.open, c.close) - c.low

        body_ratio = body / total_range
        upper_ratio = upper_wick / total_range
        lower_ratio = lower_wick / total_range

        is_bullish = c.close > c.open
        is_bearish = c.close < c.open

        # 1. Bullish Engulfing
        # Previous candle was bearish, current candle opens <= prev close and closes > prev open
        if prev.close < prev.open and is_bullish and c.close > prev.open and c.open <= prev.close:
            patterns.append(CandlePattern(
                candle_index=i,
                timestamp=c.timestamp,
                pattern_name="Bullish Engulfing",
                direction="BULLISH",
                confidence_score=90.0,
                description=f"Bullish Engulfing: Strong buyer displacement completely engulfed prior bearish body",
                body_ratio=round(body_ratio, 2),
                upper_wick_ratio=round(upper_ratio, 2),
                lower_wick_ratio=round(lower_ratio, 2),
            ))
            continue

        # 2. Bearish Engulfing
        # Previous candle was bullish, current candle opens >= prev close and closes < prev open
        if prev.close > prev.open and is_bearish and c.close < prev.open and c.open >= prev.close:
            patterns.append(CandlePattern(
                candle_index=i,
                timestamp=c.timestamp,
                pattern_name="Bearish Engulfing",
                direction="BEARISH",
                confidence_score=90.0,
                description=f"Bearish Engulfing: Aggressive seller displacement completely engulfed prior bullish body",
                body_ratio=round(body_ratio, 2),
                upper_wick_ratio=round(upper_ratio, 2),
                lower_wick_ratio=round(lower_ratio, 2),
            ))
            continue

        # 3. Pin Bar / Hammer (Bullish Rejection: Lower wick > 65% of total range, small upper wick and body)
        if lower_ratio >= 0.65 and upper_ratio <= 0.15:
            patterns.append(CandlePattern(
                candle_index=i,
                timestamp=c.timestamp,
                pattern_name="Bullish Pin Bar / Hammer",
                direction="BULLISH",
                confidence_score=85.0,
                description=f"Bullish Pin Bar: Strong lower wick rejection ({lower_ratio*100:.1f}% of range) indicating aggressive demand absorption",
                body_ratio=round(body_ratio, 2),
                upper_wick_ratio=round(upper_ratio, 2),
                lower_wick_ratio=round(lower_ratio, 2),
            ))
            continue

        # 4. Shooting Star / Inverted Pin Bar (Bearish Rejection: Upper wick > 65% of total range)
        if upper_ratio >= 0.65 and lower_ratio <= 0.15:
            patterns.append(CandlePattern(
                candle_index=i,
                timestamp=c.timestamp,
                pattern_name="Bearish Shooting Star",
                direction="BEARISH",
                confidence_score=85.0,
                description=f"Bearish Shooting Star: Strong upper wick rejection ({upper_ratio*100:.1f}% of range) indicating heavy institutional supply wall",
                body_ratio=round(body_ratio, 2),
                upper_wick_ratio=round(upper_ratio, 2),
                lower_wick_ratio=round(lower_ratio, 2),
            ))
            continue

        # 5. Morning Star (3-Candle Bullish Reversal)
        if i >= 2:
            c_prev2 = candles[i - 2]
            # c_prev2 is long bearish, prev is small doji/spinning top, c is strong bullish closing into c_prev2
            if (c_prev2.close < c_prev2.open and
                abs(prev.close - prev.open) / (prev.high - prev.low + 0.0001) < 0.35 and
                is_bullish and c.close > (c_prev2.open + c_prev2.close) / 2):
                patterns.append(CandlePattern(
                    candle_index=i,
                    timestamp=c.timestamp,
                    pattern_name="Morning Star Reversal",
                    direction="BULLISH",
                    confidence_score=92.0,
                    description="Morning Star: 3-bar reversal showing seller exhaustion followed by institutional accumulation",
                    body_ratio=round(body_ratio, 2),
                    upper_wick_ratio=round(upper_ratio, 2),
                    lower_wick_ratio=round(lower_ratio, 2),
                ))
                continue

            # 6. Evening Star (3-Candle Bearish Reversal)
            if (c_prev2.close > c_prev2.open and
                abs(prev.close - prev.open) / (prev.high - prev.low + 0.0001) < 0.35 and
                is_bearish and c.close < (c_prev2.open + c_prev2.close) / 2):
                patterns.append(CandlePattern(
                    candle_index=i,
                    timestamp=c.timestamp,
                    pattern_name="Evening Star Reversal",
                    direction="BEARISH",
                    confidence_score=92.0,
                    description="Evening Star: 3-bar reversal showing buyer exhaustion followed by institutional distribution",
                    body_ratio=round(body_ratio, 2),
                    upper_wick_ratio=round(upper_ratio, 2),
                    lower_wick_ratio=round(lower_ratio, 2),
                ))
                continue

        # 7. Inside Bar Breakout
        # Previous candle was an inside bar inside prev2, current candle breaks out
        if i >= 2:
            c_prev2 = candles[i - 2]
            prev_is_inside = prev.high <= c_prev2.high and prev.low >= c_prev2.low
            if prev_is_inside:
                if c.close > c_prev2.high:
                    patterns.append(CandlePattern(
                        candle_index=i,
                        timestamp=c.timestamp,
                        pattern_name="Inside Bar Bullish Breakout",
                        direction="BULLISH",
                        confidence_score=80.0,
                        description="Inside Bar Breakout: Price consolidated and resolved forcefully upwards",
                        body_ratio=round(body_ratio, 2),
                        upper_wick_ratio=round(upper_ratio, 2),
                        lower_wick_ratio=round(lower_ratio, 2),
                    ))
                elif c.close < c_prev2.low:
                    patterns.append(CandlePattern(
                        candle_index=i,
                        timestamp=c.timestamp,
                        pattern_name="Inside Bar Bearish Breakout",
                        direction="BEARISH",
                        confidence_score=80.0,
                        description="Inside Bar Breakout: Price consolidated and resolved forcefully downwards",
                        body_ratio=round(body_ratio, 2),
                        upper_wick_ratio=round(upper_ratio, 2),
                        lower_wick_ratio=round(lower_ratio, 2),
                    ))

    return patterns
