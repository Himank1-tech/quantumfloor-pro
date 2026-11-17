# QuantumFloor: Institutional Multi-Agent Autonomous Trading Floor
### Indian Equities (NSE/BSE) + Global Forex | 3-Tier Quantitative Pipeline

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![Vite](https://img.shields.io/badge/Vite-5.4+-646CFF.svg?style=flat&logo=vite)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=flat&logo=python)](https://python.org)

QuantumFloor is an institutional-grade, multi-agent autonomous trading platform architected for concurrent operation across **Indian Financial Markets (NSE & BSE cash equities, NIFTY 50 / BANKNIFTY)** and **Global Foreign Exchange (EUR/USD, GBP/USD, USD/INR, USD/JPY)**.

The system enforces a strict **3-Tier Quantitative Pipeline**, replacing erratic, unconstrained single-prompt LLM execution with mathematical risk governors and adversarial dual-agent consensus.

---

## 🏛️ 1. Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TIER 1: MARKET INTELLIGENCE & DISCOVERY                │
│                                                                             │
│   ┌─────────────────────┐   MCP Tools   ┌────────────────────────────────┐  │
│   │  Trading MCP Server │ ────────────► │ Live Quotes, Level 2 Depth,    │  │
│   └─────────────────────┘               │ Technicals (RSI/EMA/MACD/ATR), │  │
│              │                          │ News Sentiment & Macro Cal.    │  │
│              ▼                          └────────────────────────────────┘  │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                   ADVERSARIAL DUAL-AGENT DEBATE                      │  │
│   │   ┌───────────────────────────┐    ┌───────────────────────────┐     │  │
│   │   │  Senior Bull Strategist   │ vs │  Senior Bear Strategist   │     │  │
│   │   │  (Momentum/Bid Depth)     │    │  (Supply Wall/Overbought) │     │  │
│   │   └───────────────────────────┘    └───────────────────────────┘     │  │
│   │                                 │                                    │  │
│   │                                 ▼                                    │  │
│   │               Floor Manager Consensus Synthesis                      │  │
│   │            (Score: -1.00 Bearish to +1.00 Bullish)                   │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ Trade Proposal (Symbol, Side, Target, SL)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                TIER 2: DETERMINISTIC QUANTITATIVE RISK GOVERNOR             │
│                                                                             │
│   No order reaches broker execution without passing mathematical gates:     │
│   1. Fractional Kelly Criterion Position Sizing: f* = p - (1-p)/b           │
│   2. Single-Asset Concentration Cap (Max 15% Portfolio NAV per asset)       │
│   3. Dynamic Volatility Brake (2.5x ATR spike trims sizing by 50%)          │
│   4. Multi-Tier Automated Drawdown Circuit Breakers:                        │
│      • Soft Brake (-3% Daily Drawdown): Trims permissible sizes by 50%      │
│      • Hard Halt  (-5% Daily Loss / -10% Total Drawdown): Freezes entries   │
│   5. Statutory Order Validation (NSE ₹0.05 ticks, R:R >= 1:1.5)             │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ Approved & Scaled Orders Only
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             TIER 3: MULTI-BROKER EXECUTION & TELEMETRY DASHBOARD            │
│                                                                             │
│   ┌────────────────────────────────┐    ┌───────────────────────────────┐   │
│   │     Indian Broker Adapter      │    │      Forex Broker Adapter     │   │
│   │  (Zerodha / Dhan / Angel One)  │    │      (OANDA v20 / MT5 / CCXT) │   │
│   │  ₹ INR Ledger | STT/SEBI Fees  │    │      $ USD Ledger | Leverage  │   │
│   └────────────────────────────────┘    └───────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│   FastAPI Engine (REST + SSE Telemetry) ──► High-Density Vite/TS Dashboard   │
│   Live Sharpe, Sortino, Drawdown, Order Book Depth, Real-Time P&L Blotter   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 2. Directory Specification

```text
trading_platform/
├── backend/
│   ├── analytics/
│   │   ├── __init__.py
│   │   └── quant.py                 # Annualized Sharpe, Sortino, Max Drawdown, Beta, Volatility, Kelly, VaR
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── security.py              # JWT tokens, bcrypt password hashing, AES-128 Fernet broker key vault
│   │   └── models.py                # User, Role, Mode, Session & Key models
│   ├── ipo/
│   │   ├── __init__.py
│   │   ├── scraper.py               # NSE/BSE IPO scraper, Chittorgarh & GMP tracker, subscription status
│   │   └── analyzer.py              # DRHP document analysis, fresh vs OFS ratio, valuation multiples vs peers
│   ├── advisory/
│   │   ├── __init__.py
│   │   ├── grounded_engine.py       # RAG grounded advisory with verifiable proofs & invalidation stops
│   │   └── signal_validator.py      # Mathematical validator (min 1:2 R:R, slippage buffer, evidence count)
│   ├── investors/
│   │   ├── __init__.py
│   │   └── basket_manager.py        # Thematic baskets (Nifty Compounders, EV/Green, Dividend Aristocrats, FX Carry)
│   ├── brokers/
│   │   ├── __init__.py
│   │   ├── base.py                  # Abstract Base Broker Interface & Common Models
│   │   ├── indian_broker.py         # Zerodha Kite Connect / Dhan / Angel One SmartAPI Adapter
│   │   └── forex_broker.py          # OANDA REST v20 / MetaTrader 5 Gateway Adapter
│   ├── risk/
│   │   ├── __init__.py
│   │   └── governor.py              # Deterministic pre-trade circuit breaker & sizing validator
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── floor_manager.py         # Multi-agent orchestrator & consensus coordinator
│   │   ├── prompts.py               # Bull/Bear thesis debate & institutional prompt templates
│   │   └── mcp_servers.py           # Model Context Protocol (MCP) server & live financial tools
│   ├── accounts.py                  # Multi-currency ledger (INR ₹ for Indian Equities, USD $ for Forex)
│   ├── database.py                  # SQLite WAL persistence with Users, Encrypted Keys, Audit Trail, SIP
│   ├── market.py                    # Multi-source live tick aggregator (NSE/BSE + FX ticks)
│   ├── api.py                       # Enterprise FastAPI app (Auth, IPOs, Advisory, Baskets, SSE Telemetry)
│   └── tests/
│       └── test_platform.py         # 8-suite comprehensive unit & enterprise test suite
├── frontend/
│   ├── src/
│   │   ├── api.ts                   # Strongly typed REST client & EventSource SSE subscriber
│   │   ├── auth/
│   │   │   └── authModal.ts         # User profile, Investment Mode toggle, AES Vault, Immutable Audit Trail
│   │   ├── ipo/
│   │   │   └── ipoPanel.ts          # IPO dashboard, GMP meters, subscription progress, DRHP modal
│   │   ├── advisory/
│   │   │   └── advisoryPanel.ts     # Grounded advisory feed with expandable verifiable evidence drawers
│   │   ├── investors/
│   │   │   └── basketPanel.ts       # Thematic model baskets, 3Y CAGR, interactive SIP allocation modal
│   │   ├── components/
│   │   │   └── navbar.ts            # Top institutional navigation bar with mode indicator & IST clock
│   │   ├── chart.ts                 # High-performance Canvas candlestick & equity curve engines
│   │   ├── panel.ts                 # Real-time quadrant UI rendering trader telemetry & badges
│   │   ├── state.ts                 # Reactive client-side multi-view state store
│   │   ├── styles.css               # Institutional terminal theme (carbon obsidian & neon accents)
│   │   └── main.ts                  # Application bootstrap, navigation router, and SSE manager
│   ├── index.html                   # Terminal HTML container
│   ├── package.json                 # Node dependencies (Vite, TypeScript, Lightweight Charts)
│   └── vite.config.ts               # Proxy configuration routing /api to FastAPI (Port 8001)
├── .env.example                     # Environment template for broker keys & risk parameters
├── pyproject.toml                   # Python packaging and project specifications
└── README.md                        # Documentation and system guide
```

---

## 🧮 3. Quantitative Formulations

### 1. Annualized Sharpe Ratio
$$\text{Sharpe} = \frac{\mu_r - r_f}{\sigma_r} \times \sqrt{N}$$
Where $\mu_r$ is periodic mean return, $r_f$ is annualized risk-free benchmark rate (default 6.5% standard Indian RBI repo baseline), $\sigma_r$ is sample standard deviation, and $N = 252$ trading days.

### 2. Sortino Ratio (Downside Semivariance)
$$\text{Sortino} = \frac{\mu_r - r_f}{\sqrt{\frac{1}{T} \sum_{t=1}^{T} \min(0, r_t - \text{MAR})^2}} \times \sqrt{N}$$
Penalizes solely downside deviations below the Minimum Acceptable Return (MAR).

### 3. Fractional Kelly Criterion
$$f^* = p - \frac{1 - p}{b}$$
$$\text{Allocation} = \min\left(f^* \times c,\; \text{Max Concentration Cap}\right)$$
Where $p$ is win probability, $b$ is the payoff ratio ($\frac{\text{Average Win}}{\text{Average Loss}}$), and $c = 0.5$ represents institutional half-Kelly scaling to prevent drawdowns.

### 4. Maximum Drawdown (MDD)
$$\text{MDD}_t = \max_{\tau \in [0, t]} \left(\frac{\max_{s \in [0, \tau]} \text{NAV}_s - \text{NAV}_\tau}{\max_{s \in [0, \tau]} \text{NAV}_s}\right)$$

### 5. Indian Equities Statutory Charge Engine
Calculates statutory transaction taxes:
- **Brokerage**: $\min(₹20, \; \text{Turnover} \times 0.03\%)$
- **STT (Securities Transaction Tax)**: $0.025\%$ for intraday equity / $0.1\%$ for delivery
- **Exchange Turnover Charges**: $0.00325\%$ (NSE)
- **SEBI Turnover Charges**: $₹10 / \text{Crore}$ ($0.0001\%$)
- **Stamp Duty**: $0.003\%$
- **GST**: $18\%$ on $(\text{Brokerage} + \text{Turnover Charges} + \text{SEBI})$

---

## 🚀 4. Quickstart Guide

### Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Node.js 18+ & npm

### Step 1: Install Backend Dependencies
```bash
pip install fastapi uvicorn[standard] pydantic numpy httpx starlette cryptography pyjwt bcrypt
```

### Step 2: Run Unit Tests
Verify all quant calculations, broker adapters, and risk governor gates:
```bash
python trading_platform/backend/tests/test_platform.py
```
*Output: `ALL BACKEND UNIT TESTS PASSED SUCCESSFULLY!`*

### Step 3: Install and Build Frontend
```bash
cd trading_platform/frontend
npm install
npm run build
cd ../..
```

### Step 4: Launch Backend Server (Port 8001)
```bash
python -m uvicorn trading_platform.backend.api:app --host 0.0.0.0 --port 8001 --reload
```

The unified dashboard will be accessible directly in your browser:
👉 **`http://localhost:8001`**

Alternatively, for active frontend development with Hot Module Replacement (HMR):
```bash
cd trading_platform/frontend
npm run dev
```
👉 Accessible at **`http://localhost:5173`** (proxied to `/api` on port 8001).

---

## 🖥️ 5. Quadrant Interface Layout

1. **Quadrant 1: Market Intelligence & Level-2 Depth (Top-Left)**:
   - Interactive NSE/BSE & Forex asset switcher.
   - 60fps HTML5 Canvas Candlestick Chart with 20 EMA overlay and real-time tick synthesis.
   - Live Level-2 Order Book displaying top 5 bids and asks with liquidity fill depth bars and imbalance metrics.

2. **Quadrant 2: Autonomous Multi-Agent Debate Arena (Top-Right)**:
   - Real-time adversarial argument streams from the **Senior Bull Strategist** and **Senior Bear Strategist**.
   - Floor Manager consensus score gauge ($-1.00$ to $+1.00$), confidence rating, and proposed target/SL.
   - "Trigger Debate" action button for on-demand debate execution.

3. **Quadrant 3: Quant Risk Governor & Performance Matrix (Bottom-Left)**:
   - Live telemetry badges: Annualized Sharpe, Sortino, Max Drawdown, Realized Volatility, Kelly Sizing, VaR 95%, CVaR 95%, Win Rate, and Profit Factor.
   - Dynamic progress meters for concentration caps and daily drawdown brakes.
   - 60-day unified equity curve chart.

4. **Quadrant 4: Portfolio Execution & Order Blotter (Bottom-Right)**:
   - Active open positions across INR cash equities and USD currency pairs.
   - Manual Pre-Trade Order Ticket with real-time Risk Governor validation before submission.
   - Executed trade blotter with transaction fees, slippage, and realized P&L.

---

## 💎 6. Enterprise Upgrade Capabilities

### 1. Autonomous IPO Intelligence Engine
- **Grey Market Premium (GMP) Tracking**: Real-time tracking of GMP, percentage listing gain estimate, and trend indicators (`RISING`, `FALLING`, `STABLE`).
- **DRHP Prospectus Parser**: Computes Fresh Issue vs. Offer for Sale (OFS) ratio, 3-Yr Revenue CAGR, Return on Equity (RoE), and Return on Capital Employed (ROCE).
- **Valuation Peer Multiples**: Side-by-side comparison with listed NSE/BSE peers across P/E, P/B, Market Cap, and RoE.
- **Automated AI Verdict Cards**: Classifies IPOs into `APPLY_LISTING_GAINS`, `APPLY_LONG_TERM`, `AVOID`, or `NEUTRAL` with deterministic quantitative scoring.

### 2. Grounded AI Advisory with Verifiable Proof
- **Verifiable Evidence Drawers**: Replaces unconstrained LLM assertions with strictly cited financial evidence items:
  - `BALANCE_SHEET`: Specific line items (e.g., Free Cash Flow, Debt-to-Equity, EBITDA margins).
  - `TECHNICAL_LEVEL`: Exact indicator thresholds (200 EMA, RSI divergence, Volume profile).
  - `SEBI_FILING`: Regulatory filings, order book wins, quarterly result disclosures.
  - `MACRO_CATALYST`: Central bank policy, rate differentials, commodity tailwinds.
- **Signal Validator**: Enforces a minimum **1:2 Risk-to-Reward (R:R)** ratio, mandatory invalidation stop-loss levels, and slippage buffers.

### 3. Multi-User RBAC & Encrypted API Key Vault
- **Multi-User Security**: Role-based access control (`ADMIN`, `PORTFOLIO_MANAGER`, `ANALYST`, `INVESTOR`) backed by JWT and bcrypt password hashing.
- **AES-128 Fernet Key Vault**: Industry-standard symmetric encryption for sensitive broker API credentials (Zerodha Kite, Angel One SmartAPI, Upstox, OANDA v20). Secrets are never exposed in plaintext.
- **Immutable Audit Trail**: Chronological event logging with user ID, IP address, action tag, resource, and cryptographic session ID.

### 4. Dual Investment Modes & Thematic Baskets
- **Mode Switching**: Instant toggle between **Autonomous Trading** (Intraday/Swing) and **Long-Term Wealth** (SIP / Thematic Portfolios).
- **Thematic Model Baskets**:
  - *Nifty 50 Compounders*: Blue-chip high-RoE compounders (Reliance, TCS, HDFC Bank, ICICI Bank, Infosys, Tata Motors).
  - *Clean Energy & EV Revolution*: Next-generation transition leaders (Tata Motors, Waaree Energies, NTPC Green Energy, Reliance O2C).
  - *High-Yield Dividend Aristocrats*: High dividend payout leaders (ITC, Coal India, Power Grid, IOC, TCS).
  - *Global FX Carry & Yield*: High-yielding macro currency baskets.
- **Deterministic SIP Allocator**: Computes fractional share budgets and dispatches one-click batch executions directly into broker ledgers.

---

## ⚡ 7. QuantumFloor Pro Institutional Suite

### 1. Real-Time Live Market Data Sync (`backend/market_data/`)
- Zero-fake-data live sync pulling real market quotes and multi-timeframe OHLCV candles (`4H`, `1H`, `15M`, `5M`) matching TradingView, Groww, and Zerodha.
- Supports Indian Equities & Indices (`RELIANCE.NS`, `TCS.NS`, `HDFCBANK.NS`, `^NSEI`, `^NSEBANK`) and Global Forex/Commodities (`EURUSD=X`, `GBPUSD=X`, `USDINR=X`, `USDJPY=X`, `GC=F` Gold).
- Resilient sub-second tick interpolation and fallback caching preventing charts from freezing.

### 2. Institutional Smart Money Concepts (SMC) & Candlestick Engine (`backend/smc/`)
- **Market Structure (`structure.py`)**: Algorithmic detection of structural Swing Highs/Lows, Break of Structure (BOS continuation), Change of Character (CHoCH reversal), and Trendline Grab Levels (TGL false breakout sweeps).
- **Liquidity & POI Mapping (`liquidity.py`)**: Buy-Side Liquidity (BSL) above Equal Highs (EQH), Sell-Side Liquidity (SSL) below Equal Lows (EQL), Order Blocks (OB demand & supply), and Fair Value Gaps (FVG 3-candle imbalance).
- **Auto-Fibonacci & OTE (`fibonacci.py`)**: Automatic anchoring from swing impulse to 50% Equilibrium, Discount (<50%) for Buys, Premium (>50%) for Sells, and the 0.618 - 0.786 Optimal Trade Entry (OTE) pocket (0.705 sweet spot).
- **Candlestick Confirmations (`candlesticks.py`)**: Detects Bullish/Bearish Engulfing, Pin Bars / Hammers (wick > 65% of range), Inside Bar breakouts, and Morning/Evening Star reversals.

### 3. Multi-Timeframe (MTF) Top-Down Confluence Workflow (`mtf_confluence.py`)
- **Step 1 — Higher Timeframe Bias (4H & 1H)**: Directional macro bias aligned with major supply/demand POIs.
- **Step 2 — Intraday Zone Refinement (15M)**: Refines higher timeframe zones into unmitigated 15M Order Blocks or FVGs.
- **Step 3 — Zone Tap & Confirmation (5M)**: Waits for live price to tap the 15M zone and print a 5M CHoCH with confirmation candle close.
- **Step 4 — Automated Trade Blueprint**: Outputs exact Entry, Stop Loss strictly beyond zone + buffer, TP1 (minimum 1:2 R:R), and TP2 (1:3+ R:R) with confluence scoring.

### 4. Macro Sessions, Forex Factory News & Precision Sizing (`backend/macro/` & `backend/execution/`)
- **Global Session Clocks (`sessions.py`)**: Real-time IST & UTC clocks for NSE/BSE (09:15–15:30 IST), London (13:30–22:30 IST), New York (18:30–03:30 IST), and Tokyo. Highlights active **London-NY Overlap Killzones (18:30–22:30 IST / 13:00–17:00 UTC)**.
- **Economic Calendar (`news_calendar.py`)**: Forex Factory-style High (Red), Medium (Orange), and Low (Yellow) impact releases with automated 30-minute news blackout warnings.
- **Precision Pip/Lot Calculator (`position_calculator.py`)**: Computes exact Forex Standard/Mini/Micro lot sizes, pip values, required margin, and NSE share counts & F&O lot multipliers based on account balance and risk %.

### 5. Interactive Context-Aware AI Co-Pilot (`backend/copilot/ai_advisor_chat.py`)
- Powered by Gemini 2.5 Flash with live system-state injection (active chart, MTF blueprint, killzone status, news warnings, portfolio balances).
- Dual role as **Platform Walkthrough Tutor** (explains how to use every feature, read BOS/CHoCH, OTE, etc.) and **Direct Trade Advisor** (data-backed Buy/Sell blueprints).
- Voice Guidance: Features "Read Trade Plan Aloud" utilizing Web Speech API `window.speechSynthesis` for hands-free audio briefing, and voice microphone input.

### 6. Historical Backtesting & Replay Lab (`backend/backtest/replay_engine.py`)
- Bar-by-bar historical candle replay (Play, Pause, Step +1 Bar, 1x-5x Speed) dynamically rendering SMC levels.
- Simulates automated MTF trade entries and exits on SL/TP.
- Generates comprehensive tear-sheet metrics: Win Rate %, Profit Factor, Max Drawdown %, and Net Equity Curve.
