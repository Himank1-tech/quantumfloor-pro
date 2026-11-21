/**
 * Enterprise Application Entry Point - QuantumFloor Pro
 * Single unified top bar architecture, spacious page layouts, and slide-over drawers.
 */

import './styles.css';
import { renderNavbar, setupNavbarEventListeners, setNavbarActions, updateNavbarState } from './components/navbar';
import {
  renderFloorPanel,
  setupFloorEventListeners,
  renderDashboard,
  setPanelCallbacks,
  syncSelectedSymbol,
  activeMTFReport,
} from './panel';
import { renderIPOPanel, setupIPOEventListeners } from './ipo/ipoPanel';
import { renderAdvisoryPanel, setupAdvisoryEventListeners } from './advisory/advisoryPanel';
import { renderBasketPanel, setupBasketEventListeners } from './investors/basketPanel';
import { renderSecurityPanel, setupSecurityEventListeners } from './auth/authModal';
import { NewsDrawer } from './news_drawer';
import { TradeCalculatorModal } from './trade_calculator';
import { AICopilotWidget } from './ai_copilot_widget';
import { IPOWealthTab } from './ipo_wealth_tab';
import { BacktestModal } from './backtest_modal';
import { store, MainViewTab } from './state';
import {
  fetchQuotes,
  fetchAccountSummary,
  fetchQuantMetrics,
  fetchDebates,
  fetchPositions,
  fetchOrders,
  fetchTrades,
  fetchRiskMetrics,
  fetchCandles,
  fetchOrderBook,
  fetchIPOs,
  fetchAdvisorySignals,
  fetchBaskets,
  fetchCurrentUser,
  fetchVaultKeys,
  fetchAuditLogs,
  subscribeTelemetry,
  subscribeNeonRealtime,
  setAuthToken,
} from './api';

let lastRenderedView: MainViewTab | null = null;
let newsDrawer: NewsDrawer | null = null;
let tradeCalculator: TradeCalculatorModal | null = null;
let aiCopilot: AICopilotWidget | null = null;
let ipoWealthView: IPOWealthTab | null = null;
let backtestLabView: BacktestModal | null = null;

function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  // Single unified layout: Navbar + Main View
  let navContainer = document.getElementById('navbar-container');
  let viewContainer = document.getElementById('main-view-container');

  if (!navContainer || !viewContainer) {
    root.innerHTML = `
      <div id="navbar-container"></div>
      <div id="main-view-container" class="main-content-area"></div>
      <footer class="app-regulatory-footer">
        <div class="regulatory-content">
          <span class="regulatory-shield">🛡️</span>
          <span class="regulatory-text">Paper Trading &amp; Educational Analytics Only — Not SEBI/SEC Registered Financial Advice</span>
        </div>
      </footer>
    `;
    navContainer = document.getElementById('navbar-container');
    viewContainer = document.getElementById('main-view-container');

    // Initialize Global Slide-over Modals
    newsDrawer = new NewsDrawer();
    tradeCalculator = new TradeCalculatorModal();
    aiCopilot = new AICopilotWidget();

    const openCalculatorAction = () => {
      const q = store.quotes.get(store.selectedSymbol);
      tradeCalculator?.open(activeMTFReport?.blueprint, store.selectedSymbol, q?.last_price || 1363.0);
    };

    const openCopilotAction = () => {
      aiCopilot?.open();
    };

    const openNewsAction = () => {
      newsDrawer?.open();
    };

    // Wire global actions to Top Navbar
    setNavbarActions({
      onOpenCalculator: openCalculatorAction,
      onOpenCopilot: openCopilotAction,
      onOpenNews: openNewsAction,
      onSelectSymbol: (sym) => syncSelectedSymbol(sym),
    });

    // Wire actions to Floor Panel components
    setPanelCallbacks({
      onOpenCalculator: openCalculatorAction,
      onOpenCopilot: openCopilotAction,
      onOpenNews: openNewsAction,
    });
  }

  // Update Single Top Navbar
  if (navContainer) {
    if (!navContainer.hasChildNodes()) {
      navContainer.innerHTML = renderNavbar();
      setupNavbarEventListeners();
    } else {
      updateNavbarState();
    }
  }

  // Update AI Co-Pilot Context
  const curQuote = store.quotes.get(store.selectedSymbol);
  if (aiCopilot && curQuote) {
    aiCopilot.setContext(store.selectedSymbol, curQuote.last_price, activeMTFReport);
  }

  // Check if main view changed
  const currentView = store.activeMainView;
  if (viewContainer) {
    if (currentView !== lastRenderedView) {
      lastRenderedView = currentView;
      if (currentView === 'FLOOR') {
        viewContainer.innerHTML = renderFloorPanel();
        setupFloorEventListeners();
        renderDashboard();
      } else if (currentView === 'IPO') {
        viewContainer.innerHTML = `<div id="ipo-wealth-mount"></div>`;
        ipoWealthView = new IPOWealthTab('ipo-wealth-mount');
        ipoWealthView.init();
      } else if (currentView === 'BACKTEST') {
        viewContainer.innerHTML = `<div id="backtest-mount"></div>`;
        backtestLabView = new BacktestModal('backtest-mount');
        backtestLabView.init();
      } else if (currentView === 'NEWS') {
        newsDrawer?.open();
        store.setMainView('FLOOR');
      } else if (currentView === 'ADVISORY') {
        viewContainer.innerHTML = renderAdvisoryPanel();
        setupAdvisoryEventListeners();
      } else if (currentView === 'BASKETS') {
        viewContainer.innerHTML = renderBasketPanel();
        setupBasketEventListeners();
      } else if (currentView === 'SECURITY') {
        viewContainer.innerHTML = renderSecurityPanel();
        setupSecurityEventListeners();
      }
    } else {
      // In-place update for active view
      if (currentView === 'FLOOR') {
        renderDashboard();
      }
    }
  }
}

async function bootstrap() {
  // Capture Google OAuth callback query parameters from redirect
  const urlParams = new URLSearchParams(window.location.search);
  const oauthToken = urlParams.get('auth_token');
  const oauthEmail = urlParams.get('email');
  const oauthName = urlParams.get('name');

  if (oauthToken) {
    setAuthToken(oauthToken);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  renderApp();

  // Subscribe to reactive state store
  store.subscribe(() => {
    renderApp();
  });

  // Initial Enterprise Data Ingestion
  try {
    const [
      quotes,
      account,
      quant,
      debates,
      positions,
      orders,
      trades,
      risk,
      candles,
      orderbook,
      ipos,
      advisory,
      baskets,
      user,
      vaultKeys,
      auditLogs,
    ] = await Promise.all([
      fetchQuotes(),
      fetchAccountSummary(),
      fetchQuantMetrics(),
      fetchDebates(),
      fetchPositions(),
      fetchOrders(),
      fetchTrades(),
      fetchRiskMetrics(),
      fetchCandles(store.selectedSymbol, 500),
      fetchOrderBook(store.selectedSymbol),
      fetchIPOs(),
      fetchAdvisorySignals(),
      fetchBaskets(),
      fetchCurrentUser().catch(() => null),
      fetchVaultKeys().catch(() => []),
      fetchAuditLogs().catch(() => []),
    ]);

    store.setQuotes(quotes);
    store.accountSummary = account;
    store.quantMetrics = quant;
    store.debates = debates;
    store.positions = positions;
    store.orders = orders;
    store.trades = trades;
    store.riskStatus = risk;
    store.candles = candles;
    // Align initial last candle close with the live quote
    const currInitQuote = quotes.find((q) => q.symbol === store.selectedSymbol);
    if (currInitQuote && store.candles.length > 0 && currInitQuote.last_price > 0) {
      const lastBar = store.candles[store.candles.length - 1];
      lastBar.close = currInitQuote.last_price;
      lastBar.high = Math.max(lastBar.high, currInitQuote.last_price);
      lastBar.low = Math.min(lastBar.low, currInitQuote.last_price);
    }
    store.orderBook = orderbook;
    store.ipos = ipos;
    store.advisorySignals = advisory;
    store.thematicBaskets = baskets;
    if (user) {
      store.currentUser = user;
    } else if (oauthToken && (oauthEmail || oauthName)) {
      store.currentUser = {
        user_id: 'USR-OAUTH',
        username: oauthName || (oauthEmail ? oauthEmail.split('@')[0] : 'Trader'),
        email: oauthEmail || 'trader@institutional.com',
        role: 'ADMIN',
        investment_mode: 'AUTONOMOUS_TRADING',
        totp_enabled: false,
      };
    }
    store.vaultKeys = vaultKeys;
    store.auditLogs = auditLogs;

    renderApp();
  } catch (err) {
    console.error('Initial data ingestion error', err);
  }

  // Subscribe to Live SSE Telemetry Stream
  subscribeTelemetry(
    (quotes) => {
      store.setQuotes(quotes);
      const curr = quotes.find((q) => q.symbol === store.selectedSymbol);
      if (curr && store.candles.length > 0 && curr.last_price > 0) {
        const lastBar = store.candles[store.candles.length - 1];
        if (Math.abs(curr.last_price - lastBar.open) / (lastBar.open || 1) < 0.25) {
          lastBar.close = curr.last_price;
          lastBar.high = Math.max(lastBar.high, curr.last_price);
          lastBar.low = Math.min(lastBar.low, curr.last_price);
        }
      }
      if (store.activeMainView === 'FLOOR') {
        renderDashboard();
      }
    },
    (heartbeat) => {
      if (store.riskStatus && heartbeat.circuit_breaker) {
        store.riskStatus.circuit_breaker_state = heartbeat.circuit_breaker;
        if (store.activeMainView === 'FLOOR') {
          renderDashboard();
        }
      }
    },
    (err) => {
      console.warn('Telemetry stream reconnecting...', err);
    }
  );

  // Dedicated 15-second live quotes polling loop to lock all UI components to real exchange feeds
  setInterval(async () => {
    try {
      const quotes = await fetchQuotes();
      if (quotes && quotes.length > 0) {
        store.setQuotes(quotes);
        const curr = quotes.find((q) => q.symbol === store.selectedSymbol);
        if (curr && store.candles.length > 0 && curr.last_price > 0) {
          const lastBar = store.candles[store.candles.length - 1];
          lastBar.close = curr.last_price;
          lastBar.high = Math.max(lastBar.high, curr.last_price);
          lastBar.low = Math.min(lastBar.low, curr.last_price);
        }
        if (store.activeMainView === 'FLOOR') {
          renderDashboard();
        }
      }
    } catch (e) {
      console.warn('Quotes 15s poll error:', e);
    }
  }, 15000);

  // Subscribe to Neon Realtime Stream for Instant Blotter & Debate Feeds
  subscribeNeonRealtime((data) => {
    if (data.event === 'TRADE_FILL' && data.trade) {
      store.trades = [data.trade, ...store.trades.slice(0, 19)];
      if (store.activeMainView === 'FLOOR') renderDashboard();
    } else if (data.event === 'DEBATE_UPDATE' && data.debate) {
      store.debates = [data.debate, ...store.debates.slice(0, 14)];
      if (store.activeMainView === 'ADVISORY' || store.activeMainView === 'FLOOR') renderDashboard();
    }
  });

  // Periodic Telemetry Poll (every 3 seconds) for accounts & background updates
  setInterval(async () => {
    try {
      const [account, quant, debates, positions, orders, trades, risk] = await Promise.all([
        fetchAccountSummary(),
        fetchQuantMetrics(),
        fetchDebates(10),
        fetchPositions(),
        fetchOrders(),
        fetchTrades(15),
        fetchRiskMetrics(),
      ]);

      store.accountSummary = account;
      store.quantMetrics = quant;

      // Preserve active debate for selectedSymbol if present
      const currentSymDebate = store.debates.find(
        (d) => d.symbol.toUpperCase() === store.selectedSymbol.toUpperCase()
      );
      if (currentSymDebate) {
        const others = debates.filter(
          (d) => d.symbol.toUpperCase() !== store.selectedSymbol.toUpperCase()
        );
        store.debates = [currentSymDebate, ...others];
      } else {
        store.debates = debates;
      }

      store.positions = positions;
      store.orders = orders;
      store.trades = trades;
      store.riskStatus = risk;

      if (store.activeMainView === 'FLOOR') {
        renderDashboard();
      }
    } catch (e) {
      // background polling catch
    }
  }, 3000);
}

document.addEventListener('DOMContentLoaded', bootstrap);
