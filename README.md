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
│   ├── database.py                  # SQLite WAL persistence for trades, equity snapshots, and debate audits
│   ├── market.py                    # Multi-source live tick aggregator (NSE/BSE + FX ticks)
│   ├── api.py                       # FastAPI application with CORS, SSE streaming, and quant endpoints
│   └── tests/
│       └── test_platform.py         # Comprehensive unit and integration test suite
├── frontend/
│   ├── src/
│   │   ├── api.ts                   # Strongly typed REST client & EventSource SSE subscriber
│   │   ├── chart.ts                 # High-performance Canvas candlestick & equity curve engines
│   │   ├── panel.ts                 # Real-time quadrant UI rendering trader telemetry & badges
│   │   ├── state.ts                 # Reactive client-side market and trader state store
│   │   ├── styles.css               # Institutional terminal theme (carbon obsidian & neon accents)
│   │   └── main.ts                  # Application bootstrap and telemetry manager
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
pip install fastapi uvicorn[standard] pydantic numpy httpx starlette
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
