"""
Institutional Database Persistence Layer.
Supports high-performance Neon PostgreSQL (with SSL, connection pooling, and pre-ping validation)
with seamless local SQLite WAL fallback.
Stores orders, trades, equity curve snapshots, agent debates, broker credentials vault,
IPO applications, wealth SIP executions, and enterprise audit logs.
"""

import os
import json
import datetime
import logging
from typing import Dict, List, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from .auth.security import hash_password, encrypt_secret, decrypt_secret, mask_secret

logger = logging.getLogger("quantumfloor.database")

DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "trading_floor.db"))


class Database:
    """
    Enterprise persistence engine supporting Neon PostgreSQL and SQLite.
    Includes pool_pre_ping health checks, connection pooling, and automated schema migrations.
    """

    def __init__(self, db_url: Optional[str] = None):
        raw_url = db_url or os.environ.get("DATABASE_URL")
        
        if raw_url and raw_url.strip():
            url = raw_url.strip()
            # Standardize postgres protocol
            if url.startswith("postgres://"):
                url = "postgresql://" + url[len("postgres://"):]
            if url.startswith("postgresql://") and not url.startswith("postgresql+psycopg2://"):
                url = "postgresql+psycopg2://" + url[len("postgresql://"):]
            
            # Ensure SSL mode for remote cloud Postgres (Neon)
            connect_args = {}
            if "sslmode" not in url:
                connect_args["sslmode"] = "require"
            
            self.is_postgres = True
            self.db_url = url
            self.engine: Engine = create_engine(
                self.db_url,
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20,
                pool_recycle=300,
                connect_args=connect_args,
            )
            logger.info("Database initialized with PostgreSQL connection pool (pool_pre_ping=True).")
        else:
            self.is_postgres = False
            clean_path = DB_FILE.replace("\\", "/")
            self.db_url = f"sqlite:///{clean_path}"
            self.engine: Engine = create_engine(
                self.db_url,
                pool_pre_ping=True,
                connect_args={"check_same_thread": False},
            )
            # Enable WAL mode for SQLite
            try:
                with self.engine.begin() as conn:
                    conn.execute(text("PRAGMA journal_mode=WAL;"))
                    conn.execute(text("PRAGMA synchronous=NORMAL;"))
            except Exception as e:
                logger.warning(f"Failed to set SQLite PRAGMA: {e}")
            logger.info(f"Database initialized with SQLite fallback ({DB_FILE}).")

        self._init_db()
        self._seed_historical_analytics()
        self._seed_default_users()

    def is_connected(self) -> bool:
        """Verify database connectivity with active ping."""
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1;"))
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    def _init_db(self) -> None:
        """Create all institutional production tables across Postgres or SQLite."""
        id_type = "SERIAL PRIMARY KEY" if self.is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
        real_type = "DOUBLE PRECISION" if self.is_postgres else "REAL"

        ddl_statements = [
            # 1. Users
            """CREATE TABLE IF NOT EXISTS users (
                user_id VARCHAR(64) PRIMARY KEY,
                username VARCHAR(64) UNIQUE NOT NULL,
                email VARCHAR(128) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'TRADER',
                investment_mode VARCHAR(64) NOT NULL DEFAULT 'AUTONOMOUS_TRADING',
                totp_enabled INTEGER DEFAULT 0,
                created_at VARCHAR(64) NOT NULL
            );""",

            # 2. Portfolios
            f"""CREATE TABLE IF NOT EXISTS portfolios (
                portfolio_id VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                name VARCHAR(128) NOT NULL,
                currency VARCHAR(10) DEFAULT 'INR',
                total_value {real_type} DEFAULT 0.0,
                cash_balance {real_type} DEFAULT 0.0,
                updated_at VARCHAR(64) NOT NULL
            );""",

            # 3. Holdings
            f"""CREATE TABLE IF NOT EXISTS holdings (
                holding_id VARCHAR(64) PRIMARY KEY,
                portfolio_id VARCHAR(64) NOT NULL,
                symbol VARCHAR(32) NOT NULL,
                asset_class VARCHAR(32) NOT NULL,
                quantity {real_type} NOT NULL,
                avg_buy_price {real_type} NOT NULL,
                current_price {real_type} DEFAULT 0.0,
                unrealized_pnl {real_type} DEFAULT 0.0,
                updated_at VARCHAR(64) NOT NULL
            );""",

            # 4. Orders
            f"""CREATE TABLE IF NOT EXISTS orders (
                order_id VARCHAR(64) PRIMARY KEY,
                symbol VARCHAR(32) NOT NULL,
                asset_class VARCHAR(32) NOT NULL,
                side VARCHAR(16) NOT NULL,
                order_type VARCHAR(32) NOT NULL,
                quantity {real_type} NOT NULL,
                price {real_type} NOT NULL,
                status VARCHAR(32) NOT NULL,
                avg_fill_price {real_type},
                fee {real_type},
                slippage {real_type},
                tag VARCHAR(64),
                created_at VARCHAR(64) NOT NULL,
                rejection_reason TEXT
            );""",

            # 5. Trades & Trade History
            f"""CREATE TABLE IF NOT EXISTS trades (
                trade_id VARCHAR(64) PRIMARY KEY,
                order_id VARCHAR(64),
                symbol VARCHAR(32) NOT NULL,
                asset_class VARCHAR(32) NOT NULL,
                side VARCHAR(16) NOT NULL,
                quantity {real_type} NOT NULL,
                price {real_type} NOT NULL,
                pnl {real_type} DEFAULT 0.0,
                fee {real_type} DEFAULT 0.0,
                slippage {real_type} DEFAULT 0.0,
                timestamp VARCHAR(64) NOT NULL
            );""",

            f"""CREATE TABLE IF NOT EXISTS trade_history (
                trade_id VARCHAR(64) PRIMARY KEY,
                order_id VARCHAR(64),
                symbol VARCHAR(32) NOT NULL,
                asset_class VARCHAR(32) NOT NULL,
                side VARCHAR(16) NOT NULL,
                quantity {real_type} NOT NULL,
                price {real_type} NOT NULL,
                pnl {real_type} DEFAULT 0.0,
                fee {real_type} DEFAULT 0.0,
                slippage {real_type} DEFAULT 0.0,
                timestamp VARCHAR(64) NOT NULL
            );""",

            # 6. Broker Vault & Encrypted Keys
            f"""CREATE TABLE IF NOT EXISTS encrypted_keys (
                id {id_type},
                user_id VARCHAR(64) NOT NULL,
                broker_name VARCHAR(64) NOT NULL,
                encrypted_api_key TEXT NOT NULL,
                encrypted_secret TEXT NOT NULL,
                api_key_masked VARCHAR(64) NOT NULL,
                secret_masked VARCHAR(64) NOT NULL,
                is_connected INTEGER DEFAULT 1,
                environment VARCHAR(32) DEFAULT 'LIVE',
                updated_at VARCHAR(64) NOT NULL,
                UNIQUE(user_id, broker_name)
            );""",

            f"""CREATE TABLE IF NOT EXISTS broker_vault (
                id {id_type},
                user_id VARCHAR(64) NOT NULL,
                broker_name VARCHAR(64) NOT NULL,
                encrypted_api_key TEXT NOT NULL,
                encrypted_secret TEXT NOT NULL,
                api_key_masked VARCHAR(64) NOT NULL,
                secret_masked VARCHAR(64) NOT NULL,
                is_connected INTEGER DEFAULT 1,
                environment VARCHAR(32) DEFAULT 'LIVE',
                updated_at VARCHAR(64) NOT NULL,
                UNIQUE(user_id, broker_name)
            );""",

            # 7. IPO Applications
            f"""CREATE TABLE IF NOT EXISTS ipo_applications (
                application_id VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                ipo_symbol VARCHAR(64) NOT NULL,
                company_name VARCHAR(128),
                lot_size INTEGER,
                bid_price {real_type},
                total_amount {real_type},
                upi_id VARCHAR(128),
                status VARCHAR(32) DEFAULT 'APPLIED',
                applied_at VARCHAR(64) NOT NULL
            );""",

            # 8. Wealth SIPs & Baskets SIP
            f"""CREATE TABLE IF NOT EXISTS baskets_sip (
                execution_id VARCHAR(64) PRIMARY KEY,
                basket_id VARCHAR(64) NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                amount_invested {real_type} NOT NULL,
                allocated_shares_json TEXT NOT NULL,
                timestamp VARCHAR(64) NOT NULL,
                status VARCHAR(32) NOT NULL
            );""",

            f"""CREATE TABLE IF NOT EXISTS wealth_sips (
                execution_id VARCHAR(64) PRIMARY KEY,
                basket_id VARCHAR(64) NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                amount_invested {real_type} NOT NULL,
                allocated_shares_json TEXT NOT NULL,
                timestamp VARCHAR(64) NOT NULL,
                status VARCHAR(32) NOT NULL
            );""",

            # 9. Audit Logs
            """CREATE TABLE IF NOT EXISTS audit_logs (
                log_id VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                username VARCHAR(64) NOT NULL,
                action VARCHAR(64) NOT NULL,
                resource VARCHAR(64) NOT NULL,
                status VARCHAR(32) NOT NULL,
                ip_address VARCHAR(64),
                details_json TEXT,
                timestamp VARCHAR(64) NOT NULL
            );""",

            # 10. Equity Snapshots
            f"""CREATE TABLE IF NOT EXISTS equity_snapshots (
                id {id_type},
                timestamp VARCHAR(64) NOT NULL,
                total_nav_inr {real_type} NOT NULL,
                total_nav_usd {real_type} NOT NULL,
                inr_equity {real_type} NOT NULL,
                usd_equity {real_type} NOT NULL,
                drawdown_pct {real_type} NOT NULL,
                daily_return_pct {real_type} NOT NULL
            );""",

            # 11. Agent Debates
            f"""CREATE TABLE IF NOT EXISTS agent_debates (
                debate_id VARCHAR(64) PRIMARY KEY,
                symbol VARCHAR(32) NOT NULL,
                asset_class VARCHAR(32) NOT NULL,
                timestamp VARCHAR(64) NOT NULL,
                consensus_score {real_type} NOT NULL,
                signal VARCHAR(32) NOT NULL,
                action VARCHAR(32) NOT NULL,
                confidence_pct {real_type} NOT NULL,
                current_price {real_type} NOT NULL,
                recommended_entry {real_type} NOT NULL,
                stop_loss {real_type} NOT NULL,
                take_profit {real_type} NOT NULL,
                risk_reward_ratio {real_type} NOT NULL,
                proposed_quantity {real_type} NOT NULL,
                bull_thesis_json TEXT NOT NULL,
                bear_thesis_json TEXT NOT NULL,
                rationale TEXT NOT NULL,
                risk_assessment_json TEXT,
                execution_result_json TEXT
            );""",

            # 12. Risk Events
            f"""CREATE TABLE IF NOT EXISTS risk_events (
                id {id_type},
                timestamp VARCHAR(64) NOT NULL,
                event_type VARCHAR(64) NOT NULL,
                details TEXT NOT NULL,
                state VARCHAR(32) NOT NULL
            );"""
        ]

        with self.engine.begin() as conn:
            for stmt in ddl_statements:
                conn.execute(text(stmt))

    def _seed_historical_analytics(self) -> None:
        """Seed 60 days of realistic institutional equity curve if empty."""
        with self.engine.connect() as conn:
            res = conn.execute(text("SELECT COUNT(*) as cnt FROM equity_snapshots")).mappings().fetchone()
            count = res["cnt"] if res else 0
            if count > 0:
                return

        now = datetime.datetime.now(datetime.timezone.utc)
        base_inr = 2_800_000.0  # ₹28 Lakhs NAV starting point
        current_inr = base_inr
        peak_inr = base_inr
        usd_rate = 84.00

        daily_returns = [
            0.004, 0.008, -0.003, 0.006, 0.002, -0.005, 0.009, 0.003, -0.002, 0.007,
            0.005, -0.008, -0.004, 0.003, 0.012, 0.001, -0.006, 0.008, 0.005, 0.002,
            -0.009, -0.007, 0.004, 0.011, 0.006, -0.002, 0.008, 0.003, 0.005, -0.004,
            0.007, 0.002, -0.003, 0.010, 0.004, -0.005, 0.006, 0.008, -0.002, 0.009,
            -0.012, 0.005, 0.007, 0.003, -0.004, 0.008, 0.006, 0.002, -0.003, 0.009,
            0.004, -0.006, 0.007, 0.005, 0.003, -0.002, 0.008, 0.004, 0.006, 0.003
        ]

        with self.engine.begin() as conn:
            for i, r in enumerate(daily_returns):
                dt = (now - datetime.timedelta(days=(60 - i))).isoformat()
                current_inr *= (1.0 + r)
                if current_inr > peak_inr:
                    peak_inr = current_inr
                dd_pct = ((peak_inr - current_inr) / peak_inr) * 100.0
                current_usd = current_inr / usd_rate
                inr_portion = current_inr * 0.52
                usd_portion = current_usd * 0.48

                conn.execute(
                    text("""
                        INSERT INTO equity_snapshots (timestamp, total_nav_inr, total_nav_usd, inr_equity, usd_equity, drawdown_pct, daily_return_pct)
                        VALUES (:ts, :nav_inr, :nav_usd, :inr_eq, :usd_eq, :dd, :ret)
                    """),
                    {
                        "ts": dt,
                        "nav_inr": round(current_inr, 2),
                        "nav_usd": round(current_usd, 2),
                        "inr_eq": round(inr_portion, 2),
                        "usd_eq": round(usd_portion, 2),
                        "dd": round(dd_pct, 2),
                        "ret": round(r * 100.0, 3),
                    }
                )

            # Sample historical trades
            sample_trades = [
                ("TR-001", "ORD-001", "RELIANCE", "INDIAN_EQUITY", "BUY", 100.0, 2740.50, 4200.0, 45.0, 5.0, (now - datetime.timedelta(days=12)).isoformat()),
                ("TR-002", "ORD-002", "EUR/USD", "FOREX", "BUY", 20000.0, 1.0820, 280.0, 7.0, 1.2, (now - datetime.timedelta(days=10)).isoformat()),
                ("TR-003", "ORD-003", "TCS", "INDIAN_EQUITY", "BUY", 50.0, 3890.0, -1850.0, 38.0, 4.0, (now - datetime.timedelta(days=9)).isoformat()),
                ("TR-004", "ORD-004", "USD/JPY", "FOREX", "SELL", 30000.0, 154.20, 410.0, 10.5, 2.0, (now - datetime.timedelta(days=7)).isoformat()),
                ("TR-005", "ORD-005", "HDFCBANK", "INDIAN_EQUITY", "BUY", 120.0, 1580.0, 3960.0, 42.0, 6.0, (now - datetime.timedelta(days=5)).isoformat()),
                ("TR-006", "ORD-006", "GBP/USD", "FOREX", "BUY", 15000.0, 1.2950, -165.0, 5.2, 1.5, (now - datetime.timedelta(days=4)).isoformat()),
                ("TR-007", "ORD-007", "INFY", "INDIAN_EQUITY", "BUY", 80.0, 1795.0, 2520.0, 32.0, 3.5, (now - datetime.timedelta(days=2)).isoformat()),
                ("TR-008", "ORD-008", "USD/INR", "FOREX", "BUY", 50000.0, 84.10, 180.0, 8.0, 1.0, (now - datetime.timedelta(days=1)).isoformat()),
            ]

            for tr in sample_trades:
                trade_params = {
                    "trade_id": tr[0], "order_id": tr[1], "symbol": tr[2], "asset_class": tr[3],
                    "side": tr[4], "quantity": tr[5], "price": tr[6], "pnl": tr[7],
                    "fee": tr[8], "slippage": tr[9], "timestamp": tr[10]
                }
                if self.is_postgres:
                    conn.execute(
                        text("""
                            INSERT INTO trades (trade_id, order_id, symbol, asset_class, side, quantity, price, pnl, fee, slippage, timestamp)
                            VALUES (:trade_id, :order_id, :symbol, :asset_class, :side, :quantity, :price, :pnl, :fee, :slippage, :timestamp)
                            ON CONFLICT (trade_id) DO NOTHING;
                            INSERT INTO trade_history (trade_id, order_id, symbol, asset_class, side, quantity, price, pnl, fee, slippage, timestamp)
                            VALUES (:trade_id, :order_id, :symbol, :asset_class, :side, :quantity, :price, :pnl, :fee, :slippage, :timestamp)
                            ON CONFLICT (trade_id) DO NOTHING;
                        """),
                        trade_params
                    )
                else:
                    conn.execute(
                        text("""
                            INSERT OR REPLACE INTO trades (trade_id, order_id, symbol, asset_class, side, quantity, price, pnl, fee, slippage, timestamp)
                            VALUES (:trade_id, :order_id, :symbol, :asset_class, :side, :quantity, :price, :pnl, :fee, :slippage, :timestamp);
                            INSERT OR REPLACE INTO trade_history (trade_id, order_id, symbol, asset_class, side, quantity, price, pnl, fee, slippage, timestamp)
                            VALUES (:trade_id, :order_id, :symbol, :asset_class, :side, :quantity, :price, :pnl, :fee, :slippage, :timestamp);
                        """),
                        trade_params
                    )

    def _seed_default_users(self) -> None:
        """Seed default admin and trader credentials and vault keys if not present."""
        with self.engine.connect() as conn:
            res = conn.execute(text("SELECT COUNT(*) as c FROM users")).mappings().fetchone()
            cnt = res["c"] if res else 0
            if cnt > 0:
                return

        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        admin_pwd = hash_password("Admin@QuantumFloor2026")
        trader_pwd = hash_password("Trader@12345")

        kite_enc_key = encrypt_secret("kite_live_institutional_key_99482")
        kite_enc_sec = encrypt_secret("kite_secret_hash_2026_alphatrade")
        oanda_enc_key = encrypt_secret("oanda_v20_live_token_771829471")
        oanda_enc_sec = encrypt_secret("oanda_account_id_001_882910")

        with self.engine.begin() as conn:
            # Users
            users_data = [
                {"uid": "USR-ADMIN-01", "un": "admin", "em": "admin@quantumfloor.institutional", "pw": admin_pwd, "role": "ADMIN", "mode": "LONG_TERM_WEALTH", "totp": 1, "created": now},
                {"uid": "USR-TRADER-01", "un": "trader1", "em": "trader@quantumfloor.institutional", "pw": trader_pwd, "role": "TRADER", "mode": "AUTONOMOUS_TRADING", "totp": 0, "created": now},
            ]
            for u in users_data:
                if self.is_postgres:
                    conn.execute(
                        text("""
                            INSERT INTO users (user_id, username, email, password_hash, role, investment_mode, totp_enabled, created_at)
                            VALUES (:uid, :un, :em, :pw, :role, :mode, :totp, :created)
                            ON CONFLICT (username) DO NOTHING;
                        """),
                        u
                    )
                else:
                    conn.execute(
                        text("""
                            INSERT OR IGNORE INTO users (user_id, username, email, password_hash, role, investment_mode, totp_enabled, created_at)
                            VALUES (:uid, :un, :em, :pw, :role, :mode, :totp, :created);
                        """),
                        u
                    )

            # Vault keys
            vault_items = [
                ("USR-ADMIN-01", "Zerodha Kite Connect", kite_enc_key, kite_enc_sec, mask_secret("kite_live_institutional_key_99482"), mask_secret("kite_secret_hash_2026_alphatrade"), 1, "LIVE", now),
                ("USR-ADMIN-01", "OANDA v20 Forex", oanda_enc_key, oanda_enc_sec, mask_secret("oanda_v20_live_token_771829471"), mask_secret("oanda_account_id_001_882910"), 1, "PRACTICE", now),
            ]
            for v in vault_items:
                v_params = {
                    "uid": v[0], "bname": v[1], "k": v[2], "s": v[3], "mk": v[4], "ms": v[5], "conn": v[6], "env": v[7], "updated": v[8]
                }
                if self.is_postgres:
                    conn.execute(
                        text("""
                            INSERT INTO encrypted_keys (user_id, broker_name, encrypted_api_key, encrypted_secret, api_key_masked, secret_masked, is_connected, environment, updated_at)
                            VALUES (:uid, :bname, :k, :s, :mk, :ms, :conn, :env, :updated)
                            ON CONFLICT (user_id, broker_name) DO UPDATE SET
                                encrypted_api_key = EXCLUDED.encrypted_api_key,
                                encrypted_secret = EXCLUDED.encrypted_secret,
                                updated_at = EXCLUDED.updated_at;
                            INSERT INTO broker_vault (user_id, broker_name, encrypted_api_key, encrypted_secret, api_key_masked, secret_masked, is_connected, environment, updated_at)
                            VALUES (:uid, :bname, :k, :s, :mk, :ms, :conn, :env, :updated)
                            ON CONFLICT (user_id, broker_name) DO UPDATE SET
                                encrypted_api_key = EXCLUDED.encrypted_api_key,
                                encrypted_secret = EXCLUDED.encrypted_secret,
                                updated_at = EXCLUDED.updated_at;
                        """),
                        v_params
                    )
                else:
                    conn.execute(
                        text("""
                            INSERT OR REPLACE INTO encrypted_keys (user_id, broker_name, encrypted_api_key, encrypted_secret, api_key_masked, secret_masked, is_connected, environment, updated_at)
                            VALUES (:uid, :bname, :k, :s, :mk, :ms, :conn, :env, :updated);
                            INSERT OR REPLACE INTO broker_vault (user_id, broker_name, encrypted_api_key, encrypted_secret, api_key_masked, secret_masked, is_connected, environment, updated_at)
                            VALUES (:uid, :bname, :k, :s, :mk, :ms, :conn, :env, :updated);
                        """),
                        v_params
                    )

            # Audit log
            audit_entry = {
                "lid": "AUD-INIT-01", "uid": "USR-ADMIN-01", "un": "admin", "act": "INITIALIZE_PLATFORM",
                "res": "SECURITY_CORE", "stat": "SUCCESS", "ip": "127.0.0.1",
                "det": json.dumps({"note": "Enterprise multi-user & vault system initialized."}), "ts": now
            }
            if self.is_postgres:
                conn.execute(
                    text("""
                        INSERT INTO audit_logs (log_id, user_id, username, action, resource, status, ip_address, details_json, timestamp)
                        VALUES (:lid, :uid, :un, :act, :res, :stat, :ip, :det, :ts)
                        ON CONFLICT (log_id) DO NOTHING;
                    """),
                    audit_entry
                )
            else:
                conn.execute(
                    text("""
                        INSERT OR IGNORE INTO audit_logs (log_id, user_id, username, action, resource, status, ip_address, details_json, timestamp)
                        VALUES (:lid, :uid, :un, :act, :res, :stat, :ip, :det, :ts);
                    """),
                    audit_entry
                )

    def record_snapshot(self, snapshot: Dict[str, Any]) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO equity_snapshots (timestamp, total_nav_inr, total_nav_usd, inr_equity, usd_equity, drawdown_pct, daily_return_pct)
                    VALUES (:ts, :nav_inr, :nav_usd, :inr_eq, :usd_eq, :dd, :ret)
                """),
                {
                    "ts": snapshot.get("timestamp", datetime.datetime.now(datetime.timezone.utc).isoformat()),
                    "nav_inr": float(snapshot.get("total_nav_inr", 0.0)),
                    "nav_usd": float(snapshot.get("total_nav_usd", 0.0)),
                    "inr_eq": float(snapshot.get("inr_equity", 0.0)),
                    "usd_eq": float(snapshot.get("usd_equity", 0.0)),
                    "dd": float(snapshot.get("drawdown_pct", 0.0)),
                    "ret": float(snapshot.get("daily_return_pct", 0.0)),
                }
            )

    def get_equity_curve(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                text("SELECT * FROM equity_snapshots ORDER BY id DESC LIMIT :lim"),
                {"lim": limit}
            ).mappings().fetchall()
            return [dict(r) for r in reversed(rows)]

    def get_trades(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                text("SELECT * FROM trades ORDER BY timestamp DESC LIMIT :lim"),
                {"lim": limit}
            ).mappings().fetchall()
            return [dict(r) for r in rows]

    def record_trade(self, trade: Dict[str, Any]) -> None:
        params = {
            "trade_id": trade.get("trade_id"),
            "order_id": trade.get("order_id"),
            "symbol": trade.get("symbol"),
            "asset_class": trade.get("asset_class"),
            "side": trade.get("side"),
            "quantity": float(trade.get("quantity", 0.0)),
            "price": float(trade.get("price", 0.0)),
            "pnl": float(trade.get("pnl", 0.0)),
            "fee": float(trade.get("fee", 0.0)),
            "slippage": float(trade.get("slippage", 0.0)),
            "timestamp": trade.get("timestamp", datetime.datetime.now(datetime.timezone.utc).isoformat()),
        }
        with self.engine.begin() as conn:
            if self.is_postgres:
                conn.execute(
                    text("""
                        INSERT INTO trades (trade_id, order_id, symbol, asset_class, side, quantity, price, pnl, fee, slippage, timestamp)
                        VALUES (:trade_id, :order_id, :symbol, :asset_class, :side, :quantity, :price, :pnl, :fee, :slippage, :timestamp)
                        ON CONFLICT (trade_id) DO UPDATE SET
                            pnl = EXCLUDED.pnl, fee = EXCLUDED.fee, slippage = EXCLUDED.slippage;
                        INSERT INTO trade_history (trade_id, order_id, symbol, asset_class, side, quantity, price, pnl, fee, slippage, timestamp)
                        VALUES (:trade_id, :order_id, :symbol, :asset_class, :side, :quantity, :price, :pnl, :fee, :slippage, :timestamp)
                        ON CONFLICT (trade_id) DO UPDATE SET
                            pnl = EXCLUDED.pnl, fee = EXCLUDED.fee, slippage = EXCLUDED.slippage;
                    """),
                    params
                )
            else:
                conn.execute(
                    text("""
                        INSERT OR REPLACE INTO trades (trade_id, order_id, symbol, asset_class, side, quantity, price, pnl, fee, slippage, timestamp)
                        VALUES (:trade_id, :order_id, :symbol, :asset_class, :side, :quantity, :price, :pnl, :fee, :slippage, :timestamp);
                        INSERT OR REPLACE INTO trade_history (trade_id, order_id, symbol, asset_class, side, quantity, price, pnl, fee, slippage, timestamp)
                        VALUES (:trade_id, :order_id, :symbol, :asset_class, :side, :quantity, :price, :pnl, :fee, :slippage, :timestamp);
                    """),
                    params
                )

    def save_debate(self, debate: Dict[str, Any]) -> None:
        params = {
            "debate_id": debate.get("debate_id"),
            "symbol": debate.get("symbol"),
            "asset_class": debate.get("asset_class"),
            "timestamp": debate.get("timestamp"),
            "consensus_score": float(debate.get("consensus_score", 0.0)),
            "signal": debate.get("signal", "NEUTRAL"),
            "action": debate.get("action", "HOLD"),
            "confidence_pct": float(debate.get("confidence_pct", 0.0)),
            "current_price": float(debate.get("current_price", 0.0)),
            "recommended_entry": float(debate.get("recommended_entry", 0.0)),
            "stop_loss": float(debate.get("stop_loss", 0.0)),
            "take_profit": float(debate.get("take_profit", 0.0)),
            "risk_reward_ratio": float(debate.get("risk_reward_ratio", 2.0)),
            "proposed_quantity": float(debate.get("proposed_quantity", 0.0)),
            "bull_thesis_json": json.dumps(debate.get("bull_thesis", {})),
            "bear_thesis_json": json.dumps(debate.get("bear_thesis", {})),
            "rationale": debate.get("executive_rationale", ""),
            "risk_assessment_json": json.dumps(debate.get("risk_assessment")) if debate.get("risk_assessment") else None,
            "execution_result_json": json.dumps(debate.get("execution_result")) if debate.get("execution_result") else None,
        }
        with self.engine.begin() as conn:
            if self.is_postgres:
                conn.execute(
                    text("""
                        INSERT INTO agent_debates (
                            debate_id, symbol, asset_class, timestamp, consensus_score, signal, action,
                            confidence_pct, current_price, recommended_entry, stop_loss, take_profit,
                            risk_reward_ratio, proposed_quantity, bull_thesis_json, bear_thesis_json,
                            rationale, risk_assessment_json, execution_result_json
                        )
                        VALUES (
                            :debate_id, :symbol, :asset_class, :timestamp, :consensus_score, :signal, :action,
                            :confidence_pct, :current_price, :recommended_entry, :stop_loss, :take_profit,
                            :risk_reward_ratio, :proposed_quantity, :bull_thesis_json, :bear_thesis_json,
                            :rationale, :risk_assessment_json, :execution_result_json
                        )
                        ON CONFLICT (debate_id) DO UPDATE SET
                            consensus_score = EXCLUDED.consensus_score,
                            signal = EXCLUDED.signal,
                            action = EXCLUDED.action,
                            confidence_pct = EXCLUDED.confidence_pct,
                            current_price = EXCLUDED.current_price,
                            recommended_entry = EXCLUDED.recommended_entry,
                            stop_loss = EXCLUDED.stop_loss,
                            take_profit = EXCLUDED.take_profit,
                            risk_reward_ratio = EXCLUDED.risk_reward_ratio,
                            proposed_quantity = EXCLUDED.proposed_quantity,
                            bull_thesis_json = EXCLUDED.bull_thesis_json,
                            bear_thesis_json = EXCLUDED.bear_thesis_json,
                            rationale = EXCLUDED.rationale,
                            risk_assessment_json = EXCLUDED.risk_assessment_json,
                            execution_result_json = EXCLUDED.execution_result_json;
                    """),
                    params
                )
            else:
                conn.execute(
                    text("""
                        INSERT OR REPLACE INTO agent_debates (
                            debate_id, symbol, asset_class, timestamp, consensus_score, signal, action,
                            confidence_pct, current_price, recommended_entry, stop_loss, take_profit,
                            risk_reward_ratio, proposed_quantity, bull_thesis_json, bear_thesis_json,
                            rationale, risk_assessment_json, execution_result_json
                        )
                        VALUES (
                            :debate_id, :symbol, :asset_class, :timestamp, :consensus_score, :signal, :action,
                            :confidence_pct, :current_price, :recommended_entry, :stop_loss, :take_profit,
                            :risk_reward_ratio, :proposed_quantity, :bull_thesis_json, :bear_thesis_json,
                            :rationale, :risk_assessment_json, :execution_result_json
                        );
                    """),
                    params
                )

    def get_debates(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                text("SELECT * FROM agent_debates ORDER BY timestamp DESC LIMIT :lim"),
                {"lim": limit}
            ).mappings().fetchall()
            results = []
            for r in rows:
                item = dict(r)
                item["bull_thesis"] = json.loads(item.pop("bull_thesis_json", "{}"))
                item["bear_thesis"] = json.loads(item.pop("bear_thesis_json", "{}"))
                if item.get("risk_assessment_json"):
                    item["risk_assessment"] = json.loads(item.pop("risk_assessment_json"))
                if item.get("execution_result_json"):
                    item["execution_result"] = json.loads(item.pop("execution_result_json"))
                results.append(item)
            return results

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        with self.engine.connect() as conn:
            row = conn.execute(
                text("SELECT * FROM users WHERE username = :un"),
                {"un": username}
            ).mappings().fetchone()
            return dict(row) if row else None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self.engine.connect() as conn:
            row = conn.execute(
                text("SELECT * FROM users WHERE user_id = :uid"),
                {"uid": user_id}
            ).mappings().fetchone()
            return dict(row) if row else None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        with self.engine.connect() as conn:
            row = conn.execute(
                text("SELECT * FROM users WHERE email = :email"),
                {"email": email}
            ).mappings().fetchone()
            return dict(row) if row else None

    def upsert_oauth_user(self, email: str, name: str, picture: str = "", provider: str = "google") -> Dict[str, Any]:
        """
        Idempotently synchronizes a Google OAuth user with QuantumFloor users,
        Better Auth tables ('user', 'account'), and creates default portfolio.
        """
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        user_id = f"USR-{provider[:4].upper()}-{abs(hash(email)) % 1000000:06d}"

        with self.engine.begin() as conn:
            # 1. Check or insert into users table
            existing = conn.execute(
                text("SELECT user_id, username, email, role, investment_mode FROM users WHERE email = :email"),
                {"email": email}
            ).mappings().fetchone()

            if existing:
                qf_user = dict(existing)
            else:
                conn.execute(
                    text("""
                        INSERT INTO users (user_id, username, email, password_hash, role, investment_mode, totp_enabled, created_at)
                        VALUES (:uid, :un, :em, :pw, 'TRADER', 'AUTONOMOUS_TRADING', 0, :created)
                    """),
                    {
                        "uid": user_id, "un": name, "em": email,
                        "pw": f"oauth_{provider}_{uuid.uuid4().hex}",
                        "created": now
                    }
                )
                try:
                    conn.execute(
                        text("""
                            INSERT INTO portfolios (portfolio_id, user_id, name, currency, total_value, cash_balance)
                            VALUES (:pid, :uid, :name, 'INR', 1000000.0, 1000000.0)
                        """),
                        {"pid": f"PF-{user_id}", "uid": user_id, "name": f"{name}'s Portfolio"}
                    )
                except Exception:
                    pass

                qf_user = {
                    "user_id": user_id,
                    "username": name,
                    "email": email,
                    "role": "TRADER",
                    "investment_mode": "AUTONOMOUS_TRADING"
                }

            # 2. Synchronize into Better Auth tables if present
            try:
                ba_check = conn.execute(
                    text('SELECT id FROM "user" WHERE email = :email'),
                    {"email": email}
                ).fetchone()
                ba_uid = ba_check[0] if ba_check else f"ba_{uuid.uuid4().hex[:12]}"
                if not ba_check:
                    conn.execute(
                        text('INSERT INTO "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt") VALUES (:id, :name, :email, true, :img, :ca, :ua)'),
                        {"id": ba_uid, "name": name, "email": email, "img": picture, "ca": now, "ua": now}
                    )
                    conn.execute(
                        text('INSERT INTO "account" (id, "userId", "accountId", "providerId", "createdAt", "updatedAt") VALUES (:id, :uid, :aid, :pid, :ca, :ua)'),
                        {"id": f"acc_{uuid.uuid4().hex[:12]}", "uid": ba_uid, "aid": email, "pid": provider, "ca": now, "ua": now}
                    )
            except Exception:
                pass

        return qf_user

    def create_user(self, user_id: str, username: str, email: str, password_hash: str, role: str, mode: str) -> Dict[str, Any]:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        with self.engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO users (user_id, username, email, password_hash, role, investment_mode, totp_enabled, created_at)
                    VALUES (:uid, :un, :em, :pw, :role, :mode, 0, :created)
                """),
                {
                    "uid": user_id, "un": username, "em": email, "pw": password_hash,
                    "role": role, "mode": mode, "created": now
                }
            )
        return self.get_user_by_id(user_id) or {}

    def update_user_mode(self, user_id: str, mode: str) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text("UPDATE users SET investment_mode = :mode WHERE user_id = :uid"),
                {"mode": mode, "uid": user_id}
            )

    def save_encrypted_broker_key(self, user_id: str, broker_name: str, plain_api_key: str, plain_secret: Any, environment: str = "LIVE") -> None:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        secret_str = json.dumps(plain_secret) if isinstance(plain_secret, dict) else str(plain_secret)
        enc_key = encrypt_secret(plain_api_key)
        enc_sec = encrypt_secret(secret_str)
        masked_key = mask_secret(plain_api_key)
        masked_sec = "MASKED_VAULT_PAYLOAD" if isinstance(plain_secret, dict) else mask_secret(str(plain_secret))

        params = {
            "uid": user_id, "bname": broker_name, "k": enc_key, "s": enc_sec,
            "mk": masked_key, "ms": masked_sec, "conn": 1, "env": environment, "updated": now
        }
        with self.engine.begin() as conn:
            if self.is_postgres:
                conn.execute(
                    text("""
                        INSERT INTO encrypted_keys (user_id, broker_name, encrypted_api_key, encrypted_secret, api_key_masked, secret_masked, is_connected, environment, updated_at)
                        VALUES (:uid, :bname, :k, :s, :mk, :ms, :conn, :env, :updated)
                        ON CONFLICT (user_id, broker_name) DO UPDATE SET
                            encrypted_api_key = EXCLUDED.encrypted_api_key,
                            encrypted_secret = EXCLUDED.encrypted_secret,
                            api_key_masked = EXCLUDED.api_key_masked,
                            secret_masked = EXCLUDED.secret_masked,
                            is_connected = EXCLUDED.is_connected,
                            environment = EXCLUDED.environment,
                            updated_at = EXCLUDED.updated_at;
                        INSERT INTO broker_vault (user_id, broker_name, encrypted_api_key, encrypted_secret, api_key_masked, secret_masked, is_connected, environment, updated_at)
                        VALUES (:uid, :bname, :k, :s, :mk, :ms, :conn, :env, :updated)
                        ON CONFLICT (user_id, broker_name) DO UPDATE SET
                            encrypted_api_key = EXCLUDED.encrypted_api_key,
                            encrypted_secret = EXCLUDED.encrypted_secret,
                            api_key_masked = EXCLUDED.api_key_masked,
                            secret_masked = EXCLUDED.secret_masked,
                            is_connected = EXCLUDED.is_connected,
                            environment = EXCLUDED.environment,
                            updated_at = EXCLUDED.updated_at;
                    """),
                    params
                )
            else:
                conn.execute(
                    text("""
                        INSERT OR REPLACE INTO encrypted_keys (user_id, broker_name, encrypted_api_key, encrypted_secret, api_key_masked, secret_masked, is_connected, environment, updated_at)
                        VALUES (:uid, :bname, :k, :s, :mk, :ms, :conn, :env, :updated);
                        INSERT OR REPLACE INTO broker_vault (user_id, broker_name, encrypted_api_key, encrypted_secret, api_key_masked, secret_masked, is_connected, environment, updated_at)
                        VALUES (:uid, :bname, :k, :s, :mk, :ms, :conn, :env, :updated);
                    """),
                    params
                )

    def get_user_broker_keys(self, user_id: str) -> List[Dict[str, Any]]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                text("SELECT broker_name, api_key_masked, secret_masked, is_connected, environment, updated_at FROM encrypted_keys WHERE user_id = :uid"),
                {"uid": user_id}
            ).mappings().fetchall()
            return [dict(r) for r in rows]

    def get_user_decrypted_broker_key(self, user_id: str, broker_name: str) -> Optional[Dict[str, Any]]:
        with self.engine.connect() as conn:
            row = conn.execute(
                text("SELECT broker_name, encrypted_api_key, encrypted_secret, environment, is_connected FROM broker_vault WHERE user_id = :uid AND broker_name = :bname"),
                {"uid": user_id, "bname": broker_name}
            ).mappings().fetchone()
            if not row:
                row = conn.execute(
                    text("SELECT broker_name, encrypted_api_key, encrypted_secret, environment, is_connected FROM encrypted_keys WHERE user_id = :uid AND broker_name = :bname"),
                    {"uid": user_id, "bname": broker_name}
                ).mappings().fetchone()
            if not row:
                return None

            api_key = decrypt_secret(row["encrypted_api_key"])
            raw_secret = decrypt_secret(row["encrypted_secret"])

            secret_data = {}
            try:
                parsed = json.loads(raw_secret)
                if isinstance(parsed, dict):
                    secret_data = parsed
                else:
                    secret_data = {"api_secret": raw_secret}
            except Exception:
                secret_data = {"api_secret": raw_secret}

            return {
                "broker_name": row["broker_name"],
                "api_key": api_key,
                "environment": row["environment"] or "LIVE",
                "is_connected": bool(row["is_connected"]),
                **secret_data
            }

    def update_broker_connection_status(self, user_id: str, broker_name: str, is_connected: bool) -> None:
        conn_val = 1 if is_connected else 0
        with self.engine.begin() as conn:
            conn.execute(
                text("UPDATE broker_vault SET is_connected = :c WHERE user_id = :uid AND broker_name = :bname"),
                {"c": conn_val, "uid": user_id, "bname": broker_name}
            )
            conn.execute(
                text("UPDATE encrypted_keys SET is_connected = :c WHERE user_id = :uid AND broker_name = :bname"),
                {"c": conn_val, "uid": user_id, "bname": broker_name}
            )

    def record_audit_log(self, entry: Dict[str, Any]) -> None:
        params = {
            "lid": entry.get("log_id"),
            "uid": entry.get("user_id"),
            "un": entry.get("username"),
            "act": entry.get("action"),
            "res": entry.get("resource"),
            "stat": entry.get("status", "SUCCESS"),
            "ip": entry.get("ip_address", "127.0.0.1"),
            "det": json.dumps(entry.get("details", {})),
            "ts": entry.get("timestamp", datetime.datetime.now(datetime.timezone.utc).isoformat()),
        }
        with self.engine.begin() as conn:
            if self.is_postgres:
                conn.execute(
                    text("""
                        INSERT INTO audit_logs (log_id, user_id, username, action, resource, status, ip_address, details_json, timestamp)
                        VALUES (:lid, :uid, :un, :act, :res, :stat, :ip, :det, :ts)
                        ON CONFLICT (log_id) DO NOTHING;
                    """),
                    params
                )
            else:
                conn.execute(
                    text("""
                        INSERT OR IGNORE INTO audit_logs (log_id, user_id, username, action, resource, status, ip_address, details_json, timestamp)
                        VALUES (:lid, :uid, :un, :act, :res, :stat, :ip, :det, :ts);
                    """),
                    params
                )

    def get_audit_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                text("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT :lim"),
                {"lim": limit}
            ).mappings().fetchall()
            results = []
            for r in rows:
                item = dict(r)
                if item.get("details_json"):
                    item["details"] = json.loads(item.pop("details_json"))
                results.append(item)
            return results

    def record_sip_execution(self, record: Dict[str, Any]) -> None:
        params = {
            "eid": record.get("execution_id"),
            "bid": record.get("basket_id"),
            "uid": record.get("user_id"),
            "amt": float(record.get("amount_invested", 0.0)),
            "alloc": json.dumps(record.get("allocated_shares", {})),
            "ts": record.get("timestamp"),
            "stat": record.get("status", "EXECUTED"),
        }
        with self.engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO baskets_sip (execution_id, basket_id, user_id, amount_invested, allocated_shares_json, timestamp, status)
                    VALUES (:eid, :bid, :uid, :amt, :alloc, :ts, :stat)
                """),
                params
            )
            conn.execute(
                text("""
                    INSERT INTO wealth_sips (execution_id, basket_id, user_id, amount_invested, allocated_shares_json, timestamp, status)
                    VALUES (:eid, :bid, :uid, :amt, :alloc, :ts, :stat)
                """),
                params
            )

    def get_sip_executions(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                text("SELECT * FROM baskets_sip ORDER BY timestamp DESC LIMIT :lim"),
                {"lim": limit}
            ).mappings().fetchall()
            results = []
            for r in rows:
                item = dict(r)
                if item.get("allocated_shares_json"):
                    item["allocated_shares"] = json.loads(item.pop("allocated_shares_json"))
                results.append(item)
            return results
