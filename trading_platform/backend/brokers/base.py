"""
Abstract Base Broker Interface and Common Data Models.
Standardizes order execution, position tracking, and quote retrieval across Indian and FX brokers.
"""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import datetime


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP_LOSS = "STOP_LOSS"
    TAKE_PROFIT = "TAKE_PROFIT"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class AssetClass(str, Enum):
    INDIAN_EQUITY = "INDIAN_EQUITY"
    FOREX = "FOREX"


class Quote(BaseModel):
    symbol: str
    asset_class: AssetClass
    bid: float
    ask: float
    last_price: float
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    previous_close: float = 0.0
    change_pct: float = 0.0
    volume: float = 0.0
    timestamp: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class Position(BaseModel):
    symbol: str
    asset_class: AssetClass
    quantity: float
    entry_price: float
    current_price: float
    unrealized_pnl: float
    realized_pnl: float = 0.0
    currency: str  # "INR" or "USD"
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    opened_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class Order(BaseModel):
    order_id: str
    symbol: str
    asset_class: AssetClass
    side: OrderSide
    order_type: OrderType
    quantity: float
    price: float
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: float = 0.0
    avg_fill_price: float = 0.0
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    fee: float = 0.0
    slippage: float = 0.0
    tag: str = "AUTONOMOUS_AGENT"
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    rejection_reason: Optional[str] = None


class OrderResult(BaseModel):
    success: bool
    order: Optional[Order] = None
    message: str = ""
    error_code: Optional[str] = None


class AbstractBroker(ABC):
    """
    Abstract interface for broker execution adapters.
    """

    def __init__(self, broker_name: str, asset_class: AssetClass, currency: str):
        self.broker_name = broker_name
        self.asset_class = asset_class
        self.currency = currency
        self.is_connected = False

    @abstractmethod
    def connect(self) -> bool:
        """Connect to broker API or simulation session."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Disconnect and cleanup session."""
        pass

    @abstractmethod
    def get_balance(self) -> Dict[str, float]:
        """
        Return dictionary of balances:
        {'cash': float, 'margin_used': float, 'margin_available': float, 'total_equity': float}
        """
        pass

    @abstractmethod
    def get_positions(self) -> List[Position]:
        """Return list of active open positions."""
        pass

    @abstractmethod
    def get_orders(self) -> List[Order]:
        """Return list of historical and pending orders."""
        pass

    @abstractmethod
    def place_order(
        self,
        symbol: str,
        side: OrderSide,
        order_type: OrderType,
        quantity: float,
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = "MANUAL",
    ) -> OrderResult:
        """Submit an order to the market/broker."""
        pass

    @abstractmethod
    def cancel_order(self, order_id: str) -> bool:
        """Cancel a pending order."""
        pass

    @abstractmethod
    def get_quote(self, symbol: str) -> Optional[Quote]:
        """Fetch current bid, ask, last price."""
        pass

    @abstractmethod
    def get_historical_bars(
        self, symbol: str, timeframe: str = "1m", count: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch OHLCV candlestick bars."""
        pass
