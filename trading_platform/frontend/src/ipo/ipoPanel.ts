/**
 * IPO Intelligence Engine UI Panel
 * Real-time GMP Tracking, Subscription Meters, DRHP Financial Ratios & Peer Multiples.
 */

import { store } from '../state';
import { IPOSummary, IPOIntelligenceReport, fetchIPOs, fetchIPOAnalysis } from '../api';

export function renderIPOPanel(): string {
  const ipos = store.ipos;

  return `
    <div class="enterprise-view-container">
      <div class="view-header">
        <div>
          <h2 class="view-title">📰 AUTONOMOUS IPO INTELLIGENCE ENGINE</h2>
          <p class="view-subtitle">NSE & BSE Mainboard Prospectus Analysis, Grey Market Premium (GMP) Tracking & DRHP Multiples</p>
        </div>
        <div class="tab-group" id="ipo-status-tabs">
          <button class="tab-btn active" data-filter="ALL">ALL IPOs</button>
          <button class="tab-btn" data-filter="ACTIVE">OPEN FOR BIDDING</button>
          <button class="tab-btn" data-filter="UPCOMING">UPCOMING</button>
          <button class="tab-btn" data-filter="LISTED">RECENTLY LISTED</button>
        </div>
      </div>

      <!-- IPO Grid -->
      <div class="ipo-grid" id="ipo-cards-container">
        ${ipos.map((ipo) => renderIPOCard(ipo)).join('')}
      </div>

      <!-- Analysis Modal Drawer -->
      <div id="ipo-modal-overlay" class="modal-overlay hidden">
        <div class="modal-content" id="ipo-modal-content">
          <div style="text-align:center; padding:30px;">Loading DRHP Prospectus & Valuation Analysis...</div>
        </div>
      </div>
    </div>
  `;
}

function renderIPOCard(ipo: IPOSummary): string {
  const gmpPositive = ipo.gmp.current_gmp >= 0;
  const statusColor = ipo.status === 'ACTIVE' ? 'var(--color-green)' : (ipo.status === 'UPCOMING' ? 'var(--color-cyan)' : 'var(--text-dim)');

  return `
    <div class="ipo-card" data-id="${ipo.ipo_id}">
      <div class="ipo-card-header">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h3 class="ipo-company-name">${ipo.company_name}</h3>
            <span class="brand-badge" style="color:${statusColor}; border-color:${statusColor}">${ipo.status}</span>
          </div>
          <span class="ipo-sector">${ipo.sector} • ${ipo.exchange}</span>
        </div>
        <div class="gmp-badge-box ${gmpPositive ? 'gmp-positive' : 'gmp-negative'}">
          <span style="font-size:10px; text-transform:uppercase; font-weight:600">Grey Market (GMP)</span>
          <span class="gmp-value">${gmpPositive ? '+' : ''}₹${ipo.gmp.current_gmp} (${ipo.gmp.gmp_pct >= 0 ? '+' : ''}${ipo.gmp.gmp_pct.toFixed(1)}%)</span>
          <span style="font-size:9px; color:var(--text-dim)">Exp. Listing: ₹${ipo.gmp.expected_listing_price.toFixed(0)}</span>
        </div>
      </div>

      <div class="ipo-specs-grid">
        <div class="spec-cell">
          <span class="spec-label">Price Band</span>
          <span class="spec-val">₹${ipo.price_band_low} - ₹${ipo.price_band_high}</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Issue Size</span>
          <span class="spec-val">₹${ipo.issue_size_cr.toLocaleString()} Cr</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Fresh vs OFS</span>
          <span class="spec-val">${((ipo.fresh_issue_cr / ipo.issue_size_cr) * 100).toFixed(0)}% Fresh / ${((ipo.ofs_cr / ipo.issue_size_cr) * 100).toFixed(0)}% OFS</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Lot Size / Min Inv</span>
          <span class="spec-val">${ipo.lot_size} Shares (₹${(ipo.lot_size * ipo.price_band_high).toLocaleString()})</span>
        </div>
      </div>

      <!-- Subscription Progress Bars -->
      <div class="subscription-section">
        <div class="sub-header">
          <span style="font-size:11px; font-weight:600">Total Bidding Demand:</span>
          <strong class="val-cyan">${ipo.subscription.total_times.toFixed(2)}x Subscribed</strong>
        </div>
        <div class="sub-meters-grid">
          <div>
            <div class="sub-label-row">
              <span>QIB (Institutions)</span>
              <strong>${ipo.subscription.qib_times.toFixed(2)}x</strong>
            </div>
            <div class="meter-bar-bg"><div class="meter-bar-fill" style="width:${Math.min(100, ipo.subscription.qib_times * 10)}%; background:var(--color-cyan)"></div></div>
          </div>
          <div>
            <div class="sub-label-row">
              <span>NII (HNIs)</span>
              <strong>${ipo.subscription.nii_times.toFixed(2)}x</strong>
            </div>
            <div class="meter-bar-bg"><div class="meter-bar-fill" style="width:${Math.min(100, ipo.subscription.nii_times * 10)}%; background:var(--color-amber)"></div></div>
          </div>
          <div>
            <div class="sub-label-row">
              <span>Retail</span>
              <strong>${ipo.subscription.retail_times.toFixed(2)}x</strong>
            </div>
            <div class="meter-bar-bg"><div class="meter-bar-fill" style="width:${Math.min(100, ipo.subscription.retail_times * 10)}%; background:var(--color-green)"></div></div>
          </div>
        </div>
      </div>

      <div class="ipo-card-footer">
        <span style="font-size:10px; color:var(--text-dim); font-family:var(--font-mono)">Dates: ${ipo.open_date} to ${ipo.close_date}</span>
        <button class="btn-primary btn-analyze-ipo" data-id="${ipo.ipo_id}">
          🔍 AI DRHP ANALYSIS & VERDICT
        </button>
      </div>
    </div>
  `;
}

export function setupIPOEventListeners(): void {
  // Filter tabs
  const tabs = document.querySelectorAll('#ipo-status-tabs .tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.getAttribute('data-filter');
      const filtered = await fetchIPOs(filter === 'ALL' ? undefined : filter || undefined);
      store.ipos = filtered;
      const container = document.getElementById('ipo-cards-container');
      if (container) {
        container.innerHTML = filtered.map((ipo) => renderIPOCard(ipo)).join('');
        setupAnalyzeButtons();
      }
    });
  });

  setupAnalyzeButtons();
}

function setupAnalyzeButtons(): void {
  document.querySelectorAll('.btn-analyze-ipo').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ipoId = btn.getAttribute('data-id');
      if (!ipoId) return;

      const overlay = document.getElementById('ipo-modal-overlay');
      const modal = document.getElementById('ipo-modal-content');
      if (overlay && modal) {
        overlay.classList.remove('hidden');
        modal.innerHTML = '<div style="text-align:center; padding:40px;">Evaluating Balance Sheet & Prospectus...</div>';

        try {
          const report = await fetchIPOAnalysis(ipoId);
          store.selectedIpoAnalysis = report;
          renderAnalysisModal(modal, report);
        } catch (err: any) {
          modal.innerHTML = `<div style="color:var(--color-red); padding:20px;">Failed to load analysis: ${err.message}</div>`;
        }
      }
    });
  });

  // Modal close when clicking overlay
  const overlay = document.getElementById('ipo-modal-overlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
    }
  });
}

function renderAnalysisModal(modal: HTMLElement, rep: IPOIntelligenceReport): void {
  const verdictBadge =
    rep.verdict === 'APPLY_LONG_TERM'
      ? 'badge-BUY'
      : rep.verdict === 'APPLY_LISTING_GAINS'
      ? 'badge-BUY'
      : rep.verdict === 'AVOID'
      ? 'badge-SELL'
      : 'badge-HOLD';

  modal.innerHTML = `
    <div class="modal-header">
      <div>
        <div style="display:flex; align-items:center; gap:10px;">
          <h2 style="font-size:18px;">${rep.company_name} (${rep.symbol})</h2>
          <span class="consensus-badge ${verdictBadge}">${rep.verdict}</span>
        </div>
        <span style="font-size:11px; color:var(--text-muted)">Automated Prospectus Rating & Peer Benchmarking</span>
      </div>
      <button class="modal-close-btn" id="btn-close-modal">✕</button>
    </div>

    <div class="modal-body-scroll">
      <!-- AI Verdict Banner -->
      <div class="consensus-banner" style="margin-bottom:14px;">
        <div>
          <span style="font-size:10px; color:var(--text-dim); text-transform:uppercase;">Composite AI Score</span>
          <div style="font-size:24px; font-weight:800; font-family:var(--font-mono); color:var(--color-cyan)">${rep.composite_score} / 100</div>
          <span style="font-size:11px; color:var(--text-muted)">Risk Rating: <strong>${rep.risk_level}</strong></span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:10px; color:var(--text-dim); text-transform:uppercase;">Expected Listing Gain</span>
          <div style="font-size:22px; font-weight:800; font-family:var(--font-mono); color:${rep.expected_listing_gain_pct >= 0 ? 'var(--color-green)' : 'var(--color-red)'}">
            ${rep.expected_listing_gain_pct >= 0 ? '+' : ''}${rep.expected_listing_gain_pct}%
          </div>
          <span style="font-size:10px; color:var(--text-dim)">Fair Value: ₹${rep.fair_value_estimate}</span>
        </div>
      </div>

      <!-- Financial Health Scorecards -->
      <h4 style="margin-bottom:8px; font-size:12px; text-transform:uppercase; color:var(--text-dim)">DRHP Audited Financials</h4>
      <div class="quant-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:14px;">
        <div class="quant-badge">
          <span class="quant-label">3-Yr Revenue CAGR</span>
          <span class="quant-val val-green">${rep.revenue_cagr_3yr_pct}%</span>
          <span class="quant-sub">Top-Line Expansion</span>
        </div>
        <div class="quant-badge">
          <span class="quant-label">EBITDA Margin</span>
          <span class="quant-val">${rep.ebitda_margin_pct}%</span>
          <span class="quant-sub">Operating Efficiency</span>
        </div>
        <div class="quant-badge">
          <span class="quant-label">Return on Equity (RoE)</span>
          <span class="quant-val val-purple">${rep.roe_pct}%</span>
          <span class="quant-sub">Capital Efficiency</span>
        </div>
        <div class="quant-badge">
          <span class="quant-label">Debt-to-Equity</span>
          <span class="quant-val">${rep.debt_to_equity}x</span>
          <span class="quant-sub">${rep.debt_to_equity < 0.5 ? 'Clean Balance Sheet' : 'Leveraged'}</span>
        </div>
      </div>

      <!-- Listed Peers Valuation Comparison -->
      <h4 style="margin-bottom:8px; font-size:12px; text-transform:uppercase; color:var(--text-dim)">Valuation Multiples vs Listed Peers</h4>
      <div class="table-responsive" style="margin-bottom:14px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Ticker</th>
              <th>P/E Ratio</th>
              <th>P/B Ratio</th>
              <th>RoE %</th>
              <th>Market Cap</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:var(--bg-card-hover)">
              <td><strong>${rep.company_name} (IPO)</strong></td>
              <td><strong>${rep.symbol}</strong></td>
              <td class="val-cyan">${rep.post_issue_pe > 0 ? rep.post_issue_pe.toFixed(1) + 'x' : 'Negative'}</td>
              <td>--</td>
              <td>${rep.roe_pct}%</td>
              <td>Issue</td>
            </tr>
            ${rep.listed_peers
              .map(
                (p) => `
              <tr>
                <td>${p.company_name}</td>
                <td>${p.symbol}</td>
                <td>${p.pe_ratio.toFixed(1)}x</td>
                <td>${p.pb_ratio.toFixed(1)}x</td>
                <td>${p.roe_pct}%</td>
                <td>₹${(p.market_cap_cr / 1000).toFixed(1)}k Cr</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <!-- Strengths and Risks -->
      <div class="debate-columns" style="margin-bottom:14px;">
        <div class="thesis-card bull-card">
          <h4 style="color:var(--color-green); margin-bottom:6px; font-size:11px;">PROSPECTUS STRENGTHS</h4>
          <ul class="thesis-args">
            ${rep.strengths.map((s) => `<li>${s}</li>`).join('')}
          </ul>
        </div>
        <div class="thesis-card bear-card">
          <h4 style="color:var(--color-red); margin-bottom:6px; font-size:11px;">PROSPECTUS RISKS & OFS DILUTION</h4>
          <ul class="thesis-args">
            ${rep.risks.map((r) => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Executive Recommendation -->
      <div style="background:var(--bg-dark); padding:10px; border-radius:4px; border:1px solid var(--border-color);">
        <span style="font-size:10px; text-transform:uppercase; color:var(--text-dim)">Institutional Recommendation</span>
        <p style="font-size:11px; color:var(--text-main); margin-top:4px;">${rep.recommendation_summary}</p>
      </div>
    </div>
  `;

  document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    document.getElementById('ipo-modal-overlay')?.classList.add('hidden');
  });
}
