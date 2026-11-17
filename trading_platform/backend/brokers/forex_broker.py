"""
Global Forex Broker Adapter (OANDA v20 / MetaTrader 5 Gateway / CCXT).
Supports major and minor currency pairs (EUR/USD, GBP/USD, USD/INR, USD/JPY),
pip value accounting, spread crossing, institutional margin leverage, and execution.
"""

from typing import Dict, List, Optional, Any
import uuid
import datetime
from .base import (
    AbstractBroker,
    Order,
    Position,
    Quote,
    OrderSide,
    OrderType,
    OrderStatus,
    AssetClass,
    OrderResult,
)


class ForexBrokerAdapter(AbstractBroker):
    """
    Adapter for Global FX currency trading.
    Standardized to OANDA REST v20 / MT5 protocols with pip calculation and leverage.
    """

    # Typical institutional spreads in pips
    TYPICAL_SPREADS = {
        "EUR/USD": 0.00010,  # 1.0 pip
        "GBP/USD": 0.00015,  # 1.5 pips
        "USD/INR": 0.015,    # 1.5 paise
        "USD/JPY": 0.012,    # 1.2 pips
        "AUD/USD": 0.00014,  # 1.4 pips
        "USD/CAD": 0.00016,  # 1.6 pips
    }

    def __init__(
        self,
        broker_name: str = "OANDA v20 / MT5 (Simulated/Live)",
        initial_balance_usd: float = 25_000.0,  # $25,000 institutional FX paper capital
        leverage: float = 30.0,  # 1:30 regulatory leverage
        api_key: Optional[str] = None,
        account_id: Optional[str] = None,
    ):
        super().__init__(broker_name=broker_name, asset_class=AssetClass.FOREX, currency="USD")
        self.api_key = api_key
        self.account_id = account_id
        self.leverage = leverage
        self.cash = initial_balance_usd
        self.margin_used = 0.0
        self.positions: Dict[str, Position] = {}
        self.orders: List[Order] = []
        self.quotes: Dict[str, Quote] = {}
        self.connect()

    def connect(self) -> bool:
        self.is_connected = True
        return True

    def disconnect(self) -> None:
        self.is_connected = False

    def update_quote(self, quote: Quote) -> None:
        self.quotes[quote.symbol] = quote
        if quote.symbol in self.positions:
            pos = self.positions[quote.symbol]
            pos.current_price = quote.last_price
            # Valuation in USD
            diff = quote.last_price - pos.entry_price if pos.quantity > 0 else pos.entry_price - quote.last_price
            # If quote currency is USD (e.g. EUR/USD), diff * units is USD
            # If base currency is USD (e.g. USD/JPY, USD/INR), diff / current_price * units is USD
            if quote.symbol.endswith("/USD"):
                pnl = diff * abs(pos.quantity)
            elif quote.symbol.startswith("USD/"):
                pnl = (diff / quote.last_price) * abs(pos.quantity) if quote.last_price > 0 else 0.0
            else:
                pnl = diff * abs(pos.quantity)
            pos.unrealized_pnl = round(pnl, 2)

    def get_pip_size(self, symbol: str) -> float:
        if "JPY" in symbol or "INR" in symbol:
            return 0.01
        return 0.0001

    def get_balance(self) -> Dict[str, float]:
        unrealized_total = sum(p.unrealized_pnl for p in self.positions.values())
        total_equity = self.cash + unrealized_total
        margin_avail = max(0.0, total_equity - self.margin_used)

        return {
            "cash": round(self.cash, 2),
            "margin_used": round(self.margin_used, 2),
            "margin_available": round(margin_avail, 2),
            "unrealized_pnl": round(unrealized_total, 2),
            "total_equity": round(total_equity, 2),
            "leverage": self.leverage,
            "currency": "USD",
        }

    def get_positions(self) -> List[Position]:
        return list(self.positions.values())

    def get_orders(self) -> List[Order]:
        return list(self.orders)

    def place_order(
        self,
        symbol: str,
        side: OrderSide,
        order_type: OrderType,
        quantity: float,  # units (e.g. 10,000 for 1 mini lot)
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = "AUTONOMOUS_FX",
    ) -> OrderResult:
        if quantity <= 0:
            return OrderResult(success=False, message="Order quantity must be positive")

        symbol = symbol.upper()
        current_quote = self.quotes.get(symbol)
        spread = self.TYPICAL_SPREADS.get(symbol, 0.00015)

        if current_quote:
            exec_price = current_quote.ask if side == OrderSide.BUY else current_quote.bid
        else:
            base_p = price if price and price > 0 else 1.0850
            exec_price = base_p + (spread / 2) if side == OrderSide.BUY else base_p - (spread / 2)

        # Pip rounding
        decimals = 3 if ("JPY" in symbol or "INR" in symbol) else 5
        exec_price = round(exec_price, decimals)

        # Notional value in USD
        if symbol.endswith("/USD"):
            notional_usd = exec_price * quantity
        elif symbol.startswith("USD/"):
            notional_usd = quantity
        else:
            notional_usd = exec_price * quantity

        required_margin = notional_usd / self.leverage
        # Commission: $3.50 per 100k standard lot
        commission = round((quantity / 100_000.0) * 3.50, 2)
        total_equity = self.cash + sum(p.unrealized_pnl for p in self.positions.values())
        avail_margin = total_equity - self.margin_used

        order_id = f"FX-{uuid.uuid4().hex[:8].upper()}"
        order = Order(
            order_id=order_id,
            symbol=symbol,
            asset_class=AssetClass.FOREX,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=exec_price,
            status=OrderStatus.FILLED,
            filled_quantity=quantity,
            avg_fill_price=exec_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            fee=commission,
            slippage=round(spread * quantity * 0.2, 2),
            tag=tag,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )

        if avail_margin < (required_margin + commission):
            order.status = OrderStatus.REJECTED
            order.rejection_reason = f"Margin call: required ${required_margin:.2f}, available ${avail_margin:.2f}"
            self.orders.append(order)
            return OrderResult(success=False, order=order, message=order.rejection_reason)

        # Execute
        self.cash -= commission
        self.margin_used += required_margin

        signed_qty = quantity if side == OrderSide.BUY else -quantity
        if symbol in self.positions:
            pos = self.positions[symbol]
            # If same direction, accumulate
            if (pos.quantity > 0 and signed_qty > 0) or (pos.quantity < 0 and signed_qty < 0):
                new_qty = pos.quantity + signed_qty
                pos.entry_price = round(((pos.entry_price * abs(pos.quantity)) + (exec_price * quantity)) / abs(new_qty), decimals)
                pos.quantity = new_qty
            else:
                # Opposite direction: reduce or flip
                closing_qty = min(abs(pos.quantity), quantity)
                # Compute realized PnL on closing portion
                pnl_per_unit = (exec_price - pos.entry_price) if pos.quantity > 0 else (pos.entry_price - exec_price)
                if symbol.endswith("/USD"):
                    realized = pnl_per_unit * closing_qty
                else:
                    realized = (pnl_per_unit / exec_price) * closing_qty if exec_price > 0 else 0.0

                self.cash += realized
                pos.realized_pnl += round(realized, 2)
                self.margin_used = max(0.0, self.margin_used - (closing_qty * (pos.entry_price / self.leverage)))

                if abs(pos.quantity) == quantity:
                    del self.positions[symbol]
                elif abs(pos.quantity) > quantity:
                    pos.quantity = pos.quantity - signed_qty
                else:
                    # Flipped direction
                    remaining = quantity - abs(pos.quantity)
                    pos.quantity = remaining if signed_qty > 0 else -remaining
                    pos.entry_price = exec_price
        else:
            self.positions[symbol] = Position(
                symbol=symbol,
                asset_class=AssetClass.FOREX,
                quantity=signed_qty,
                entry_price=exec_price,
                current_price=exec_price,
                unrealized_pnl=0.0,
                currency="USD",
                stop_loss=stop_loss,
                take_profit=take_profit,
            )

        self.orders.append(order)
        return OrderResult(success=True, order=order, message=f"Executed {side} {quantity:,.0f} {symbol} at {exec_price}")

    def cancel_order(self, order_id: str) -> bool:
        for o in self.orders:
            if o.order_id == order_id and o.status == OrderStatus.PENDING:
                o.status = OrderStatus.CANCELLED
                return True
        return False

    def get_quote(self, symbol: str) -> Optional[Quote]:
        return self.quotes.get(symbol.upper())

    def get_historical_bars(
        self, symbol: str, timeframe: str = "1m", count: int = 100
    ) -> List[Dict[str, Any]]:
        return []
