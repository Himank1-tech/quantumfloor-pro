/**
 * Institutional Top Navigation Bar (Sleek 60px Unified Top Bar)
 * Merges brand, market switcher, primary navigation, live session clock,
 * Pip/Lot risk sizing trigger, and AI Co-Pilot assistant trigger.
 */

import { store, MainViewTab } from '../state';

export interface NavbarActionCallbacks {
  onOpenCalculator: () => void;
  onOpenCopilot: () => void;
  onOpenNews?: () => void;
  onSelectSymbol?: (symbol: string) => void;
}

let navbarCallbacks: NavbarActionCallbacks | null = null;

export function setNavbarActions(callbacks: NavbarActionCallbacks): void {
  navbarCallbacks = callbacks;
}

export function renderNavbar(): string {
  const v = store.activeMainView;
  const u = store.currentUser;
  const isNSE = store.activeTab === 'INDIAN_EQUITY';

  return `
    <header class="top-navbar">
      <!-- Left: Brand Logo & Segmented Market Switcher -->
      <div class="nav-brand-section">
        <div class="brand-cluster" id="nav-brand-logo">
          <span class="brand-icon">⚡</span>
          <span class="brand-name">QUANTUM FLOOR</span>
          <span class="brand-pill-pro">PRO</span>
        </div>

        <div class="nav-market-segmented">
          <button class="market-segment-btn ${isNSE ? 'active' : ''}" id="nav-switch-nse" title="Switch to Indian Equities (NSE/BSE)">
            <span class="flag">🇮🇳</span>
            <span class="seg-label">NSE / BSE</span>
          </button>
          <button class="market-segment-btn ${!isNSE ? 'active' : ''}" id="nav-switch-forex" title="Switch to Global Foreign Exchange & Gold">
            <span class="flag">🌐</span>
            <span class="seg-label">FOREX</span>
          </button>
        </div>
      </div>

      <!-- Center: Clean Navigation Tabs -->
      <nav class="nav-tabs-center">
        <button class="nav-tab-item ${v === 'FLOOR' ? 'active' : ''}" data-view="FLOOR">
          <span class="tab-icon">⚡</span>
          <span class="tab-text">Trading Floor</span>
        </button>
        <button class="nav-tab-item ${v === 'IPO' ? 'active' : ''}" data-view="IPO">
          <span class="tab-icon">📰</span>
          <span class="tab-text">IPO & Wealth</span>
        </button>
        <button class="nav-tab-item ${v === 'BACKTEST' ? 'active' : ''}" data-view="BACKTEST">
          <span class="tab-icon">🔬</span>
          <span class="tab-text">Backtest Lab</span>
        </button>
        <button class="nav-tab-item ${v === 'NEWS' ? 'active' : ''}" data-view="NEWS">
          <span class="tab-icon">📅</span>
          <span class="tab-text">Economic News</span>
        </button>
        <button class="nav-tab-item ${v === 'ADVISORY' ? 'active' : ''}" data-view="ADVISORY">
          <span class="tab-icon">🎯</span>
          <span class="tab-text">Advisory</span>
        </button>
        <button class="nav-tab-item ${v === 'SECURITY' ? 'active' : ''}" data-view="SECURITY">
          <span class="tab-icon">🔐</span>
          <span class="tab-text">Account</span>
        </button>
      </nav>

      <!-- Right: Live Session Pill, Drawers & User Profile -->
      <div class="nav-tools-right">
        <!-- Compact Session Status Pill -->
        <div class="nav-session-pill" id="nav-session-trigger" title="Click to view live economic news">
          <span class="status-indicator-dot pulse-emerald"></span>
          <span id="nav-ist-clock" class="mono-time">--:--:-- IST</span>
          <span class="session-divider">·</span>
          <span id="nav-market-state" class="state-label">LIVE</span>
        </div>

        <!-- Quick Pip/Lot Calculator Trigger -->
        <button class="nav-action-pill" id="btn-nav-calc" title="Open Pip & Lot Risk Calculator">
          <span class="pill-icon">📐</span>
          <span class="pill-text">Pip/Lot Calc</span>
        </button>

        <!-- AI Co-Pilot Trigger -->
        <button class="nav-action-pill nav-pill-copilot" id="btn-nav-copilot" title="Open Interactive AI Trading Co-Pilot">
          <span class="copilot-sparkle">✨</span>
          <span class="pill-text">AI Co-Pilot</span>
        </button>

        <!-- User Profile Badge -->
        <button class="nav-user-chip" id="btn-nav-user" title="Account & Security Settings">
          <span class="user-avatar-circle">AD</span>
          <span class="user-name">${u?.username || 'admin'}</span>
          <span class="user-role-badge">${u?.role || 'ADMIN'}</span>
        </button>
      </div>
    </header>
  `;
}

export function setupNavbarEventListeners(): void {
  // Navigation Tabs
  document.querySelectorAll('.nav-tab-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view') as MainViewTab;
      if (view) {
        store.setMainView(view);
      }
    });
  });

  // Market Switcher Segments
  document.getElementById('nav-switch-nse')?.addEventListener('click', () => {
    store.setActiveTab('INDIAN_EQUITY');
    if (navbarCallbacks?.onSelectSymbol) {
      navbarCallbacks.onSelectSymbol('RELIANCE');
    } else {
      store.setSelectedSymbol('RELIANCE');
    }
  });

  document.getElementById('nav-switch-forex')?.addEventListener('click', () => {
    store.setActiveTab('FOREX');
    const target = store.selectedSymbol.includes('/') ? store.selectedSymbol : 'EUR/USD';
    if (navbarCallbacks?.onSelectSymbol) {
      navbarCallbacks.onSelectSymbol(target);
    } else {
      store.setSelectedSymbol(target);
    }
  });

  // Pip/Lot Calculator Button
  document.getElementById('btn-nav-calc')?.addEventListener('click', () => {
    if (navbarCallbacks?.onOpenCalculator) {
      navbarCallbacks.onOpenCalculator();
    }
  });

  // AI Co-Pilot Button
  document.getElementById('btn-nav-copilot')?.addEventListener('click', () => {
    if (navbarCallbacks?.onOpenCopilot) {
      navbarCallbacks.onOpenCopilot();
    }
  });

  // Session Pill Trigger
  document.getElementById('nav-session-trigger')?.addEventListener('click', () => {
    if (navbarCallbacks?.onOpenNews) {
      navbarCallbacks.onOpenNews();
    } else {
      store.setMainView('NEWS');
    }
  });

  // User Badge
  document.getElementById('btn-nav-user')?.addEventListener('click', () => {
    store.setMainView('SECURITY');
  });

  // Live IST Clock update
  updateClockDisplay();
}

function updateClockDisplay() {
  const clockEl = document.getElementById('nav-ist-clock');
  const stateEl = document.getElementById('nav-market-state');
  if (clockEl) {
    const opts: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    const now = new Date();
    clockEl.innerText = `${new Intl.DateTimeFormat('en-GB', opts).format(now)} IST`;

    // Determine current market state
    if (stateEl) {
      const istHour = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24;
      const istMin = (now.getUTCMinutes() + 30) % 60;
      const istTime = istHour * 60 + istMin;
      const day = now.getUTCDay();

      if (day >= 1 && day <= 5 && istTime >= 9 * 60 + 15 && istTime <= 15 * 60 + 30) {
        stateEl.innerText = 'NSE OPEN';
        stateEl.className = 'state-label val-emerald';
      } else {
        stateEl.innerText = 'FOREX LIVE';
        stateEl.className = 'state-label val-indigo';
      }
    }
  }
}

// Tick clock every second
setInterval(updateClockDisplay, 1000);
