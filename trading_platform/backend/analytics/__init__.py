"""
Quantitative Analytics Package for Trading Platform.
Provides institutional performance metrics: Sharpe, Sortino, Max Drawdown, Beta, Volatility, Kelly sizing, and VaR/CVaR.
"""

from .quant import (
    calculate_sharpe_ratio,
    calculate_sortino_ratio,
    calculate_max_drawdown,
    calculate_beta,
    calculate_volatility,
    calculate_kelly_criterion,
    calculate_var_cvar,
    compute_portfolio_quant_metrics,
)

__all__ = [
    "calculate_sharpe_ratio",
    "calculate_sortino_ratio",
    "calculate_max_drawdown",
    "calculate_beta",
    "calculate_volatility",
    "calculate_kelly_criterion",
    "calculate_var_cvar",
    "compute_portfolio_quant_metrics",
]
