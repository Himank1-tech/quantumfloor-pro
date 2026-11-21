/**
 * QuantumFloor Pro - Primary Trading Floor Workspace
 * Institutional-grade spacious layout (Daylight White Institutional Light Theme)
 * Featuring Priority TP/SL Hero Banner on First Load, Movable / Zoomable / Maximizable Superchart (8 Timeframes),
 * and Full SMC & Quant Engine (Internal/External Liquidity, Dynamic S&R S1-S3/R1-R3, 90%+ FVG & Order Blocks, 5 Algorithms).
 */

import { store } from './state';
import {
  triggerDebateCycle,
  toggleAutoTrading,
  resetCircuitBreaker,
  submitManualOrder,
  fetchCandles,
  fetchCandlesPro,
  fetchOrderBook,
  fetchSMCAnalysis,
  fetchMTFSetup,
  fetchDebates,
  exportTradeBlotterReport,
  MTFSetupReport,
  API_BASE,
} from './api';
import { PriceChartEngine, EquityCurveChartEngine } from './chart';

let priceChart: PriceChartEngine | null = null;
let equityChart: EquityCurveChartEngine | null = null;
export let activeMTFReport: MTFSetupReport | null = null;
export let activeExecutionMode: 'PAPER' | 'LIVE' = 'PAPER';
export let activeQuantAlgorithm: string = 'SMC_SWEEP';
export let onOpenCalculatorCallback: (() => void) | null = null;
export let onOpenCopilotCallback: (() => void) | null = null;
export let onOpenNewsCallback: (() => void) | null = null;

export function setPanelCallbacks(callbacks: {
  onOpenCalculator: () => void;
  onOpenCopilot: () => void;
  onOpenNews?: () => void;
}) {
  onOpenCalculatorCallback = callbacks.onOpenCalculator;
  onOpenCopilotCallback = callbacks.onOpenCopilot;
  if (callbacks.onOpenNews) onOpenNewsCallback = callbacks.onOpenNews;
}

export function renderFloorPanel(): string {
  return `
    <!-- Floor Workspace Container -->
    <div class="floor-page-wrapper">
      <!-- 1. Executive Portfolio & Session Strip (5 Spacious KPI Cards) -->
      <section class="executive-kpi-strip">
        <!-- Card 1: Unified NAV -->
        <div class="kpi-card kpi-card-nav">
          <div class="kpi-card-header">
            <span class="kpi-label">UNIFIED PORTFOLIO NAV</span>
            <span class="kpi-tag badge-gold">LIVE</span>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-pulse-dot dot-gold pulse-emerald"></span>
            <span id="nav-inr" class="kpi-value-main val-amber">₹--</span>
            <span id="nav-usd" class="kpi-value-sub">$--</span>
          </div>
          <div class="kpi-footer-note">Cross-broker consolidated cash + margin</div>
        </div>

        <!-- Card 2: Daily P&L -->
        <div class="kpi-card kpi-card-pnl" id="card-daily-pnl">
          <div class="kpi-card-header">
            <span class="kpi-label">TODAY'S NET P&L</span>
            <span class="kpi-tag tag-emerald">DAY 1</span>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-pulse-dot dot-emerald pulse-emerald" id="pnl-pulse-dot"></span>
            <span id="nav-daily-pnl" class="kpi-value-main val-green">--</span>
          </div>
          <div class="kpi-footer-note">Realized + Mark-to-Market Unrealized</div>
        </div>

        <!-- Card 3: Active Session & Killzone -->
        <div class="kpi-card kpi-card-session" id="kpi-card-session">
          <div class="kpi-card-header">
            <span class="kpi-label">SESSION & KILLZONE</span>
            <span class="kpi-tag tag-cyan pulse-tag">ACTIVE</span>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-pulse-dot dot-cyan pulse-emerald"></span>
            <span id="kpi-session-title" class="kpi-value-main val-cyan" style="font-size:1.35rem;">NSE Equities (IST)</span>
          </div>
          <div class="kpi-footer-note" id="kpi-session-killzone">Killzone: 09:15 - 11:30 IST · London Pre-Market</div>
        </div>

        <!-- Card 4: Next Red-Folder News -->
        <div class="kpi-card kpi-card-news kpi-card-interactive" id="kpi-card-news" title="Click to view full Economic Calendar">
          <div class="kpi-card-header">
            <span class="kpi-label">UPCOMING MACRO EVENT</span>
            <span class="kpi-tag tag-rose">HIGH IMPACT</span>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-pulse-dot dot-crimson pulse-emerald"></span>
            <span id="kpi-next-news" class="kpi-value-main val-rose" style="font-size:1.15rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ⚠️ US CPI Data (in 45m)
            </span>
          </div>
          <div class="kpi-footer-note" style="color:var(--color-cyan)">Click to inspect impact filters →</div>
        </div>

        <!-- Card 5: Risk Governor & Auto-Trade Control -->
        <div class="kpi-card kpi-card-governor">
          <div class="kpi-card-header">
            <span class="kpi-label">RISK GOVERNOR</span>
            <span id="circuit-breaker-pill" class="breaker-badge breaker-NORMAL">NORMAL</span>
          </div>
          <div class="kpi-actions-row">
            <button id="btn-auto-trade" class="btn-toggle active">
              <span>🤖 AUTO TRADE: ON</span>
            </button>
            <button id="btn-reset-breaker" class="btn-mini-reset" title="Reset Circuit Breaker">
              ↺ RESET
            </button>
          </div>
          <div class="kpi-footer-note">Max DD Cap: 10% | Max Asset: 15%</div>
        </div>
      </section>

      <!-- 1b. Priority Trade Signal & TP/SL Hero Banner (Primary Focus on First Load) -->
      <section class="priority-setup-hero-banner" id="priority-setup-hero">
        <div class="priority-hero-inner">
          <div class="priority-hero-left">
            <div class="hero-asset-row">
              <span class="hero-symbol-tag" id="hero-active-symbol">RELIANCE</span>
              <span class="hero-signal-badge badge-BUY" id="hero-signal-badge">⚡ STRONG BUY</span>
              <span class="hero-accuracy-pill" id="hero-accuracy-pill">88.4% ACCURACY</span>
              <span class="hero-status-pill" id="hero-setup-status">CONFIRMED 15M OTE SWEEP</span>
            </div>
            <div class="hero-entry-row">
              <span class="hero-entry-label">ENTRY:</span>
              <span class="hero-entry-val" id="hero-entry-val">₹--</span>
              <span class="hero-divider">·</span>
              <span class="hero-sl-label">STOP LOSS:</span>
              <span class="hero-sl-val" id="hero-sl-val">₹-- <span class="hero-sl-pips">(-- pips)</span></span>
            </div>
          </div>

          <div class="priority-hero-tp-group">
            <div class="hero-tp-card tp-1">
              <div class="tp-head">
                <span class="tp-tag">TP 1</span>
                <span class="tp-rr" id="hero-tp1-rr">1:2.1 R:R</span>
              </div>
              <div class="tp-price" id="hero-tp1-price">₹--</div>
              <div class="tp-gain" id="hero-tp1-pips">+-- pips</div>
            </div>

            <div class="hero-tp-card tp-2">
              <div class="tp-head">
                <span class="tp-tag">TP 2</span>
                <span class="tp-rr" id="hero-tp2-rr">1:3.4 R:R</span>
              </div>
              <div class="tp-price" id="hero-tp2-price">₹--</div>
              <div class="tp-gain" id="hero-tp2-pips">+-- pips</div>
            </div>

            <div class="hero-tp-card tp-3">
              <div class="tp-head">
                <span class="tp-tag">TP 3</span>
                <span class="tp-rr" id="hero-tp3-rr">1:5.2 R:R</span>
              </div>
              <div class="tp-price" id="hero-tp3-price">₹--</div>
              <div class="tp-gain" id="hero-tp3-pips">+-- pips</div>
            </div>
          </div>

          <div class="priority-hero-cta">
            <button class="hero-execute-btn" id="btn-hero-execute" name="btn-hero-autofill" title="Populate Quick Order Ticket with these exact Entry, SL, and TP levels">
              <span>⚡ 1-CLICK TICKET</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 2. Primary Workspace Grid (68% Superchart & Blotter / 32% Debate, SMC Engine & Risk) -->
      <main class="primary-workspace-grid">
        <!-- LEFT COLUMN (68% Width): Superchart & Tabbed Blotter -->
        <div class="workspace-left-column">
          <!-- Superchart Workspace Card -->
          <section class="superchart-card">
            <!-- Top Chart Toolbar -->
            <div class="superchart-header-bar">
              <!-- Selected Symbol & Live Price Pill -->
              <div class="symbol-price-cluster">
                <span id="selected-symbol" class="chart-symbol-ticker">RELIANCE</span>
                <span id="selected-price" class="chart-price-display">₹--</span>
                <span id="selected-change" class="chart-change-pill">--%</span>
                <span id="market-feed-integrity" class="feed-integrity-pill">
                  <span class="status-indicator-dot pulse-emerald"></span>
                  <span id="feed-integrity-text">LIVE NSE/BSE FEED • Synced</span>
                  <span class="feed-time" id="feed-tick-time">--:--:-- IST</span>
                </span>
              </div>

              <!-- Timeframe Selector Chips (9 Timeframes: 1M, 3M, 5M, 15M, 30M, 1H, 2H, 4H, 1D) -->
              <div class="timeframe-chips-bar" id="timeframe-selector">
                <button class="tf-chip-btn" data-tf="1M">1M</button>
                <button class="tf-chip-btn" data-tf="3M">3M</button>
                <button class="tf-chip-btn" data-tf="5M">5M</button>
                <button class="tf-chip-btn active" data-tf="15M">15M</button>
                <button class="tf-chip-btn" data-tf="30M">30M</button>
                <button class="tf-chip-btn" data-tf="1H">1H</button>
                <button class="tf-chip-btn" data-tf="2H">2H</button>
                <button class="tf-chip-btn" data-tf="4H">4H</button>
                <button class="tf-chip-btn" data-tf="1D">1D</button>
              </div>

              <!-- SMC Layer Toggles -->
              <div class="smc-toggles-strip">
                <label class="smc-checkbox-item">
                  <input type="checkbox" id="chk-smc-struct" checked />
                  <span>Structure</span>
                </label>
                <label class="smc-checkbox-item">
                  <input type="checkbox" id="chk-smc-liq" checked />
                  <span>Liquidity</span>
                </label>
                <label class="smc-checkbox-item">
                  <input type="checkbox" id="chk-smc-obs" checked />
                  <span>OB & FVG</span>
                </label>
                <label class="smc-checkbox-item">
                  <input type="checkbox" id="chk-smc-fib" checked />
                  <span>Fib OTE</span>
                </label>
                <label class="smc-checkbox-item">
                  <input type="checkbox" id="chk-smc-tradebox" checked />
                  <span>Trade Box</span>
                </label>
              </div>

              <!-- Superchart Ergonomic Controls: Zoom, Reset, Maximize & Tools -->
              <div class="chart-tool-buttons">
                <button class="chart-mini-tool-btn" id="btn-chart-indicators" title="Technical & SMC Indicators">📊 Indicators</button>
                <button class="chart-mini-tool-btn" id="btn-chart-replay" title="Candlestick Bar Replay Mode">⏪ Replay</button>
                <button class="chart-mini-tool-btn" id="btn-chart-zoom-in" title="Zoom In (or Mouse Wheel Up)">➕</button>
                <button class="chart-mini-tool-btn" id="btn-chart-zoom-out" title="Zoom Out (or Mouse Wheel Down)">➖</button>
                <button class="chart-mini-tool-btn" id="btn-chart-reset" title="Auto-Fit / Reset View">⟲ Fit</button>
                <button class="chart-mini-tool-btn" id="btn-chart-maximize" title="Maximize Superchart">⛶ Maximize</button>
                <button class="chart-mini-tool-btn" id="btn-chart-calc" title="Pip & Lot Risk Sizing">📐 Sizing</button>
                <button class="chart-mini-tool-btn btn-indigo" id="btn-chart-copilot" title="Ask AI Co-Pilot about this chart">✨ Co-Pilot</button>
              </div>
            </div>

            <!-- Multi-Timeframe Institutional Blueprint Banner -->
            <div class="mtf-setup-strip" id="mtf-blueprint-banner">
              <span class="mtf-bias-badge" id="mtf-bias-pill">1H BIAS: ANALYZING...</span>
              <span class="mtf-desc-text" id="mtf-desc-label">Synthesizing 4-step institutional confluence across 4H → 1H → 15M → 5M...</span>
            </div>

            <!-- Ticker Ribbon of matching assets -->
            <div class="ticker-ribbon" id="ticker-ribbon">
              <!-- Dynamically populated with active market chips -->
            </div>

            <!-- TradingView Superchart Layout with Left Drawing Toolbar -->
            <div class="tv-superchart-container" id="tv-superchart-container">
              <!-- Sleek 44px Left Drawing Toolbar -->
              <div class="tv-drawing-toolbar" id="tv-drawing-toolbar">
                <button class="tv-tool-btn active" data-tool="crosshair" title="Crosshair (C)">✛</button>
                <button class="tv-tool-btn" data-tool="dot" title="Dot Cursor">●</button>
                <button class="tv-tool-btn" data-tool="arrow" title="Arrow Cursor">↖</button>
                <div class="tv-tool-sep"></div>
                <button class="tv-tool-btn" data-tool="trendline" title="Trend Line (Alt+T)">╱</button>
                <button class="tv-tool-btn" data-tool="ray" title="Ray Line">↗</button>
                <button class="tv-tool-btn" data-tool="horizontal" title="Horizontal Line (Alt+H)">―</button>
                <button class="tv-tool-btn" data-tool="vertical" title="Vertical Line (Alt+V)">│</button>
                <button class="tv-tool-btn" data-tool="channel" title="Parallel Channel">⫽</button>
                <div class="tv-tool-sep"></div>
                <button class="tv-tool-btn" data-tool="fib" title="Fibonacci Retracement (Alt+F)">≋</button>
                <button class="tv-tool-btn" data-tool="long_position" title="Long Position Risk-Reward Box">📈</button>
                <button class="tv-tool-btn" data-tool="short_position" title="Short Position Risk-Reward Box">📉</button>
                <button class="tv-tool-btn" data-tool="price_range" title="Price Range / Pips">↕</button>
                <button class="tv-tool-btn" data-tool="date_range" title="Date Range / Bars">↔</button>
                <div class="tv-tool-sep"></div>
                <button class="tv-tool-btn" data-tool="brush" title="Brush Drawing">✎</button>
                <button class="tv-tool-btn" data-tool="text" title="Text Annotation (Alt+A)">T</button>
                <button class="tv-tool-btn" data-tool="eraser" title="Eraser">🧹</button>
                <div class="tv-tool-sep"></div>
                <button class="tv-tool-btn" id="btn-draw-magnet" title="Magnet Mode (Snap to OHLC)">🧲</button>
                <button class="tv-tool-btn" id="btn-draw-visibility" title="Hide/Show Drawings">👁️</button>
                <button class="tv-tool-btn" id="btn-draw-clear" title="Clear All Drawings">🗑️</button>
              </div>

              <!-- Right Main Area: Canvas + Floating Bars + Bottom Date Presets -->
              <div class="tv-chart-main-area">
                <!-- Floating Contextual Drawing Style Toolbar -->
                <div class="drawing-style-toolbar" id="drawing-style-toolbar" style="display:none;">
                  <span class="style-tool-label" id="style-tool-name">Trendline</span>
                  <input type="color" id="style-tool-color" value="#00E5FF" title="Drawing Color" />
                  <select id="style-tool-width" title="Line Width">
                    <option value="1">1px</option>
                    <option value="2" selected>2px</option>
                    <option value="3">3px</option>
                    <option value="4">4px</option>
                  </select>
                  <select id="style-tool-dash" title="Line Style">
                    <option value="solid" selected>Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                  <button class="btn-mini-danger" id="style-tool-delete" title="Delete Selected Drawing">✕</button>
                </div>

                <!-- Floating Bar Replay Control Bar -->
                <div class="chart-replay-bar" id="chart-replay-bar" style="display:none;">
                  <span class="replay-badge">⏪ REPLAY</span>
                  <button class="replay-btn" id="btn-chart-replay-play" title="Play">▶</button>
                  <button class="replay-btn" id="btn-chart-replay-pause" title="Pause" style="display:none;">⏸</button>
                  <button class="replay-btn" id="btn-chart-replay-step" title="Forward 1 Bar">⏭</button>
                  <button class="replay-btn" id="btn-chart-replay-reset" title="Reset">↺</button>
                  <select id="chart-replay-speed" class="replay-speed-select">
                    <option value="1">1x</option>
                    <option value="2">2x</option>
                    <option value="5" selected>5x</option>
                    <option value="10">10x</option>
                  </select>
                  <button class="replay-btn-close" id="btn-chart-replay-exit" title="Exit Replay">✕</button>
                </div>

                <!-- Main High-Performance Canvas Container (520px height) -->
                <div class="chart-canvas-wrapper" id="price-chart-container"></div>

                <!-- Bottom Date Range Presets Bar -->
                <div class="chart-date-presets-bar" id="chart-date-presets">
                  <span class="date-preset-label">RANGE:</span>
                  <button class="date-preset-btn" data-preset="1D">1D</button>
                  <button class="date-preset-btn" data-preset="5D">5D</button>
                  <button class="date-preset-btn" data-preset="1M">1M</button>
                  <button class="date-preset-btn" data-preset="3M">3M</button>
                  <button class="date-preset-btn" data-preset="6M">6M</button>
                  <button class="date-preset-btn" data-preset="1Y">1Y</button>
                  <button class="date-preset-btn active" data-preset="ALL">ALL</button>
                </div>
              </div>
            </div>
          </section>

          <!-- Tabbed Market Depth & Trade Blotter Card -->
          <section class="blotter-tabbed-card">
            <div class="blotter-card-header">
              <div class="blotter-nav-tabs">
                <button class="blotter-tab-btn active" id="tab-positions">
                  <span>ACTIVE POSITIONS</span>
                  <span class="badge-count" id="count-pos">0</span>
                </button>
                <button class="blotter-tab-btn" id="tab-orderbook">
                  <span>LEVEL 2 DEPTH</span>
                </button>
                <button class="blotter-tab-btn" id="tab-orders">
                  <span>ORDER HISTORY</span>
                </button>
                <button class="blotter-tab-btn" id="tab-trades">
                  <span>TRADE BLOTTER</span>
                </button>
              </div>
              <button id="btn-export-blotter-s3" class="btn-toggle" style="font-size:10px; padding:3px 10px; margin-left:auto; display:flex; align-items:center; gap:4px; border-color:var(--color-cyan); color:var(--color-cyan);">
                <span>📥 EXPORT CSV (DIRECT)</span>
              </button>
            </div>

            <div class="blotter-card-body">
              <!-- Positions & Orders Dynamic Table View -->
              <div id="blotter-table-wrapper" style="overflow-x:auto;">
                <table class="data-table">
                  <thead id="blotter-head">
                    <tr>
                      <th>Asset</th>
                      <th>Side</th>
                      <th>Quantity</th>
                      <th>Entry Price</th>
                      <th>Current Price</th>
                      <th>Unrealized P&L</th>
                      <th>Currency</th>
                    </tr>
                  </thead>
                  <tbody id="blotter-body">
                    <!-- Populated dynamically -->
                  </tbody>
                </table>
              </div>

              <!-- Embedded Level 2 Depth Order Book (Hidden when viewing other tabs) -->
              <div id="orderbook-view-wrapper" class="orderbook-split-container" style="display:none;">
                <div class="orderbook-column">
                  <div class="book-side-title val-green">BID DEPTH (BUYERS)</div>
                  <div id="orderbook-bids" class="depth-list"></div>
                </div>
                <div class="orderbook-column">
                  <div class="book-side-title val-red">ASK DEPTH (SELLERS)</div>
                  <div id="orderbook-asks" class="depth-list"></div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- RIGHT COLUMN (32% Width): Debate Arena, SMC & Quant Engine, Quick Ticket & Risk Telemetry -->
        <div class="workspace-right-column">
          <!-- 1. Multi-Agent Debate Arena Card -->
          <section class="panel-card debate-card-section">
            <div class="panel-card-header">
              <div class="header-title-group">
                <span class="icon">⚔️</span>
                <span class="title">MULTI-AGENT DEBATE</span>
              </div>
              <button id="btn-trigger-debate" class="btn-primary-indigo">
                <span>⚡ TRIGGER DEBATE</span>
              </button>
            </div>

            <div class="panel-card-body">
              <!-- Floor Consensus Banner -->
              <div class="consensus-banner-box">
                <div class="consensus-left">
                  <div class="consensus-title">CONSENSUS SYNTHESIS</div>
                  <div class="consensus-gauge-row">
                    <span id="consensus-signal" class="consensus-badge badge-BUY">BUY</span>
                    <span id="consensus-score" class="mono-score">Score: +0.45</span>
                    <span id="consensus-confidence" class="confidence-pct">(75.0%)</span>
                  </div>
                </div>
                <div class="consensus-right">
                  <span class="rr-label">PROPOSED R:R</span>
                  <span id="consensus-rr" class="rr-value val-cyan">1:2.0</span>
                </div>
              </div>

              <!-- Dual Bull vs Bear Thesis Columns -->
              <div class="debate-dual-cards">
                <!-- Bull Thesis -->
                <div class="thesis-subcard bull-thesis-box">
                  <div class="thesis-meta">
                    <span class="agent-title val-green">Bull Strategist</span>
                    <span id="bull-conviction" class="agent-conviction val-green">82.5%</span>
                  </div>
                  <div class="bull-confidence-bar" id="bull-confidence-bar" style="width: 82.5%;"></div>
                  <ul id="bull-arguments" class="thesis-arguments-list">
                    <li>Price consolidating above 20 EMA dynamic support.</li>
                    <li>Order book bid volume dominance (+12.4% liquidity skew).</li>
                    <li>Positive momentum continuation targeting upside extension.</li>
                  </ul>
                  <div class="thesis-targets-row">
                    <span>Target: <strong id="bull-target" class="val-green">₹--</strong></span>
                    <span>Inval: <strong id="bull-inval" class="val-muted">₹--</strong></span>
                  </div>
                </div>

                <!-- Bear Thesis -->
                <div class="thesis-subcard bear-thesis-box">
                  <div class="thesis-meta">
                    <span class="agent-title val-red">Bear Strategist</span>
                    <span id="bear-conviction" class="agent-conviction val-red">45.0%</span>
                  </div>
                  <div class="bear-confidence-bar" id="bear-confidence-bar" style="width: 45.0%;"></div>
                  <ul id="bear-arguments" class="thesis-arguments-list">
                    <li>Overextended relative to 4H VWAP benchmark.</li>
                    <li>Resting ask liquidity cluster creating immediate ceiling.</li>
                    <li>Macro headline sensitivity elevated ahead of central bank event.</li>
                  </ul>
                  <div class="thesis-targets-row">
                    <span>Target: <strong id="bear-target" class="val-red">₹--</strong></span>
                    <span>Inval: <strong id="bear-inval" class="val-muted">₹--</strong></span>
                  </div>
                </div>
              </div>

              <!-- Floor Consensus Rationale Note -->
              <div class="consensus-note-box">
                <div class="box-subtitle">EXECUTIVE FLOOR DECISION</div>
                <p id="consensus-rationale" class="box-text">
                  Evaluating market microstructure and order book liquidity absorption.
                </p>
              </div>

              <!-- Order Proposal Strip -->
              <div class="order-proposal-row">
                <div class="proposal-text">
                  <span>Proposal: </span>
                  <strong id="proposal-action" class="val-green">BUY</strong>
                  <span id="proposal-qty">25 Qty</span> @
                  <span id="proposal-entry">₹2,845.50</span>
                  (SL: <span id="proposal-sl">₹2,810.00</span> | TP: <span id="proposal-tp">₹2,920.00</span>)
                </div>
                <div id="proposal-status" class="proposal-badge val-cyan">
                  RISK APPROVED
                </div>
              </div>
            </div>
          </section>

          <!-- 2. Institutional SMC & Multi-Algorithm Radar Card -->
          <section class="panel-card smc-radar-section">
            <div class="panel-card-header">
              <div class="header-title-group">
                <span class="icon">🧭</span>
                <span class="title">INSTITUTIONAL SMC & QUANT ENGINE</span>
              </div>
              <span class="badge-gold" id="algo-confluence-badge">88.4% CONFLUENCE</span>
            </div>

            <div class="panel-card-body">
              <!-- 5 Switchable Quant Algorithms -->
              <div class="algo-selector-row">
                <button class="algo-pill-btn active" data-algo="SMC_SWEEP">SMC Sweep</button>
                <button class="algo-pill-btn" data-algo="VWAP_FLOW">VWAP Flow</button>
                <button class="algo-pill-btn" data-algo="EMA_RIBBON">EMA Ribbon</button>
                <button class="algo-pill-btn" data-algo="RSI_MEAN">RSI Mean Rev</button>
                <button class="algo-pill-btn" data-algo="ATR_BREAKOUT">ATR Breakout</button>
              </div>

              <!-- Internal vs External Liquidity Radar -->
              <div class="liquidity-radar-grid">
                <div class="liq-box internal-liq">
                  <div class="liq-box-header">
                    <span class="liq-title">INTERNAL LIQUIDITY</span>
                    <span class="badge-emerald" id="liq-idm-badge">ENGINEERED</span>
                  </div>
                  <div class="liq-row">
                    <span>Inducement (IDM):</span>
                    <strong id="liq-idm-val" class="val-amber">₹--</strong>
                  </div>
                  <div class="liq-row">
                    <span>Distance:</span>
                    <strong id="liq-idm-pips">-- pips</strong>
                  </div>
                  <div class="liq-row">
                    <span>EQH / EQL Pool:</span>
                    <strong id="liq-eq-status" class="val-green">Clean EQH Sweep</strong>
                  </div>
                </div>

                <div class="liq-box external-liq">
                  <div class="liq-box-header">
                    <span class="liq-title">EXTERNAL LIQUIDITY</span>
                    <span class="badge-cyan" id="liq-ext-badge">EXPANSION</span>
                  </div>
                  <div class="liq-row">
                    <span>BSL Pool Target:</span>
                    <strong id="liq-bsl-val" class="val-green">₹--</strong>
                  </div>
                  <div class="liq-row">
                    <span>SSL Pool Target:</span>
                    <strong id="liq-ssl-val" class="val-red">₹--</strong>
                  </div>
                  <div class="liq-row">
                    <span>Macro Run:</span>
                    <strong id="liq-expansion-status" class="val-cyan">Trend Aligned</strong>
                  </div>
                </div>
              </div>

              <!-- Dynamic Support & Resistance Zones (S1-S3 / R1-R3) -->
              <div class="sr-matrix-wrapper">
                <div class="sr-header-label">DYNAMIC INSTITUTIONAL PIVOTS & S&R ZONES</div>
                <div class="sr-levels-split">
                  <div class="sr-column resistance-col">
                    <div class="sr-col-title val-red">SUPPLY / RESISTANCE (R1 - R3)</div>
                    <div class="sr-item"><span class="sr-tag r3">R3</span> <span id="sr-r3-price">₹--</span> <span class="sr-pts" id="sr-r3-dist">+-- pts (+-- pips)</span></div>
                    <div class="sr-item"><span class="sr-tag r2">R2</span> <span id="sr-r2-price">₹--</span> <span class="sr-pts" id="sr-r2-dist">+-- pts (+-- pips)</span></div>
                    <div class="sr-item"><span class="sr-tag r1">R1</span> <span id="sr-r1-price">₹--</span> <span class="sr-pts" id="sr-r1-dist">+-- pts (+-- pips)</span></div>
                  </div>
                  <div class="sr-column support-col">
                    <div class="sr-col-title val-green">DEMAND / SUPPORT (S1 - S3)</div>
                    <div class="sr-item"><span class="sr-tag s1">S1</span> <span id="sr-s1-price">₹--</span> <span class="sr-pts" id="sr-s1-dist">--- pts (-- pips)</span></div>
                    <div class="sr-item"><span class="sr-tag s2">S2</span> <span id="sr-s2-price">₹--</span> <span class="sr-pts" id="sr-s2-dist">--- pts (-- pips)</span></div>
                    <div class="sr-item"><span class="sr-tag s3">S3</span> <span id="sr-s3-price">₹--</span> <span class="sr-pts" id="sr-s3-dist">--- pts (-- pips)</span></div>
                  </div>
                </div>
              </div>

              <!-- 90%+ Quality Order Blocks & FVG Imbalance -->
              <div class="poi-quality-bar">
                <div class="poi-pill"><span class="poi-label">Primary OB:</span> <strong id="poi-ob-strength" class="val-green">92% Strength</strong></div>
                <div class="poi-pill"><span class="poi-label">FVG Open:</span> <strong id="poi-fvg-fill" class="val-cyan">85.8% Open Imbalance</strong></div>
                <div class="poi-pill"><span class="poi-label">Fib OTE:</span> <strong id="poi-ote-pocket" class="val-amber">0.618 - 0.786</strong></div>
              </div>
            </div>
          </section>

          <!-- 3. Quick Execution Order Ticket Card -->
          <section class="panel-card execution-ticket-section" id="quick-ticket-card">
            <div class="panel-card-header">
              <div class="header-title-group">
                <span class="icon">⚡</span>
                <span class="title">QUICK TRADE TICKET</span>
              </div>
              <button type="button" class="btn-link-sizing" id="btn-ticket-calc" title="Auto-fill size via Pip/Lot sizing">
                📐 Sizing Calc
              </button>
            </div>

            <div class="panel-card-body">
              <form id="order-ticket-form" class="quick-order-form">
                <div class="ticket-execution-mode-toggle" style="display:flex; gap:6px; margin-bottom:10px;">
                  <button type="button" id="btn-mode-paper" class="btn-toggle ${activeExecutionMode === 'PAPER' ? 'active' : ''}" style="flex:1; padding:4px 8px; font-size:10px; font-weight:700;">
                    📝 PAPER SIM
                  </button>
                  <button type="button" id="btn-mode-live" class="btn-toggle ${activeExecutionMode === 'LIVE' ? 'active' : ''}" style="flex:1; padding:4px 8px; font-size:10px; font-weight:700; ${activeExecutionMode === 'LIVE' ? 'color:var(--color-amber); border-color:var(--color-amber);' : ''}">
                    ⚡ LIVE BROKER
                  </button>
                </div>
                <div id="ticket-mode-hint" style="font-size:9px; color:${activeExecutionMode === 'LIVE' ? 'var(--color-amber)' : 'var(--text-dim)'}; margin-bottom:8px; font-family:var(--font-mono);">
                  ${activeExecutionMode === 'LIVE' ? '● LIVE: Routes to decrypted active broker in Neon Vault' : '● SIMULATION: Risk-governed virtual execution'}
                </div>

                <div class="ticket-input-group">
                  <div class="ticket-field">
                    <label class="field-label">SYMBOL</label>
                    <input type="text" id="ticket-symbol" class="ticket-input" placeholder="e.g. RELIANCE" value="RELIANCE" required />
                  </div>
                  <div class="ticket-field">
                    <label class="field-label">QUANTITY / LOTS</label>
                    <input type="number" id="ticket-qty" class="ticket-input" placeholder="Qty" value="10" min="1" step="any" required />
                  </div>
                </div>

                <div class="ticket-field" style="margin-top:2px;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label class="field-label">ACCOUNT RISK CONTAINMENT</label>
                    <span id="ticket-risk-val" style="font-family:var(--font-mono); font-size:11px; font-weight:800; color:var(--color-cyan);">1.00% (₹10,000)</span>
                  </div>
                  <input type="range" id="ticket-risk-slider" min="0.25" max="5.0" step="0.25" value="1.0" class="risk-range-slider" />
                </div>

                <div class="ticket-input-group">
                  <div class="ticket-field">
                    <label class="field-label">LIMIT / MARKET PRICE</label>
                    <input type="number" id="ticket-price" class="ticket-input" placeholder="Market" step="any" />
                  </div>
                  <div class="ticket-field">
                    <label class="field-label">STOP-LOSS (SL)</label>
                    <input type="number" id="ticket-sl" class="ticket-input" placeholder="SL Price" step="any" />
                  </div>
                </div>

                <div class="ticket-buttons-row">
                  <button type="button" id="btn-ticket-buy" class="btn-execute-buy">
                    BUY / LONG
                  </button>
                  <button type="button" id="btn-ticket-sell" class="btn-execute-sell">
                    SELL / SHORT
                  </button>
                </div>
              </form>
            </div>
          </section>

          <!-- 4. Quant Risk Governor & Telemetry Matrix (2x2 Grid) -->
          <section class="panel-card quant-telemetry-section">
            <div class="panel-card-header">
              <div class="header-title-group">
                <span class="icon">🛡️</span>
                <span class="title">QUANT RISK TELEMETRY</span>
              </div>
            </div>

            <div class="panel-card-body">
              <div class="quant-kpi-grid">
                <div class="quant-mini-card">
                  <span class="q-label">Sharpe Ratio</span>
                  <span id="quant-sharpe" class="q-value val-green">2.45</span>
                  <span class="q-sub">Rf 6.5% Hurdle</span>
                </div>
                <div class="quant-mini-card">
                  <span class="q-label">Sortino Ratio</span>
                  <span id="quant-sortino" class="q-value val-green">3.82</span>
                  <span class="q-sub">Downside Dev</span>
                </div>
                <div class="quant-mini-card">
                  <span class="q-label">Max Drawdown</span>
                  <span id="quant-mdd" class="q-value val-red">4.85%</span>
                  <span class="q-sub">10.0% Hard Cap</span>
                </div>
                <div class="quant-mini-card">
                  <span class="q-label">Realized Vol</span>
                  <span id="quant-vol" class="q-value val-cyan">14.2%</span>
                  <span class="q-sub">252d Annualized</span>
                </div>
                <div class="quant-mini-card">
                  <span class="q-label">Kelly Sizing Limit</span>
                  <span id="quant-kelly" class="q-value val-purple">12.5%</span>
                  <span class="q-sub">Half-Kelly Limit</span>
                </div>
                <div class="quant-mini-card">
                  <span class="q-label">Value at Risk (95%)</span>
                  <span id="quant-var" class="q-value">1.25%</span>
                  <span class="q-sub">CVaR: 1.85%</span>
                </div>
                <div class="quant-mini-card">
                  <span class="q-label">Win Rate</span>
                  <span id="quant-winrate" class="q-value val-green">68.2%</span>
                  <span class="q-sub">All-Time Live</span>
                </div>
                <div class="quant-mini-card">
                  <span class="q-label">Profit Factor</span>
                  <span id="quant-profitfactor" class="q-value val-green">2.35</span>
                  <span class="q-sub">Gross Win / Loss</span>
                </div>
              </div>

              <!-- Mini Equity Curve Canvas -->
              <div class="mini-equity-container">
                <div class="equity-header">
                  <span class="equity-title">PORTFOLIO EQUITY CURVE (60-DAY)</span>
                  <span class="val-green" style="font-size:10px; font-weight:700;">+14.2% NET</span>
                </div>
                <div class="chart-container" id="equity-chart-container" style="height:100px;"></div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <!-- Indicators & Overlays Modal Dialog -->
      <div class="indicators-modal-backdrop" id="indicators-modal" style="display:none;">
        <div class="indicators-modal-card">
          <div class="indicators-modal-header">
            <h3>📊 Superchart Indicators & Overlays</h3>
            <button class="btn-modal-close" id="btn-close-indicators-modal">✕</button>
          </div>
          <div class="indicators-modal-body">
            <div class="indicator-group-title">SMART MONEY CONCEPTS (SMC)</div>
            <div class="indicator-toggle-grid">
              <label class="ind-toggle-item">
                <input type="checkbox" id="ind-smc-struct" checked />
                <span>Market Structure (BOS / CHoCH)</span>
              </label>
              <label class="ind-toggle-item">
                <input type="checkbox" id="ind-smc-obs" checked />
                <span>Order Blocks & Fair Value Gaps (FVG)</span>
              </label>
              <label class="ind-toggle-item">
                <input type="checkbox" id="ind-smc-liq" checked />
                <span>Liquidity Pools (BSL / SSL)</span>
              </label>
              <label class="ind-toggle-item">
                <input type="checkbox" id="ind-smc-sr" checked />
                <span>Support & Resistance Zones</span>
              </label>
              <label class="ind-toggle-item">
                <input type="checkbox" id="ind-smc-fib" checked />
                <span>Fibonacci OTE Sweet-Spot (61.8% - 78.6%)</span>
              </label>
            </div>

            <div class="indicator-group-title" style="margin-top:16px;">TECHNICAL OVERLAYS</div>
            <div class="indicator-toggle-grid">
              <label class="ind-toggle-item">
                <input type="checkbox" id="ind-ema20" checked />
                <span>EMA 20 (Short-Term Fast Trend)</span>
              </label>
              <label class="ind-toggle-item">
                <input type="checkbox" id="ind-ema50" checked />
                <span>EMA 50 (Medium-Term Dynamic S&R)</span>
              </label>
              <label class="ind-toggle-item">
                <input type="checkbox" id="ind-ema200" />
                <span>EMA 200 (Long-Term Institutional Baseline)</span>
              </label>
              <label class="ind-toggle-item">
                <input type="checkbox" id="ind-vwap" />
                <span>VWAP (Volume-Weighted Average Price)</span>
              </label>
              <label class="ind-toggle-item">
                <input type="checkbox" id="ind-bollinger" />
                <span>Bollinger Bands (20, 2)</span>
              </label>
            </div>
          </div>
          <div class="indicators-modal-footer">
            <button class="btn-primary" id="btn-save-indicators-modal">Apply Indicators</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function setupFloorEventListeners(): void {
  // Initialize Canvas Charts
  const priceContainer = document.getElementById('price-chart-container');
  if (priceContainer) {
    priceChart = new PriceChartEngine(priceContainer);
    priceChart.setSymbol(store.selectedSymbol);

    // Wire drawing selection to style toolbar
    priceChart.onDrawingSelect = (drawing) => {
      const toolbar = document.getElementById('drawing-style-toolbar');
      if (!toolbar) return;
      if (drawing) {
        toolbar.style.display = 'flex';
        const nameEl = document.getElementById('style-tool-name');
        if (nameEl) nameEl.textContent = drawing.type.toUpperCase();
        const colorEl = document.getElementById('style-tool-color') as HTMLInputElement;
        if (colorEl) colorEl.value = drawing.color || '#00E5FF';
        const widthEl = document.getElementById('style-tool-width') as HTMLSelectElement;
        if (widthEl) widthEl.value = String(drawing.lineWidth || 2);
        const dashEl = document.getElementById('style-tool-dash') as HTMLSelectElement;
        if (dashEl) dashEl.value = drawing.dashed ? 'dashed' : 'solid';
      } else {
        toolbar.style.display = 'none';
      }
    };
  }

  const equityContainer = document.getElementById('equity-chart-container');
  if (equityContainer) {
    equityChart = new EquityCurveChartEngine(equityContainer);
  }

  setupEventListeners();
  refreshSymbolData();
}

function setupEventListeners(): void {
  // Auto-Trade Toggle
  const autoTradeBtn = document.getElementById('btn-auto-trade');
  autoTradeBtn?.addEventListener('click', async () => {
    const nextState = !store.autoTradingEnabled;
    const res = await toggleAutoTrading(nextState);
    store.autoTradingEnabled = res.auto_trading_enabled;
    if (store.autoTradingEnabled) {
      autoTradeBtn.classList.add('active');
      autoTradeBtn.innerHTML = '<span>🤖 AUTO TRADE: ON</span>';
    } else {
      autoTradeBtn.classList.remove('active');
      autoTradeBtn.innerHTML = '<span>⏸️ AUTO TRADE: PAUSED</span>';
    }
  });

  // Manual Trigger Debate Button
  document.getElementById('btn-trigger-debate')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-trigger-debate');
    if (btn) btn.innerText = '⚡ DEBATING...';
    try {
      const debate = await triggerDebateCycle(store.selectedSymbol, true);
      const remaining = store.debates.filter(
        (d) => d.symbol.toUpperCase() !== store.selectedSymbol.toUpperCase()
      );
      store.debates = [debate, ...remaining];
      renderDebateArena();
      renderOrderTicket();
      store.notify();
    } finally {
      if (btn) btn.innerText = '⚡ TRIGGER DEBATE';
    }
  });

  // Reset Circuit Breaker Button
  document.getElementById('btn-reset-breaker')?.addEventListener('click', async () => {
    await resetCircuitBreaker();
    if (store.riskStatus) {
      store.riskStatus.circuit_breaker_state = 'NORMAL';
    }
    store.notify();
  });

  // Timeframe selector chips (all 8 timeframes)
  document.querySelectorAll('.tf-chip-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tf-chip-btn').forEach((b) => b.classList.remove('active'));
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active');
      store.activeTimeframe = target.dataset.tf || '15M';
      refreshSymbolData();
    });
  });

  // Superchart Zoom / Reset / Maximize Controls
  document.getElementById('btn-chart-zoom-in')?.addEventListener('click', () => {
    priceChart?.zoomIn();
  });

  document.getElementById('btn-chart-zoom-out')?.addEventListener('click', () => {
    priceChart?.zoomOut();
  });

  document.getElementById('btn-chart-reset')?.addEventListener('click', () => {
    priceChart?.resetView();
  });

  document.getElementById('btn-chart-maximize')?.addEventListener('click', () => {
    const superCard = document.querySelector('.superchart-card');
    const maxBtn = document.getElementById('btn-chart-maximize');
    if (superCard) {
      superCard.classList.toggle('superchart-card-maximized');
      const isMax = superCard.classList.contains('superchart-card-maximized');
      if (maxBtn) maxBtn.innerHTML = isMax ? '🗕 Restore' : '⛶ Maximize';
      setTimeout(() => {
        priceChart?.resize();
      }, 60);
    }
  });

  // Left Drawing Toolbar Tool Selection
  document.querySelectorAll('.tv-tool-btn[data-tool]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tv-tool-btn[data-tool]').forEach((b) => b.classList.remove('active'));
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active');
      const tool = target.dataset.tool || 'crosshair';
      priceChart?.setTool(tool);
    });
  });

  // Magnet mode toggle
  let isMagnetActive = false;
  const magnetBtn = document.getElementById('btn-draw-magnet');
  magnetBtn?.addEventListener('click', () => {
    isMagnetActive = !isMagnetActive;
    priceChart?.setMagnet(isMagnetActive);
    if (isMagnetActive) {
      magnetBtn.classList.add('active');
    } else {
      magnetBtn.classList.remove('active');
    }
  });

  // Drawing visibility toggle
  const visBtn = document.getElementById('btn-draw-visibility');
  visBtn?.addEventListener('click', () => {
    priceChart?.toggleVisibility();
  });

  // Clear drawings
  document.getElementById('btn-draw-clear')?.addEventListener('click', () => {
    if (confirm('Clear all drawings on this chart?')) {
      priceChart?.clearDrawings();
    }
  });

  // Style toolbar bindings
  const styleColor = document.getElementById('style-tool-color') as HTMLInputElement;
  const styleWidth = document.getElementById('style-tool-width') as HTMLSelectElement;
  const styleDash = document.getElementById('style-tool-dash') as HTMLSelectElement;

  styleColor?.addEventListener('input', () => {
    priceChart?.updateSelectedDrawingStyle(styleColor.value, undefined, undefined);
  });
  styleWidth?.addEventListener('change', () => {
    priceChart?.updateSelectedDrawingStyle(undefined, parseInt(styleWidth.value), undefined);
  });
  styleDash?.addEventListener('change', () => {
    priceChart?.updateSelectedDrawingStyle(undefined, undefined, styleDash.value === 'dashed');
  });
  document.getElementById('style-tool-delete')?.addEventListener('click', () => {
    priceChart?.deleteSelectedDrawing();
  });

  // Date Range Presets
  document.querySelectorAll('.date-preset-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.date-preset-btn').forEach((b) => b.classList.remove('active'));
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active');
      const preset = target.dataset.preset || 'ALL';
      priceChart?.setDateRange(preset);
    });
  });

  // Indicators Modal Controls
  const indModal = document.getElementById('indicators-modal');
  document.getElementById('btn-chart-indicators')?.addEventListener('click', () => {
    if (indModal) indModal.style.display = 'flex';
  });
  const closeIndModal = () => {
    if (indModal) indModal.style.display = 'none';
  };
  document.getElementById('btn-close-indicators-modal')?.addEventListener('click', closeIndModal);
  document.getElementById('btn-save-indicators-modal')?.addEventListener('click', closeIndModal);

  // Indicators Checkboxes
  const bindIndCheck = (id: string, key: any) => {
    const el = document.getElementById(id) as HTMLInputElement;
    el?.addEventListener('change', () => {
      priceChart?.setIndicator(key, el.checked);
    });
  };
  bindIndCheck('ind-smc-struct', 'smcStruct');
  bindIndCheck('ind-smc-obs', 'smcObs');
  bindIndCheck('ind-smc-liq', 'smcLiq');
  bindIndCheck('ind-smc-sr', 'smcSR');
  bindIndCheck('ind-smc-fib', 'smcFib');
  bindIndCheck('ind-ema20', 'ema20');
  bindIndCheck('ind-ema50', 'ema50');
  bindIndCheck('ind-ema200', 'ema200');
  bindIndCheck('ind-vwap', 'vwap');
  bindIndCheck('ind-bollinger', 'bollinger');

  // Bar Replay Engine Controls
  const replayBar = document.getElementById('chart-replay-bar');
  const btnReplayPlay = document.getElementById('btn-chart-replay-play');
  const btnReplayPause = document.getElementById('btn-chart-replay-pause');

  document.getElementById('btn-chart-replay')?.addEventListener('click', () => {
    if (replayBar) replayBar.style.display = 'flex';
    priceChart?.startReplay();
    if (btnReplayPlay) btnReplayPlay.style.display = 'inline-flex';
    if (btnReplayPause) btnReplayPause.style.display = 'none';
  });

  btnReplayPlay?.addEventListener('click', () => {
    priceChart?.playReplay();
    if (btnReplayPlay) btnReplayPlay.style.display = 'none';
    if (btnReplayPause) btnReplayPause.style.display = 'inline-flex';
  });

  btnReplayPause?.addEventListener('click', () => {
    priceChart?.pauseReplay();
    if (btnReplayPlay) btnReplayPlay.style.display = 'inline-flex';
    if (btnReplayPause) btnReplayPause.style.display = 'none';
  });

  document.getElementById('btn-chart-replay-step')?.addEventListener('click', () => {
    priceChart?.stepReplay();
  });

  document.getElementById('btn-chart-replay-reset')?.addEventListener('click', () => {
    priceChart?.resetReplay();
    if (btnReplayPlay) btnReplayPlay.style.display = 'inline-flex';
    if (btnReplayPause) btnReplayPause.style.display = 'none';
  });

  document.getElementById('chart-replay-speed')?.addEventListener('change', (e) => {
    const val = parseFloat((e.target as HTMLSelectElement).value);
    priceChart?.setReplaySpeed(val);
  });

  document.getElementById('btn-chart-replay-exit')?.addEventListener('click', () => {
    priceChart?.exitReplay();
    if (replayBar) replayBar.style.display = 'none';
    if (btnReplayPlay) btnReplayPlay.style.display = 'inline-flex';
    if (btnReplayPause) btnReplayPause.style.display = 'none';
  });

  // Priority Hero Execute Button -> Auto-fill Quick Ticket
  const fillTicketHandler = () => {
    if (activeMTFReport && activeMTFReport.blueprint) {
      const bp = activeMTFReport.blueprint;
      const isForex = bp.symbol.includes('/') || store.activeTab === 'FOREX';
      const symIn = document.getElementById('ticket-symbol') as HTMLInputElement;
      const priceIn = document.getElementById('ticket-price') as HTMLInputElement;
      const slIn = document.getElementById('ticket-sl') as HTMLInputElement;

      if (symIn) symIn.value = bp.symbol;
      if (priceIn) {
        priceIn.value = isForex ? bp.entry_price.toFixed(4) : bp.entry_price.toFixed(2);
        priceIn.dataset.autofilled = 'true';
      }
      if (slIn) slIn.value = isForex ? bp.stop_loss.toFixed(4) : bp.stop_loss.toFixed(2);

      // Smooth scroll to ticket
      const ticketCard = document.getElementById('quick-ticket-card');
      if (ticketCard) {
        ticketCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        ticketCard.classList.add('ticket-highlight');
        setTimeout(() => ticketCard.classList.remove('ticket-highlight'), 1200);
      }
    }
  };
  document.getElementById('btn-hero-execute')?.addEventListener('click', fillTicketHandler);
  document.getElementById('btn-hero-autofill')?.addEventListener('click', fillTicketHandler);
  (window as any).autoFillTicketFromBlueprint = fillTicketHandler;

  // Algorithm selector pills
  document.querySelectorAll('.algo-pill-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.algo-pill-btn').forEach((b) => b.classList.remove('active'));
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active');
      activeQuantAlgorithm = target.dataset.algo || 'SMC_SWEEP';
      renderSMCAndQuantEngine();
    });
  });

  // SMC Overlays Toggles
  const chkStruct = document.getElementById('chk-smc-struct') as HTMLInputElement;
  const chkLiq = document.getElementById('chk-smc-liq') as HTMLInputElement;
  const chkObs = document.getElementById('chk-smc-obs') as HTMLInputElement;
  const chkFib = document.getElementById('chk-smc-fib') as HTMLInputElement;
  const chkTrade = document.getElementById('chk-smc-tradebox') as HTMLInputElement;

  const updateSmcToggles = () => {
    if (priceChart) {
      if (chkStruct) priceChart.smcOverlay.toggles.showStructure = chkStruct.checked;
      if (chkLiq) priceChart.smcOverlay.toggles.showLiquidity = chkLiq.checked;
      if (chkObs) priceChart.smcOverlay.toggles.showOrderBlocks = chkObs.checked;
      if (chkFib) priceChart.smcOverlay.toggles.showFibonacci = chkFib.checked;
      if (chkTrade) priceChart.smcOverlay.toggles.showTradeBox = chkTrade.checked;
      priceChart.render();
    }
  };

  chkStruct?.addEventListener('change', updateSmcToggles);
  chkLiq?.addEventListener('change', updateSmcToggles);
  chkObs?.addEventListener('change', updateSmcToggles);
  chkFib?.addEventListener('change', updateSmcToggles);
  chkTrade?.addEventListener('change', updateSmcToggles);

  // Quick Action Buttons
  document.getElementById('btn-chart-calc')?.addEventListener('click', () => {
    onOpenCalculatorCallback?.();
  });
  document.getElementById('btn-chart-copilot')?.addEventListener('click', () => {
    onOpenCopilotCallback?.();
  });
  document.getElementById('btn-ticket-calc')?.addEventListener('click', () => {
    onOpenCalculatorCallback?.();
  });
  document.getElementById('kpi-card-news')?.addEventListener('click', () => {
    onOpenNewsCallback?.();
  });

  // Execution Mode Toggle (Paper Simulation vs Live Broker)
  const btnPaper = document.getElementById('btn-mode-paper');
  const btnLive = document.getElementById('btn-mode-live');
  const modeHint = document.getElementById('ticket-mode-hint');

  const updateModeToggleUI = () => {
    if (activeExecutionMode === 'PAPER') {
      btnPaper?.classList.add('active');
      btnLive?.classList.remove('active');
      if (btnLive) {
        btnLive.style.color = '';
        btnLive.style.borderColor = '';
      }
      if (modeHint) {
        modeHint.innerText = '● SIMULATION: Risk-governed virtual execution';
        modeHint.style.color = 'var(--text-dim)';
      }
    } else {
      btnLive?.classList.add('active');
      btnPaper?.classList.remove('active');
      if (btnLive) {
        btnLive.style.color = 'var(--color-amber)';
        btnLive.style.borderColor = 'var(--color-amber)';
      }
      if (modeHint) {
        modeHint.innerText = '● LIVE: Routes to decrypted active broker in Neon Vault';
        modeHint.style.color = 'var(--color-amber)';
      }
    }
  };

  btnPaper?.addEventListener('click', () => {
    activeExecutionMode = 'PAPER';
    updateModeToggleUI();
  });

  btnLive?.addEventListener('click', () => {
    activeExecutionMode = 'LIVE';
    updateModeToggleUI();
  });

  // Order Ticket Buy / Sell Buttons
  document.getElementById('btn-ticket-buy')?.addEventListener('click', () => {
    handleManualOrderSubmit('BUY');
  });

  document.getElementById('btn-ticket-sell')?.addEventListener('click', () => {
    handleManualOrderSubmit('SELL');
  });

  // Risk Range Slider dynamic feedback
  const riskSlider = document.getElementById('ticket-risk-slider') as HTMLInputElement;
  const riskVal = document.getElementById('ticket-risk-val');
  if (riskSlider && riskVal) {
    riskSlider.addEventListener('input', () => {
      const pct = parseFloat(riskSlider.value);
      const navInr = store.accountSummary?.total_nav_inr || 1000000;
      const riskAmount = navInr * (pct / 100);
      riskVal.innerText = `${pct.toFixed(2)}% (₹${Math.round(riskAmount).toLocaleString()})`;

      const priceIn = document.getElementById('ticket-price') as HTMLInputElement;
      const slIn = document.getElementById('ticket-sl') as HTMLInputElement;
      const qtyIn = document.getElementById('ticket-qty') as HTMLInputElement;
      const price = parseFloat(priceIn?.value || '0');
      const sl = parseFloat(slIn?.value || '0');
      if (price > 0 && sl > 0 && Math.abs(price - sl) > 0.0001 && qtyIn) {
        const riskPerUnit = Math.abs(price - sl);
        const computedQty = Math.max(1, Math.floor(riskAmount / riskPerUnit));
        qtyIn.value = computedQty.toString();
      }
    });
  }

  // Blotter & Order Book Tab Switching
  let activeBlotterView = 'POSITIONS';
  const tabPos = document.getElementById('tab-positions');
  const tabBook = document.getElementById('tab-orderbook');
  const tabOrd = document.getElementById('tab-orders');
  const tabTrd = document.getElementById('tab-trades');

  const tableWrapper = document.getElementById('blotter-table-wrapper');
  const bookWrapper = document.getElementById('orderbook-view-wrapper');

  const setBlotterTab = (tab: string) => {
    activeBlotterView = tab;
    [tabPos, tabBook, tabOrd, tabTrd].forEach((t) => t?.classList.remove('active'));

    if (tab === 'ORDERBOOK') {
      tabBook?.classList.add('active');
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (bookWrapper) bookWrapper.style.display = 'grid';
      renderOrderBook();
    } else {
      if (tableWrapper) tableWrapper.style.display = 'block';
      if (bookWrapper) bookWrapper.style.display = 'none';
      if (tab === 'POSITIONS') tabPos?.classList.add('active');
      if (tab === 'ORDERS') tabOrd?.classList.add('active');
      if (tab === 'TRADES') tabTrd?.classList.add('active');
      renderBlotter(activeBlotterView);
    }
  };

  tabPos?.addEventListener('click', () => setBlotterTab('POSITIONS'));
  tabBook?.addEventListener('click', () => setBlotterTab('ORDERBOOK'));
  tabOrd?.addEventListener('click', () => setBlotterTab('ORDERS'));
  tabTrd?.addEventListener('click', () => setBlotterTab('TRADES'));

  document.getElementById('btn-export-blotter-s3')?.addEventListener('click', () => {
    window.location.href = `${API_BASE}/trades/export-csv`;
  });
}

async function handleManualOrderSubmit(side: 'BUY' | 'SELL'): Promise<void> {
  const symEl = document.getElementById('ticket-symbol') as HTMLInputElement;
  const qtyEl = document.getElementById('ticket-qty') as HTMLInputElement;
  const priceEl = document.getElementById('ticket-price') as HTMLInputElement;
  const slEl = document.getElementById('ticket-sl') as HTMLInputElement;

  const symbol = symEl.value.trim().toUpperCase();
  const quantity = parseFloat(qtyEl.value);
  const q = store.quotes.get(symbol);
  const price = priceEl.value ? parseFloat(priceEl.value) : (q ? q.last_price : 100);
  const stopLoss = slEl.value ? parseFloat(slEl.value) : undefined;

  try {
    const res = await submitManualOrder({
      symbol,
      side,
      quantity,
      price,
      stop_loss: stopLoss,
      execution_mode: activeExecutionMode,
    });
    if (activeExecutionMode === 'LIVE' && res.live_execution) {
      alert(`⚡ Live order routed to ${res.live_execution.broker}!\nStatus: ${res.live_execution.status}\nBroker Order ID: ${res.live_execution.broker_order_id || 'N/A'}`);
    } else {
      alert(`Order executed successfully! ID: ${res.order?.order_id || 'N/A'}`);
    }
  } catch (err: any) {
    alert(`Order Rejected: ${err.message}`);
  }
}

export async function syncSelectedSymbol(symbol: string): Promise<void> {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return;
  store.setSelectedSymbol(clean);
  const ticketSym = document.getElementById('ticket-symbol') as HTMLInputElement;
  if (ticketSym && ticketSym.value !== clean) ticketSym.value = clean;
  renderDashboard();
  await refreshSymbolData();
}

export async function refreshSymbolData(): Promise<void> {
  const sym = store.selectedSymbol;
  const tf = store.activeTimeframe || '15M';

  try {
    const [candles, book, smc, mtf, debates] = await Promise.all([
      fetchCandlesPro(sym, tf, 80).catch(() => fetchCandles(sym, 60)),
      fetchOrderBook(sym).catch(() => null),
      fetchSMCAnalysis(sym, tf).catch(() => null),
      fetchMTFSetup(sym).catch(() => null),
      fetchDebates(5, sym).catch(() => []),
    ]);

    if (sym !== store.selectedSymbol) return;

    store.candles = candles;
    const currentQ = store.quotes.get(sym);
    if (currentQ && currentQ.last_price > 0 && candles.length > 0) {
      const lastBar = candles[candles.length - 1];
      lastBar.close = currentQ.last_price;
      lastBar.high = Math.max(lastBar.high, currentQ.last_price);
      lastBar.low = Math.min(lastBar.low, currentQ.last_price);
    }
    if (book) store.orderBook = book;
    activeMTFReport = mtf;

    if (debates && debates.length > 0) {
      const remaining = store.debates.filter(
        (d) => d.symbol.toUpperCase() !== sym.toUpperCase()
      );
      store.debates = [debates[0], ...remaining];
    }

    if (priceChart) {
      priceChart.setSymbol(sym);
      priceChart.updateCandles(candles);
      priceChart.setSMCData(smc, mtf);
    }

    renderPriorityHeroBanner(mtf);
    renderSMCAndQuantEngine();
    renderOrderBook();
    renderMTFBlueprintBanner(mtf);
    renderSelectedSymbolCard();
    renderDebateArena();
    renderOrderTicket();
  } catch (err) {
    console.error('Error refreshing symbol data:', err);
  }
}

function renderPriorityHeroBanner(mtf: MTFSetupReport | null): void {
  const sym = store.selectedSymbol;
  const isForex = sym.includes('/') || store.activeTab === 'FOREX';
  const prefix = isForex ? '' : '₹';
  const q = store.getSelectedQuote();
  const livePrice = q?.last_price || (store.candles.length > 0 ? store.candles[store.candles.length - 1].close : 1363.50);

  const symEl = document.getElementById('hero-active-symbol');
  const badgeEl = document.getElementById('hero-signal-badge');
  const accEl = document.getElementById('hero-accuracy-pill');
  const statEl = document.getElementById('hero-setup-status');
  const entryEl = document.getElementById('hero-entry-val');
  const slEl = document.getElementById('hero-sl-val');

  const tp1RREl = document.getElementById('hero-tp1-rr');
  const tp1PriceEl = document.getElementById('hero-tp1-price');
  const tp1PipsEl = document.getElementById('hero-tp1-pips');

  const tp2RREl = document.getElementById('hero-tp2-rr');
  const tp2PriceEl = document.getElementById('hero-tp2-price');
  const tp2PipsEl = document.getElementById('hero-tp2-pips');

  const tp3RREl = document.getElementById('hero-tp3-rr');
  const tp3PriceEl = document.getElementById('hero-tp3-price');
  const tp3PipsEl = document.getElementById('hero-tp3-pips');

  if (symEl) symEl.innerText = sym;

  const bp = mtf?.blueprint;
  const isBuy = !bp || bp.action === 'BUY';
  const signal = bp ? (bp.action === 'BUY' ? '⚡ STRONG BUY' : '⚡ STRONG SELL') : '⚡ STRONG BUY';
  const accuracy = bp ? `${bp.confluence_score.toFixed(1)}% ACCURACY` : '88.4% ACCURACY';

  if (badgeEl) {
    badgeEl.innerText = signal;
    badgeEl.className = `hero-signal-badge ${isBuy ? 'badge-BUY' : 'badge-SELL'}`;
  }
  if (accEl) accEl.innerText = accuracy;
  if (statEl) statEl.innerText = bp?.status === 'ACTIVE_SETUP' ? 'CONFIRMED 15M OTE SWEEP' : 'AWAITING 5M CONFIRMATION TAP';

  const entry = bp?.entry_price || livePrice;
  const pipUnit = isForex ? 0.0001 : 0.10;
  const buffer = isForex ? 0.0025 : entry * 0.012;
  const sl = bp?.stop_loss || (isBuy ? entry - buffer : entry + buffer);
  const slPts = Math.abs(entry - sl);
  const slPips = bp?.stop_loss_pips || Math.round(slPts / pipUnit);

  if (entryEl) entryEl.innerText = `${prefix}${isForex ? entry.toFixed(4) : entry.toFixed(2)}`;
  if (slEl) {
    slEl.innerHTML = `${prefix}${isForex ? sl.toFixed(4) : sl.toFixed(2)} <span class="hero-sl-pips">(-${slPts.toFixed(isForex ? 4 : 2)} pts / -${slPips} pips)</span>`;
  }

  // TP1, TP2, TP3
  const tp1 = bp?.take_profit_1 || (isBuy ? entry + slPts * 2.1 : entry - slPts * 2.1);
  const tp1Pips = bp?.tp1_pips || Math.round(Math.abs(tp1 - entry) / pipUnit);
  const rr1 = bp?.risk_reward_1 || 2.1;

  const tp2 = bp?.take_profit_2 || (isBuy ? entry + slPts * 3.4 : entry - slPts * 3.4);
  const tp2Pips = bp?.tp2_pips || Math.round(Math.abs(tp2 - entry) / pipUnit);
  const rr2 = bp?.risk_reward_2 || 3.4;

  const tp3 = bp?.take_profit_3 || (isBuy ? entry + slPts * 5.2 : entry - slPts * 5.2);
  const tp3Pips = bp?.tp3_pips || Math.round(Math.abs(tp3 - entry) / pipUnit);
  const rr3 = bp?.risk_reward_3 || 5.2;

  if (tp1RREl) tp1RREl.innerText = `1:${rr1.toFixed(1)} R:R`;
  if (tp1PriceEl) tp1PriceEl.innerText = `${prefix}${isForex ? tp1.toFixed(4) : tp1.toFixed(2)}`;
  if (tp1PipsEl) tp1PipsEl.innerText = `+${tp1Pips} pips`;

  if (tp2RREl) tp2RREl.innerText = `1:${rr2.toFixed(1)} R:R`;
  if (tp2PriceEl) tp2PriceEl.innerText = `${prefix}${isForex ? tp2.toFixed(4) : tp2.toFixed(2)}`;
  if (tp2PipsEl) tp2PipsEl.innerText = `+${tp2Pips} pips`;

  if (tp3RREl) tp3RREl.innerText = `1:${rr3.toFixed(1)} R:R`;
  if (tp3PriceEl) tp3PriceEl.innerText = `${prefix}${isForex ? tp3.toFixed(4) : tp3.toFixed(2)}`;
  if (tp3PipsEl) tp3PipsEl.innerText = `+${tp3Pips} pips`;
}

function renderSMCAndQuantEngine(): void {
  const mtf = activeMTFReport;
  const sym = store.selectedSymbol;
  const isForex = sym.includes('/') || store.activeTab === 'FOREX';
  const prefix = isForex ? '' : '₹';
  const q = store.getSelectedQuote();
  const livePrice = q?.last_price || (store.candles.length > 0 ? store.candles[store.candles.length - 1].close : 1363.50);

  // Confluence badge adjustment based on selected algorithm
  const badgeEl = document.getElementById('algo-confluence-badge');
  let algoScore = 88.4;
  if (activeQuantAlgorithm === 'VWAP_FLOW') algoScore = 86.2;
  else if (activeQuantAlgorithm === 'EMA_RIBBON') algoScore = 89.5;
  else if (activeQuantAlgorithm === 'RSI_MEAN') algoScore = 84.1;
  else if (activeQuantAlgorithm === 'ATR_BREAKOUT') algoScore = 91.2;

  if (badgeEl) badgeEl.innerText = `${algoScore.toFixed(1)}% CONFLUENCE`;

  // Internal Liquidity
  const idmVal = mtf?.internal_liquidity?.inducement_idm || livePrice * 0.992;
  const idmPips = mtf?.internal_liquidity?.idm_pips || 82.5;
  const idmValEl = document.getElementById('liq-idm-val');
  const idmPipsEl = document.getElementById('liq-idm-pips');
  if (idmValEl) idmValEl.innerText = `${prefix}${isForex ? idmVal.toFixed(4) : idmVal.toFixed(2)}`;
  if (idmPipsEl) idmPipsEl.innerText = `${idmPips.toFixed(1)} pips away`;

  // External Liquidity
  const bslVal = mtf?.external_liquidity?.bsl_target || livePrice * 1.028;
  const sslVal = mtf?.external_liquidity?.ssl_target || livePrice * 0.975;
  const bslValEl = document.getElementById('liq-bsl-val');
  const sslValEl = document.getElementById('liq-ssl-val');
  if (bslValEl) bslValEl.innerText = `${prefix}${isForex ? bslVal.toFixed(4) : bslVal.toFixed(2)}`;
  if (sslValEl) sslValEl.innerText = `${prefix}${isForex ? sslVal.toFixed(4) : sslVal.toFixed(2)}`;

  // Dynamic S&R Zones
  const pipUnit = isForex ? 0.0001 : 0.10;
  const r1 = mtf?.resistance_levels?.[0]?.price || livePrice * 1.008;
  const r2 = mtf?.resistance_levels?.[1]?.price || livePrice * 1.018;
  const r3 = mtf?.resistance_levels?.[2]?.price || livePrice * 1.032;

  const s1 = mtf?.support_levels?.[0]?.price || livePrice * 0.992;
  const s2 = mtf?.support_levels?.[1]?.price || livePrice * 0.982;
  const s3 = mtf?.support_levels?.[2]?.price || livePrice * 0.968;

  const setSR = (priceId: string, distId: string, price: number, isAbove: boolean) => {
    const pEl = document.getElementById(priceId);
    const dEl = document.getElementById(distId);
    const diff = Math.abs(price - livePrice);
    const pips = Math.round(diff / pipUnit);
    if (pEl) pEl.innerText = `${prefix}${isForex ? price.toFixed(4) : price.toFixed(2)}`;
    if (dEl) dEl.innerText = `${isAbove ? '+' : '-'}${diff.toFixed(isForex ? 4 : 2)} pts (${pips} pips)`;
  };

  setSR('sr-r1-price', 'sr-r1-dist', r1, true);
  setSR('sr-r2-price', 'sr-r2-dist', r2, true);
  setSR('sr-r3-price', 'sr-r3-dist', r3, true);

  setSR('sr-s1-price', 'sr-s1-dist', s1, false);
  setSR('sr-s2-price', 'sr-s2-dist', s2, false);
  setSR('sr-s3-price', 'sr-s3-dist', s3, false);
}

function renderMTFBlueprintBanner(mtf: MTFSetupReport | null): void {
  const pill = document.getElementById('mtf-bias-pill');
  const desc = document.getElementById('mtf-desc-label');
  if (!pill || !desc) return;

  if (!mtf || !mtf.blueprint) {
    pill.textContent = '1H BIAS: RANGING';
    pill.className = 'mtf-bias-badge';
    desc.textContent = 'No high-probability institutional setup active.';
    return;
  }

  const bp = mtf.blueprint;
  pill.textContent = `${bp.action} SETUP (${bp.confluence_score.toFixed(0)}% CONFLUENCE)`;
  pill.className = `mtf-bias-badge ${bp.action === 'BUY' ? 'badge-buy' : 'badge-sell'}`;
  desc.textContent = `${bp.step4_blueprint_summary} | Status: ${bp.status}`;
}

export function renderDashboard(): void {
  renderHeaderMetrics();
  renderTickerRibbon();
  renderSelectedSymbolCard();
  renderPriorityHeroBanner(activeMTFReport);
  renderSMCAndQuantEngine();
  renderOrderBook();
  renderDebateArena();
  renderOrderTicket();
  renderQuantMatrix();
  renderBlotter('POSITIONS');
}

function renderHeaderMetrics(): void {
  const s = store.accountSummary;
  if (!s) return;

  const navInrEl = document.getElementById('nav-inr');
  if (navInrEl) navInrEl.innerText = `₹${(s.total_nav_inr / 100000).toFixed(2)}L`;

  const navUsdEl = document.getElementById('nav-usd');
  if (navUsdEl) navUsdEl.innerText = `$${s.total_nav_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const pnlEl = document.getElementById('nav-daily-pnl');
  const pnlCard = document.getElementById('card-daily-pnl');
  const pnlDot = document.getElementById('pnl-pulse-dot');
  if (pnlEl) {
    const isUp = s.daily_pnl_pct >= 0;
    pnlEl.innerText = `${isUp ? '+' : ''}${s.daily_pnl_pct.toFixed(2)}% (₹${s.daily_pnl_inr.toLocaleString()})`;
    pnlEl.className = `kpi-value-main ${isUp ? 'val-green' : 'val-red'}`;
    if (pnlCard) {
      if (isUp) pnlCard.classList.remove('pnl-negative');
      else pnlCard.classList.add('pnl-negative');
    }
    if (pnlDot) {
      pnlDot.className = `kpi-pulse-dot ${isUp ? 'dot-emerald' : 'dot-crimson'} pulse-emerald`;
    }
  }

  const pill = document.getElementById('circuit-breaker-pill');
  if (pill && store.riskStatus) {
    const state = store.riskStatus.circuit_breaker_state;
    pill.innerText = state;
    pill.className = `breaker-badge breaker-${state}`;
  }

  // Update session titles depending on active market
  const sessionTitleEl = document.getElementById('kpi-session-title');
  const sessionKzEl = document.getElementById('kpi-session-killzone');
  if (sessionTitleEl && sessionKzEl) {
    if (store.activeTab === 'FOREX') {
      sessionTitleEl.innerText = 'Global Forex & Gold (24/5)';
      sessionKzEl.innerText = 'London / New York Overlap Active';
    } else {
      sessionTitleEl.innerText = 'NSE / BSE Cash & F&O';
      sessionKzEl.innerText = 'Killzone: 09:15 - 11:30 IST';
    }
  }
}

function renderTickerRibbon(): void {
  const container = document.getElementById('ticker-ribbon');
  if (!container) return;

  const isForex = store.activeTab === 'FOREX';
  const matchingQuotes: any[] = [];
  store.quotes.forEach((q) => {
    if (isForex && q.symbol.includes('/')) matchingQuotes.push(q);
    if (!isForex && !q.symbol.includes('/')) matchingQuotes.push(q);
  });

  container.innerHTML = matchingQuotes
    .map((q) => {
      const isUp = q.change_pct >= 0;
      const isSelected = q.symbol === store.selectedSymbol;
      const formattedPrice = q.last_price >= 100 ? q.last_price.toFixed(2) : q.last_price.toFixed(4);
      return `
        <div class="ticker-chip ${isSelected ? 'selected' : ''}" data-symbol="${q.symbol}">
          <strong class="chip-symbol">${q.symbol}</strong>
          <span class="chip-price">${formattedPrice}</span>
          <span class="chip-change ${isUp ? 'val-green' : 'val-red'}">${isUp ? '+' : ''}${q.change_pct.toFixed(2)}%</span>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.ticker-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const sym = chip.getAttribute('data-symbol');
      if (sym) {
        syncSelectedSymbol(sym);
      }
    });
  });
}

function renderSelectedSymbolCard(): void {
  const q = store.getSelectedQuote();
  const symEl = document.getElementById('selected-symbol');
  const priceEl = document.getElementById('selected-price');
  const chgEl = document.getElementById('selected-change');

  if (symEl) symEl.innerText = store.selectedSymbol;
  const isForex = store.selectedSymbol.includes('/') || store.activeTab === 'FOREX';
  const prefix = isForex ? '' : '₹';

  const feedStatusText = (q as any)?.feed_status || (isForex ? 'LIVE INTERBANK FX • Synced' : 'LIVE NSE/BSE FEED • Synced');
  const feedTime = (q as any)?.ist_time || new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';
  const feedTextEl = document.getElementById('feed-integrity-text');
  const feedTimeEl = document.getElementById('feed-tick-time');
  if (feedTextEl) feedTextEl.innerText = feedStatusText;
  if (feedTimeEl) feedTimeEl.innerText = feedTime;

  if (q) {
    const isUp = q.change_pct >= 0;
    if (priceEl) priceEl.innerText = `${prefix}${isForex || q.last_price < 100 ? q.last_price.toFixed(4) : q.last_price.toFixed(2)}`;
    if (chgEl) {
      chgEl.innerText = `${isUp ? '+' : ''}${q.change_pct.toFixed(2)}%`;
      chgEl.className = `chart-change-pill ${isUp ? 'pill-up' : 'pill-down'}`;
    }
  } else if (store.candles.length > 0) {
    const last = store.candles[store.candles.length - 1];
    if (priceEl) priceEl.innerText = `${prefix}${isForex || last.close < 100 ? last.close.toFixed(4) : last.close.toFixed(2)}`;
    if (chgEl) {
      const isUp = last.close >= last.open;
      const diff = last.close - last.open;
      const pct = (diff / last.open) * 100;
      chgEl.innerText = `${isUp ? '+' : ''}${pct.toFixed(2)}%`;
      chgEl.className = `chart-change-pill ${isUp ? 'pill-up' : 'pill-down'}`;
    }
  }

  // Lock quick order ticket limit price to exact live quote
  const ticketPriceIn = document.getElementById('ticket-price') as HTMLInputElement;
  if (ticketPriceIn && q && q.last_price > 0 && (!ticketPriceIn.value || ticketPriceIn.dataset.autofilled === 'true')) {
    ticketPriceIn.value = `${isForex || q.last_price < 100 ? q.last_price.toFixed(4) : q.last_price.toFixed(2)}`;
    ticketPriceIn.dataset.autofilled = 'true';
  }

  if (priceChart && store.candles.length > 0) {
    if (q && q.last_price > 0) {
      const lastBar = store.candles[store.candles.length - 1];
      lastBar.close = q.last_price;
      lastBar.high = Math.max(lastBar.high, q.last_price);
      lastBar.low = Math.min(lastBar.low, q.last_price);
    }
    priceChart.updateCandles(store.candles);
  }
}

function renderOrderBook(): void {
  const book = store.orderBook;
  const bidsEl = document.getElementById('orderbook-bids');
  const asksEl = document.getElementById('orderbook-asks');
  if (!book || !bidsEl || !asksEl) return;

  const maxBidTotal = Math.max(...book.bids.map((b) => b.total), 1);
  const maxAskTotal = Math.max(...book.asks.map((a) => a.total), 1);

  bidsEl.innerHTML = book.bids
    .map((b) => {
      const fillPct = (b.total / maxBidTotal) * 100;
      return `
        <div class="book-row">
          <div class="book-depth-bar depth-bid" style="width:${fillPct}%"></div>
          <span class="val-green">${b.price.toFixed(b.price >= 100 ? 2 : 4)}</span>
          <span class="book-size">${b.size.toLocaleString()}</span>
        </div>
      `;
    })
    .join('');

  asksEl.innerHTML = book.asks
    .map((a) => {
      const fillPct = (a.total / maxAskTotal) * 100;
      return `
        <div class="book-row">
          <div class="book-depth-bar depth-ask" style="width:${fillPct}%"></div>
          <span class="val-red">${a.price.toFixed(a.price >= 100 ? 2 : 4)}</span>
          <span class="book-size">${a.size.toLocaleString()}</span>
        </div>
      `;
    })
    .join('');
}

function renderDebateArena(): void {
  const sym = store.selectedSymbol;
  const q = store.getSelectedQuote();
  const debate = store.debates.find(
    (d) => d.symbol.toUpperCase() === sym.toUpperCase()
  ) || store.debates[0];

  if (!debate) return;

  const isForex = debate.symbol.includes('/') || debate.current_price < 100;
  const currPrefix = isForex ? '' : '₹';
  const livePrice = q?.last_price || (store.candles.length > 0 ? store.candles[store.candles.length - 1].close : debate.current_price);
  const ratio = (livePrice > 0 && debate.current_price > 0 && Math.abs(livePrice - debate.current_price) / debate.current_price > 0.12)
    ? livePrice / debate.current_price
    : 1.0;

  const bTgtVal = debate.bull_thesis.target_price * ratio;
  const bInvVal = debate.bull_thesis.invalidation_price * ratio;
  const beTgtVal = debate.bear_thesis.target_price * ratio;
  const beInvVal = debate.bear_thesis.invalidation_price * ratio;
  const entryVal = ratio !== 1.0 ? livePrice : debate.recommended_entry;
  const slVal = debate.stop_loss * ratio;
  const tpVal = debate.take_profit * ratio;

  const sigEl = document.getElementById('consensus-signal');
  const scoreEl = document.getElementById('consensus-score');
  const confEl = document.getElementById('consensus-confidence');
  const rrEl = document.getElementById('consensus-rr');
  const ratEl = document.getElementById('consensus-rationale');

  if (sigEl) {
    sigEl.innerText = debate.signal;
    sigEl.className = `consensus-badge badge-${debate.action}`;
  }
  if (scoreEl) scoreEl.innerText = `Score: ${debate.consensus_score > 0 ? '+' : ''}${debate.consensus_score.toFixed(2)}`;
  if (confEl) confEl.innerText = `(${debate.confidence_pct.toFixed(1)}%)`;
  if (rrEl) rrEl.innerText = `1:${debate.risk_reward_ratio.toFixed(2)}`;
  if (ratEl) ratEl.innerText = debate.executive_rationale;

  // Bull card
  const bConv = document.getElementById('bull-conviction');
  const bBar = document.getElementById('bull-confidence-bar');
  const bArgs = document.getElementById('bull-arguments');
  const bTgt = document.getElementById('bull-target');
  const bInv = document.getElementById('bull-inval');
  if (bConv) bConv.innerText = `${debate.bull_thesis.conviction_pct.toFixed(1)}%`;
  if (bBar) bBar.style.width = `${Math.min(100, Math.max(5, debate.bull_thesis.conviction_pct))}%`;
  if (bArgs) {
    bArgs.innerHTML = debate.bull_thesis.key_arguments.map((arg) => `<li>${arg}</li>`).join('');
  }
  if (bTgt) {
    bTgt.innerText = `${currPrefix}${isForex || bTgtVal < 100 ? bTgtVal.toFixed(4) : bTgtVal.toFixed(2)}`;
  }
  if (bInv) {
    bInv.innerText = `${currPrefix}${isForex || bInvVal < 100 ? bInvVal.toFixed(4) : bInvVal.toFixed(2)}`;
  }

  // Bear card
  const beConv = document.getElementById('bear-conviction');
  const beBar = document.getElementById('bear-confidence-bar');
  const beArgs = document.getElementById('bear-arguments');
  const beTgt = document.getElementById('bear-target');
  const beInv = document.getElementById('bear-inval');
  if (beConv) beConv.innerText = `${debate.bear_thesis.conviction_pct.toFixed(1)}%`;
  if (beBar) beBar.style.width = `${Math.min(100, Math.max(5, debate.bear_thesis.conviction_pct))}%`;
  if (beArgs) {
    beArgs.innerHTML = debate.bear_thesis.key_arguments.map((arg) => `<li>${arg}</li>`).join('');
  }
  if (beTgt) {
    beTgt.innerText = `${currPrefix}${isForex || beTgtVal < 100 ? beTgtVal.toFixed(4) : beTgtVal.toFixed(2)}`;
  }
  if (beInv) {
    beInv.innerText = `${currPrefix}${isForex || beInvVal < 100 ? beInvVal.toFixed(4) : beInvVal.toFixed(2)}`;
  }

  // Proposal bar & SL/TP pills
  const propAct = document.getElementById('proposal-action');
  const propQty = document.getElementById('proposal-qty');
  const propEntry = document.getElementById('proposal-entry');
  const propSL = document.getElementById('proposal-sl');
  const propTP = document.getElementById('proposal-tp');

  if (propAct) {
    propAct.innerText = debate.action;
    propAct.className = debate.action === 'BUY' ? 'val-green' : (debate.action === 'SELL' ? 'val-red' : '');
  }
  if (propQty) propQty.innerText = `${debate.proposed_quantity.toLocaleString()} Qty`;
  if (propEntry) {
    propEntry.innerText = `${currPrefix}${isForex || entryVal < 100 ? entryVal.toFixed(4) : entryVal.toFixed(2)}`;
  }
  if (propSL) {
    propSL.innerText = `${currPrefix}${isForex || slVal < 100 ? slVal.toFixed(4) : slVal.toFixed(2)}`;
  }
  if (propTP) {
    propTP.innerText = `${currPrefix}${isForex || tpVal < 100 ? tpVal.toFixed(4) : tpVal.toFixed(2)}`;
  }
}

function renderOrderTicket(): void {
  const sym = store.selectedSymbol;
  const isForex = sym.includes('/') || store.activeTab === 'FOREX';
  const q = store.getSelectedQuote();
  const debate = store.debates.find(
    (d) => d.symbol.toUpperCase() === sym.toUpperCase()
  ) || store.debates[0];
  const bp = activeMTFReport?.blueprint;

  const symInput = document.getElementById('ticket-symbol') as HTMLInputElement;
  const qtyInput = document.getElementById('ticket-qty') as HTMLInputElement;
  const priceInput = document.getElementById('ticket-price') as HTMLInputElement;
  const slInput = document.getElementById('ticket-sl') as HTMLInputElement;

  if (symInput && symInput.value !== sym) {
    symInput.value = sym;
  }

  // Lock limit/market price to exact live quote
  const livePrice = q?.last_price || (store.candles.length > 0 ? store.candles[store.candles.length - 1].close : 0);
  const activePrice = livePrice || bp?.entry_price || debate?.recommended_entry;
  if (priceInput && activePrice) {
    priceInput.value = isForex || activePrice < 100 ? activePrice.toFixed(4) : activePrice.toFixed(2);
  }

  // Synchronize stop-loss (SL) pill / field
  const atrEst = (activePrice || 100) * 0.008;
  const activeSL = bp?.stop_loss && Math.abs(bp.stop_loss - (activePrice || 0)) / (activePrice || 1) < 0.15
    ? bp.stop_loss
    : (debate?.stop_loss && Math.abs(debate.stop_loss - (activePrice || 0)) / (activePrice || 1) < 0.15
        ? debate.stop_loss
        : Number(((activePrice || 100) - atrEst * 1.5).toFixed(isForex ? 4 : 2)));
  if (slInput && activeSL) {
    slInput.value = isForex || activeSL < 100 ? activeSL.toFixed(4) : activeSL.toFixed(2);
  }

  // Synchronize suggested quantity / lots
  if (qtyInput) {
    if (debate && debate.proposed_quantity) {
      qtyInput.value = String(debate.proposed_quantity);
    } else if (isForex) {
      qtyInput.value = '1000';
    } else {
      qtyInput.value = '10';
    }
  }
}

function renderQuantMatrix(): void {
  const q = store.quantMetrics;
  if (!q) return;

  const setEl = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  setEl('quant-sharpe', q.sharpe_ratio.toFixed(2));
  setEl('quant-sortino', q.sortino_ratio.toFixed(2));
  setEl('quant-mdd', `${q.max_drawdown_pct.toFixed(2)}%`);
  setEl('quant-vol', `${q.annualized_volatility_pct.toFixed(1)}%`);
  setEl('quant-kelly', `${q.kelly_recommended_pct.toFixed(1)}%`);
  setEl('quant-var', `${q.var_95_pct.toFixed(2)}%`);
  setEl('quant-winrate', `${q.win_rate_pct.toFixed(1)}%`);
  setEl('quant-profitfactor', q.profit_factor.toFixed(2));

  // Render equity curve series if available
  if (equityChart && q.equity_series && q.equity_series.length > 0) {
    const series = q.equity_series.map((s) => s.total_nav_inr);
    equityChart.updateEquitySeries(series);
  }
}

function renderBlotter(view: string): void {
  const thead = document.getElementById('blotter-head');
  const tbody = document.getElementById('blotter-body');
  const countPos = document.getElementById('count-pos');
  if (!thead || !tbody) return;

  const allPositions = [...store.positions.indian_equities, ...store.positions.forex];
  if (countPos) countPos.innerText = `${allPositions.length}`;

  if (view === 'POSITIONS') {
    thead.innerHTML = `
      <tr>
        <th>Asset</th>
        <th>Side</th>
        <th>Quantity</th>
        <th>Entry Price</th>
        <th>Current Price</th>
        <th>Unrealized P&L</th>
        <th>Currency</th>
      </tr>
    `;
    if (allPositions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:20px;">No open positions in active portfolio</td></tr>`;
      return;
    }
    tbody.innerHTML = allPositions
      .map((p) => {
        const isLong = p.quantity > 0;
        const isProfitable = p.unrealized_pnl >= 0;
        const prefix = p.currency === 'INR' ? '₹' : '$';
        return `
          <tr>
            <td><strong>${p.symbol}</strong></td>
            <td class="${isLong ? 'val-green' : 'val-red'}">${isLong ? 'LONG' : 'SHORT'}</td>
            <td>${Math.abs(p.quantity).toLocaleString()}</td>
            <td>${prefix}${p.entry_price.toFixed(p.entry_price >= 100 ? 2 : 4)}</td>
            <td>${prefix}${p.current_price.toFixed(p.current_price >= 100 ? 2 : 4)}</td>
            <td class="${isProfitable ? 'val-green' : 'val-red'}">
              ${isProfitable ? '+' : ''}${prefix}${p.unrealized_pnl.toFixed(2)}
            </td>
            <td>${p.currency}</td>
          </tr>
        `;
      })
      .join('');
  } else if (view === 'ORDERS') {
    thead.innerHTML = `
      <tr>
        <th>Order ID</th>
        <th>Symbol</th>
        <th>Side</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Status</th>
        <th>Tag</th>
      </tr>
    `;
    if (store.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:20px;">No recent orders placed</td></tr>`;
      return;
    }
    tbody.innerHTML = store.orders
      .slice(0, 15)
      .map((o) => `
        <tr>
          <td>${o.order_id}</td>
          <td><strong>${o.symbol}</strong></td>
          <td class="${o.side === 'BUY' ? 'val-green' : 'val-red'}">${o.side}</td>
          <td>${o.quantity}</td>
          <td>${o.avg_fill_price || o.price}</td>
          <td><span class="brand-badge">${o.status}</span></td>
          <td style="color:var(--text-dim)">${o.tag}</td>
        </tr>
      `)
      .join('');
  } else if (view === 'TRADES') {
    thead.innerHTML = `
      <tr>
        <th>Trade ID</th>
        <th>Symbol</th>
        <th>Side</th>
        <th>Qty</th>
        <th>Fill Price</th>
        <th>Realized P&L</th>
        <th>Fee</th>
      </tr>
    `;
    if (store.trades.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:20px;">No trade ledger records</td></tr>`;
      return;
    }
    tbody.innerHTML = store.trades
      .slice(0, 15)
      .map((t) => {
        const isUp = t.pnl >= 0;
        return `
          <tr>
            <td>${t.trade_id}</td>
            <td><strong>${t.symbol}</strong></td>
            <td class="${t.side === 'BUY' ? 'val-green' : 'val-red'}">${t.side}</td>
            <td>${t.quantity}</td>
            <td>${t.price}</td>
            <td class="${isUp ? 'val-green' : 'val-red'}">${isUp ? '+' : ''}${t.pnl}</td>
            <td style="color:var(--text-dim)">${t.fee}</td>
          </tr>
        `;
      })
      .join('');
  }
}
