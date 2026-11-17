/**
 * Long-Term Wealth Architecture & Thematic Smallcase-style Baskets UI Panel
 */

import { store } from '../state';
import { ThematicBasket, investInBasket, fetchBaskets, fetchSIPHistory } from '../api';

export function renderBasketPanel(): string {
  const baskets = store.thematicBaskets;

  return `
    <div class="enterprise-view-container">
      <div class="view-header">
        <div>
          <h2 class="view-title">💼 LONG-TERM WEALTH ARCHITECTURE & THEMATIC BASKETS</h2>
          <p class="view-subtitle">Systematic Investment Plans (SIP), High-RoCE Quality Compounders & Multi-Asset Thematic Model Portfolios</p>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button id="btn-refresh-baskets" class="btn-toggle">
            <span>🔄 REFRESH BASKETS</span>
          </button>
        </div>
      </div>

      <!-- Baskets Grid -->
      <div class="baskets-grid" id="baskets-grid-container">
        ${baskets.map((b) => renderBasketCard(b)).join('')}
      </div>

      <!-- One-Click Investment / SIP Execution Modal -->
      <div id="basket-invest-modal" class="modal-overlay hidden">
        <div class="modal-content" style="max-width:550px;">
          <div class="modal-header">
            <div>
              <h3 id="modal-basket-title" style="font-size:16px;">Invest in Thematic Basket</h3>
              <span id="modal-basket-min" style="font-size:10px; color:var(--text-dim)">Min Investment: ₹25,000</span>
            </div>
            <button class="modal-close-btn" id="btn-close-invest-modal">✕</button>
          </div>

          <div style="padding:16px;">
            <div style="margin-bottom:12px;">
              <label style="font-size:11px; color:var(--text-dim); display:block; margin-bottom:4px;">Investment Capital (${store.activeTab === 'FOREX' ? '$' : '₹'})</label>
              <input type="number" id="input-sip-amount" class="ticket-input" style="width:100%; font-size:14px; padding:8px;" value="25000" min="5000" step="5000" />
            </div>

            <div style="background:var(--bg-card); padding:10px; border-radius:4px; border:1px solid var(--border-color); margin-bottom:14px;">
              <span style="font-size:10px; text-transform:uppercase; color:var(--text-dim); font-weight:600;">Constituent Allocation Simulation</span>
              <div id="modal-allocation-preview" style="font-family:var(--font-mono); font-size:11px; margin-top:6px;">
                <!-- Filled dynamically -->
              </div>
            </div>

            <button id="btn-confirm-basket-invest" class="btn-primary" style="width:100%; padding:10px; font-size:12px; font-weight:700;">
              🚀 CONFIRM & ALLOCATE TO BROKER
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderBasketCard(b: ThematicBasket): string {
  const riskClass = b.risk_profile === 'CONSERVATIVE' ? 'val-green' : (b.risk_profile === 'MODERATE' ? 'val-cyan' : 'val-amber');

  return `
    <div class="basket-card" data-id="${b.basket_id}">
      <div class="basket-card-header">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h3 style="font-size:16px; font-weight:700;">${b.title}</h3>
            <span class="brand-badge" style="color:${riskClass}; border-color:${riskClass}">${b.risk_profile}</span>
          </div>
          <span style="font-size:11px; color:var(--text-dim)">${b.tagline}</span>
        </div>
        <div class="nav-metric" style="text-align:right;">
          <span class="nav-label">3-Yr CAGR</span>
          <span class="val-green" style="font-family:var(--font-mono); font-weight:800; font-size:16px;">+${b.cagr_3yr_pct.toFixed(1)}%</span>
        </div>
      </div>

      <!-- Performance Metric Strip -->
      <div class="ipo-specs-grid" style="margin-bottom:12px;">
        <div class="spec-cell">
          <span class="spec-label">Annualized Sharpe</span>
          <span class="spec-val val-cyan">${b.annualized_sharpe.toFixed(2)}</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Max Drawdown</span>
          <span class="spec-val val-red">${b.max_drawdown_pct.toFixed(1)}%</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Dividend Yield</span>
          <span class="spec-val val-purple">${b.dividend_yield_pct.toFixed(2)}%</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Min Investment</span>
          <span class="spec-val">${b.currency === 'INR' ? '₹' : '$'}${b.min_investment_amount.toLocaleString()}</span>
        </div>
      </div>

      <p style="font-size:11px; color:var(--text-muted); line-height:1.4; margin-bottom:12px;">${b.description}</p>

      <!-- Constituents List & Weight Chips -->
      <div style="margin-bottom:14px;">
        <span style="font-size:10px; color:var(--text-dim); text-transform:uppercase; font-weight:600; display:block; margin-bottom:6px;">Model Constituents (${b.constituents.length} Assets)</span>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${b.constituents
            .map(
              (c) => `
            <div class="ticker-chip" style="font-size:10px; padding:3px 8px;">
              <strong>${c.symbol}</strong>
              <span class="val-cyan">${c.weight_pct}%</span>
              <span style="color:var(--text-dim)">₹${c.current_price.toFixed(0)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:10px;">
        <span style="font-size:10px; color:var(--text-dim); font-family:var(--font-mono)">Rebalance: ${b.rebalance_frequency}</span>
        <button class="btn-action-buy btn-invest-basket" data-id="${b.basket_id}" data-min="${b.min_investment_amount}" data-title="${b.title}">
          ⚡ ONE-CLICK INVEST / SIP
        </button>
      </div>
    </div>
  `;
}

export function setupBasketEventListeners(): void {
  let activeBasketId: string = 'BSK-NIFTY-COMPOUNDERS';

  document.querySelectorAll('.btn-invest-basket').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bId = btn.getAttribute('data-id') || 'BSK-NIFTY-COMPOUNDERS';
      const bTitle = btn.getAttribute('data-title') || 'Thematic Basket';
      const bMin = parseFloat(btn.getAttribute('data-min') || '25000');
      activeBasketId = bId;

      const modal = document.getElementById('basket-invest-modal');
      const titleEl = document.getElementById('modal-basket-title');
      const minEl = document.getElementById('modal-basket-min');
      const inputEl = document.getElementById('input-sip-amount') as HTMLInputElement;

      if (modal && titleEl && minEl && inputEl) {
        titleEl.innerText = `Invest in ${bTitle}`;
        minEl.innerText = `Minimum Allocation: ₹${bMin.toLocaleString()}`;
        inputEl.value = bMin.toString();
        updateSimulationPreview(bId, bMin);
        modal.classList.remove('hidden');
      }
    });
  });

  const amountInput = document.getElementById('input-sip-amount') as HTMLInputElement;
  amountInput?.addEventListener('input', () => {
    const amt = parseFloat(amountInput.value) || 25000;
    updateSimulationPreview(activeBasketId, amt);
  });

  document.getElementById('btn-close-invest-modal')?.addEventListener('click', () => {
    document.getElementById('basket-invest-modal')?.classList.add('hidden');
  });

  document.getElementById('btn-confirm-basket-invest')?.addEventListener('click', async () => {
    const amt = parseFloat(amountInput.value) || 25000;
    const btn = document.getElementById('btn-confirm-basket-invest');
    if (btn) btn.innerText = 'Routing to Broker...';

    try {
      const res = await investInBasket(activeBasketId, amt);
      alert(`🎉 Basket Investment Executed!\n\n${res.message}\nExecution ID: ${res.execution.execution_id}`);
      document.getElementById('basket-invest-modal')?.classList.add('hidden');
    } catch (err: any) {
      alert(`Investment Failed: ${err.message}`);
    } finally {
      if (btn) btn.innerText = '🚀 CONFIRM & ALLOCATE TO BROKER';
    }
  });
}

function updateSimulationPreview(basketId: string, amount: number): void {
  const basket = store.thematicBaskets.find((b) => b.basket_id === basketId);
  const container = document.getElementById('modal-allocation-preview');
  if (!basket || !container) return;

  container.innerHTML = basket.constituents
    .map((c) => {
      const capital = amount * (c.weight_pct / 100);
      const shares = Math.max(1, Math.floor(capital / c.current_price));
      return `
        <div style="display:flex; justify-content:space-between; padding:2px 0;">
          <span>${c.symbol} (${c.weight_pct}%)</span>
          <strong>${shares} Shares (~₹${(shares * c.current_price).toLocaleString(undefined, { maximumFractionDigits: 0 })})</strong>
        </div>
      `;
    })
    .join('');
}
