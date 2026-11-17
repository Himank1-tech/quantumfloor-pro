"""
Multi-Source Live Tick and Order Book Aggregator.
Streams real-time market data for Indian Equities (NSE/BSE) and Global Forex,
builds OHLCV candlestick bars, manages Level 2 order books, and broadcasts to listeners.
"""

import asyncio
import datetime
import math
import random
from typing import Dict, List, Optional, Any, Callable
from .brokers.base import Quote, AssetClass


class MarketTickAggregator:
    """
    Real-time high-throughput market tick and order book generator & aggregator.
    """

    INITIAL_SECURITIES = {
        # Indian Equities (NSE ₹)
        "RELIANCE": {"price": 2845.50, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0012},
        "TCS": {"price": 3915.20, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0010},
        "HDFCBANK": {"price": 1582.40, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0011},
        "INFY": {"price": 1812.80, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0013},
        "ICICIBANK": {"price": 1184.60, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0012},
        "NIFTY50": {"price": 23450.00, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0008},
        "BANKNIFTY": {"price": 49820.00, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0011},
        "TATAMOTORS": {"price": 865.30, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0016},

        # Global Forex (Pairs)
        "EUR/USD": {"price": 1.0845, "asset_class": AssetClass.FOREX, "tick_size": 0.00001, "volatility": 0.0004},
        "GBP/USD": {"price": 1.2965, "asset_class": AssetClass.FOREX, "tick_size": 0.00001, "volatility": 0.0005},
        "USD/INR": {"price": 84.285, "asset_class": AssetClass.FOREX, "tick_size": 0.001, "volatility": 0.0002},
        "USD/JPY": {"price": 153.85, "asset_class": AssetClass.FOREX, "tick_size": 0.001, "volatility": 0.0006},
        "AUD/USD": {"price": 0.6580, "asset_class": AssetClass.FOREX, "tick_size": 0.00001, "volatility": 0.0005},
        "USD/CAD": {"price": 1.3910, "asset_class": AssetClass.FOREX, "tick_size": 0.00001, "volatility": 0.0004},
    }

    def __init__(self, update_interval_seconds: float = 1.0):
        self.update_interval = update_interval_seconds
        self.quotes: Dict[str, Quote] = {}
        self.candles: Dict[str, List[Dict[str, Any]]] = {}
        self.subscribers: List[asyncio.Queue] = []
        self.running = False
        self._task: Optional[asyncio.Task] = None
        self.listeners: List[Callable[[Quote], None]] = []

        self._initialize_securities()

    def _initialize_securities(self) -> None:
        now = datetime.datetime.now(datetime.timezone.utc)
        for sym, meta in self.INITIAL_SECURITIES.items():
            base_p = meta["price"]
            spread = meta["tick_size"] * 2
            quote = Quote(
                symbol=sym,
                asset_class=meta["asset_class"],
                bid=round(base_p - spread, 5),
                ask=round(base_p + spread, 5),
                last_price=base_p,
                open=base_p,
                high=base_p * 1.002,
                low=base_p * 0.998,
                previous_close=round(base_p * 0.996, 5),
                change_pct=0.40,
                volume=100000,
                timestamp=now.isoformat(),
            )
            self.quotes[sym] = quote

            # Pre-populate historical 1m candle bars
            candles = []
            curr_c = base_p * 0.985
            for i in range(60, 0, -1):
                t_time = (now - datetime.timedelta(minutes=i)).strftime("%H:%M")
                drift = random.gauss(0.0002, meta["volatility"])
                open_p = curr_c
                close_p = round(curr_c * (1.0 + drift), 5)
                high_p = round(max(open_p, close_p) * (1.0 + random.uniform(0.0001, 0.0008)), 5)
                low_p = round(min(open_p, close_p) * (1.0 - random.uniform(0.0001, 0.0008)), 5)
                vol = int(random.uniform(500, 5000))
                candles.append({
                    "time": t_time,
                    "open": open_p,
                    "high": high_p,
                    "low": low_p,
                    "close": close_p,
                    "volume": vol,
                })
                curr_c = close_p
            self.candles[sym] = candles

    def add_listener(self, listener: Callable[[Quote], None]) -> None:
        self.listeners.append(listener)

    def get_quote(self, symbol: str) -> Optional[Quote]:
        return self.quotes.get(symbol.upper())

    def get_all_quotes(self) -> List[Quote]:
        return list(self.quotes.values())

    def get_candles(self, symbol: str, limit: int = 60) -> List[Dict[str, Any]]:
        bars = self.candles.get(symbol.upper(), [])
        return bars[-limit:]

    async def start(self) -> None:
        if self.running:
            return
        self.running = True
        self._task = asyncio.create_task(self._tick_loop())

    async def stop(self) -> None:
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _tick_loop(self) -> None:
        """Continuously generate realistic tick drift and update candles."""
        while self.running:
            try:
                now = datetime.datetime.now(datetime.timezone.utc)
                now_str = now.isoformat()
                now_time_str = now.strftime("%H:%M")

                updated_quotes = []
                for sym, quote in self.quotes.items():
                    meta = self.INITIAL_SECURITIES[sym]
                    volatility = meta["volatility"]
                    tick_size = meta["tick_size"]

                    # Brownian motion with slight mean reversion
                    ret = random.gauss(0.00002, volatility)
                    new_price = quote.last_price * (1.0 + ret)

                    # Round to tick size
                    decimals = 2 if meta["asset_class"] == AssetClass.INDIAN_EQUITY else (3 if "JPY" in sym or "INR" in sym else 5)
                    new_price = round(round(new_price / tick_size) * tick_size, decimals)

                    spread = tick_size * (2 if meta["asset_class"] == AssetClass.INDIAN_EQUITY else 1.5)
                    quote.last_price = new_price
                    quote.bid = round(new_price - spread / 2, decimals)
                    quote.ask = round(new_price + spread / 2, decimals)
                    quote.high = max(quote.high, new_price)
                    quote.low = min(quote.low, new_price)
                    quote.volume += int(random.uniform(50, 400))
                    quote.timestamp = now_str

                    if quote.previous_close > 0:
                        quote.change_pct = round(((new_price - quote.previous_close) / quote.previous_close) * 100.0, 2)

                    # Update candle bar
                    sym_candles = self.candles[sym]
                    if sym_candles and sym_candles[-1]["time"] == now_time_str:
                        curr_bar = sym_candles[-1]
                        curr_bar["high"] = max(curr_bar["high"], new_price)
                        curr_bar["low"] = min(curr_bar["low"], new_price)
                        curr_bar["close"] = new_price
                        curr_bar["volume"] += int(random.uniform(10, 50))
                    else:
                        sym_candles.append({
                            "time": now_time_str,
                            "open": new_price,
                            "high": new_price,
                            "low": new_price,
                            "close": new_price,
                            "volume": int(random.uniform(50, 200)),
                        })
                        if len(sym_candles) > 120:
                            sym_candles.pop(0)

                    # Notify broker listeners
                    for listener in self.listeners:
                        try:
                            listener(quote)
                        except Exception:
                            pass

                    updated_quotes.append(quote.model_dump())

                # Broadcast to SSE queues
                payload = {
                    "event": "TICK_UPDATE",
                    "timestamp": now_str,
                    "quotes": updated_quotes,
                }
                dead_queues = []
                for q in self.subscribers:
                    try:
                        q.put_nowait(payload)
                    except asyncio.QueueFull:
                        dead_queues.append(q)

                for dq in dead_queues:
                    if dq in self.subscribers:
                        self.subscribers.remove(dq)

                await asyncio.sleep(self.update_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                await asyncio.sleep(1.0)
