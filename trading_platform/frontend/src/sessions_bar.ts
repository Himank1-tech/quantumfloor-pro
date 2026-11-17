/**
 * Persistent Global Session Clocks & Institutional Killzones Bar.
 * Renders real-time IST and UTC clocks, market open/closed status for NSE/BSE,
 * active Forex sessions, London-NY Overlap Killzone indicator, and Red-News countdown.
 */

import { fetchSessionOverview, SessionOverview, fetchEconomicNews, CalendarReport } from './api';

export class SessionsBar {
  private container: HTMLElement;
  private timer: number | null = null;
  private currentOverview: SessionOverview | null = null;
  private currentCalendar: CalendarReport | null = null;
  private onOpenNewsDrawer: () => void;
  private onOpenCalculator: () => void;
  private onOpenCopilot: () => void;

  constructor(
    containerId: string,
    callbacks: {
      onOpenNewsDrawer: () => void;
      onOpenCalculator: () => void;
      onOpenCopilot: () => void;
    }
  ) {
    const el = document.getElementById(containerId);
    if (!el) {
      this.container = document.createElement('div');
      this.container.id = containerId;
      document.body.prepend(this.container);
    } else {
      this.container = el;
    }
    this.onOpenNewsDrawer = callbacks.onOpenNewsDrawer;
    this.onOpenCalculator = callbacks.onOpenCalculator;
    this.onOpenCopilot = callbacks.onOpenCopilot;

    this.init();
  }

  public async init() {
    await this.updateData();
    this.render();

    // Auto-refresh every 5 seconds
    this.timer = window.setInterval(async () => {
      await this.updateData();
      this.render();
    }, 5000);
  }

  private async updateData() {
    try {
      const [sessions, news] = await Promise.all([
        fetchSessionOverview(),
        fetchEconomicNews().catch(() => null),
      ]);
      this.currentOverview = sessions;
      if (news) this.currentCalendar = news;
    } catch (e) {
      console.warn('Failed to update sessions bar data', e);
    }
  }

  public render() {
    if (!this.currentOverview) {
      this.container.innerHTML = `<div class="sessions-bar loading">Synchronizing global session clocks...</div>`;
      return;
    }

    const ov = this.currentOverview;
    const isNseOpen = ov.nse_bse_status === 'OPEN';
    const isNsePre = ov.nse_bse_status === 'PRE_OPEN';
    const nseClass = isNseOpen ? 'badge-open' : (isNsePre ? 'badge-pre' : 'badge-closed');

    const overlapActive = ov.london_ny_overlap_active;
    const warningActive = this.currentCalendar?.high_impact_warning_active;
    const warningMsg = this.currentCalendar?.warning_message || 'No immediate high-impact news';

    this.container.innerHTML = `
      <div class="sessions-strip">
        <div class="session-clocks-group">
          <div class="clock-item">
            <span class="clock-label">IST (India)</span>
            <span class="clock-value ist-glow">${ov.ist_time}</span>
          </div>
          <div class="clock-item">
            <span class="clock-label">UTC (Forex)</span>
            <span class="clock-value">${ov.utc_time}</span>
          </div>
        </div>

        <div class="market-status-pills">
          <!-- NSE/BSE Pill -->
          <div class="market-pill ${nseClass}" title="${ov.nse_bse_time_remaining}">
            <span class="status-dot"></span>
            <span class="market-name">NSE/BSE</span>
            <span class="status-text">${ov.nse_bse_status}</span>
            <span class="countdown-text">${ov.nse_bse_time_remaining}</span>
          </div>

          <!-- London-NY Overlap Killzone Pill -->
          <div class="killzone-pill ${overlapActive ? 'killzone-active' : 'killzone-dormant'}" 
               title="13:00 - 17:00 UTC (18:30 - 22:30 IST) Peak Institutional Liquidity">
            <span class="kz-badge">${overlapActive ? '🔥 KILLZONE ACTIVE' : '⚡ KILLZONE DORMANT'}</span>
            <span class="kz-label">LONDON - NY OVERLAP</span>
          </div>

          <!-- Active Sessions Badges -->
          <div class="active-fx-sessions">
            ${ov.sessions.slice(1).map(s => `
              <span class="fx-session-tag ${s.is_active ? 'active' : 'inactive'}" title="${s.name}: ${s.time_remaining}">
                ${s.name.split(' ')[0]} ${s.is_active ? '●' : '○'}
              </span>
            `).join('')}
          </div>
        </div>

        <!-- Red News Warning / Ticker -->
        <div class="news-warning-ticker ${warningActive ? 'alert-flash' : ''}" id="btn-open-news-ticker">
          <span class="news-icon">${warningActive ? '🚨' : '📅'}</span>
          <span class="news-text">${warningMsg}</span>
          <button class="news-drawer-btn" id="news-click-btn">View Calendar</button>
        </div>

        <!-- Quick Access Actions -->
        <div class="sessions-actions">
          <button class="pill-action-btn" id="btn-quick-calc" title="Universal Pip & Lot Sizing Calculator">
            🧮 Pip/Lot Calc
          </button>
          <button class="pill-action-btn copilot-pill-btn" id="btn-quick-copilot" title="Interactive AI Co-Pilot">
            🤖 AI Co-Pilot
          </button>
        </div>
      </div>
    `;

    // Attach event listeners
    this.container.querySelector('#btn-open-news-ticker')?.addEventListener('click', () => this.onOpenNewsDrawer());
    this.container.querySelector('#news-click-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onOpenNewsDrawer();
    });
    this.container.querySelector('#btn-quick-calc')?.addEventListener('click', () => this.onOpenCalculator());
    this.container.querySelector('#btn-quick-copilot')?.addEventListener('click', () => this.onOpenCopilot());
  }

  public destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
