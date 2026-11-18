/**
 * Institutional Top Navigation Bar & Mobile Responsive Navigation Suite
 * Sleek 60px Top Bar (Desktop) / 56px Compact Row + Mobile Drawer + Bottom Bar (Mobile/Tablet)
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
    <!-- Top Primary Navbar -->
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

      <!-- Center: Clean Navigation Tabs (Desktop >= 1024px) -->
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

      <!-- Right: Live Session Pill, Drawers, User Profile & Hamburger -->
      <div class="nav-tools-right">
        <!-- Compact Session Status Pill (Desktop >= 1024px) -->
        <div class="nav-session-pill" id="nav-session-trigger" title="Click to view live economic news">
          <span class="status-indicator-dot pulse-emerald"></span>
          <span id="nav-ist-clock" class="mono-time">--:--:-- IST</span>
          <span class="session-divider">·</span>
          <span id="nav-market-state" class="state-label">LIVE</span>
        </div>

        <!-- Quick Pip/Lot Calculator Trigger (Desktop >= 1024px) -->
        <button class="nav-action-pill" id="btn-nav-calc" title="Open Pip & Lot Risk Calculator">
          <span class="pill-icon">📐</span>
          <span class="pill-text">Pip/Lot Calc</span>
        </button>

        <!-- AI Co-Pilot Trigger (Desktop >= 1024px) -->
        <button class="nav-action-pill nav-pill-copilot" id="btn-nav-copilot" title="Open Interactive AI Trading Co-Pilot">
          <span class="copilot-sparkle">✨</span>
          <span class="pill-text">AI Co-Pilot</span>
        </button>

        <!-- User Profile Badge -->
        <button class="nav-user-chip" id="btn-nav-user" title="${u?.email || 'Account & Security Settings'}">
          <span class="user-avatar-circle" style="${u?.email?.includes('@gmail.com') ? 'background:#EA4335;' : ''}">${(u?.username || 'AD').substring(0, 2).toUpperCase()}</span>
          <span class="user-name">${u?.username || 'admin'}</span>
          <span class="user-role-badge">${u?.email ? u.email : (u?.role || 'ADMIN')}</span>
        </button>

        <!-- Hamburger Menu Button (Mobile & Tablet < 1024px) -->
        <button class="btn-hamburger-menu" id="btn-mobile-menu" aria-label="Open Navigation Menu" title="Open Terminal Menu">
          <span class="hamburger-icon">☰</span>
        </button>
      </div>
    </header>

    <!-- Mobile Slide-Over Navigation Drawer (< 1024px) -->
    <div id="mobile-nav-backdrop" class="mobile-nav-backdrop hidden">
      <aside class="mobile-nav-drawer" id="mobile-drawer-content">
        <div class="mobile-drawer-header">
          <div class="brand-cluster">
            <span class="brand-icon">⚡</span>
            <span class="brand-name">QUANTUM FLOOR</span>
            <span class="brand-pill-pro">PRO</span>
          </div>
          <button class="mobile-drawer-close" id="btn-close-mobile-nav" aria-label="Close navigation menu">✕</button>
        </div>

        <!-- Mobile Market Switcher -->
        <div class="mobile-drawer-section">
          <span class="drawer-section-title">ACTIVE MARKET</span>
          <div class="nav-market-segmented mobile-seg-full">
            <button class="market-segment-btn ${isNSE ? 'active' : ''}" id="mobile-switch-nse">
              <span class="flag">🇮🇳</span>
              <span class="seg-label">NSE / BSE Equities</span>
            </button>
            <button class="market-segment-btn ${!isNSE ? 'active' : ''}" id="mobile-switch-forex">
              <span class="flag">🌐</span>
              <span class="seg-label">Global Forex & Gold</span>
            </button>
          </div>
        </div>

        <!-- Navigation Tabs List -->
        <div class="mobile-drawer-section">
          <span class="drawer-section-title">PLATFORM MODULES</span>
          <nav class="mobile-drawer-nav">
            <button class="mobile-nav-item ${v === 'FLOOR' ? 'active' : ''}" data-view="FLOOR">
              <span class="tab-icon">⚡</span>
              <span class="tab-text">Trading Floor</span>
              <span class="nav-chevron">›</span>
            </button>
            <button class="mobile-nav-item ${v === 'IPO' ? 'active' : ''}" data-view="IPO">
              <span class="tab-icon">📰</span>
              <span class="tab-text">IPO Intelligence & Wealth</span>
              <span class="nav-chevron">›</span>
            </button>
            <button class="mobile-nav-item ${v === 'BACKTEST' ? 'active' : ''}" data-view="BACKTEST">
              <span class="tab-icon">🔬</span>
              <span class="tab-text">Backtest Lab</span>
              <span class="nav-chevron">›</span>
            </button>
            <button class="mobile-nav-item ${v === 'NEWS' ? 'active' : ''}" data-view="NEWS">
              <span class="tab-icon">📅</span>
              <span class="tab-text">Economic News & Calendar</span>
              <span class="nav-chevron">›</span>
            </button>
            <button class="mobile-nav-item ${v === 'ADVISORY' ? 'active' : ''}" data-view="ADVISORY">
              <span class="tab-icon">🎯</span>
              <span class="tab-text">Quant Advisory</span>
              <span class="nav-chevron">›</span>
            </button>
            <button class="mobile-nav-item ${v === 'SECURITY' ? 'active' : ''}" data-view="SECURITY">
              <span class="tab-icon">🔐</span>
              <span class="tab-text">Account & Broker Vault</span>
              <span class="nav-chevron">›</span>
            </button>
          </nav>
        </div>

        <!-- Quick Tools & Drawers -->
        <div class="mobile-drawer-section">
          <span class="drawer-section-title">QUANT TOOLS</span>
          <div class="mobile-tools-grid">
            <button class="mobile-tool-btn" id="mobile-btn-calc">
              <span class="tool-icon">📐</span>
              <span class="tool-label">Pip/Lot Sizing Calc</span>
            </button>
            <button class="mobile-tool-btn mobile-tool-copilot" id="mobile-btn-copilot">
              <span class="tool-icon">✨</span>
              <span class="tool-label">AI Trading Co-Pilot</span>
            </button>
            <button class="mobile-tool-btn" id="mobile-btn-news">
              <span class="tool-icon">📅</span>
              <span class="tool-label">Live Macro Events</span>
            </button>
          </div>
        </div>

        <!-- User Profile & Session Footer in Drawer -->
        <div class="mobile-drawer-footer">
          <button class="drawer-user-card" id="mobile-btn-user" title="Open Security & Account Panel">
            <span class="user-avatar-circle" style="${u?.email?.includes('@gmail.com') ? 'background:#EA4335;' : ''}">${(u?.username || 'AD').substring(0, 2).toUpperCase()}</span>
            <div class="drawer-user-info">
              <span class="drawer-username">${u?.username || 'admin'}</span>
              <span class="drawer-useremail">${u?.email || 'admin@quantumfloor.institutional'}</span>
            </div>
            <span class="drawer-role-badge">${u?.role || 'ADMIN'}</span>
          </button>
          <div class="drawer-session-status">
            <span class="status-indicator-dot pulse-emerald"></span>
            <span id="mobile-ist-clock">--:--:-- IST</span>
            <span>·</span>
            <span class="val-green">LIVE SESSION</span>
          </div>
        </div>
      </aside>
    </div>

    <!-- Mobile Bottom Navigation Bar (< 768px) -->
    <nav class="mobile-bottom-bar" id="mobile-bottom-bar">
      <button class="bottom-bar-item ${v === 'FLOOR' ? 'active' : ''}" data-view="FLOOR">
        <span class="bottom-icon">⚡</span>
        <span class="bottom-label">Floor</span>
      </button>
      <button class="bottom-bar-item ${v === 'IPO' ? 'active' : ''}" data-view="IPO">
        <span class="bottom-icon">📰</span>
        <span class="bottom-label">IPO</span>
      </button>
      <button class="bottom-bar-item ${v === 'BACKTEST' ? 'active' : ''}" data-view="BACKTEST">
        <span class="bottom-icon">🔬</span>
        <span class="bottom-label">Lab</span>
      </button>
      <button class="bottom-bar-item ${v === 'ADVISORY' ? 'active' : ''}" data-view="ADVISORY">
        <span class="bottom-icon">🎯</span>
        <span class="bottom-label">Advisory</span>
      </button>
      <button class="bottom-bar-item" id="btn-bottom-menu">
        <span class="bottom-icon">☰</span>
        <span class="bottom-label">Menu</span>
      </button>
    </nav>
  `;
}

export function setupNavbarEventListeners(): void {
  // Mobile drawer controls
  const backdrop = document.getElementById('mobile-nav-backdrop');
  const closeDrawer = () => {
    backdrop?.classList.add('hidden');
    document.body.style.overflow = '';
  };
  const openDrawer = () => {
    backdrop?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  document.getElementById('btn-mobile-menu')?.addEventListener('click', openDrawer);
  document.getElementById('btn-bottom-menu')?.addEventListener('click', openDrawer);
  document.getElementById('btn-close-mobile-nav')?.addEventListener('click', closeDrawer);

  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeDrawer();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop && !backdrop.classList.contains('hidden')) {
      closeDrawer();
    }
  });

  // Navigation Tabs (Desktop, Drawer & Bottom Bar)
  const allNavButtons = document.querySelectorAll(
    '.nav-tab-item, .mobile-nav-item, .bottom-bar-item[data-view]'
  );
  allNavButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view') as MainViewTab;
      if (view) {
        store.setMainView(view);
        closeDrawer();
      }
    });
  });

  // Market Switcher Segments (Desktop & Mobile)
  const handleSwitchNSE = () => {
    store.setActiveTab('INDIAN_EQUITY');
    if (navbarCallbacks?.onSelectSymbol) {
      navbarCallbacks.onSelectSymbol('RELIANCE');
    } else {
      store.setSelectedSymbol('RELIANCE');
    }
    closeDrawer();
  };

  const handleSwitchForex = () => {
    store.setActiveTab('FOREX');
    const target = store.selectedSymbol.includes('/') ? store.selectedSymbol : 'EUR/USD';
    if (navbarCallbacks?.onSelectSymbol) {
      navbarCallbacks.onSelectSymbol(target);
    } else {
      store.setSelectedSymbol(target);
    }
    closeDrawer();
  };

  document.getElementById('nav-switch-nse')?.addEventListener('click', handleSwitchNSE);
  document.getElementById('mobile-switch-nse')?.addEventListener('click', handleSwitchNSE);

  document.getElementById('nav-switch-forex')?.addEventListener('click', handleSwitchForex);
  document.getElementById('mobile-switch-forex')?.addEventListener('click', handleSwitchForex);

  // Pip/Lot Calculator Button (Desktop & Mobile)
  const handleOpenCalc = () => {
    closeDrawer();
    navbarCallbacks?.onOpenCalculator();
  };
  document.getElementById('btn-nav-calc')?.addEventListener('click', handleOpenCalc);
  document.getElementById('mobile-btn-calc')?.addEventListener('click', handleOpenCalc);

  // AI Co-Pilot Button (Desktop & Mobile)
  const handleOpenCopilot = () => {
    closeDrawer();
    navbarCallbacks?.onOpenCopilot();
  };
  document.getElementById('btn-nav-copilot')?.addEventListener('click', handleOpenCopilot);
  document.getElementById('mobile-btn-copilot')?.addEventListener('click', handleOpenCopilot);

  // Session Pill Trigger & News (Desktop & Mobile)
  const handleOpenNews = () => {
    closeDrawer();
    if (navbarCallbacks?.onOpenNews) {
      navbarCallbacks.onOpenNews();
    } else {
      store.setMainView('NEWS');
    }
  };
  document.getElementById('nav-session-trigger')?.addEventListener('click', handleOpenNews);
  document.getElementById('mobile-btn-news')?.addEventListener('click', handleOpenNews);

  // User Profile / Security (Desktop & Mobile)
  const handleOpenSecurity = () => {
    closeDrawer();
    store.setMainView('SECURITY');
  };
  document.getElementById('btn-nav-user')?.addEventListener('click', handleOpenSecurity);
  document.getElementById('mobile-btn-user')?.addEventListener('click', handleOpenSecurity);

  // Brand click resets to Floor
  document.getElementById('nav-brand-logo')?.addEventListener('click', () => {
    store.setMainView('FLOOR');
  });

  // Live IST Clock update
  updateClockDisplay();
}

function updateClockDisplay() {
  const clockEl = document.getElementById('nav-ist-clock');
  const mobileClockEl = document.getElementById('mobile-ist-clock');
  const stateEl = document.getElementById('nav-market-state');

  const update = () => {
    const opts: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    const nowStr = new Intl.DateTimeFormat('en-IN', opts).format(new Date());
    if (clockEl) clockEl.innerText = `${nowStr} IST`;
    if (mobileClockEl) mobileClockEl.innerText = `${nowStr} IST`;

    // Simple market state evaluator
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMins = now.getUTCMinutes();
    const istMinsTotal = (utcHours * 60 + utcMins + 330) % 1440;
    const isNSEOpen = istMinsTotal >= 555 && istMinsTotal <= 930; // 09:15 - 15:30 IST

    if (stateEl) {
      stateEl.innerText = isNSEOpen ? 'LIVE' : 'EXT-HOURS';
      stateEl.className = isNSEOpen ? 'state-label val-green' : 'state-label val-amber';
    }
  };

  update();
  setInterval(update, 1000);
}
