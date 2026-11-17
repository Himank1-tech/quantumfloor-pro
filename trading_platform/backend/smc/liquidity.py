"""
Liquidity & Point of Interest (POI) Engine.
Maps Buy-Side / Sell-Side Liquidity (BSL/SSL), Equal Highs/Lows (EQH/EQL),
Order Blocks (OB), and Fair Value Gaps (FVG).
"""

from typing import List, Dict, Optional, Any
from enum import Enum
from pydantic import BaseModel, Field

from ..market_data.historical import Candle


class LiquidityType(str, Enum):
    BSL = "BSL"  # Buy-Side Liquidity (Resting buy stops above highs / EQH)
    SSL = "SSL"  # Sell-Side Liquidity (Resting sell stops below lows / EQL)


class OrderBlockType(str, Enum):
    BULLISH_DEMAND = "BULLISH_DEMAND"
    BEARISH_SUPPLY = "BEARISH_SUPPLY"


class LiquidityPool(BaseModel):
    pool_type: LiquidityType
    price_level: float
    touches: int
    source_indices: List[int]
    is_swept: bool = False
    description: str


class OrderBlock(BaseModel):
    block_type: OrderBlockType
    top: float
    bottom: float
    candle_index: int
    timestamp: str
    is_mitigated: bool = False
    mitigated_at_index: Optional[int] = None
    volume: int
    strength_score: float  # 0 to 100 based on subsequent displacement


class FairValueGap(BaseModel):
    direction: str  # "BULLISH" or "BEARISH"
    top: float
    bottom: float
    gap_size: float
    candle_index: int
    timestamp: str
    is_mitigated: bool = False
    midpoint_consequent_encroachment: float  # 50% CE of the gap


class LiquidityPOIResult(BaseModel):
    bsl_pools: List[LiquidityPool]
    ssl_pools: List[LiquidityPool]
    order_blocks: List[OrderBlock]
    unmitigated_order_blocks: List[OrderBlock]
    fair_value_gaps: List[FairValueGap]
    unmitigated_fvgs: List[FairValueGap]


def detect_liquidity_and_poi(candles: List[Candle], eq_tolerance_pct: float = 0.0015) -> LiquidityPOIResult:
    """
    Scans candlestick sequence to detect BSL, SSL, Order Blocks, and FVGs.
    """
    n = len(candles)
    if n < 5:
        return LiquidityPOIResult(
            bsl_pools=[], ssl_pools=[], order_blocks=[],
            unmitigated_order_blocks=[], fair_value_gaps=[], unmitigated_fvgs=[]
        )

    bsl_pools: List[LiquidityPool] = []
    ssl_pools: List[LiquidityPool] = []
    order_blocks: List[OrderBlock] = []
    fair_value_gaps: List[FairValueGap] = []

    # 1. Equal Highs (EQH -> BSL) and Equal Lows (EQL -> SSL)
    for i in range(1, n - 1):
        for j in range(i + 3, min(i + 30, n)):
            # Check Equal Highs
            diff_h = abs(candles[i].high - candles[j].high)
            avg_h = (candles[i].high + candles[j].high) / 2
            if avg_h > 0 and (diff_h / avg_h) <= eq_tolerance_pct:
                level = max(candles[i].high, candles[j].high)
                swept = any(candles[k].high > level for k in range(j + 1, n))
                bsl_pools.append(LiquidityPool(
                    pool_type=LiquidityType.BSL,
                    price_level=round(level, 4),
                    touches=2,
                    source_indices=[i, j],
                    is_swept=swept,
                    description=f"EQH Buy-Side Liquidity Pool at {level:.2f}"
                ))

            # Check Equal Lows
            diff_l = abs(candles[i].low - candles[j].low)
            avg_l = (candles[i].low + candles[j].low) / 2
            if avg_l > 0 and (diff_l / avg_l) <= eq_tolerance_pct:
                level = min(candles[i].low, candles[j].low)
                swept = any(candles[k].low < level for k in range(j + 1, n))
                ssl_pools.append(LiquidityPool(
                    pool_type=LiquidityType.SSL,
                    price_level=round(level, 4),
                    touches=2,
                    source_indices=[i, j],
                    is_swept=swept,
                    description=f"EQL Sell-Side Liquidity Pool at {level:.2f}"
                ))

    # Also add highest high of the window as external BSL and lowest low as external SSL
    highest_c = max(candles, key=lambda c: c.high)
    lowest_c = min(candles, key=lambda c: c.low)
    highest_idx = candles.index(highest_c)
    lowest_idx = candles.index(lowest_c)
    bsl_pools.append(LiquidityPool(
        pool_type=LiquidityType.BSL,
        price_level=highest_c.high,
        touches=1,
        source_indices=[highest_idx],
        is_swept=False,
        description=f"External Swing BSL Target at {highest_c.high:.2f}"
    ))
    ssl_pools.append(LiquidityPool(
        pool_type=LiquidityType.SSL,
        price_level=lowest_c.low,
        touches=1,
        source_indices=[lowest_idx],
        is_swept=False,
        description=f"External Swing SSL Target at {lowest_c.low:.2f}"
    ))

    # 2. Fair Value Gaps (FVG) across 3-candle windows
    for i in range(2, n):
        c1 = candles[i - 2]
        c2 = candles[i - 1]
        c3 = candles[i]

        # Bullish FVG: Candle 1 High < Candle 3 Low (Displacement Upwards)
        if c3.low > c1.high:
            gap_size = c3.low - c1.high
            ce = round(c1.high + gap_size / 2, 4)
            # Check mitigation by future candles
            mitigated = False
            for k in range(i + 1, n):
                if candles[k].low <= c1.high:
                    mitigated = True
                    break

            fair_value_gaps.append(FairValueGap(
                direction="BULLISH",
                top=round(c3.low, 4),
                bottom=round(c1.high, 4),
                gap_size=round(gap_size, 4),
                candle_index=i - 1,
                timestamp=c2.timestamp,
                is_mitigated=mitigated,
                midpoint_consequent_encroachment=ce,
            ))

        # Bearish FVG: Candle 1 Low > Candle 3 High (Displacement Downwards)
        elif c1.low > c3.high:
            gap_size = c1.low - c3.high
            ce = round(c3.high + gap_size / 2, 4)
            # Check mitigation by future candles
            mitigated = False
            for k in range(i + 1, n):
                if candles[k].high >= c1.low:
                    mitigated = True
                    break

            fair_value_gaps.append(FairValueGap(
                direction="BEARISH",
                top=round(c1.low, 4),
                bottom=round(c3.high, 4),
                gap_size=round(gap_size, 4),
                candle_index=i - 1,
                timestamp=c2.timestamp,
                is_mitigated=mitigated,
                midpoint_consequent_encroachment=ce,
            ))

    # 3. Order Blocks (OB)
    # Find candles that were followed by strong displacement breaking previous local highs/lows
    for i in range(1, n - 3):
        ob_candle = candles[i]
        next_candle = candles[i + 1]
        following_candles = candles[i + 1:min(i + 4, n)]

        # Bullish Order Block (Demand):
        # Last bearish (down) candle before strong displacement upward
        if ob_candle.close < ob_candle.open:
            displacement = max(c.close for c in following_candles) - ob_candle.low
            avg_body = abs(ob_candle.close - ob_candle.open)
            if displacement > (avg_body * 2.2):
                # Strong impulse up confirmed
                top = max(ob_candle.open, ob_candle.high)
                bottom = ob_candle.low
                
                # Check mitigation
                mitigated = False
                mitigated_idx = None
                for k in range(i + 4, n):
                    if candles[k].low <= top:
                        mitigated = True
                        mitigated_idx = k
                        break

                order_blocks.append(OrderBlock(
                    block_type=OrderBlockType.BULLISH_DEMAND,
                    top=round(top, 4),
                    bottom=round(bottom, 4),
                    candle_index=i,
                    timestamp=ob_candle.timestamp,
                    is_mitigated=mitigated,
                    mitigated_at_index=mitigated_idx,
                    volume=ob_candle.volume,
                    strength_score=min(95.0, round(50.0 + (displacement / ob_candle.low) * 1000, 1)),
                ))

        # Bearish Order Block (Supply):
        # Last bullish (up) candle before strong displacement downward
        elif ob_candle.close > ob_candle.open:
            displacement = ob_candle.high - min(c.close for c in following_candles)
            avg_body = abs(ob_candle.close - ob_candle.open)
            if displacement > (avg_body * 2.2):
                # Strong impulse down confirmed
                top = ob_candle.high
                bottom = min(ob_candle.open, ob_candle.low)

                # Check mitigation
                mitigated = False
                mitigated_idx = None
                for k in range(i + 4, n):
                    if candles[k].high >= bottom:
                        mitigated = True
                        mitigated_idx = k
                        break

                order_blocks.append(OrderBlock(
                    block_type=OrderBlockType.BEARISH_SUPPLY,
                    top=round(top, 4),
                    bottom=round(bottom, 4),
                    candle_index=i,
                    timestamp=ob_candle.timestamp,
                    is_mitigated=mitigated,
                    mitigated_at_index=mitigated_idx,
                    volume=ob_candle.volume,
                    strength_score=min(95.0, round(50.0 + (displacement / ob_candle.high) * 1000, 1)),
                ))

    # Keep only the most recent pools & POIs
    recent_obs = order_blocks[-10:]
    unmitigated_obs = [ob for ob in recent_obs if not ob.is_mitigated]
    recent_fvgs = fair_value_gaps[-12:]
    unmitigated_fvgs = [fvg for fvg in recent_fvgs if not fvg.is_mitigated]

    return LiquidityPOIResult(
        bsl_pools=bsl_pools[-6:],
        ssl_pools=ssl_pools[-6:],
        order_blocks=recent_obs,
        unmitigated_order_blocks=unmitigated_obs,
        fair_value_gaps=recent_fvgs,
        unmitigated_fvgs=unmitigated_fvgs,
    )
