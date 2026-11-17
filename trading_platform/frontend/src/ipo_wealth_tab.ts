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

              return `
                <div class="ipo-card" data-ipo-id="${ipo.ipo_id}">
                  <div class="ipo-card-header">
                    <div>
                      <div class="ipo-company">${ipo.company_name}</div>
                      <div class="ipo-symbol">${ipo.symbol} • ${ipo.sector}</div>
                    </div>
                    <span class="ipo-status-badge status-${ipo.status.toLowerCase()}">${ipo.status}</span>
                  </div>

                  <div class="ipo-gmp-box ${isPositiveGmp ? 'gmp-green' : 'gmp-red'}">
                    <div class="gmp-main">
                      <span class="gmp-lbl">Grey Market Premium (GMP)</span>
                      <span class="gmp-price">₹${gmpVal.toFixed(1)} (${gmpPct >= 0 ? '+' : ''}${gmpPct.toFixed(1)}%)</span>
                    </div>
                    <div class="gmp-exp-listing">
                      Est. Listing: <strong>₹${ipo.gmp?.expected_listing_price?.toFixed(1) || '--'}</strong>
                    </div>
                  </div>

                  <div class="ipo-meta-grid">
                    <div class="ipo-meta-item">
                      <span class="lbl">Price Band</span>
                      <span class="val">₹${ipo.price_band_low} - ₹${ipo.price_band_high}</span>
                    </div>
                    <div class="ipo-meta-item">
                      <span class="lbl">Lot Size</span>
                      <span class="val">${ipo.lot_size} Shares</span>
                    </div>
                    <div class="ipo-meta-item">
                      <span class="lbl">Total Issue</span>
                      <span class="val">₹${ipo.issue_size_cr.toLocaleString()} Cr</span>
                    </div>
                    <div class="ipo-meta-item">
                      <span class="lbl">Fresh Issue</span>
                      <span class="val">₹${ipo.fresh_issue_cr.toLocaleString()} Cr (${((ipo.fresh_issue_cr / (ipo.issue_size_cr || 1)) * 100).toFixed(0)}%)</span>
                    </div>
                  </div>

                  <!-- Subscription Progress -->
                  <div class="sub-progress-wrap">
                    <div class="sub-labels">
                      <span>Total Subscription</span>
                      <strong>${totalSub.toFixed(2)}x</strong>
                    </div>
                    <div class="sub-progress-bar">
                      <div class="sub-progress-fill" style="width: ${Math.min(100, (totalSub / 20) * 100)}%"></div>
                    </div>
                  </div>

                  <div class="ipo-actions-row">
                    <button class="btn-drhp-modal" data-id="${ipo.ipo_id}">
                      🔍 Deep-Dive DRHP Analysis
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
                      <h4>${b.title}</h4>
                      <span class="basket-cagr-badge">+${b.cagr_3yr_pct.toFixed(1)}% 3Y CAGR</span>
                    </div>
                    <div class="basket-tagline">${b.tagline}</div>
                    
                    <div class="basket-stats-row">
                      <div class="b-stat">
                        <span class="stat-lbl">Sharpe</span>
                        <span class="stat-val">${b.annualized_sharpe.toFixed(2)}</span>
                      </div>
                      <div class="b-stat">
                        <span class="stat-lbl">Max Drawdown</span>
                        <span class="stat-val text-red">-${b.max_drawdown_pct.toFixed(1)}%</span>
                      </div>
                      <div class="b-stat">
                        <span class="stat-lbl">Min. Inv.</span>
                        <span class="stat-val">₹${b.min_investment_amount.toLocaleString()}</span>
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
}
