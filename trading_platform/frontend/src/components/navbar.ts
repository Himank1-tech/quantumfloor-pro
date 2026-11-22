/**
 * Institutional Top Navigation Bar & Mobile Responsive Navigation Suite
 * Sleek 60px Top Bar (Desktop) / 56px Compact Row + Mobile Drawer + Bottom Bar (Mobile/Tablet)
 */

import { store, MainViewTab } from '../state';
import { fetchSreBanner } from '../api';

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
    <!-- Global Production Incident Broadcast Banner (if active) -->
    <div id="global-incident-banner" class="global-incident-banner" style="display:none; background:#FEF2F2; border-bottom:1px solid #FCA5A5; color:#991B1B; padding:6px 16px; font-size:11px; font-weight:700; align-items:center; justify-content:center; gap:8px;">
      <span class="status-pulse-dot pulse-red"></span>
      <span id="global-incident-banner-text">PRODUCTION ALERT: Incident broadcast active.</span>
    </div>

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

      <!-- Universal Global Search Bar (Desktop & Tablet) -->
      <div class="nav-global-search-container" id="nav-global-search">
        <div class="nav-search-input-wrapper">
          <span class="nav-search-icon">🔍</span>
          <input type="text" id="global-search-input" class="global-search-input" placeholder="Search symbols, trades, SMC setups, tools, news..." autocomplete="off" />
          <kbd class="nav-search-kbd">Ctrl+K</kbd>
        </div>
        <div class="global-search-dropdown" id="global-search-dropdown" style="display:none;"></div>
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
        ${u ? `
          <button class="nav-user-chip" id="btn-nav-user" title="${u.email || 'Account & Security Settings'}">
            <span class="user-avatar-circle" style="${u.email?.includes('@gmail.com') ? 'background:#EA4335;' : ''}">${(u.username || 'AD').substring(0, 2).toUpperCase()}</span>
            <span class="user-name">${u.username}</span>
            <span class="user-role-badge">${u.role}</span>
          </button>
        ` : `
          <button class="nav-user-chip unauthenticated" id="btn-nav-user" title="Sign In or Connect Broker" style="background:#FFFFFF; border:1px solid #CBD5E1; color:#0F172A; box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <span class="user-avatar-circle" style="background:#2563EB; color:#FFFFFF; font-weight:700;">🔑</span>
            <span class="user-name" style="color:#0F172A; font-weight:700;">Sign In</span>
            <span class="user-role-badge" style="background:#F1F5F9; color:#475569; border:1px solid #CBD5E1;">GUEST</span>
          </button>
        `}

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

        <!-- Mobile Global Search -->
        <div style="padding: 12px 16px 4px 16px;">
          <div class="nav-search-input-wrapper">
            <span class="nav-search-icon">🔍</span>
            <input type="text" id="mobile-global-search-input" class="global-search-input" placeholder="Search markets, tools, setups..." autocomplete="off" />
          </div>
          <div class="global-search-dropdown" id="mobile-search-dropdown" style="display:none; position:relative; top:6px;"></div>
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
          ${u ? `
            <button class="drawer-user-card" id="mobile-btn-user" title="Open Security & Account Panel">
              <span class="user-avatar-circle" style="${u.email?.includes('@gmail.com') ? 'background:#EA4335;' : ''}">${(u.username || 'AD').substring(0, 2).toUpperCase()}</span>
              <div class="drawer-user-info">
                <span class="drawer-username">${u.username}</span>
                <span class="drawer-useremail">${u.email}</span>
              </div>
              <span class="drawer-role-badge">${u.role}</span>
            </button>
          ` : `
            <button class="drawer-user-card unauthenticated" id="mobile-btn-user" title="Sign In or Connect Broker" style="background:#FFFFFF; border:1px solid #CBD5E1;">
              <span class="user-avatar-circle" style="background:#2563EB; color:#fff;">🔑</span>
              <div class="drawer-user-info">
                <span class="drawer-username" style="color:#0F172A; font-weight:700;">Sign In</span>
                <span class="drawer-useremail" style="color:#64748B;">Access Account & Brokers</span>
              </div>
              <span class="drawer-role-badge">GUEST</span>
            </button>
          `}
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

export function updateNavbarState(): void {
  const v = store.activeMainView;
  const isNSE = store.activeTab === 'INDIAN_EQUITY';
  const u = store.currentUser;

  // Update Active Navigation Buttons (Desktop, Drawer & Bottom Bar)
  document.querySelectorAll('.nav-tab-item, .mobile-nav-item, .bottom-bar-item[data-view]').forEach((btn) => {
    const view = btn.getAttribute('data-view');
    if (view === v) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update Market Switcher Segments
  const nseBtns = [document.getElementById('nav-switch-nse'), document.getElementById('mobile-switch-nse')];
  const forexBtns = [document.getElementById('nav-switch-forex'), document.getElementById('mobile-switch-forex')];

  nseBtns.forEach((btn) => (isNSE ? btn?.classList.add('active') : btn?.classList.remove('active')));
  forexBtns.forEach((btn) => (!isNSE ? btn?.classList.add('active') : btn?.classList.remove('active')));

  // Update User Profile Badge
  const userChip = document.getElementById('btn-nav-user');
  if (userChip) {
    const avatar = userChip.querySelector('.user-avatar-circle') as HTMLElement;
    const name = userChip.querySelector('.user-name') as HTMLElement;
    const role = userChip.querySelector('.user-role-badge') as HTMLElement;
    if (u) {
      if (avatar) {
        avatar.innerText = (u.username || 'AD').substring(0, 2).toUpperCase();
        avatar.style.background = u.email?.includes('@gmail.com') ? '#EA4335' : '#2563EB';
      }
      if (name) name.innerText = u.username || 'User';
      if (role) role.innerText = u.role || 'TRADER';
    } else {
      if (avatar) {
        avatar.innerText = '🔑';
        avatar.style.background = '#2563EB';
      }
      if (name) name.innerText = 'Sign In';
      if (role) role.innerText = 'GUEST';
    }
  }

  // Update Drawer User Profile
  const drawerUserCard = document.getElementById('mobile-btn-user');
  if (drawerUserCard) {
    const drawerAvatar = drawerUserCard.querySelector('.user-avatar-circle') as HTMLElement;
    const drawerName = drawerUserCard.querySelector('.drawer-username') as HTMLElement;
    const drawerEmail = drawerUserCard.querySelector('.drawer-useremail') as HTMLElement;
    const drawerRole = drawerUserCard.querySelector('.drawer-role-badge') as HTMLElement;
    if (u) {
      if (drawerAvatar) {
        drawerAvatar.innerText = (u.username || 'AD').substring(0, 2).toUpperCase();
        drawerAvatar.style.background = u.email?.includes('@gmail.com') ? '#EA4335' : '#2563EB';
      }
      if (drawerName) drawerName.innerText = u.username || 'User';
      if (drawerEmail) drawerEmail.innerText = u.email || '';
      if (drawerRole) drawerRole.innerText = u.role || 'TRADER';
    } else {
      if (drawerAvatar) {
        drawerAvatar.innerText = '🔑';
        drawerAvatar.style.background = '#2563EB';
      }
      if (drawerName) drawerName.innerText = 'Sign In';
      if (drawerEmail) drawerEmail.innerText = 'Access Account & Brokers';
      if (drawerRole) drawerRole.innerText = 'GUEST';
    }
  }
}

export function setupNavbarEventListeners(): void {
  // Check for global active SRE incident
  const checkIncidentBanner = async () => {
    try {
      const bannerData = await fetchSreBanner();
      const bannerEl = document.getElementById('global-incident-banner');
      const bannerText = document.getElementById('global-incident-banner-text');
      if (bannerEl && bannerText) {
        if (bannerData.has_incident && bannerData.incident) {
          bannerEl.style.display = 'flex';
          bannerText.textContent = `🚨 ${bannerData.incident.severity}: ${bannerData.incident.title} — ${bannerData.incident.description || 'Engineering team active'}`;
        } else {
          bannerEl.style.display = 'none';
        }
      }
    } catch {
      // ignore
    }
  };
  checkIncidentBanner();

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

  // Setup Global Search (Desktop & Mobile)
  setupGlobalSearch('global-search-input', 'global-search-dropdown', navbarCallbacks, closeDrawer);
  setupGlobalSearch('mobile-global-search-input', 'mobile-search-dropdown', navbarCallbacks, closeDrawer);

  // Live IST Clock update
  updateClockDisplay();
}

function setupGlobalSearch(
  inputId: string,
  dropdownId: string,
  actions?: NavbarActionCallbacks,
  closeDrawerFn?: () => void
) {
  const searchInput = document.getElementById(inputId) as HTMLInputElement | null;
  const searchDropdown = document.getElementById(dropdownId);
  if (!searchInput || !searchDropdown) return;

  const SYMBOLS_LIST = [
    { sym: 'RELIANCE', name: 'Reliance Industries Ltd', market: 'NSE / BSE', flag: '🇮🇳' },
    { sym: 'TCS', name: 'Tata Consultancy Services', market: 'NSE / BSE', flag: '🇮🇳' },
    { sym: 'HDFCBANK', name: 'HDFC Bank Ltd', market: 'NSE / BSE', flag: '🇮🇳' },
    { sym: 'ICICIBANK', name: 'ICICI Bank Ltd', market: 'NSE / BSE', flag: '🇮🇳' },
    { sym: 'INFY', name: 'Infosys Ltd', market: 'NSE / BSE', flag: '🇮🇳' },
    { sym: 'SBIN', name: 'State Bank of India', market: 'NSE / BSE', flag: '🇮🇳' },
    { sym: 'BHARTIARTL', name: 'Bharti Airtel Ltd', market: 'NSE / BSE', flag: '🇮🇳' },
    { sym: 'NIFTY 50', name: 'Nifty 50 Index', market: 'NSE Index', flag: '🇮🇳' },
    { sym: 'BANKNIFTY', name: 'Bank Nifty Index', market: 'NSE Index', flag: '🇮🇳' },
    { sym: 'EUR/USD', name: 'Euro / US Dollar', market: 'Global Forex', flag: '🌐' },
    { sym: 'GBP/USD', name: 'British Pound / US Dollar', market: 'Global Forex', flag: '🌐' },
    { sym: 'USD/INR', name: 'US Dollar / Indian Rupee', market: 'Global Forex', flag: '🌐' },
    { sym: 'USD/JPY', name: 'US Dollar / Japanese Yen', market: 'Global Forex', flag: '🌐' },
    { sym: 'XAU/USD', name: 'Gold Spot / US Dollar', market: 'Commodity', flag: '🪙' },
  ];

  const TOOLS_LIST = [
    { id: 'tool-backtest', title: 'Backtest Lab', desc: 'Strategy simulation & Bar Replay', icon: '🔬', action: () => store.setMainView('BACKTEST') },
    { id: 'tool-ipo', title: 'IPO Hub & Wealth', desc: 'Live Mainboard & SME IPOs, SIP Baskets', icon: '📰', action: () => store.setMainView('IPO') },
    { id: 'tool-news', title: 'Economic News', desc: 'Real-time Macro Events & Sessions', icon: '📅', action: () => actions?.onOpenNews?.() },
    { id: 'tool-calc', title: 'Pip & Lot Risk Calculator', desc: 'Institutional position sizing', icon: '📐', action: () => actions?.onOpenCalculator?.() },
    { id: 'tool-copilot', title: 'AI Co-Pilot Assistant', desc: 'Institutional SMC trade rationale', icon: '✨', action: () => actions?.onOpenCopilot?.() },
    { id: 'tool-fvg', title: '90% FVG (Fair Value Gap)', desc: 'Institutional order imbalance zones', icon: '⚡', action: () => { store.setMainView('FLOOR'); } },
    { id: 'tool-ob', title: 'Order Blocks (OB)', desc: 'High-probability smart money footprints', icon: '🧱', action: () => { store.setMainView('FLOOR'); } },
    { id: 'tool-liq', title: 'Internal & External Liquidity', desc: 'Buy/Sell-side liquidity sweep pools', icon: '💧', action: () => { store.setMainView('FLOOR'); } },
    { id: 'tool-sr', title: 'Support & Resistance (BOS/CHoCH)', desc: 'Market structure break & change of character', icon: '📊', action: () => { store.setMainView('FLOOR'); } },
    { id: 'tool-fib', title: 'OTE Fibonacci Retracement', desc: '0.618 - 0.786 Optimal Trade Entry', icon: '≋', action: () => { store.setMainView('FLOOR'); } },
    { id: 'tool-vault', title: 'Multi-Broker Vault & Security', desc: 'AES-128 Fernet broker encryption', icon: '🔐', action: () => store.setMainView('SECURITY') },
  ];

  const performSearch = (q: string) => {
    const query = q.trim().toLowerCase();
    if (!query) {
      searchDropdown.style.display = 'none';
      searchDropdown.innerHTML = '';
      return;
    }

    const matchedSymbols = SYMBOLS_LIST.filter(
      (s) => s.sym.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
    );

    const activeTrades = (store.trades || []).filter(
      (t) => t.symbol.toLowerCase().includes(query) || (t.order_id && t.order_id.toLowerCase().includes(query)) || t.side.toLowerCase().includes(query)
    );

    const matchedTools = TOOLS_LIST.filter(
      (t) => t.title.toLowerCase().includes(query) || t.desc.toLowerCase().includes(query)
    );

    let html = '';

    if (matchedSymbols.length > 0) {
      html += `<div class="search-category-header">MARKETS &amp; SYMBOLS</div>`;
      for (const s of matchedSymbols.slice(0, 5)) {
        html += `
          <div class="search-result-item" data-action="symbol" data-sym="${s.sym}">
            <div class="search-item-left">
              <span class="search-item-flag">${s.flag}</span>
              <div>
                <span class="search-item-title">${s.sym}</span>
                <span class="search-item-sub">${s.name} • ${s.market}</span>
              </div>
            </div>
            <span class="search-jump-badge">Jump to Chart ›</span>
          </div>
        `;
      }
    }

    if (activeTrades.length > 0) {
      html += `<div class="search-category-header">ACTIVE TRADES &amp; BLOTTER</div>`;
      for (const tr of activeTrades.slice(0, 3)) {
        html += `
          <div class="search-result-item" data-action="trade" data-sym="${tr.symbol}">
            <div class="search-item-left">
              <span class="search-item-side ${tr.side.toLowerCase()}">${tr.side}</span>
              <div>
                <span class="search-item-title">${tr.symbol} • ${tr.quantity} Qty @ ${tr.price}</span>
                <span class="search-item-sub">Order ${tr.order_id || tr.trade_id}</span>
              </div>
            </div>
            <span class="search-jump-badge">Highlight ›</span>
          </div>
        `;
      }
    }

    if (matchedTools.length > 0) {
      html += `<div class="search-category-header">PLATFORM TOOLS &amp; FEATURES</div>`;
      for (const tl of matchedTools.slice(0, 4)) {
        html += `
          <div class="search-result-item" data-action="tool" data-toolid="${tl.id}">
            <div class="search-item-left">
              <span class="search-item-icon">${tl.icon}</span>
              <div>
                <span class="search-item-title">${tl.title}</span>
                <span class="search-item-sub">${tl.desc}</span>
              </div>
            </div>
            <span class="search-jump-badge">Open Tool ›</span>
          </div>
        `;
      }
    }

    if (!html) {
      html = `<div class="search-no-results" style="padding:12px; font-size:11px; color:#64748B; text-align:center;">No matching symbols, trades, or tools found for "${q}"</div>`;
    }

    searchDropdown.innerHTML = html;
    searchDropdown.style.display = 'block';

    // Wire clicks
    searchDropdown.querySelectorAll('.search-result-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const act = el.dataset.action;
        if (act === 'symbol' || act === 'trade') {
          const sym = el.dataset.sym;
          if (sym) {
            store.setSelectedSymbol(sym);
            actions?.onSelectSymbol?.(sym);
            store.setMainView('FLOOR');
          }
        } else if (act === 'tool') {
          const tid = el.dataset.toolid;
          const found = TOOLS_LIST.find((t) => t.id === tid);
          found?.action();
        }
        searchDropdown.style.display = 'none';
        searchInput.value = '';
        closeDrawerFn?.();
      });
    });
  };

  searchInput.addEventListener('input', (e) => {
    performSearch((e.target as HTMLInputElement).value);
  });

  searchInput.addEventListener('focus', (e) => {
    performSearch((e.target as HTMLInputElement).value || 'RELIANCE');
  });

  document.addEventListener('click', (e) => {
    if (!document.getElementById('nav-global-search')?.contains(e.target as Node) &&
        !document.getElementById('mobile-search-dropdown')?.contains(e.target as Node)) {
      searchDropdown.style.display = 'none';
    }
  });

  // Ctrl+K to focus search input
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
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
