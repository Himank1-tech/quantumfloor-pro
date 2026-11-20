/**
 * Forex Factory-Style Economic Calendar Modal & Drawer.
 * Renders High (Red), Medium (Orange), and Low (Yellow) impact macro events,
 * countdown timers, forecast vs. previous metrics, and imminent blackout alerts.
 */

import { fetchEconomicNews, CalendarReport, EconomicEvent } from './api';

export class NewsDrawer {
  private overlay: HTMLElement;
  private currentFilter: 'ALL' | 'HIGH_RED' | 'MEDIUM_ORANGE' | 'LOW_YELLOW' | 'LIVE_NEWS' = 'ALL';
  private calendarData: CalendarReport | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-backdrop news-drawer-backdrop hidden';
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
  }

  public async open() {
    this.overlay.classList.remove('hidden');
    await this.refresh();
  }

  public close() {
    this.overlay.classList.add('hidden');
  }

  public async refresh() {
    this.overlay.innerHTML = `
      <div class="modal-card news-modal-card">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3>📅 Economic News Calendar</h3>
            <span class="sub-badge">Forex Factory & RBI Sync</span>
          </div>
          <button class="modal-close-btn" id="news-close-btn">&times;</button>
        </div>
        <div class="modal-body news-modal-body loading-state">
          Fetching institutional macro calendar...
        </div>
      </div>
    `;

    this.overlay.querySelector('#news-close-btn')?.addEventListener('click', () => this.close());

    try {
      this.calendarData = await fetchEconomicNews();
      this.renderContent();
    } catch (e: any) {
      const body = this.overlay.querySelector('.news-modal-body');
      if (body) {
        body.innerHTML = `<div class="error-msg">Failed to load news calendar: ${e.message}</div>`;
      }
    }
  }

  private renderContent() {
    const data = this.calendarData;
    if (!data) return;

    const filtered = data.events.filter(e => {
      if (this.currentFilter === 'ALL') return true;
      return e.impact === this.currentFilter;
    });

    const body = this.overlay.querySelector('.news-modal-body');
    if (!body) return;

    body.classList.remove('loading-state');
    body.innerHTML = `
      <!-- Warning Banner if active -->
      <div class="news-banner ${data.high_impact_warning_active ? 'warning-active' : 'warning-dormant'}">
        <div class="banner-title">
          ${data.high_impact_warning_active ? '🚨 HIGH-IMPACT NEWS BLACKOUT IN EFFECT' : 'ℹ️ MACRO NEWS MONITOR'}
        </div>
        <div class="banner-desc">
          ${data.warning_message || 'No high-impact releases within 30 minutes. Normal trading spreads.'}
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="news-filter-tabs">
        <button class="filter-tab ${this.currentFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">
          All Events (${data.events.length})
        </button>
        <button class="filter-tab red-tab ${this.currentFilter === 'HIGH_RED' ? 'active' : ''}" data-filter="HIGH_RED">
          🔴 High Impact (${data.events.filter(e => e.impact === 'HIGH_RED').length})
        </button>
        <button class="filter-tab orange-tab ${this.currentFilter === 'MEDIUM_ORANGE' ? 'active' : ''}" data-filter="MEDIUM_ORANGE">
          🟠 Medium Impact (${data.events.filter(e => e.impact === 'MEDIUM_ORANGE').length})
        </button>
        <button class="filter-tab yellow-tab ${this.currentFilter === 'LOW_YELLOW' ? 'active' : ''}" data-filter="LOW_YELLOW">
          🟡 Low Impact (${data.events.filter(e => e.impact === 'LOW_YELLOW').length})
        </button>
        <button class="filter-tab cyan-tab ${this.currentFilter === 'LIVE_NEWS' ? 'active' : ''}" data-filter="LIVE_NEWS">
          📰 Live Wire (${(data.news_articles || []).length})
        </button>
      </div>

      <!-- Events or Live News List -->
      <div class="news-events-grid">
        ${this.currentFilter === 'LIVE_NEWS' ? (
          (data.news_articles || []).map(art => {
            const isBull = art.sentiment === 'BULLISH';
            const isBear = art.sentiment === 'BEARISH';
            const sentClass = isBull ? 'sentiment-bullish' : (isBear ? 'sentiment-bearish' : 'sentiment-neutral');
            const sourceName = art.source.replace(' (RSS)', '');

            return `
              <div class="news-wire-card ${isBull ? 'wire-border-emerald' : (isBear ? 'wire-border-crimson' : 'wire-border-cyan')}">
                <div class="event-header-row">
                  <div class="wire-source-cluster">
                    <span class="news-source-pill font-mono">${sourceName}</span>
                    <span class="sentiment-badge ${sentClass}">● ${art.sentiment}</span>
                  </div>
                  <span class="wire-time-badge font-mono">${art.published}</span>
                </div>
                <div class="wire-title-row">
                  <a href="${art.link}" target="_blank" rel="noopener noreferrer" class="wire-headline font-bold hover:underline">${art.title}</a>
                </div>
                <div class="wire-tickers-row">
                  <span class="wire-tickers-lbl">Impacted Tickers:</span>
                  ${(art.affected_tickers || ['NIFTY', 'GLOBAL']).map(t => `<span class="affected-ticker-chip font-mono">${t}</span>`).join('')}
                </div>
                <div class="event-desc-row mt-2 text-dim text-xs">${art.summary}</div>
              </div>
            `;
          }).join('')
        ) : (
          filtered.map(evt => {
            const impactClass = evt.impact === 'HIGH_RED' ? 'impact-crimson-strip' : (evt.impact === 'MEDIUM_ORANGE' ? 'impact-gold-strip' : 'impact-cyan-strip');
            const isHigh = evt.impact === 'HIGH_RED';
            const timeBadge = evt.minutes_away > 0 
              ? `⏳ In ${Math.floor(evt.minutes_away / 60)}h ${evt.minutes_away % 60}m` 
              : `✓ ${Math.abs(evt.minutes_away)}m ago`;

            return `
              <div class="news-event-card ${impactClass} ${evt.is_imminent ? 'imminent-card' : ''}">
                <div class="event-header-row">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="currency-tag tag-${evt.currency.toLowerCase()} font-mono font-bold">${evt.currency}</span>
                    <span class="event-name font-bold">${evt.event_name}</span>
                  </div>
                  <span class="event-time-badge font-mono ${isHigh ? 'countdown-pulse-red' : ''}">${timeBadge}</span>
                </div>

                <div class="event-schedule-row">
                  <span class="sched-ist font-mono">⏰ IST: <strong>${evt.scheduled_ist}</strong></span>
                  <span class="sched-utc font-mono">🌐 UTC: ${evt.scheduled_utc}</span>
                  <span class="impact-level-pill font-mono ${impactClass}">${isHigh ? '🔴 HIGH IMPACT' : (evt.impact === 'MEDIUM_ORANGE' ? '🟠 MEDIUM IMPACT' : '🟡 LOW IMPACT')}</span>
                </div>

                <div class="event-metrics-row">
                  <div class="metric-col">
                    <span class="metric-lbl">Forecast</span>
                    <span class="metric-val font-mono">${evt.forecast}</span>
                  </div>
                  <div class="metric-col">
                    <span class="metric-lbl">Previous</span>
                    <span class="metric-val font-mono">${evt.previous}</span>
                  </div>
                  <div class="metric-col">
                    <span class="metric-lbl">Actual</span>
                    <span class="metric-val font-mono ${evt.actual ? 'actual-printed' : 'pending'}">${evt.actual || 'Pending'}</span>
                  </div>
                </div>

                <div class="event-desc-row">${evt.description}</div>
              </div>
            `;
          }).join('')
        )}
      </div>
    `;

    // Attach filter click events
    body.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.currentFilter = target.dataset.filter as any;
        this.renderContent();
      });
    });
  }
}
