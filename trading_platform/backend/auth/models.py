"""
Authentication, User Roles, Sessions, and Security Schemas.
"""

from enum import Enum
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, EmailStr, Field
import datetime
import uuid


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    PORTFOLIO_MANAGER = "PORTFOLIO_MANAGER"
    TRADER = "TRADER"
    INVESTOR = "INVESTOR"
    VIEWER = "VIEWER"


class InvestmentMode(str, Enum):
    AUTONOMOUS_TRADING = "AUTONOMOUS_TRADING"  # Intraday, Scalping, High-frequency multi-agent debate
    LONG_TERM_WEALTH = "LONG_TERM_WEALTH"      # SIP, Value Investing, Dividend compounders, Thematic baskets


class User(BaseModel):
    user_id: str = Field(default_factory=lambda: f"USR-{uuid.uuid4().hex[:8].upper()}")
    username: str
    email: str
    role: UserRole = UserRole.TRADER
    investment_mode: InvestmentMode = InvestmentMode.AUTONOMOUS_TRADING
    is_active: bool = True
    totp_enabled: bool = False
    inr_portfolio_id: Optional[str] = None
    usd_portfolio_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[UserRole] = UserRole.TRADER
    investment_mode: Optional[InvestmentMode] = InvestmentMode.AUTONOMOUS_TRADING


class UserLogin(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: User


class TokenData(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = None


class BrokerKeyItem(BaseModel):
    broker_name: str  # Zerodha, Angel One, Upstox, Dhan, OANDA
    api_key_masked: str
    secret_masked: str
    is_connected: bool = True
    environment: str = "LIVE"
    last_synced: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class BrokerKeyInput(BaseModel):
    broker_name: str
    api_key: str
    api_secret: Optional[str] = ""
    client_code: Optional[str] = None
    pin: Optional[str] = None
    totp_secret: Optional[str] = None
    account_id: Optional[str] = None
    environment: Optional[str] = "LIVE"
    extra_token: Optional[str] = None


class AuditLogEntry(BaseModel):
    log_id: str = Field(default_factory=lambda: f"AUD-{uuid.uuid4().hex[:8].upper()}")
    user_id: str
    username: str
    action: str  # "LOGIN", "EXECUTE_TRADE", "UPDATE_KEY", "SWITCH_MODE", "SUBMIT_SIP"
    resource: str
    status: str = "SUCCESS"  # "SUCCESS", "REJECTED_BY_GOVERNOR", "ERROR"
    ip_address: Optional[str] = "127.0.0.1"
    details: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
