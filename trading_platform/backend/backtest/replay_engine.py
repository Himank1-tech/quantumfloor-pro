"""
Institutional Strategy Backtesting & Bar-by-Bar Replay Engine.
Simulates MTF Smart Money Concepts (BOS, CHoCH, Order Blocks, Fib OTE)
across historical candlestick sequences with tear-sheet performance metrics.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
import math

from ..market_data.historical import Candle, historical_candle_loader
from ..smc.structure import detect_market_structure, MarketStructureResult
from ..smc.liquidity import detect_liquidity_and_poi, LiquidityPOIResult
from ..smc.fibonacci import calculate_auto_fibonacci, FibLevels
from ..smc.candlesticks import detect_candlestick_patterns, CandlePattern


class SimulatedTrade(BaseModel):
    trade_id: str
    symbol: str
    side: str  # "BUY" or "SELL"
    entry_index: int
    exit_index: Optional[int] = None
    entry_time: str
    exit_time: Optional[str] = None
    entry_price: float
    exit_price: Optional[float] = None
    stop_loss: float
    take_profit: float
    quantity: float
    pnl: float = 0.0
    return_pct: float = 0.0
    exit_reason: Optional[str] = None  # "TAKE_PROFIT", "STOP_LOSS", "OPEN"
    status: str = "OPEN"  # "OPEN" or "CLOSED"


class EquityPoint(BaseModel):
    index: int
    timestamp: str
    equity: float
    drawdown_pct: float


class BacktestRequest(BaseModel):
    symbol: str = "RELIANCE"
    timeframe: str = "15M"
    initial_capital: float = 100000.0
    risk_pct_per_trade: float = 1.0


class BacktestReport(BaseModel):
    symbol: str
    timeframe: str
    initial_capital: float
    final_equity: float
    net_profit: float
    net_return_pct: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate_pct: float
    profit_factor: float
    max_drawdown_pct: float
    avg_risk_reward: float
    trades: List[SimulatedTrade]
    equity_curve: List[EquityPoint]
    candles: List[Candle] = []


class ReplayStepResult(BaseModel):
    current_index: int
    total_bars: int
    current_candle: Candle
    active_trade: Optional[SimulatedTrade] = None
    completed_trades: List[SimulatedTrade]
    current_equity: float
    smc_trend: str
    last_bos_price: Optional[float] = None
    last_choch_price: Optional[float] = None
    order_block_count: int
    fvg_count: int


class BacktestEngine:
    """
    Simulates institutional SMC strategy on historical candlestick bars.
    """

    async def run_backtest(self, req: BacktestRequest) -> BacktestReport:
        """
        Executes complete historical backtest on multi-timeframe candles.
        """
        candles = await historical_candle_loader.get_candles(req.symbol, timeframe=req.timeframe, limit=120)
        n = len(candles)
        capital = req.initial_capital
        equity = capital
        peak_equity = capital
        max_dd = 0.0

        trades: List[SimulatedTrade] = []
        equity_curve: List[EquityPoint] = [
            EquityPoint(index=0, timestamp=candles[0].timestamp if candles else "", equity=capital, drawdown_pct=0.0)
        ]

        active_trade: Optional[SimulatedTrade] = None
        trade_counter = 1

        # Walk forward bar-by-bar
        for i in range(20, n):
            c = candles[i]
            prev_candles = candles[:i]

            # 1. Update active trade if one exists
            if active_trade:
                # Check Stop Loss
                if active_trade.side == "BUY":
                    if c.low <= active_trade.stop_loss:
                        # Stopped out
                        loss = (active_trade.stop_loss - active_trade.entry_price) * active_trade.quantity
                        active_trade.exit_price = active_trade.stop_loss
                        active_trade.exit_index = i
                        active_trade.exit_time = c.timestamp
                        active_trade.pnl = round(loss, 2)
                        active_trade.return_pct = round((loss / (active_trade.entry_price * active_trade.quantity)) * 100, 2)
                        active_trade.exit_reason = "STOP_LOSS"
                        active_trade.status = "CLOSED"
                        equity += loss
                        trades.append(active_trade)
                        active_trade = None
                    elif c.high >= active_trade.take_profit:
                        # Hit Take Profit
                        gain = (active_trade.take_profit - active_trade.entry_price) * active_trade.quantity
                        active_trade.exit_price = active_trade.take_profit
                        active_trade.exit_index = i
                        active_trade.exit_time = c.timestamp
                        active_trade.pnl = round(gain, 2)
                        active_trade.return_pct = round((gain / (active_trade.entry_price * active_trade.quantity)) * 100, 2)
                        active_trade.exit_reason = "TAKE_PROFIT"
                        active_trade.status = "CLOSED"
                        equity += gain
                        trades.append(active_trade)
                        active_trade = None

                elif active_trade.side == "SELL":
                    if c.high >= active_trade.stop_loss:
                        # Stopped out
                        loss = (active_trade.entry_price - active_trade.stop_loss) * active_trade.quantity
                        active_trade.exit_price = active_trade.stop_loss
                        active_trade.exit_index = i
                        active_trade.exit_time = c.timestamp
                        active_trade.pnl = round(loss, 2)
                        active_trade.return_pct = round((loss / (active_trade.entry_price * active_trade.quantity)) * 100, 2)
                        active_trade.exit_reason = "STOP_LOSS"
                        active_trade.status = "CLOSED"
                        equity += loss
                        trades.append(active_trade)
                        active_trade = None
                    elif c.low <= active_trade.take_profit:
                        # Hit Take Profit
                        gain = (active_trade.entry_price - active_trade.take_profit) * active_trade.quantity
                        active_trade.exit_price = active_trade.take_profit
                        active_trade.exit_index = i
                        active_trade.exit_time = c.timestamp
                        active_trade.pnl = round(gain, 2)
                        active_trade.return_pct = round((gain / (active_trade.entry_price * active_trade.quantity)) * 100, 2)
                        active_trade.exit_reason = "TAKE_PROFIT"
                        active_trade.status = "CLOSED"
                        equity += gain
                        trades.append(active_trade)
                        active_trade = None

            # 2. Check for new SMC entry signal if no active trade
            if not active_trade and (n - i) > 5:
                struct = detect_market_structure(prev_candles, pivot_depth=2)
                poi = detect_liquidity_and_poi(prev_candles)
                fib = calculate_auto_fibonacci(prev_candles, struct.swing_highs, struct.swing_lows, active_trend=struct.active_trend)
                patterns = detect_candlestick_patterns(prev_candles)
                last_pattern = patterns[-1] if patterns else None

                risk_cash = equity * (req.risk_pct_per_trade / 100.0)

                # Bullish Entry: Bullish Trend + Discount / OTE + Bullish Confirmation
                if struct.active_trend == "BULLISH" and fib.is_price_in_discount:
                    if last_pattern and last_pattern.direction == "BULLISH":
                        sl_level = fib.anchor_low * 0.998
                        sl_dist = max(0.01, c.close - sl_level)
                        tp_level = c.close + (sl_dist * 2.2)
                        qty = max(1.0, round(risk_cash / sl_dist, 2))

                        active_trade = SimulatedTrade(
                            trade_id=f"BT-TRD-{trade_counter:03d}",
                            symbol=req.symbol,
                            side="BUY",
                            entry_index=i,
                            entry_time=c.timestamp,
                            entry_price=c.close,
                            stop_loss=round(sl_level, 4),
                            take_profit=round(tp_level, 4),
                            quantity=qty,
                        )
                        trade_counter += 1

                # Bearish Entry: Bearish Trend + Premium / OTE + Bearish Confirmation
                elif struct.active_trend == "BEARISH" and fib.is_price_in_premium:
                    if last_pattern and last_pattern.direction == "BEARISH":
                        sl_level = fib.anchor_high * 1.002
                        sl_dist = max(0.01, sl_level - c.close)
                        tp_level = c.close - (sl_dist * 2.2)
                        qty = max(1.0, round(risk_cash / sl_dist, 2))

                        active_trade = SimulatedTrade(
                            trade_id=f"BT-TRD-{trade_counter:03d}",
                            symbol=req.symbol,
                            side="SELL",
                            entry_index=i,
                            entry_time=c.timestamp,
                            entry_price=c.close,
                            stop_loss=round(sl_level, 4),
                            take_profit=round(tp_level, 4),
                            quantity=qty,
                        )
                        trade_counter += 1

            # Update drawdown curve
            peak_equity = max(peak_equity, equity)
            dd = round(((peak_equity - equity) / peak_equity) * 100, 2)
            max_dd = max(max_dd, dd)
            equity_curve.append(EquityPoint(
                index=i,
                timestamp=c.timestamp,
                equity=round(equity, 2),
                drawdown_pct=dd,
            ))

        # Close any lingering trade at last close
        if active_trade:
            last_c = candles[-1]
            pnl = (last_c.close - active_trade.entry_price) * active_trade.quantity if active_trade.side == "BUY" else (active_trade.entry_price - last_c.close) * active_trade.quantity
            active_trade.exit_price = last_c.close
            active_trade.exit_index = n - 1
            active_trade.exit_time = last_c.timestamp
            active_trade.pnl = round(pnl, 2)
            active_trade.exit_reason = "END_OF_DATA"
            active_trade.status = "CLOSED"
            equity += pnl
            trades.append(active_trade)

        # Performance Tear-Sheet Statistics
        wins = [t for t in trades if t.pnl > 0]
        losses = [t for t in trades if t.pnl < 0]
        gross_profit = sum(t.pnl for t in wins)
        gross_loss = abs(sum(t.pnl for t in losses))

        win_rate = round((len(wins) / len(trades) * 100), 1) if trades else 0.0
        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (99.0 if gross_profit > 0 else 1.0)
        net_prof = round(equity - capital, 2)
        net_ret = round((net_prof / capital) * 100, 2)

        return BacktestReport(
            symbol=req.symbol,
            timeframe=req.timeframe,
            initial_capital=capital,
            final_equity=round(equity, 2),
            net_profit=net_prof,
            net_return_pct=net_ret,
            total_trades=len(trades),
            winning_trades=len(wins),
            losing_trades=len(losses),
            win_rate_pct=win_rate,
            profit_factor=profit_factor,
            max_drawdown_pct=round(max_dd, 2),
            avg_risk_reward=2.2,
            trades=trades,
            equity_curve=equity_curve,
            candles=candles,
        )

    async def get_replay_step(self, symbol: str, timeframe: str = "15M", step_index: int = 25) -> ReplayStepResult:
        """
        Calculates slice of data for bar-by-bar historical player.
        """
        candles = await historical_candle_loader.get_candles(symbol, timeframe=timeframe, limit=100)
        n = len(candles)
        safe_idx = max(5, min(step_index, n - 1))
        cur_slice = candles[:safe_idx + 1]

        struct = detect_market_structure(cur_slice, pivot_depth=2)
        poi = detect_liquidity_and_poi(cur_slice)

        return ReplayStepResult(
            current_index=safe_idx,
            total_bars=n,
            current_candle=candles[safe_idx],
            active_trade=None,
            completed_trades=[],
            current_equity=100000.0,
            smc_trend=struct.active_trend,
            last_bos_price=struct.last_bos.break_price if struct.last_bos else None,
            last_choch_price=struct.last_choch.break_price if struct.last_choch else None,
            order_block_count=len(poi.order_blocks),
            fvg_count=len(poi.fair_value_gaps),
        )


backtest_engine = BacktestEngine()
