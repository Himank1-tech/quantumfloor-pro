/**
 * Grounded AI Advisory Panel with Verifiable Proof & Citations Drawer.
 */

import { store } from '../state';
import { GroundedAdviceSignal, fetchAdvisorySignals } from '../api';

export function renderAdvisoryPanel(): string {
  const signals = store.advisorySignals;

  return `
    <div class="enterprise-view-container">
      <div class="view-header">
        <div>
          <h2 class="view-title">🎯 GROUNDED AI ADVISORY & VERIFIABLE EVIDENCE ENGINE</h2>
          <p class="view-subtitle">Deterministic recommendations backed by balance sheet line items, live indicator math, and SEBI filings.</p>
        </div>
        <div class="tab-group" id="advisory-horizon-tabs">
          <button class="tab-btn active" data-horizon="ALL">ALL HORIZONS</button>
          <button class="tab-btn" data-horizon="LONG_TERM_WEALTH">LONG-TERM WEALTH</button>
          <button class="tab-btn" data-horizon="SWING_TRADE">SWING TRADE</button>
          <button class="tab-btn" data-horizon="INTRADAY">INTRADAY SCALP</button>
        </div>
      </div>

      <!-- Signals Feed -->
      <div class="advisory-feed" id="advisory-feed-container">
        ${signals.map((sig) => renderSignalCard(sig)).join('')}
      </div>
    </div>
  `;
}

function renderSignalCard(sig: GroundedAdviceSignal): string {
  const isBuy = sig.action.includes('BUY') || sig.action === 'ACCUMULATE';
  const actionClass = isBuy ? 'badge-BUY' : 'badge-SELL';

  return `
    <div class="advisory-card" data-id="${sig.signal_id}">
      <div class="advisory-card-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="consensus-badge ${actionClass}">${sig.action}</span>
          <div>
            <h3 style="font-size:16px; font-weight:700; font-family:var(--font-mono)">${sig.symbol}</h3>
            <span style="font-size:10px; color:var(--text-dim)">${sig.asset_class} • Horizon: <strong>${sig.horizon}</strong></span>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:14px;">
          <div class="nav-metric" style="text-align:right;">
            <span class="nav-label">Risk/Reward</span>
            <span class="val-cyan" style="font-family:var(--font-mono); font-weight:700; font-size:14px;">1:${sig.risk_reward_ratio.toFixed(2)}</span>
          </div>
          <div class="nav-metric" style="text-align:right;">
            <span class="nav-label">Conviction</span>
            <span class="val-green" style="font-family:var(--font-mono); font-weight:700; font-size:14px;">${sig.conviction_pct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div class="advisory-thesis-title">${sig.thesis_title}</div>
      <p class="advisory-summary">${sig.executive_summary}</p>

      <!-- Key Execution Range Grid -->
      <div class="ipo-specs-grid" style="margin-bottom:12px;">
        <div class="spec-cell">
          <span class="spec-label">Entry Range</span>
          <span class="spec-val">₹${sig.entry_range[0]} - ₹${sig.entry_range[1]}</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Target Price</span>
          <span class="spec-val val-green">₹${sig.target_price.toFixed(2)}</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Invalidation Stop</span>
          <span class="spec-val val-red">₹${sig.invalidation_stop.toFixed(2)}</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Portfolio Allocation</span>
          <span class="spec-val val-purple">${sig.suggested_portfolio_allocation_pct}% Max</span>
        </div>
      </div>

      <!-- Invalidation Criteria Alert -->
      <div class="invalidation-alert">
        <span style="font-weight:700; color:var(--color-amber);">⚠️ INVALIDATION CRITERIA:</span>
        <span>${sig.invalidation_criteria}</span>
      </div>

      <!-- Expandable Verifiable Proof Drawer Toggle -->
      <div class="proof-drawer-container">
        <button class="btn-toggle btn-proof-toggle" data-id="${sig.signal_id}" style="width:100%; justify-content:space-between; margin-top:8px;">
          <span>🔍 VERIFIABLE EVIDENCE & CITATIONS (${sig.verifiable_proof.length} PROOFS)</span>
          <span class="drawer-arrow">▼</span>
        </button>

        <div class="proof-drawer-content hidden" id="proof-drawer-${sig.signal_id}">
          <div style="font-size:10px; color:var(--text-dim); text-transform:uppercase; margin-bottom:8px; font-weight:600;">
            Institutional Source Chain & Evidence Log
          </div>
          ${sig.verifiable_proof.map((p) => renderProofItem(p)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderProofItem(p: any): string {
  const catColor =
    p.category === 'BALANCE_SHEET'
      ? 'var(--color-purple)'
      : p.category === 'TECHNICAL_LEVEL'
      ? 'var(--color-cyan)'
      : p.category === 'SEBI_FILING'
      ? 'var(--color-green)'
      : 'var(--color-amber)';

  return `
    <div class="proof-item-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span class="brand-badge" style="color:${catColor}; border-color:${catColor}">${p.category}</span>
        <span style="font-size:9px; color:var(--text-dim); font-family:var(--font-mono)">Verified Timestamp: ${p.timestamp.substring(0, 19).replace('T', ' ')} UTC</span>
      </div>
      <div style="font-weight:600; font-size:11px; color:#fff; margin-bottom:2px;">Claim: ${p.claim}</div>
      <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono); margin-bottom:4px; background:var(--bg-dark); padding:4px 6px; border-radius:3px;">
        📊 Data Point: ${p.verified_data_point}
      </div>
      <div style="font-size:10px; color:var(--text-dim)">
        🔗 Source Citation: <strong style="color:var(--text-muted)">${p.source_citation}</strong>
      </div>
    </div>
  `;
}

export function setupAdvisoryEventListeners(): void {
  // Horizon filter tabs
  const tabs = document.querySelectorAll('#advisory-horizon-tabs .tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const horizon = tab.getAttribute('data-horizon');
      const signals = await fetchAdvisorySignals(undefined, horizon === 'ALL' ? undefined : horizon || undefined);
      store.advisorySignals = signals;
      const container = document.getElementById('advisory-feed-container');
      if (container) {
        container.innerHTML = signals.map((s) => renderSignalCard(s)).join('');
        setupDrawerToggles();
      }
    });
  });

  setupDrawerToggles();
}

function setupDrawerToggles(): void {
  document.querySelectorAll('.btn-proof-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sigId = btn.getAttribute('data-id');
      const drawer = document.getElementById(`proof-drawer-${sigId}`);
      const arrow = btn.querySelector('.drawer-arrow');
      if (drawer) {
        drawer.classList.toggle('hidden');
        if (arrow) {
          arrow.textContent = drawer.classList.contains('hidden') ? '▼' : '▲';
        }
      }
    });
  });
}
