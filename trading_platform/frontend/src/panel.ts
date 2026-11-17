/**
 * QuantumFloor Pro - Primary Trading Floor Workspace
 * Institutional-grade spacious layout (68% Superchart & Blotter / 32% Multi-Agent Debate & Risk Governor)
 * Modeled after TradingView Supercharts, Linear, and Stripe Dashboard.
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
} from './api';
import { PriceChartEngine, EquityCurveChartEngine } from './chart';

let priceChart: PriceChartEngine | null = null;
let equityChart: EquityCurveChartEngine | null = null;
export let activeMTFReport: MTFSetupReport | null = null;
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
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-label">UNIFIED PORTFOLIO NAV</span>
            <span class="kpi-tag tag-cyan">LIVE</span>
          </div>
          <div class="kpi-value-row">
            <span id="nav-inr" class="kpi-value-main val-cyan">₹--</span>
            <span id="nav-usd" class="kpi-value-sub">$--</span>
          </div>
          <div class="kpi-footer-note">Cross-broker consolidated cash + margin</div>
        </div>

        <!-- Card 2: Daily P&L -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-label">TODAY'S NET P&L</span>
            <span class="kpi-tag tag-emerald">DAY 1</span>
          </div>
          <div class="kpi-value-row">
            <span id="nav-daily-pnl" class="kpi-value-main val-green">--</span>
          </div>
          <div class="kpi-footer-note">Realized + Mark-to-Market Unrealized</div>
        </div>

        <!-- Card 3: Active Session & Killzone -->
        <div class="kpi-card" id="kpi-card-session">
          <div class="kpi-card-header">
            <span class="kpi-label">SESSION & KILLZONE</span>
            <span class="kpi-tag tag-emerald pulse-tag">ACTIVE</span>
          </div>
          <div class="kpi-value-row">
            <span id="kpi-session-title" class="kpi-value-main val-white" style="font-size:16px;">NSE Equities (IST)</span>
          </div>
          <div class="kpi-footer-note" id="kpi-session-killzone">Killzone: 09:15 - 11:30 IST · London Pre-Market</div>
        </div>

        <!-- Card 4: Next Red-Folder News -->
        <div class="kpi-card kpi-card-interactive" id="kpi-card-news" title="Click to view full Economic Calendar">
          <div class="kpi-card-header">
            <span class="kpi-label">UPCOMING MACRO EVENT</span>
            <span class="kpi-tag tag-rose">HIGH IMPACT</span>
          </div>
          <div class="kpi-value-row">
            <span id="kpi-next-news" class="kpi-value-main val-rose" style="font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ⚠️ US CPI Data (in 45m)
            </span>
          </div>
          <div class="kpi-footer-note" style="color:var(--accent-indigo)">Click to inspect impact filters →</div>
        </div>

        <!-- Card 5: Risk Governor & Auto-Trade Control -->
        <div class="kpi-card">
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

      <!-- 2. Primary Workspace Grid (68% Superchart & Blotter / 32% Debate & Risk) -->
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
              </div>

              <!-- Timeframe Selector Chips -->
              <div class="timeframe-chips-bar" id="timeframe-selector">
                <button class="tf-chip-btn" data-tf="5M">5M</button>
                <button class="tf-chip-btn active" data-tf="15M">15M</button>
                <button class="tf-chip-btn" data-tf="1H">1H</button>
                <button class="tf-chip-btn" data-tf="4H">4H</button>
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

              <!-- Quick Tools -->
              <div class="chart-tool-buttons">
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

            <!-- Main High-Performance Canvas Container (520px height) -->
            <div class="chart-canvas-wrapper" id="price-chart-container"></div>
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
                <span>☁️ EXPORT CSV (NEON STORAGE)</span>
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

        <!-- RIGHT COLUMN (32% Width): Debate Arena, Quick Ticket & Quant Matrix -->
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
                  <ul id="bear-arguments" class="thesis-arguments-list">
                    <li>Testing resistance boundary near upper volatility band.</li>
                    <li>Overhead supply overhang capping immediate aggressive breakouts.</li>
                  </ul>
                  <div class="thesis-targets-row">
                    <span>Target: <strong id="bear-target" class="val-red">₹--</strong></span>
                    <span>Inval: <strong id="bear-inval" class="val-muted">₹--</strong></span>
                  </div>
                </div>
              </div>

              <!-- Floor Manager Executive Rationale -->
              <div class="executive-decision-box">
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

          <!-- 2. Quick Execution Order Ticket Card -->
          <section class="panel-card execution-ticket-section">
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

          <!-- 3. Quant Risk Governor & Telemetry Matrix (2x2 Grid) -->
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
    </div>
  `;
}

export function setupFloorEventListeners(): void {
  // Initialize Canvas Charts
  const priceContainer = document.getElementById('price-chart-container');
  if (priceContainer) {
    priceChart = new PriceChartEngine(priceContainer);
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

  // Timeframe selector chips
  document.querySelectorAll('.tf-chip-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tf-chip-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active');
      store.activeTimeframe = target.dataset.tf || '15M';
      refreshSymbolData();
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

  // Manual Order Buttons
  document.getElementById('btn-ticket-buy')?.addEventListener('click', () => handleManualOrderSubmit('BUY'));
  document.getElementById('btn-ticket-sell')?.addEventListener('click', () => handleManualOrderSubmit('SELL'));

  // Quick Trade Ticket Symbol Input Listener for reactive sync
  const ticketSymInput = document.getElementById('ticket-symbol') as HTMLInputElement;
  ticketSymInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = ticketSymInput.value.trim().toUpperCase();
      if (val && val !== store.selectedSymbol) {
        syncSelectedSymbol(val);
      }
    }
  });
  ticketSymInput?.addEventListener('change', () => {
    const val = ticketSymInput.value.trim().toUpperCase();
    if (val && val !== store.selectedSymbol) {
      syncSelectedSymbol(val);
    }
  });

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
    [tabPos, tabBook, tabOrd, tabTrd].forEach(t => t?.classList.remove('active'));

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

  document.getElementById('btn-export-blotter-s3')?.addEventListener('click', async () => {
    try {
      const res = await exportTradeBlotterReport();
      alert(`Trade Blotter exported to Neon Object Storage!\nFile: ${res.filename}\nRows: ${res.count}\n\nPresigned URL generated (valid 24h). Opening download...`);
      window.open(res.url, '_blank');
    } catch (err: any) {
      alert(`Export Failed: ${err.message}`);
    }
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
    });
    alert(`Order executed successfully! ID: ${res.order?.order_id}`);
  } catch (err: any) {
    alert(`Risk Governor Rejected Order: ${err.message}`);
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
    if (book) store.orderBook = book;
    activeMTFReport = mtf;

    if (debates && debates.length > 0) {
      const remaining = store.debates.filter(
        (d) => d.symbol.toUpperCase() !== sym.toUpperCase()
      );
      store.debates = [debates[0], ...remaining];
    }

    if (priceChart) {
      priceChart.updateCandles(candles);
      priceChart.setSMCData(smc, mtf);
    }

    renderOrderBook();
    renderMTFBlueprintBanner(mtf);
    renderSelectedSymbolCard();
    renderDebateArena();
    renderOrderTicket();
  } catch (err) {
    console.error('Error refreshing symbol data:', err);
  }
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
  if (pnlEl) {
    const isUp = s.daily_pnl_pct >= 0;
    pnlEl.innerText = `${isUp ? '+' : ''}${s.daily_pnl_pct.toFixed(2)}% (₹${s.daily_pnl_inr.toLocaleString()})`;
    pnlEl.className = `kpi-value-main ${isUp ? 'val-green' : 'val-red'}`;
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

  if (priceChart && store.candles.length > 0) {
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
  const debate = store.debates.find(
    (d) => d.symbol.toUpperCase() === sym.toUpperCase()
  ) || store.debates[0];

  if (!debate) return;

  const isForex = debate.symbol.includes('/') || debate.current_price < 100;
  const currPrefix = isForex ? '' : '₹';

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
  const bArgs = document.getElementById('bull-arguments');
  const bTgt = document.getElementById('bull-target');
  const bInv = document.getElementById('bull-inval');
  if (bConv) bConv.innerText = `${debate.bull_thesis.conviction_pct.toFixed(1)}%`;
  if (bArgs) {
    bArgs.innerHTML = debate.bull_thesis.key_arguments.map((arg) => `<li>${arg}</li>`).join('');
  }
  if (bTgt) {
    const tgt = debate.bull_thesis.target_price;
    bTgt.innerText = `${currPrefix}${isForex || tgt < 100 ? tgt.toFixed(4) : tgt.toFixed(2)}`;
  }
  if (bInv) {
    const inv = debate.bull_thesis.invalidation_price;
    bInv.innerText = `${currPrefix}${isForex || inv < 100 ? inv.toFixed(4) : inv.toFixed(2)}`;
  }

  // Bear card
  const beConv = document.getElementById('bear-conviction');
  const beArgs = document.getElementById('bear-arguments');
  const beTgt = document.getElementById('bear-target');
  const beInv = document.getElementById('bear-inval');
  if (beConv) beConv.innerText = `${debate.bear_thesis.conviction_pct.toFixed(1)}%`;
  if (beArgs) {
    beArgs.innerHTML = debate.bear_thesis.key_arguments.map((arg) => `<li>${arg}</li>`).join('');
  }
  if (beTgt) {
    const tgt = debate.bear_thesis.target_price;
    beTgt.innerText = `${currPrefix}${isForex || tgt < 100 ? tgt.toFixed(4) : tgt.toFixed(2)}`;
  }
  if (beInv) {
    const inv = debate.bear_thesis.invalidation_price;
    beInv.innerText = `${currPrefix}${isForex || inv < 100 ? inv.toFixed(4) : inv.toFixed(2)}`;
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
    const entry = debate.recommended_entry;
    propEntry.innerText = `${currPrefix}${isForex || entry < 100 ? entry.toFixed(4) : entry.toFixed(2)}`;
  }
  if (propSL) {
    const sl = debate.stop_loss;
    propSL.innerText = `${currPrefix}${isForex || sl < 100 ? sl.toFixed(4) : sl.toFixed(2)}`;
  }
  if (propTP) {
    const tp = debate.take_profit;
    propTP.innerText = `${currPrefix}${isForex || tp < 100 ? tp.toFixed(4) : tp.toFixed(2)}`;
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

  // Synchronize limit / market price
  const activePrice = bp?.entry_price || debate?.recommended_entry || q?.last_price;
  if (priceInput && activePrice) {
    priceInput.value = isForex || activePrice < 100 ? activePrice.toFixed(4) : activePrice.toFixed(2);
  }

  // Synchronize stop-loss (SL) pill / field
  const activeSL = bp?.stop_loss || debate?.stop_loss;
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
