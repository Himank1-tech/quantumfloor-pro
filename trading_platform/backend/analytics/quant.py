"""
Institutional Quantitative Analytics Engine
Calculates Sharpe, Sortino, Max Drawdown, Beta, Volatility, Kelly Criterion, and VaR/CVaR.
"""

from typing import List, Dict, Any, Optional, Union
import math
import numpy as np


def calculate_sharpe_ratio(
    returns: Union[List[float], np.ndarray],
    risk_free_rate: float = 0.065,
    periods_per_year: int = 252,
) -> float:
    """
    Calculate annualized Sharpe Ratio.
    Formula: (Mean_Return - Annualized_Rf / periods) / Std_Dev * sqrt(periods_per_year)

    :param returns: Array-like of periodic decimal returns (e.g., 0.01 for 1%)
    :param risk_free_rate: Annualized risk-free rate (default 6.5% standard Indian RBI repo / US 4.5% baseline)
    :param periods_per_year: 252 for daily, 252*375 for 1-minute bars
    :return: Annualized Sharpe Ratio
    """
    if len(returns) < 2:
        return 0.0
    arr = np.asarray(returns, dtype=np.float64)
    # Remove NaNs or infinities
    arr = arr[np.isfinite(arr)]
    if len(arr) < 2:
        return 0.0

    periodic_rf = risk_free_rate / periods_per_year
    excess_returns = arr - periodic_rf
    mean_excess = np.mean(excess_returns)
    std_dev = np.std(arr, ddof=1)

    if std_dev == 0.0 or np.isnan(std_dev):
        return 0.0

    sharpe = (mean_excess / std_dev) * math.sqrt(periods_per_year)
    return float(np.round(sharpe, 4))


def calculate_sortino_ratio(
    returns: Union[List[float], np.ndarray],
    target_return: float = 0.0,
    risk_free_rate: float = 0.065,
    periods_per_year: int = 252,
) -> float:
    """
    Calculate annualized Sortino Ratio.
    Penalizes only downside volatility below the target or risk-free hurdle.

    :param returns: Periodic returns
    :param target_return: Minimum acceptable return (MAR)
    :param risk_free_rate: Annualized risk-free rate
    :param periods_per_year: Annualization factor
    :return: Annualized Sortino Ratio
    """
    if len(returns) < 2:
        return 0.0
    arr = np.asarray(returns, dtype=np.float64)
    arr = arr[np.isfinite(arr)]
    if len(arr) < 2:
        return 0.0

    periodic_rf = risk_free_rate / periods_per_year
    excess_returns = arr - periodic_rf
    mean_excess = np.mean(excess_returns)

    # Downside deviation: only consider returns below target_return
    downside_diff = np.minimum(0.0, arr - target_return)
    downside_sq = np.square(downside_diff)
    downside_variance = np.mean(downside_sq)
    downside_dev = math.sqrt(downside_variance)

    if downside_dev == 0.0 or np.isnan(downside_dev):
        return 0.0 if mean_excess <= 0 else 10.0

    sortino = (mean_excess / downside_dev) * math.sqrt(periods_per_year)
    return float(np.round(sortino, 4))


def calculate_max_drawdown(
    equity_curve: Union[List[float], np.ndarray]
) -> Dict[str, float]:
    """
    Calculate Maximum Drawdown, Current Drawdown, Peak, Trough, and Drawdown Duration.

    :param equity_curve: Array of cumulative portfolio equity values
    :return: Dictionary containing max_drawdown_pct, current_drawdown_pct, peak, trough, duration_periods
    """
    if len(equity_curve) == 0:
        return {
            "max_drawdown_pct": 0.0,
            "current_drawdown_pct": 0.0,
            "peak_equity": 0.0,
            "trough_equity": 0.0,
            "max_drawdown_duration": 0,
        }

    eq = np.asarray(equity_curve, dtype=np.float64)
    eq = eq[np.isfinite(eq)]
    if len(eq) == 0 or np.all(eq <= 0):
        return {
            "max_drawdown_pct": 0.0,
            "current_drawdown_pct": 0.0,
            "peak_equity": 0.0,
            "trough_equity": 0.0,
            "max_drawdown_duration": 0,
        }

    running_max = np.maximum.accumulate(eq)
    drawdowns = (eq - running_max) / running_max  # negative values or zero

    max_dd = float(np.min(drawdowns))  # e.g. -0.072 for -7.2%
    curr_dd = float(drawdowns[-1])

    # Find peak and trough at maximum drawdown
    trough_idx = int(np.argmin(drawdowns))
    peak_idx = int(np.argmax(eq[:trough_idx + 1])) if trough_idx >= 0 else 0
    peak_val = float(eq[peak_idx]) if len(eq) > 0 else 0.0
    trough_val = float(eq[trough_idx]) if len(eq) > 0 else 0.0

    # Calculate max duration in drawdown
    duration = 0
    current_duration = 0
    for dd in drawdowns:
        if dd < 0:
            current_duration += 1
            if current_duration > duration:
                duration = current_duration
        else:
            current_duration = 0

    return {
        "max_drawdown_pct": float(np.round(abs(max_dd) * 100.0, 2)),
        "current_drawdown_pct": float(np.round(abs(curr_dd) * 100.0, 2)),
        "peak_equity": float(np.round(peak_val, 2)),
        "trough_equity": float(np.round(trough_val, 2)),
        "max_drawdown_duration": int(duration),
    }


def calculate_beta(
    asset_returns: Union[List[float], np.ndarray],
    benchmark_returns: Union[List[float], np.ndarray],
) -> float:
    """
    Calculate Beta of the portfolio relative to a market benchmark (e.g. NIFTY 50 / S&P 500).
    Beta = Cov(R_p, R_m) / Var(R_m)

    :param asset_returns: Periodic returns of the portfolio/asset
    :param benchmark_returns: Periodic returns of the benchmark
    :return: Beta coefficient
    """
    min_len = min(len(asset_returns), len(benchmark_returns))
    if min_len < 3:
        return 1.0  # Default neutral market beta

    r_p = np.asarray(asset_returns[:min_len], dtype=np.float64)
    r_m = np.asarray(benchmark_returns[:min_len], dtype=np.float64)

    # Filter invalid entries
    valid = np.isfinite(r_p) & np.isfinite(r_m)
    r_p = r_p[valid]
    r_m = r_m[valid]
    if len(r_p) < 3:
        return 1.0

    var_m = np.var(r_m, ddof=1)
    if var_m == 0.0 or np.isnan(var_m):
        return 1.0

    cov_matrix = np.cov(r_p, r_m, ddof=1)
    cov_pm = cov_matrix[0, 1]

    beta = cov_pm / var_m
    return float(np.round(beta, 3))


def calculate_volatility(
    returns: Union[List[float], np.ndarray],
    periods_per_year: int = 252,
) -> float:
    """
    Calculate annualized realized volatility (standard deviation of returns).

    :param returns: Array of periodic decimal returns
    :param periods_per_year: 252 for daily
    :return: Annualized volatility in percent (e.g. 18.5 for 18.5%)
    """
    if len(returns) < 2:
        return 0.0
    arr = np.asarray(returns, dtype=np.float64)
    arr = arr[np.isfinite(arr)]
    if len(arr) < 2:
        return 0.0

    std_dev = np.std(arr, ddof=1)
    annualized_vol = std_dev * math.sqrt(periods_per_year) * 100.0
    return float(np.round(annualized_vol, 2))


def calculate_kelly_criterion(
    win_rate: float,
    avg_win: float,
    avg_loss: float,
    fraction: float = 0.5,
    max_cap: float = 0.25,
) -> float:
    """
    Calculate optimal position sizing fraction using Kelly Criterion.
    Formula: f* = p - (1 - p) / b
    where p = win_rate, b = payoff ratio (avg_win / avg_loss).

    To avoid reckless institutional drawdowns, fractional Kelly (e.g., half-Kelly = 0.5 or quarter-Kelly = 0.25)
    and an upper risk bound cap (default max 25% of equity) are applied.

    :param win_rate: Historical or modeled win rate between 0.0 and 1.0
    :param avg_win: Average win magnitude (or return %)
    :param avg_loss: Average loss magnitude (or return %)
    :param fraction: Kelly scaling factor (0.5 for Half-Kelly, 0.25 for Quarter-Kelly)
    :param max_cap: Strict maximum single allocation cap
    :return: Recommended fraction of equity to allocate (0.0 to max_cap)
    """
    if win_rate <= 0.0 or avg_loss <= 0.0 or avg_win <= 0.0:
        return 0.0

    p = max(0.0, min(1.0, win_rate))
    q = 1.0 - p
    b = avg_win / avg_loss  # payoff ratio

    if b <= 0.0:
        return 0.0

    full_kelly = p - (q / b)
    if full_kelly <= 0.0:
        return 0.0  # Negative edge: do not take trade

    # Apply fractional Kelly scaling for institutional stability
    fractional_kelly = full_kelly * fraction
    # Bound between 0 and max_cap
    bounded = max(0.0, min(max_cap, fractional_kelly))
    return float(np.round(bounded, 4))


def calculate_var_cvar(
    returns: Union[List[float], np.ndarray],
    confidence: float = 0.95,
) -> Dict[str, float]:
    """
    Calculate Historical Value at Risk (VaR) and Conditional VaR (CVaR / Expected Shortfall).

    :param returns: Array of periodic decimal returns
    :param confidence: Confidence level (e.g. 0.95 for 95% VaR)
    :return: Dict with 'var_pct' and 'cvar_pct'
    """
    if len(returns) < 5:
        return {"var_pct": 0.0, "cvar_pct": 0.0}

    arr = np.asarray(returns, dtype=np.float64)
    arr = arr[np.isfinite(arr)]
    if len(arr) < 5:
        return {"var_pct": 0.0, "cvar_pct": 0.0}

    # Percentile corresponding to (1 - confidence)
    alpha = 1.0 - confidence
    var_cutoff = np.percentile(arr, alpha * 100.0)

    # CVaR is the mean of all returns below the VaR cutoff
    tail_losses = arr[arr <= var_cutoff]
    cvar_val = np.mean(tail_losses) if len(tail_losses) > 0 else var_cutoff

    # Report positive percentages representing risk of loss
    return {
        "var_pct": float(np.round(abs(min(0.0, var_cutoff)) * 100.0, 2)),
        "cvar_pct": float(np.round(abs(min(0.0, cvar_val)) * 100.0, 2)),
    }


def compute_portfolio_quant_metrics(
    equity_curve: List[float],
    returns: List[float],
    benchmark_returns: Optional[List[float]] = None,
    trades: Optional[List[Dict[str, Any]]] = None,
    risk_free_rate: float = 0.065,
) -> Dict[str, Any]:
    """
    Compute comprehensive quantitative portfolio telemetry.
    """
    sharpe = calculate_sharpe_ratio(returns, risk_free_rate=risk_free_rate)
    sortino = calculate_sortino_ratio(returns, risk_free_rate=risk_free_rate)
    drawdown_stats = calculate_max_drawdown(equity_curve)
    volatility = calculate_volatility(returns)

    beta = 1.0
    if benchmark_returns and len(benchmark_returns) > 2:
        beta = calculate_beta(returns, benchmark_returns)

    var_stats = calculate_var_cvar(returns, confidence=0.95)

    # Trade stats
    win_rate = 0.0
    profit_factor = 0.0
    total_trades = 0
    winning_trades = 0
    losing_trades = 0
    avg_win = 0.0
    avg_loss = 0.0
    kelly_fraction = 0.0

    if trades and len(trades) > 0:
        pnls = [t.get("pnl", 0.0) for t in trades if "pnl" in t]
        if pnls:
            total_trades = len(pnls)
            wins = [p for p in pnls if p > 0]
            losses = [abs(p) for p in pnls if p < 0]
            winning_trades = len(wins)
            losing_trades = len(losses)

            win_rate = winning_trades / total_trades if total_trades > 0 else 0.0
            sum_win = sum(wins)
            sum_loss = sum(losses)
            profit_factor = sum_win / sum_loss if sum_loss > 0 else (99.9 if sum_win > 0 else 0.0)
            avg_win = sum_win / winning_trades if winning_trades > 0 else 0.0
            avg_loss = sum_loss / losing_trades if losing_trades > 0 else 0.0

            kelly_fraction = calculate_kelly_criterion(
                win_rate=win_rate,
                avg_win=avg_win,
                avg_loss=avg_loss,
                fraction=0.5,
                max_cap=0.25,
            )

    # Initial and current equity
    initial_eq = equity_curve[0] if len(equity_curve) > 0 else 100000.0
    current_eq = equity_curve[-1] if len(equity_curve) > 0 else 100000.0
    total_return_pct = ((current_eq - initial_eq) / initial_eq) * 100.0 if initial_eq > 0 else 0.0

    return {
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "max_drawdown_pct": drawdown_stats["max_drawdown_pct"],
        "current_drawdown_pct": drawdown_stats["current_drawdown_pct"],
        "peak_equity": drawdown_stats["peak_equity"],
        "trough_equity": drawdown_stats["trough_equity"],
        "drawdown_duration": drawdown_stats["max_drawdown_duration"],
        "annualized_volatility_pct": volatility,
        "beta": beta,
        "var_95_pct": var_stats["var_pct"],
        "cvar_95_pct": var_stats["cvar_pct"],
        "kelly_recommended_pct": float(np.round(kelly_fraction * 100.0, 2)),
        "win_rate_pct": float(np.round(win_rate * 100.0, 2)),
        "profit_factor": float(np.round(profit_factor, 2)),
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "avg_win": float(np.round(avg_win, 2)),
        "avg_loss": float(np.round(avg_loss, 2)),
        "total_return_pct": float(np.round(total_return_pct, 2)),
        "current_equity": float(np.round(current_eq, 2)),
        "initial_equity": float(np.round(initial_eq, 2)),
    }
