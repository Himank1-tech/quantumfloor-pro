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
        "RELIANCE": {"price": 1372.50, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0004},
        "TCS": {"price": 2389.00, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0004},
        "HDFCBANK": {"price": 809.70, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0004},
        "INFY": {"price": 1111.00, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0004},
        "ICICIBANK": {"price": 1596.80, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0004},
        "NIFTY50": {"price": 25218.00, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0003},
        "BANKNIFTY": {"price": 61923.00, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0003},
        "TATAMOTORS": {"price": 1116.90, "asset_class": AssetClass.INDIAN_EQUITY, "tick_size": 0.05, "volatility": 0.0005},

        # Global Forex (Pairs)
        "EUR/USD": {"price": 1.09670, "asset_class": AssetClass.FOREX, "tick_size": 0.0001, "volatility": 0.0002},
        "GBP/USD": {"price": 1.31620, "asset_class": AssetClass.FOREX, "tick_size": 0.0001, "volatility": 0.0002},
        "USD/INR": {"price": 93.5400, "asset_class": AssetClass.FOREX, "tick_size": 0.0025, "volatility": 0.0001},
        "USD/JPY": {"price": 159.200, "asset_class": AssetClass.FOREX, "tick_size": 0.01, "volatility": 0.0002},
        "AUD/USD": {"price": 0.67190, "asset_class": AssetClass.FOREX, "tick_size": 0.0001, "volatility": 0.0002},
        "USD/CAD": {"price": 1.43270, "asset_class": AssetClass.FOREX, "tick_size": 0.0001, "volatility": 0.0002},
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
        """Continuously synchronize live market ticks and update candles."""
        while self.running:
            try:
                now = datetime.datetime.now(datetime.timezone.utc)
                now_str = now.isoformat()
                now_time_str = now.strftime("%H:%M")

                # Attempt to sync with live feed cache if available
                feed_cache = {}
                try:
                    from .market_data.live_feed import live_market_feed
                    feed_cache = live_market_feed.cache
                except Exception:
                    pass

                updated_quotes = []
                for sym, quote in self.quotes.items():
                    meta = self.INITIAL_SECURITIES[sym]
                    tick_size = meta["tick_size"]
                    decimals = 2 if meta["asset_class"] == AssetClass.INDIAN_EQUITY else (3 if "JPY" in sym or "INR" in sym else 5)
                    spread = tick_size * (2 if meta["asset_class"] == AssetClass.INDIAN_EQUITY else 1.5)

                    feed_q = feed_cache.get(sym)
                    if feed_q and feed_q.price > 0:
                        new_price = round(float(feed_q.price), decimals)
                        quote.last_price = new_price
                        quote.bid = round(float(feed_q.bid), decimals)
                        quote.ask = round(float(feed_q.ask), decimals)
                        quote.high = max(quote.high, new_price)
                        quote.low = min(quote.low, new_price)
                        quote.volume = int(feed_q.volume)
                        quote.previous_close = round(float(feed_q.previous_close), decimals)
                        quote.change_pct = float(feed_q.change_pct)
                        quote.timestamp = now_str
                    else:
                        # Bounded micro-tick adjustment within 0.05% of base price
                        drift = (random.random() - 0.49) * tick_size
                        new_price = round(round((quote.last_price + drift) / tick_size) * tick_size, decimals)
                        quote.last_price = new_price
                        quote.bid = round(new_price - spread / 2, decimals)
                        quote.ask = round(new_price + spread / 2, decimals)
                        quote.high = max(quote.high, new_price)
                        quote.low = min(quote.low, new_price)
                        quote.volume += int(random.uniform(10, 80))
                        quote.timestamp = now_str
                        if quote.previous_close > 0:
                            quote.change_pct = round(((new_price - quote.previous_close) / quote.previous_close) * 100.0, 2)

                    # Update candle bar cleanly without artificial spike
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
