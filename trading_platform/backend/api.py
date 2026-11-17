"""
Institutional FastAPI Application.
Exposes REST endpoints, Server-Sent Events (SSE) telemetry streaming,
CORS middleware, and multi-agent coordination routes.
"""

from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Any
import asyncio
import json
import datetime
import uuid
import secrets
import urllib.parse
import numpy as np
import httpx

from fastapi import FastAPI, HTTPException, Query, Body, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse, RedirectResponse
from sqlalchemy import text
from .storage import storage_client

from .analytics.quant import compute_portfolio_quant_metrics
from .brokers.base import OrderSide, OrderType, AssetClass
from .brokers.indian_broker import IndianBrokerAdapter
from .brokers.forex_broker import ForexBrokerAdapter
from .brokers.zerodha_adapter import ZerodhaKiteAdapter
from .brokers.groww_adapter import GrowwTradeAdapter
from .brokers.angelone_adapter import AngelOneSmartAPIAdapter
from .brokers.oanda_adapter import OandaV20Adapter
from .brokers.metatrader_adapter import MetaTraderMetaApiAdapter
from .risk.governor import RiskGovernor, CircuitBreakerState
from .agents.mcp_servers import TradingMCPServer
from .agents.floor_manager import FloorManager
from .accounts import MultiCurrencyLedger
from .database import Database
from .market import MarketTickAggregator
from .auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    verify_access_token,
)
from .auth.models import (
    UserRole,
    InvestmentMode,
    UserCreate,
    UserLogin,
    BrokerKeyInput,
)
from .ipo.scraper import IPOScraper
from .ipo.analyzer import IPOAnalyzer
from .advisory.grounded_engine import GroundedAdvisoryEngine
from .advisory.signal_validator import SignalValidator
from .investors.basket_manager import BasketManager
from .market_data.live_feed import live_market_feed
from .market_data.historical import historical_candle_loader
from .smc.structure import detect_market_structure
from .smc.liquidity import detect_liquidity_and_poi
from .smc.fibonacci import calculate_auto_fibonacci
from .smc.candlesticks import detect_candlestick_patterns
from .smc.mtf_confluence import synthesize_mtf_setup
from .macro.sessions import get_session_status
from .macro.news_calendar import get_economic_calendar
from .execution.position_calculator import calculate_position_size, PositionInput
from .copilot.ai_advisor_chat import get_copilot_response, AICopilotRequest
from .backtest.replay_engine import backtest_engine, BacktestRequest
from .investors.wealth_baskets import wealth_baskets_engine


# Initialize platform singletons
db = Database()
market = MarketTickAggregator(update_interval_seconds=1.0)
indian_broker = IndianBrokerAdapter()
forex_broker = ForexBrokerAdapter()
accounts = MultiCurrencyLedger(initial_inr=1_000_000.0, initial_usd=25_000.0)
risk_governor = RiskGovernor()
mcp_server = TradingMCPServer(market_aggregator=market, accounts_manager=accounts)
floor_manager = FloorManager(
    mcp_server=mcp_server,
    risk_governor=risk_governor,
    indian_broker=indian_broker,
    forex_broker=forex_broker,
    database=db,
)

# New Enterprise Modules
ipo_scraper = IPOScraper()
ipo_analyzer = IPOAnalyzer()
advisory_engine = GroundedAdvisoryEngine(market_aggregator=market)
signal_validator = SignalValidator(min_risk_reward=2.0)
basket_manager = BasketManager(indian_broker=indian_broker, forex_broker=forex_broker)

# Connect market quotes to brokers
market.add_listener(lambda q: indian_broker.update_quote(q) if q.asset_class == AssetClass.INDIAN_EQUITY else forex_broker.update_quote(q))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start market tick loop and background agent cycles
    await market.start()
    agent_task = asyncio.create_task(background_agent_loop())
    snapshot_task = asyncio.create_task(background_snapshot_loop())
    yield
    # Shutdown
    agent_task.cancel()
    snapshot_task.cancel()
    await market.stop()


app = FastAPI(
    title="Autonomous Trading Floor API",
    description="Multi-Agent Institutional Trading Floor for Indian Equities & Global Forex",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend Vite dev server (Port 5173 / Port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def background_agent_loop():
    """Background cycle periodically conducting debates across Indian & Forex assets."""
    symbols = ["RELIANCE", "EUR/USD", "TCS", "USD/INR", "HDFCBANK", "GBP/USD", "TATAMOTORS", "USD/JPY"]
    idx = 0
    await asyncio.sleep(5)  # initial delay
    while True:
        try:
            if floor_manager.is_auto_trading_enabled:
                sym = symbols[idx % len(symbols)]
                idx += 1
                debate = floor_manager.conduct_debate(sym)
                # Check circuit breaker
                summary = accounts.get_unified_summary(
                    inr_broker_balance=indian_broker.get_balance(),
                    forex_broker_balance=forex_broker.get_balance(),
                )
                risk_governor.update_portfolio_state(
                    current_nav=summary["total_nav_inr"],
                    daily_pnl_pct=summary["daily_pnl_pct"],
                    total_drawdown_pct=summary["current_drawdown_pct"],
                )
            await asyncio.sleep(12)  # Debate cycle every 12 seconds
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(5)


async def background_snapshot_loop():
    """Periodic portfolio equity snapshot for quant curves."""
    while True:
        try:
            summary = accounts.get_unified_summary(
                inr_broker_balance=indian_broker.get_balance(),
                forex_broker_balance=forex_broker.get_balance(),
            )
            db.record_snapshot(summary)
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(10)


# ==================== REST ROUTES ====================

@app.get("/api/health")
def get_health():
    db_connected = db.is_connected()
    storage_ok = storage_client.is_configured()
    return {
        "status": "ok",
        "database": "connected" if db_connected else "disconnected",
        "storage": "connected" if storage_ok else "ready",
        "realtime": "enabled",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "circuit_breaker": risk_governor.circuit_breaker_state.value,
        "auto_trading": floor_manager.is_auto_trading_enabled,
        "disclaimer": "Paper Trading & Educational Analytics Only — Not SEBI/SEC Registered Financial Advice",
    }


@app.get("/api/market/quotes")
async def get_quotes():
    # Return real live synchronized quotes from the new live market feed
    return await live_market_feed.get_all_quotes()


@app.get("/api/market/live-quotes")
async def get_live_quotes():
    return await live_market_feed.get_all_quotes()


@app.get("/api/market/quote/{symbol}")
async def get_single_quote(symbol: str):
    try:
        return await live_market_feed.fetch_real_quote(symbol)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/market/candles")
async def get_candles(
    symbol: str = Query(..., description="Ticker symbol"),
    timeframe: str = Query("15M", description="Timeframe: 5M, 15M, 1H, 4H, 1D"),
    limit: int = 100
):
    try:
        return await historical_candle_loader.get_candles(symbol, timeframe=timeframe, limit=limit)
    except Exception as e:
        return market.get_candles(symbol, limit=limit)


@app.get("/api/market/orderbook")
def get_orderbook(symbol: str = Query(..., description="Ticker symbol")):
    return mcp_server.get_order_book_depth(symbol)


@app.get("/api/market/technicals")
def get_technicals(symbol: str = Query(...), timeframe: str = "1m"):
    return mcp_server.get_technical_indicators(symbol, timeframe)


@app.get("/api/accounts/summary")
def get_account_summary():
    return accounts.get_unified_summary(
        inr_broker_balance=indian_broker.get_balance(),
        forex_broker_balance=forex_broker.get_balance(),
    )


@app.get("/api/accounts/ledger")
def get_ledger(limit: int = 50):
    return accounts.get_ledger_history(limit=limit)


@app.get("/api/positions")
def get_positions():
    inr_pos = indian_broker.get_positions()
    fx_pos = forex_broker.get_positions()
    return {
        "indian_equities": [p.model_dump() for p in inr_pos],
        "forex": [p.model_dump() for p in fx_pos],
        "total_active_positions": len(inr_pos) + len(fx_pos),
    }


@app.get("/api/orders")
def get_orders():
    inr_ord = indian_broker.get_orders()
    fx_ord = forex_broker.get_orders()
    all_orders = [o.model_dump() for o in inr_ord + fx_ord]
    all_orders.sort(key=lambda x: x["created_at"], reverse=True)
    return all_orders


@app.get("/api/trades")
def get_trades(limit: int = 50):
    return db.get_trades(limit=limit)


@app.get("/api/risk/metrics")
def get_risk_metrics():
    return risk_governor.get_status()


@app.post("/api/risk/validate")
def validate_trade_proposal(data: Dict[str, Any] = Body(...)):
    summary = accounts.get_unified_summary(
        inr_broker_balance=indian_broker.get_balance(),
        forex_broker_balance=forex_broker.get_balance(),
    )
    result = risk_governor.validate_trade_proposal(
        symbol=data.get("symbol", "RELIANCE"),
        asset_class=data.get("asset_class", "INDIAN_EQUITY"),
        side=data.get("side", "BUY"),
        proposed_quantity=float(data.get("quantity", 10)),
        price=float(data.get("price", 1000.0)),
        total_portfolio_nav=summary["total_nav_inr"],
        current_asset_exposure=0.0,
        stop_loss=data.get("stop_loss"),
        take_profit=data.get("take_profit"),
    )
    return result.model_dump()


@app.post("/api/risk/reset-circuit-breaker")
def reset_circuit_breaker():
    risk_governor.reset_circuit_breaker()
    return {"status": "SUCCESS", "circuit_breaker_state": risk_governor.circuit_breaker_state.value}


@app.get("/api/agents/debates")
def get_debates(limit: int = 20, symbol: Optional[str] = Query(None)):
    if symbol:
        clean_sym = symbol.strip().upper()
        debate = floor_manager.get_debate_for_symbol(clean_sym)
        return [debate.model_dump()]
    recent = floor_manager.get_recent_debates(limit=limit)
    if not recent:
        recent = db.get_debates(limit=limit)
    return recent


@app.post("/api/agents/run-cycle")
def run_debate_cycle(data: Dict[str, Any] = Body(...)):
    symbol = data.get("symbol", "RELIANCE")
    force = data.get("force_execute", False)
    debate = floor_manager.conduct_debate(symbol=symbol, force_execute=force)
    return debate.model_dump()


@app.post("/api/system/toggle-auto-trade")
def toggle_auto_trade(data: Dict[str, Any] = Body(...)):
    enabled = data.get("enabled", True)
    floor_manager.set_auto_trading(enabled)
    return {"auto_trading_enabled": floor_manager.is_auto_trading_enabled}


@app.get("/api/analytics/quant")
def get_quant_analytics():
    snapshots = db.get_equity_curve(limit=100)
    trades = db.get_trades(limit=50)

    if snapshots and len(snapshots) > 1:
        equity_curve = [s["total_nav_inr"] for s in snapshots]
        returns = [s["daily_return_pct"] / 100.0 for s in snapshots]
    else:
        # Fallback baseline
        equity_curve = [3000000.0, 3012000.0, 3025000.0]
        returns = [0.004, 0.0043]

    metrics = compute_portfolio_quant_metrics(
        equity_curve=equity_curve,
        returns=returns,
        trades=trades,
        risk_free_rate=0.065,  # 6.5% Indian benchmark
    )
    metrics["equity_series"] = snapshots
    return metrics


@app.post("/api/manual/order")
def place_manual_order(request: Request, data: Dict[str, Any] = Body(...)):
    user = get_current_user_from_request(request)
    symbol = data.get("symbol", "").upper()
    side_str = data.get("side", "BUY").upper()
    side = OrderSide.BUY if side_str == "BUY" else OrderSide.SELL
    quantity = float(data.get("quantity", 0))
    price = float(data.get("price", 0))
    stop_loss = data.get("stop_loss")
    take_profit = data.get("take_profit")
    execution_mode = data.get("execution_mode", "PAPER").upper()
    asset_class = "INDIAN_EQUITY" if "/" not in symbol else "FOREX"

    summary = accounts.get_unified_summary(
        inr_broker_balance=indian_broker.get_balance(),
        forex_broker_balance=forex_broker.get_balance(),
    )

    # 1. Deterministic Pre-Trade Risk Governor Validation
    risk_eval = risk_governor.validate_trade_proposal(
        symbol=symbol,
        asset_class=asset_class,
        side=side_str,
        proposed_quantity=quantity,
        price=price,
        total_portfolio_nav=summary["total_nav_inr"],
        current_asset_exposure=0.0,
        stop_loss=stop_loss,
        take_profit=take_profit,
    )

    if not risk_eval.approved:
        raise HTTPException(
            status_code=400,
            detail={"message": "Order rejected by Risk Governor", "audit": risk_eval.audit_trail},
        )

    exec_qty = risk_eval.approved_quantity
    live_broker_result = None

    # 2. Live Broker Routing (if LIVE execution toggle is active)
    if execution_mode == "LIVE":
        vault_keys = db.get_user_broker_keys(user["user_id"])
        if asset_class == "INDIAN_EQUITY":
            broker_found = None
            for bk in vault_keys:
                bname = bk.get("broker_name", "").lower()
                if any(x in bname for x in ["zerodha", "groww", "angel"]):
                    broker_found = bk.get("broker_name")
                    break

            if broker_found:
                creds = db.get_user_decrypted_broker_key(user["user_id"], broker_found) or {}
                bname_l = broker_found.lower()
                if "zerodha" in bname_l:
                    z_adapter = ZerodhaKiteAdapter(api_key=creds.get("api_key", ""), api_secret=creds.get("api_secret", ""))
                    live_broker_result = z_adapter.place_order(symbol=symbol, transaction_type=side_str, quantity=int(exec_qty), price=price)
                elif "groww" in bname_l:
                    g_adapter = GrowwTradeAdapter(api_key=creds.get("api_key", ""), api_secret=creds.get("api_secret", ""))
                    live_broker_result = g_adapter.place_order(symbol=symbol, transaction_type=side_str, quantity=int(exec_qty), price=price)
                elif "angel" in bname_l:
                    a_adapter = AngelOneSmartAPIAdapter(api_key=creds.get("api_key", ""), client_code=creds.get("client_code", ""), pin=creds.get("pin", ""))
                    live_broker_result = a_adapter.place_order(tradingsymbol=symbol, symboltoken="3045", transactiontype=side_str, quantity=int(exec_qty), price=price)
            else:
                raise HTTPException(status_code=400, detail="LIVE execution requested, but no Indian broker (Zerodha, Groww, Angel One) is configured in your Vault. Please add credentials under Account -> Vault.")
        else:
            broker_found = None
            for bk in vault_keys:
                bname = bk.get("broker_name", "").lower()
                if any(x in bname for x in ["oanda", "metatrader", "metaapi"]):
                    broker_found = bk.get("broker_name")
                    break

            if broker_found:
                creds = db.get_user_decrypted_broker_key(user["user_id"], broker_found) or {}
                bname_l = broker_found.lower()
                if "oanda" in bname_l:
                    o_adapter = OandaV20Adapter(api_token=creds.get("api_key", ""), account_id=creds.get("account_id", ""), environment=creds.get("environment", "LIVE"))
                    live_broker_result = o_adapter.create_order(instrument=symbol.replace("/", "_"), units=exec_qty, stop_loss=stop_loss, take_profit=take_profit)
                elif "metatrader" in bname_l:
                    m_adapter = MetaTraderMetaApiAdapter(api_token=creds.get("api_key", ""), account_id=creds.get("account_id", ""))
                    action = "ORDER_TYPE_BUY" if side_str == "BUY" else "ORDER_TYPE_SELL"
                    live_broker_result = m_adapter.execute_trade(symbol=symbol.replace("/", ""), action_type=action, volume=exec_qty / 100000.0, stop_loss=stop_loss, take_profit=take_profit)
            else:
                raise HTTPException(status_code=400, detail="LIVE execution requested, but no Forex broker (OANDA, MetaTrader) is configured in your Vault. Please add credentials under Account -> Vault.")

        db.record_audit_log({
            "log_id": f"AUD-LIVE-{uuid.uuid4().hex[:6].upper()}",
            "user_id": user["user_id"],
            "username": user["username"],
            "action": "LIVE_BROKER_EXECUTION",
            "resource": "REAL_EXCHANGE_GATEWAY",
            "status": "SUCCESS",
            "details": {"symbol": symbol, "side": side_str, "qty": exec_qty, "broker_response": live_broker_result},
        })

    # 3. Execution Engine Dispatch (Simulated Paper Ledger)
    if asset_class == "INDIAN_EQUITY":
        res = indian_broker.place_order(
            symbol=symbol,
            side=side,
            order_type=OrderType.MARKET,
            quantity=exec_qty,
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            tag=f"MANUAL_{execution_mode}",
        )
    else:
        res = forex_broker.place_order(
            symbol=symbol,
            side=side,
            order_type=OrderType.MARKET,
            quantity=exec_qty,
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            tag=f"MANUAL_{execution_mode}",
        )

    if not res.success:
        raise HTTPException(status_code=400, detail=res.message)

    return {
        "success": True,
        "execution_mode": execution_mode,
        "order": res.order.model_dump() if res.order else None,
        "risk_governor": risk_eval.model_dump(),
        "live_broker_result": live_broker_result,
    }


# ==================== ENTERPRISE AUTH & RBAC ROUTES ====================

def get_current_user_from_request(request: Request) -> Dict[str, Any]:
    """Helper to extract user from Authorization header or fallback to default admin."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        token_data = verify_access_token(token)
        if token_data and token_data.username:
            user = db.get_user_by_username(token_data.username)
            if user:
                return user
    # Fallback to default active user
    admin = db.get_user_by_username("admin")
    return admin or {"user_id": "USR-ADMIN-01", "username": "admin", "role": "ADMIN", "investment_mode": "LONG_TERM_WEALTH"}


@app.post("/api/auth/register")
def register_user(data: UserCreate = Body(...)):
    existing = db.get_user_by_username(data.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    user_id = f"USR-{data.username.upper()[:4]}-{datetime.datetime.now().strftime('%M%S')}"
    pwd_hash = hash_password(data.password)
    user = db.create_user(
        user_id=user_id,
        username=data.username,
        email=data.email,
        password_hash=pwd_hash,
        role=data.role.value if data.role else "TRADER",
        mode=data.investment_mode.value if data.investment_mode else "AUTONOMOUS_TRADING",
    )

    db.record_audit_log({
        "log_id": f"AUD-REG-{uuid.uuid4().hex[:6].upper()}",
        "user_id": user_id,
        "username": data.username,
        "action": "USER_REGISTRATION",
        "resource": "AUTH_SYSTEM",
        "status": "SUCCESS",
        "details": {"role": user["role"], "email": data.email},
    })

    token = create_access_token({"sub": user["user_id"], "username": user["username"], "role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "investment_mode": user["investment_mode"],
        },
    }


@app.post("/api/auth/login")
def login_user(data: UserLogin = Body(...)):
    user = db.get_user_by_username(data.username)
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password credentials")

    token = create_access_token({"sub": user["user_id"], "username": user["username"], "role": user["role"]})

    db.record_audit_log({
        "log_id": f"AUD-LOG-{uuid.uuid4().hex[:6].upper()}",
        "user_id": user["user_id"],
        "username": user["username"],
        "action": "USER_LOGIN",
        "resource": "SECURITY_GATE",
        "status": "SUCCESS",
        "details": {"role": user["role"]},
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_minutes": 1440,
        "user": {
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "investment_mode": user["investment_mode"],
            "totp_enabled": bool(user["totp_enabled"]),
        },
    }


@app.get("/api/auth/me")
def get_current_user_profile(request: Request):
    user = get_current_user_from_request(request)
    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "email": user.get("email", f"{user['username']}@quantumfloor.institutional"),
        "role": user.get("role", "TRADER"),
        "investment_mode": user.get("investment_mode", "AUTONOMOUS_TRADING"),
        "totp_enabled": bool(user.get("totp_enabled", False)),
    }


@app.post("/api/auth/switch-mode")
@app.post("/api/auth/mode")
def switch_investment_mode(request: Request, data: Dict[str, Any] = Body(...)):
    user = get_current_user_from_request(request)
    new_mode = data.get("investment_mode") or data.get("mode") or "AUTONOMOUS_TRADING"
    if new_mode not in ("AUTONOMOUS_TRADING", "LONG_TERM_WEALTH"):
        raise HTTPException(status_code=400, detail="Invalid investment mode")

    db.update_user_mode(user["user_id"], new_mode)
    db.record_audit_log({
        "log_id": f"AUD-MOD-{uuid.uuid4().hex[:6].upper()}",
        "user_id": user["user_id"],
        "username": user["username"],
        "action": "SWITCH_INVESTMENT_MODE",
        "resource": "PORTFOLIO_CORE",
        "status": "SUCCESS",
        "details": {"new_mode": new_mode},
    })
    return {"status": "SUCCESS", "investment_mode": new_mode}


@app.get("/api/auth/vault/keys")
def get_vault_keys(request: Request):
    user = get_current_user_from_request(request)
    keys = db.get_user_broker_keys(user["user_id"])
    return keys


@app.post("/api/auth/vault/keys")
def save_vault_key(request: Request, data: BrokerKeyInput = Body(...)):
    user = get_current_user_from_request(request)
    secret_payload: Dict[str, Any] = {
        "api_secret": data.api_secret or "",
    }
    if data.client_code:
        secret_payload["client_code"] = data.client_code
    if data.pin:
        secret_payload["pin"] = data.pin
    if data.totp_secret:
        secret_payload["totp_secret"] = data.totp_secret
    if data.account_id:
        secret_payload["account_id"] = data.account_id
    if data.extra_token:
        secret_payload["extra_token"] = data.extra_token

    env = (data.environment or "LIVE").upper()

    db.save_encrypted_broker_key(
        user_id=user["user_id"],
        broker_name=data.broker_name,
        plain_api_key=data.api_key,
        plain_secret=secret_payload,
        environment=env,
    )
    db.record_audit_log({
        "log_id": f"AUD-KEY-{uuid.uuid4().hex[:6].upper()}",
        "user_id": user["user_id"],
        "username": user["username"],
        "action": "UPDATE_BROKER_KEY_VAULT",
        "resource": "FERNET_VAULT",
        "status": "SUCCESS",
        "details": {"broker": data.broker_name, "environment": env},
    })
    return {
        "status": "SUCCESS",
        "broker_name": data.broker_name,
        "message": f"Credentials for {data.broker_name} securely encrypted with Fernet AES-128 and vaulted."
    }


@app.post("/api/brokers/verify")
def verify_broker_credentials(request: Request, data: Dict[str, Any] = Body(...)):
    """
    Decrypts user's stored credentials from broker_vault (or validates newly provided credentials),
    executes live API handshake against the real broker, and returns live status and balances.
    """
    user = get_current_user_from_request(request)
    broker_name = data.get("broker_name", "")
    if not broker_name:
        raise HTTPException(status_code=400, detail="broker_name is required")

    api_key = data.get("api_key")
    api_secret = data.get("api_secret", "")
    client_code = data.get("client_code")
    pin = data.get("pin")
    totp_secret = data.get("totp_secret")
    account_id = data.get("account_id")
    environment = data.get("environment", "LIVE")

    if not api_key:
        stored = db.get_user_decrypted_broker_key(user["user_id"], broker_name)
        if stored:
            api_key = stored.get("api_key", "")
            api_secret = stored.get("api_secret", "")
            client_code = stored.get("client_code")
            pin = stored.get("pin")
            totp_secret = stored.get("totp_secret")
            account_id = stored.get("account_id")
            environment = stored.get("environment", "LIVE")

    bname_lower = broker_name.lower()
    adapter = None
    if "zerodha" in bname_lower or "kite" in bname_lower:
        adapter = ZerodhaKiteAdapter(api_key=api_key or "", api_secret=api_secret or "", user_id=user["user_id"])
    elif "groww" in bname_lower:
        adapter = GrowwTradeAdapter(api_key=api_key or "", api_secret=api_secret or "", totp_secret=totp_secret or "", user_id=user["user_id"])
    elif "angel" in bname_lower or "smartapi" in bname_lower:
        adapter = AngelOneSmartAPIAdapter(api_key=api_key or "", client_code=client_code or "", pin=pin or "", totp_secret=totp_secret or "", user_id=user["user_id"])
    elif "oanda" in bname_lower:
        adapter = OandaV20Adapter(api_token=api_key or "", account_id=account_id or "", environment=environment, user_id=user["user_id"])
    elif "metatrader" in bname_lower or "metaapi" in bname_lower or "mt4" in bname_lower or "mt5" in bname_lower:
        adapter = MetaTraderMetaApiAdapter(api_token=api_key or "", account_id=account_id or "", platform=environment, user_id=user["user_id"])
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported broker: {broker_name}")

    result = adapter.verify_connection()
    is_connected = result.get("success", False)
    db.update_broker_connection_status(user["user_id"], broker_name, is_connected)

    db.record_audit_log({
        "log_id": f"AUD-VERIFY-{uuid.uuid4().hex[:6].upper()}",
        "user_id": user["user_id"],
        "username": user["username"],
        "action": "VERIFY_BROKER_CONNECTION",
        "resource": "BROKER_ADAPTER",
        "status": "SUCCESS" if is_connected else "FAILED",
        "details": {"broker": broker_name, "connected": is_connected, "result": result},
    })
    return result


@app.get("/api/audit/logs")
def get_audit_trail(limit: int = 50):
    return db.get_audit_logs(limit=limit)


# ==================== IPO INTELLIGENCE ROUTES ====================

@app.get("/api/ipo/all")
@app.get("/api/ipo")
@app.get("/api/ipo/list")
def get_all_ipos(status: Optional[str] = None):
    return ipo_scraper.get_all_ipos(status=status)


@app.get("/api/ipo/{ipo_id}")
def get_ipo_details(ipo_id: str):
    ipo = ipo_scraper.get_ipo_by_id(ipo_id)
    if not ipo:
        raise HTTPException(status_code=404, detail="IPO not found")
    return ipo


@app.get("/api/ipo/{ipo_id}/analysis")
def get_ipo_analysis(ipo_id: str):
    ipo = ipo_scraper.get_ipo_by_id(ipo_id)
    if not ipo:
        raise HTTPException(status_code=404, detail="IPO not found")
    report = ipo_analyzer.analyze_ipo(ipo)
    return report.model_dump()


# ==================== GROUNDED AI ADVISORY ROUTES ====================

@app.get("/api/advisory/signals")
def get_advisory_signals(symbol: Optional[str] = None, horizon: Optional[str] = None):
    signals = advisory_engine.get_signals(symbol=symbol, horizon=horizon)
    return [s.model_dump() for s in signals]


@app.get("/api/advisory/signals/{signal_id}")
def get_advisory_signal_detail(signal_id: str):
    signal = advisory_engine.get_signal_by_id(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Advisory signal not found")
    validation = signal_validator.validate_signal(signal)
    res = signal.model_dump()
    res["validation_result"] = validation.model_dump()
    return res


@app.post("/api/advisory/validate-custom")
def validate_custom_signal(signal_data: Dict[str, Any] = Body(...)):
    try:
        from .advisory.grounded_engine import GroundedAdviceSignal
        sig = GroundedAdviceSignal(**signal_data)
        val = signal_validator.validate_signal(sig)
        return val.model_dump()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== LONG-TERM WEALTH & THEMATIC BASKETS ====================

@app.get("/api/baskets")
def get_baskets():
    return [b.model_dump() for b in basket_manager.get_all_baskets()]


@app.get("/api/baskets/{basket_id}")
def get_basket_detail(basket_id: str):
    basket = basket_manager.get_basket_by_id(basket_id)
    if not basket:
        raise HTTPException(status_code=404, detail="Basket not found")
    return basket.model_dump()


@app.post("/api/baskets/{basket_id}/invest")
def invest_in_basket(request: Request, basket_id: str, data: Dict[str, Any] = Body(...)):
    user = get_current_user_from_request(request)
    amount = float(data.get("amount", 25000.0))

    try:
        record = basket_manager.execute_basket_investment(
            basket_id=basket_id,
            user_id=user["user_id"],
            amount=amount,
        )
        db.record_sip_execution(record.model_dump())
        db.record_audit_log({
            "log_id": f"AUD-SIP-{uuid.uuid4().hex[:6].upper()}",
            "user_id": user["user_id"],
            "username": user["username"],
            "action": "EXECUTE_THEMATIC_SIP",
            "resource": f"BASKET:{basket_id}",
            "status": "SUCCESS",
            "details": {"amount": amount, "shares": record.allocated_shares},
        })
        return {
            "success": True,
            "execution": record.model_dump(),
            "message": f"Successfully allocated ₹{amount:,.2f} across basket constituents.",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/baskets/history/sip")
def get_sip_history():
    return db.get_sip_executions(limit=50)


# ==================== SMART MONEY CONCEPTS (SMC) & MTF ====================

@app.get("/api/smc/analysis")
async def get_smc_analysis(
    symbol: str = Query(..., description="Ticker symbol"),
    timeframe: str = Query("15M", description="5M, 15M, 1H, 4H")
):
    candles = await historical_candle_loader.get_candles(symbol, timeframe=timeframe, limit=100)
    struct = detect_market_structure(candles, pivot_depth=3)
    poi = detect_liquidity_and_poi(candles)
    fib = calculate_auto_fibonacci(candles, struct.swing_highs, struct.swing_lows, active_trend=struct.active_trend)
    patterns = detect_candlestick_patterns(candles)

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "current_price": candles[-1].close if candles else 0.0,
        "structure": struct.model_dump(),
        "poi": poi.model_dump(),
        "fibonacci": fib.model_dump(),
        "candlestick_patterns": [p.model_dump() for p in patterns[-8:]],
    }


@app.get("/api/smc/mtf-setup")
async def get_mtf_setup(symbol: str = Query(..., description="Ticker symbol")):
    report = await synthesize_mtf_setup(symbol)
    return report.model_dump()


# ==================== MACRO SESSIONS & ECONOMIC CALENDAR ====================

@app.get("/api/macro/sessions")
def get_macro_sessions():
    return get_session_status().model_dump()


@app.get("/api/macro/news")
def get_macro_economic_news():
    return get_economic_calendar().model_dump()


# ==================== UNIVERSAL POSITION & PIP CALCULATOR ====================

@app.post("/api/execution/calculate-position")
def calculate_execution_position(inp: PositionInput):
    return calculate_position_size(inp).model_dump()


# ==================== INTERACTIVE AI CO-PILOT ====================

@app.post("/api/copilot/chat")
async def chat_with_copilot(req: AICopilotRequest):
    res = await get_copilot_response(req)
    return res.model_dump()


# ==================== WEALTH & SIP PROJECTIONS ====================

@app.get("/api/wealth/sip-projection")
def get_sip_projection(
    basket_id: str = Query("BSK-NIFTY-COMPOUNDERS"),
    monthly_amount: float = Query(10000.0),
    years: int = Query(10)
):
    return wealth_baskets_engine.calculate_sip_projection(
        basket_id=basket_id,
        monthly_amount=monthly_amount,
        years=years
    ).model_dump()


# ==================== HISTORICAL BACKTESTING & REPLAY ====================

@app.post("/api/backtest/run")
async def run_strategy_backtest(req: BacktestRequest):
    report = await backtest_engine.run_backtest(req)
    return report.model_dump()


@app.get("/api/backtest/replay-step")
async def get_replay_step(
    symbol: str = Query("RELIANCE"),
    timeframe: str = Query("15M"),
    step_index: int = Query(30)
):
    step = await backtest_engine.get_replay_step(symbol=symbol, timeframe=timeframe, step_index=step_index)
    return step.model_dump()


# ==================== NEON OBJECT STORAGE & EXPORT ROUTES ====================

@app.post("/api/storage/export-blotter")
def export_trade_blotter_report():
    """Generates CSV trade blotter and uploads it directly to Neon Object Storage bucket."""
    trades = db.get_trades(limit=100)
    result = storage_client.export_trade_blotter(trades)
    return result


@app.post("/api/storage/export-backtest")
def export_backtest_report_endpoint(data: Dict[str, Any] = Body(...)):
    """Uploads Backtest Lab performance results to Neon Object Storage."""
    result = storage_client.export_backtest_report(data)
    return result


@app.post("/api/storage/export-payoff")
def export_payoff_snapshot_endpoint(data: Dict[str, Any] = Body(...)):
    """Uploads F&O Strategy Payoff Matrix snapshot to Neon Object Storage."""
    result = storage_client.export_payoff_snapshot(data)
    return result


@app.get("/api/storage/reports")
def list_storage_reports(prefix: str = Query("")):
    """Lists generated report artifacts in Neon Object Storage with presigned download URLs."""
    return storage_client.list_reports(prefix=prefix)


# ==================== REAL GOOGLE OAUTH 2.0 AUTHENTICATION ====================

_oauth_states: Dict[str, float] = {}

@app.get("/api/auth/oauth/google")
def google_oauth_redirect(request: Request):
    """
    Initiates genuine Google OAuth 2.0 authorization redirect.
    Redirects with HTTP 302 directly to https://accounts.google.com/o/oauth2/v2/auth.
    """
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "https://quantumfloor-pro.onrender.com/api/auth/callback/google")

    # Prune expired states (> 10 mins)
    now_ts = datetime.datetime.now().timestamp()
    for s, exp in list(_oauth_states.items()):
        if exp < now_ts:
            _oauth_states.pop(s, None)

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = now_ts + 600.0

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account"
    }
    google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=google_auth_url, status_code=302)


@app.get("/api/auth/callback/google")
async def google_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None)
):
    """
    Exchanges Google authorization code for access_token, fetches verified profile
    from Google OAuth2 userinfo, synchronizes with PostgreSQL, and issues signed JWT.
    """
    if error or not code:
        err_msg = error or "Authorization code missing from Google callback"
        return RedirectResponse(url=f"/?auth_error={urllib.parse.quote(err_msg)}", status_code=302)

    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "https://quantumfloor-pro.onrender.com/api/auth/callback/google")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"}
            )
            token_data = token_resp.json()
            if token_resp.status_code != 200 or "access_token" not in token_data:
                err_detail = token_data.get("error_description", token_data.get("error", "Token exchange failed"))
                return RedirectResponse(url=f"/?auth_error={urllib.parse.quote(err_detail)}", status_code=302)

            access_token = token_data["access_token"]
            userinfo_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            userinfo = userinfo_resp.json()
            if userinfo_resp.status_code != 200 or "email" not in userinfo:
                return RedirectResponse(url="/?auth_error=Failed+to+retrieve+Google+userinfo", status_code=302)

            email = userinfo["email"]
            name = userinfo.get("name") or email.split("@")[0]
            picture = userinfo.get("picture", "")

            # Idempotent upsert into PostgreSQL (users, user, account, portfolios)
            qf_user = db.upsert_oauth_user(email=email, name=name, picture=picture, provider="google")

            # Immutable security audit log
            db.record_audit_log({
                "log_id": f"AUD-GOOG-{uuid.uuid4().hex[:6].upper()}",
                "user_id": qf_user["user_id"],
                "username": qf_user["username"],
                "action": "GOOGLE_OAUTH_LOGIN",
                "resource": "GOOGLE_IDENTITY",
                "status": "SUCCESS",
                "details": {"email": email, "name": name},
            })

            # Issue 24-hour signed JWT access token
            jwt_token = create_access_token({
                "sub": qf_user["user_id"],
                "username": qf_user["username"],
                "role": qf_user["role"]
            })

            redirect_target = f"/?auth_token={jwt_token}&email={urllib.parse.quote(email)}&name={urllib.parse.quote(name)}"
            return RedirectResponse(url=redirect_target, status_code=302)
    except Exception as e:
        return RedirectResponse(url=f"/?auth_error={urllib.parse.quote(str(e))}", status_code=302)


# ==================== WEBSOCKET REALTIME STREAM ====================

@app.websocket("/api/ws/realtime")
async def websocket_realtime_endpoint(websocket: WebSocket):
    """
    Neon Realtime WebSocket bridge streaming live trade blotters,
    order fills, and AI agent debates with sub-millisecond latency.
    """
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue(maxsize=50)
    market.subscribers.append(queue)
    try:
        await websocket.send_json({
            "event": "CONNECTED",
            "provider": "neon-realtime",
            "neon_realtime_url": os.getenv("NEON_REALTIME_URL", ""),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        while True:
            data = await queue.get()
            await websocket.send_json(data)
    except WebSocketDisconnect:
        pass
    finally:
        if queue in market.subscribers:
            market.subscribers.remove(queue)


# ==================== SSE TELEMETRY STREAM ====================

@app.get("/api/stream/telemetry")
async def stream_telemetry(request: Request):
    """
    High-frequency SSE streaming of market ticks, agent debates, and risk governor state.
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=30)
    market.subscribers.append(queue)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=2.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat / ping
                    ping = {
                        "event": "HEARTBEAT",
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "circuit_breaker": risk_governor.circuit_breaker_state.value,
                    }
                    yield f"data: {json.dumps(ping)}\n\n"
        finally:
            if queue in market.subscribers:
                market.subscribers.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Mount Frontend Static Assets & SPA Fallback if built
import os
from starlette.staticfiles import StaticFiles
from starlette.responses import FileResponse

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str):
        # Preserve 404 for unhandled API calls
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Index file not found")


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("trading_platform.backend.api:app", host=host, port=port, reload=False)

