"""
Smart Money Concepts (SMC) Institutional Suite.
Provides algorithmic market structure detection (BOS, CHoCH, TGL),
liquidity mapping (BSL, SSL, Order Blocks, FVGs), Auto-Fibonacci OTE,
candlestick confirmations, and Multi-Timeframe (MTF) confluence synthesis.
"""

from .structure import detect_market_structure, SwingPoint, StructureBreak, StructureType
from .liquidity import detect_liquidity_and_poi, LiquidityPool, OrderBlock, FairValueGap
from .fibonacci import calculate_auto_fibonacci, FibLevels
from .candlesticks import detect_candlestick_patterns, CandlePattern
from .mtf_confluence import synthesize_mtf_setup, MTFSetupReport

__all__ = [
    "detect_market_structure",
    "SwingPoint",
    "StructureBreak",
    "StructureType",
    "detect_liquidity_and_poi",
    "LiquidityPool",
    "OrderBlock",
    "FairValueGap",
    "calculate_auto_fibonacci",
    "FibLevels",
    "detect_candlestick_patterns",
    "CandlePattern",
    "synthesize_mtf_setup",
    "MTFSetupReport",
]
