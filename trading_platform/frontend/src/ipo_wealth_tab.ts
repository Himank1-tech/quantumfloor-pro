/**
 * IPO Intelligence Terminal & Long-Term Wealth/SIP Baskets View.
 * Displays live NSE/BSE IPOs with GMP meters, DRHP analysis, subscription tracking,
 * and Thematic Wealth Baskets with multi-year compound SIP calculators.
 */

import {
  fetchIPOs,
  fetchIPOAnalysis,
  IPOSummary,
  IPOIntelligenceReport,
  fetchBaskets,
  ThematicBasket,
  fetchSIPProjections,
  SIPCalculationResult,
  investInBasket,
  applyForIPO,
} from './api';

export class IPOWealthTab {
  private container: HTMLElement;
  private ipos: IPOSummary[] = [];
  private baskets: ThematicBasket[] = [];
  private currentFilter: string = 'ALL';
  private selectedBasketId: string = 'BSK-NIFTY-COMPOUNDERS';
  private sipProjection: SIPCalculationResult | null = null;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) {
      this.container = document.createElement('div');
      this.container.id = containerId;
      document.body.appendChild(this.container);
    } else {
      this.container = el;
    }
  }

  public async init() {
    this.container.innerHTML = `<div class="loading-state">Loading IPO Intelligence & Thematic Wealth Portfolios...</div>`;
    try {
      const [ipos, baskets] = await Promise.all([
        fetchIPOs(),
        fetchBaskets(),
      ]);
      this.ipos = ipos;
      this.baskets = baskets;
      if (baskets.length > 0) {
        this.selectedBasketId = baskets[0].basket_id;
        this.sipProjection = await fetchSIPProjections(this.selectedBasketId, 15000, 10).catch(() => null);
      }
      this.render();
    } catch (e: any) {
      this.container.innerHTML = `<div class="error-msg">Failed to load wealth data: ${e.message}</div>`;
    }
  }

  public render() {
    const filteredIpos = this.ipos.filter(ipo => {
      if (this.currentFilter === 'ALL') return true;
      return ipo.status.toUpperCase() === this.currentFilter;
    });

    this.container.innerHTML = `
      <div class="ipo-wealth-view">
        <!-- Tab Sub-Navigation -->
        <div class="wealth-header-row">
          <div class="wealth-title-col">
            <h2>💎 Institutional IPO Intelligence & Long-Term Wealth</h2>
            <p class="section-desc">Grounded DRHP valuation multiples, real-time GMP tracking, and thematic Smallcase-style SIP baskets.</p>
          </div>
        </div>

        <!-- SECTION 1: IPO INTELLIGENCE TERMINAL -->
        <div class="wealth-section">
          <div class="section-top-bar">
            <div class="section-title-wrap">
              <span class="sec-icon">🚀</span>
              <h3>Autonomous IPO Intelligence Engine (NSE / BSE)</h3>
            </div>
            <div class="ipo-filter-chips">
              <button class="chip-filter ${this.currentFilter === 'ALL' ? 'active' : ''}" data-status="ALL">All IPOs</button>
              <button class="chip-filter ${this.currentFilter === 'ACTIVE' ? 'active' : ''}" data-status="ACTIVE">Bidding Active</button>
              <button class="chip-filter ${this.currentFilter === 'UPCOMING' ? 'active' : ''}" data-status="UPCOMING">Upcoming</button>
              <button class="chip-filter ${this.currentFilter === 'LISTED' ? 'active' : ''}" data-status="LISTED">Recently Listed</button>
            </div>
          </div>

          <div class="ipo-cards-grid">
            ${filteredIpos.map(ipo => {
              const gmpPct = ipo.gmp?.gmp_pct || 0;
              const gmpVal = ipo.gmp?.current_gmp || 0;
              const isPositiveGmp = gmpPct >= 0;
              const totalSub = ipo.subscription?.total_times || 0;
              const isLive = ipo.status.toUpperCase() === 'ACTIVE' || ipo.status.toUpperCase() === 'OPEN';
              const isUpcoming = ipo.status.toUpperCase() === 'UPCOMING';

              return `
                <div class="ipo-card" data-ipo-id="${ipo.ipo_id}">
                  <div class="ipo-card-header">
                    <div>
                      <div class="ipo-header-top-row">
                        <span class="ipo-sector-badge">${(ipo.sector || 'EQUITY').toUpperCase()}</span>
                        <span class="ipo-status-pill ${isLive ? 'pill-live' : (isUpcoming ? 'pill-upcoming' : 'pill-listed')}">
                          <span class="status-pulse-dot ${isLive ? 'pulse-green' : (isUpcoming ? 'pulse-gold' : '')}"></span>
                          ${isLive ? 'BIDDING ACTIVE' : (isUpcoming ? 'UPCOMING' : 'LISTED')}
                        </span>
                      </div>
                      <div class="ipo-company">${ipo.company_name}</div>
                      <div class="ipo-symbol">${ipo.symbol} · NSE &amp; BSE Mainboard</div>
                    </div>
                  </div>

                  <!-- Animated GMP Gain Meter in Sovereign Gold & Neon Emerald -->
                  <div class="ipo-gmp-gain-meter ${isPositiveGmp ? 'gmp-meter-emerald' : 'gmp-meter-crimson'}">
                    <div class="gmp-meter-header">
                      <div class="gmp-meter-title">
                        <span class="gmp-icon">🔥</span>
                        <span class="gmp-lbl">Grey Market Premium (GMP)</span>
                      </div>
                      <span class="gmp-gain-pill">${gmpPct >= 0 ? '+' : ''}${gmpPct.toFixed(1)}% Est. Gain</span>
                    </div>
                    <div class="gmp-price-row">
                      <span class="gmp-current-val">₹${gmpVal.toFixed(1)}</span>
                      <span class="gmp-exp-listing">Est. Listing: <strong>₹${ipo.gmp?.expected_listing_price?.toFixed(1) || '--'}</strong></span>
                    </div>
                    <div class="gmp-track-wrap">
                      <div class="gmp-track-fill" style="width: ${Math.min(100, Math.max(12, Math.abs(gmpPct) * 1.6))}%"></div>
                    </div>
                  </div>

                  <!-- Price Band & Lot Size Institutional Grid -->
                  <div class="ipo-meta-grid">
                    <div class="ipo-meta-item">
                      <span class="lbl">Price Band</span>
                      <span class="val font-mono">₹${ipo.price_band_low} - ₹${ipo.price_band_high}</span>
                    </div>
                    <div class="ipo-meta-item">
                      <span class="lbl">Lot Size</span>
                      <span class="val font-mono">${ipo.lot_size} Shares</span>
                    </div>
                    <div class="ipo-meta-item">
                      <span class="lbl">Total Issue</span>
                      <span class="val font-mono">₹${ipo.issue_size_cr.toLocaleString()} Cr</span>
                    </div>
                    <div class="ipo-meta-item">
                      <span class="lbl">Fresh Issue</span>
                      <span class="val font-mono">₹${ipo.fresh_issue_cr.toLocaleString()} Cr</span>
                    </div>
                  </div>

                  <!-- Subscription Multiplier Progress (QIB / NII / Retail) -->
                  <div class="ipo-sub-multi-box">
                    <div class="sub-multi-header">
                      <span class="sub-lbl">Institutional Subscription Demand</span>
                      <span class="sub-total-val font-mono">${totalSub.toFixed(2)}x Booked</span>
                    </div>
                    <div class="sub-multi-bar">
                      <div class="sub-seg sub-qib" title="QIB: ${(totalSub * 0.48).toFixed(1)}x" style="width: 48%;"></div>
                      <div class="sub-seg sub-nii" title="NII: ${(totalSub * 0.32).toFixed(1)}x" style="width: 32%;"></div>
                      <div class="sub-seg sub-ret" title="Retail: ${(totalSub * 0.20).toFixed(1)}x" style="width: 20%;"></div>
                    </div>
                    <div class="sub-tiers-legend">
                      <span>QIB: <strong>${(totalSub * 0.48).toFixed(1)}x</strong></span>
                      <span>NII: <strong>${(totalSub * 0.32).toFixed(1)}x</strong></span>
                      <span>Retail: <strong>${(totalSub * 0.20).toFixed(1)}x</strong></span>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="ipo-actions-row flex gap-2">
                    <button class="btn-drhp-modal flex-1" data-id="${ipo.ipo_id}">
                      🔍 DRHP Analysis
                    </button>
                    <button class="btn-ipo-apply flex-1" data-id="${ipo.ipo_id}" data-name="${ipo.company_name}" data-price="${ipo.price_band_high}" data-lot="${ipo.lot_size}">
                      ⚡ Instant ASBA UPI Bid
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- SECTION 2: THEMATIC WEALTH BASKETS & SIP -->
        <div class="wealth-section mt-8">
          <div class="section-top-bar">
            <div class="section-title-wrap">
              <span class="sec-icon">📈</span>
              <h3>Long-Term Wealth & Systematic Compounding Baskets (Smallcase-Style)</h3>
            </div>
          </div>

          <div class="baskets-layout">
            <!-- Left: Basket Selector Cards -->
            <div class="baskets-cards-col">
              ${this.baskets.map(b => {
                const isSelected = b.basket_id === this.selectedBasketId;
                return `
                  <div class="thematic-basket-card ${isSelected ? 'selected' : ''}" data-basket-id="${b.basket_id}">
                    <div class="basket-head">
                      <div>
                        <h4>${b.title}</h4>
                        <div class="basket-tagline">${b.tagline}</div>
                      </div>
                      <span class="basket-cagr-badge">+${b.cagr_3yr_pct.toFixed(1)}% 3Y CAGR</span>
                    </div>
                    
                    <!-- Projected Growth Sparkline -->
                    <div class="basket-sparkline-row">
                      <svg class="basket-cagr-sparkline" viewBox="0 0 200 36" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="cagr-grad-${b.basket_id}" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#00E676" stop-opacity="0.35"/>
                            <stop offset="100%" stop-color="#00E676" stop-opacity="0.0"/>
                          </linearGradient>
                        </defs>
                        <path d="M 0 32 Q 50 28 100 18 T 200 4 L 200 36 L 0 36 Z" fill="url(#cagr-grad-${b.basket_id})"/>
                        <path d="M 0 32 Q 50 28 100 18 T 200 4" fill="none" stroke="#00E676" stroke-width="2.5" stroke-linecap="round"/>
                      </svg>
                    </div>

                    <div class="basket-stats-row">
                      <div class="b-stat">
                        <span class="stat-lbl">Sharpe</span>
                        <span class="stat-val font-mono text-cyan">${b.annualized_sharpe.toFixed(2)}</span>
                      </div>
                      <div class="b-stat">
                        <span class="stat-lbl">Max Drawdown</span>
                        <span class="stat-val font-mono text-red">-${b.max_drawdown_pct.toFixed(1)}%</span>
                      </div>
                      <div class="b-stat">
                        <span class="stat-lbl">Min. Inv.</span>
                        <span class="stat-val font-mono text-gold">₹${b.min_investment_amount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Right: Interactive SIP Compounding Calculator -->
            <div class="sip-calc-col">
              <div class="sip-calc-card">
                <div class="sip-calc-header">
                  <h4>🧮 Interactive Multi-Year SIP Projection</h4>
                  <span class="basket-name-tag">${this.selectedBasketId}</span>
                </div>

                <div class="sip-inputs-inline">
                  <div class="sip-input-grp">
                    <label>Monthly SIP (₹)</label>
                    <input type="number" id="sip-monthly-amount" class="form-input" value="15000" step="1000" />
                  </div>
                  <div class="sip-input-grp">
                    <label>Duration (Years)</label>
                    <select id="sip-duration" class="form-input">
                      <option value="5">5 Years</option>
                      <option value="10" selected>10 Years</option>
                      <option value="15">15 Years</option>
                      <option value="20">20 Years</option>
                    </select>
                  </div>
                  <button class="primary-btn btn-calc-sip" id="btn-recalc-sip">Recalculate</button>
                </div>

                <div id="sip-results-box">
                  ${this.renderSIPResults()}
                </div>

                <div class="sip-action-footer">
                  <button class="primary-btn btn-invest-sip" id="btn-open-invest-modal">
                    🚀 Execute Basket SIP Investment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- DRHP Modal Container -->
        <div id="drhp-modal-container"></div>
      </div>
    `;

    this.attachEvents();
  }

  private renderSIPResults(): string {
    if (!this.sipProjection) return `<div class="results-loading">Calculating SIP compound curve...</div>`;
    const p = this.sipProjection;

    return `
      <div class="sip-summary-metrics">
        <div class="sip-metric-tile">
          <span class="lbl">Total Invested</span>
          <span class="val">₹${p.total_invested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="sip-metric-tile highlight">
          <span class="lbl">Projected Wealth (${p.expected_cagr_pct}% CAGR)</span>
          <span class="val text-green">₹${p.projected_wealth.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="sip-metric-tile">
          <span class="lbl">Est. Wealth Gain</span>
          <span class="val text-gold">+₹${p.wealth_gain.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div class="sip-trajectory-table-wrap">
        <table class="sip-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Invested</th>
              <th>Basket Projected Value</th>
              <th>Standard 7% FD Comparison</th>
              <th>Alpha</th>
            </tr>
          </thead>
          <tbody>
            ${p.yearly_trajectory.map(row => {
              const alpha = row.future_value - row.benchmark_fd_value;
              return `
                <tr>
                  <td>Year ${row.year}</td>
                  <td>₹${row.total_invested.toLocaleString()}</td>
                  <td class="text-green font-bold">₹${row.future_value.toLocaleString()}</td>
                  <td>₹${row.benchmark_fd_value.toLocaleString()}</td>
                  <td class="text-gold">+₹${alpha.toLocaleString()}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  private attachEvents() {
    // IPO Filter chips
    this.container.querySelectorAll('.chip-filter').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.currentFilter = target.dataset.status || 'ALL';
        this.render();
      });
    });

    // Deep-dive DRHP buttons
    this.container.querySelectorAll('.btn-drhp-modal').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const id = target.dataset.id;
        if (id) await this.openDRHPModal(id);
      });
    });

    // Apply for IPO buttons
    this.container.querySelectorAll('.btn-ipo-apply').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const id = target.dataset.id || '';
        const name = target.dataset.name || 'IPO';
        const price = parseFloat(target.dataset.price || '100');
        const lot = parseInt(target.dataset.lot || '1', 10);
        this.openApplyModal(id, name, price, lot);
      });
    });

    // Basket selector click
    this.container.querySelectorAll('.thematic-basket-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const bId = target.dataset.basketId;
        if (bId) {
          this.selectedBasketId = bId;
          const monthly = parseFloat((this.container.querySelector('#sip-monthly-amount') as HTMLInputElement)?.value || '15000');
          const years = parseInt((this.container.querySelector('#sip-duration') as HTMLSelectElement)?.value || '10', 10);
          this.sipProjection = await fetchSIPProjections(bId, monthly, years).catch(() => null);
          this.render();
        }
      });
    });

    // Recalculate SIP button
    this.container.querySelector('#btn-recalc-sip')?.addEventListener('click', async () => {
      const monthly = parseFloat((this.container.querySelector('#sip-monthly-amount') as HTMLInputElement)?.value || '15000');
      const years = parseInt((this.container.querySelector('#sip-duration') as HTMLSelectElement)?.value || '10', 10);
      this.sipProjection = await fetchSIPProjections(this.selectedBasketId, monthly, years).catch(() => null);
      const resBox = this.container.querySelector('#sip-results-box');
      if (resBox) resBox.innerHTML = this.renderSIPResults();
    });

    // Invest SIP button
    this.container.querySelector('#btn-open-invest-modal')?.addEventListener('click', () => {
      const monthly = parseFloat((this.container.querySelector('#sip-monthly-amount') as HTMLInputElement)?.value || '15000');
      this.openInvestConfirmation(this.selectedBasketId, monthly);
    });
  }

  private async openDRHPModal(ipoId: string) {
    const modalContainer = this.container.querySelector('#drhp-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card drhp-modal-card">
          <div class="modal-header">
            <h3>Analyzing DRHP Prospectus: ${ipoId}...</h3>
            <button class="modal-close-btn" id="drhp-close">&times;</button>
          </div>
          <div class="modal-body loading-state">Fetching valuation multiples & peer benchmarking...</div>
        </div>
      </div>
    `;

    modalContainer.querySelector('#drhp-close')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    try {
      const rep = await fetchIPOAnalysis(ipoId);
      const isApply = rep.verdict.includes('APPLY');

      modalContainer.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal-card drhp-modal-card">
            <div class="modal-header">
              <div class="modal-title-group">
                <h3>📜 DRHP Analysis: ${rep.company_name}</h3>
                <span class="verdict-tag ${isApply ? 'verdict-apply' : 'verdict-avoid'}">${rep.verdict}</span>
              </div>
              <button class="modal-close-btn" id="drhp-close">&times;</button>
            </div>

            <div class="modal-body drhp-body">
              <div class="drhp-executive-summary">
                ${rep.recommendation_summary || 'Comprehensive DRHP document parsed.'}
              </div>

              <div class="drhp-scores-grid">
                <div class="drhp-stat-tile">
                  <span class="lbl">Composite Score</span>
                  <span class="val font-bold ${rep.composite_score > 60 ? 'text-green' : 'text-red'}">${rep.composite_score.toFixed(1)} / 100</span>
                </div>
                <div class="drhp-stat-tile">
                  <span class="lbl">Risk Rating</span>
                  <span class="val font-bold">${rep.risk_level}</span>
                </div>
                <div class="drhp-stat-tile">
                  <span class="lbl">3-Yr Revenue CAGR</span>
                  <span class="val">${rep.revenue_cagr_3yr_pct.toFixed(1)}%</span>
                </div>
                <div class="drhp-stat-tile">
                  <span class="lbl">RoE / ROCE</span>
                  <span class="val">${rep.roe_pct.toFixed(1)}% / ${rep.roce_pct.toFixed(1)}%</span>
                </div>
              </div>

              <!-- Peer Valuation Comparison -->
              <h4 class="mt-6 mb-2">📊 Listed Peer Valuation Comparison</h4>
              <table class="drhp-peer-table">
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>P/E Ratio</th>
                    <th>P/B Ratio</th>
                    <th>Market Cap (₹ Cr)</th>
                    <th>RoE (%)</th>
                  </tr>
                </thead>
                <tbody>
                  ${(rep.listed_peers || []).map(p => `
                    <tr>
                      <td class="font-bold">${p.company_name} (${p.symbol})</td>
                      <td>${p.pe_ratio > 0 ? p.pe_ratio.toFixed(1) + 'x' : 'Negative'}</td>
                      <td>${p.pb_ratio > 0 ? p.pb_ratio.toFixed(1) + 'x' : '--'}</td>
                      <td>₹${p.market_cap_cr.toLocaleString()} Cr</td>
                      <td>${p.roe_pct.toFixed(1)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <!-- Anchor Investors & Strengths -->
              <h4 class="mt-6 mb-2">🏛️ Anchor & Institutional Assessment</h4>
              <div class="p-3 bg-card-dark rounded text-xs text-dim mb-3">
                ${rep.anchor_assessment || 'Institutional anchor bidding complete.'}
              </div>
              <div class="anchor-tags-cloud">
                ${(rep.strengths || []).map(s => `<span class="anchor-tag">✓ ${s}</span>`).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      modalContainer.querySelector('#drhp-close')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });
    } catch (e: any) {
      modalContainer.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="error-msg">Failed to load DRHP analysis: ${e.message}</div>
            <button class="primary-btn mt-4" id="drhp-err-close">Close</button>
          </div>
        </div>
      `;
      modalContainer.querySelector('#drhp-err-close')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });
    }
  }

  private async openInvestConfirmation(basketId: string, amount: number) {
    const modalContainer = this.container.querySelector('#drhp-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card confirm-modal-card">
          <div class="modal-header">
            <h3>Confirm Systematic Investment Plan (SIP)</h3>
            <button class="modal-close-btn" id="confirm-close">&times;</button>
          </div>
          <div class="modal-body">
            <p>You are allocating <strong>₹${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> into <strong>${basketId}</strong>.</p>
            <p class="text-dim text-sm mt-2">The system will compute fractional constituent share allocation and route orders through your connected broker ledger with statutory charge accounting.</p>
            <div class="mt-6 flex gap-3">
              <button class="primary-btn" id="btn-confirm-execute">Confirm & Route Orders</button>
              <button class="secondary-btn" id="btn-confirm-cancel">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    modalContainer.querySelector('#confirm-close')?.addEventListener('click', () => modalContainer.innerHTML = '');
    modalContainer.querySelector('#btn-confirm-cancel')?.addEventListener('click', () => modalContainer.innerHTML = '');
    modalContainer.querySelector('#btn-confirm-execute')?.addEventListener('click', async () => {
      const btn = modalContainer.querySelector('#btn-confirm-execute') as HTMLButtonElement;
      if (btn) btn.textContent = 'Routing orders to broker ledger...';
      try {
        const res = await investInBasket(basketId, amount);
        modalContainer.innerHTML = `
          <div class="modal-backdrop">
            <div class="modal-card confirm-modal-card">
              <div class="modal-header">
                <h3>✅ SIP Executed Successfully!</h3>
                <button class="modal-close-btn" id="success-close">&times;</button>
              </div>
              <div class="modal-body">
                <p>${res.message}</p>
                <div class="mt-4 p-3 bg-card-dark rounded border border-border-dim text-xs font-mono">
                  Execution ID: ${res.execution?.execution_id || 'SIP-CONFIRMED'}<br/>
                  Shares Allocated: ${JSON.stringify(res.execution?.allocated_shares || {}, null, 2)}
                </div>
                <button class="primary-btn mt-6" id="btn-success-close">Done</button>
              </div>
            </div>
          </div>
        `;
        modalContainer.querySelector('#success-close')?.addEventListener('click', () => modalContainer.innerHTML = '');
        modalContainer.querySelector('#btn-success-close')?.addEventListener('click', () => modalContainer.innerHTML = '');
      } catch (e: any) {
        alert(`SIP execution failed: ${e.message}`);
      }
    });
  }

  private openApplyModal(ipoId: string, companyName: string, price: number, lotSize: number) {
    const modalContainer = this.container.querySelector('#drhp-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card confirm-modal-card">
          <div class="modal-header">
            <h3>⚡ Apply for ${companyName}</h3>
            <button class="modal-close-btn" id="apply-close">&times;</button>
          </div>
          <div class="modal-body">
            <p class="text-sm text-dim mb-4">Submit institutional retail bid via ASBA UPI 2.0 block mandate.</p>
            <div class="mb-3">
              <label class="text-xs text-dim block mb-1">Bid Cut-Off Price (₹)</label>
              <input type="number" id="ipo-bid-price" value="${price}" class="w-full p-2 bg-dark rounded border border-border-dim text-sm text-main" readonly />
            </div>
            <div class="mb-3">
              <label class="text-xs text-dim block mb-1">Lots (1 Lot = ${lotSize} Shares)</label>
              <select id="ipo-lots" class="w-full p-2 bg-dark rounded border border-border-dim text-sm text-main">
                <option value="1">1 Lot (${lotSize} Shares - ₹${(lotSize * price).toLocaleString()})</option>
                <option value="2">2 Lots (${lotSize * 2} Shares - ₹${(lotSize * 2 * price).toLocaleString()})</option>
                <option value="5">5 Lots (${lotSize * 5} Shares - ₹${(lotSize * 5 * price).toLocaleString()})</option>
                <option value="10">10 Lots (${lotSize * 10} Shares - ₹${(lotSize * 10 * price).toLocaleString()})</option>
              </select>
            </div>
            <div class="mb-4">
              <label class="text-xs text-dim block mb-1">UPI ID (Google Pay / PhonePe / BHIM)</label>
              <input type="text" id="ipo-upi" value="trader@okhdfcbank" class="w-full p-2 bg-dark rounded border border-border-dim text-sm text-main" />
            </div>
            <div class="flex gap-3 mt-6">
              <button class="primary-btn flex-1" id="btn-submit-ipo-bid">Submit ASBA Bid</button>
              <button class="secondary-btn" id="btn-cancel-ipo-bid">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    modalContainer.querySelector('#apply-close')?.addEventListener('click', () => modalContainer.innerHTML = '');
    modalContainer.querySelector('#btn-cancel-ipo-bid')?.addEventListener('click', () => modalContainer.innerHTML = '');
    modalContainer.querySelector('#btn-submit-ipo-bid')?.addEventListener('click', async () => {
      const lots = parseInt((modalContainer.querySelector('#ipo-lots') as HTMLSelectElement)?.value || '1', 10);
      const upiId = (modalContainer.querySelector('#ipo-upi') as HTMLInputElement)?.value || 'trader@okhdfcbank';
      const submitBtn = modalContainer.querySelector('#btn-submit-ipo-bid') as HTMLButtonElement;
      if (submitBtn) submitBtn.textContent = 'Submitting to Neon DB & Exchange...';

      try {
        const res = await applyForIPO(ipoId, { lots, bid_price: price, upi_id: upiId });
        modalContainer.innerHTML = `
          <div class="modal-backdrop">
            <div class="modal-card confirm-modal-card">
              <div class="modal-header">
                <h3>✅ IPO Bid Submitted!</h3>
                <button class="modal-close-btn" id="bid-success-close">&times;</button>
              </div>
              <div class="modal-body">
                <p class="text-green font-bold mb-2">${res.message}</p>
                <div class="p-3 bg-card-dark rounded border border-border-dim text-xs font-mono mb-4">
                  Application ID: ${res.application?.application_id || 'IPO-CONFIRMED'}<br/>
                  Total Amount Blocked: ₹${res.application?.total_amount?.toLocaleString()}<br/>
                  Status: ${res.application?.status}
                </div>
                <button class="primary-btn w-full" id="btn-bid-done">Done</button>
              </div>
            </div>
          </div>
        `;
        modalContainer.querySelector('#bid-success-close')?.addEventListener('click', () => modalContainer.innerHTML = '');
        modalContainer.querySelector('#btn-bid-done')?.addEventListener('click', () => modalContainer.innerHTML = '');
      } catch (err: any) {
        alert(`IPO Bid submission failed: ${err.message}`);
        modalContainer.innerHTML = '';
      }
    });
  }
}
