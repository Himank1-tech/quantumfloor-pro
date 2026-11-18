/**
 * Universal Precision Position, Pip & Lot Sizing Calculator Modal.
 * Live calculation of Forex Standard/Mini/Micro lots, Pip values, Margin,
 * and Indian Equities share quantities, F&O lot multipliers, and statutory taxes.
 */

import { calculatePositionSize, PositionCalculationResult, TradeBlueprint } from './api';

export class TradeCalculatorModal {
  private overlay: HTMLElement;
  private currentResult: PositionCalculationResult | null = null;
  private activeBlueprint: TradeBlueprint | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-backdrop calc-modal-backdrop hidden';
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
  }

  public open(blueprint?: TradeBlueprint, currentSymbol: string = 'RELIANCE', currentPrice: number = 1363.0) {
    this.activeBlueprint = blueprint || null;
    this.overlay.classList.remove('hidden');
    this.renderForm(currentSymbol, currentPrice);
  }

  public close() {
    this.overlay.classList.add('hidden');
  }

  private renderForm(defaultSymbol: string, defaultPrice: number) {
    const isFx = defaultSymbol.includes('/') || defaultSymbol.includes('=X') || defaultSymbol.includes('XAU');
    const assetClass = isFx ? 'FOREX' : 'INDIAN_EQUITY';
    const defaultBal = isFx ? 10000.0 : 500000.0;

    let entry = defaultPrice;
    let sl = isFx ? defaultPrice - 0.0025 : defaultPrice - 25.0;
    let tp = isFx ? defaultPrice + 0.0055 : defaultPrice + 55.0;

    if (this.activeBlueprint) {
      entry = this.activeBlueprint.entry_price;
      sl = this.activeBlueprint.stop_loss;
      tp = this.activeBlueprint.take_profit_1;
    }

    this.overlay.innerHTML = `
      <div class="modal-card calc-modal-card">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3>🧮 Institutional Position & Pip/Lot Calculator</h3>
            <span class="sub-badge">${isFx ? 'Global Forex & Commodities' : 'NSE / BSE Cash & F&O'}</span>
          </div>
          <button class="modal-close-btn" id="calc-close-btn">&times;</button>
        </div>

        <div class="modal-body calc-modal-body">
          ${this.activeBlueprint ? `
            <div class="blueprint-quick-banner">
              <span>⚡ Active MTF Setup Loaded for <strong>${this.activeBlueprint.symbol}</strong> (${this.activeBlueprint.action})</span>
              <button class="small-btn" id="btn-reload-blueprint">Sync Setup Levels</button>
            </div>
          ` : ''}

          <div class="calc-grid">
            <!-- Left Input Form -->
            <div class="calc-inputs-col">
              <div class="form-group">
                <label>Instrument Symbol</label>
                <input type="text" id="calc-sym" class="form-input" value="${defaultSymbol}" />
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label>Asset Class</label>
                  <select id="calc-asset-class" class="form-input">
                    <option value="INDIAN_EQUITY" ${assetClass === 'INDIAN_EQUITY' ? 'selected' : ''}>NSE / BSE Indian Equities</option>
                    <option value="FOREX" ${assetClass === 'FOREX' ? 'selected' : ''}>Global Forex & Commodities</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Account Balance</label>
                  <input type="number" id="calc-balance" class="form-input" value="${defaultBal}" />
                </div>
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label>Risk Per Trade (%)</label>
                  <div class="risk-presets">
                    <button class="risk-chip active" data-risk="1.0">1.0%</button>
                    <button class="risk-chip" data-risk="0.5">0.5%</button>
                    <button class="risk-chip" data-risk="2.0">2.0%</button>
                    <input type="number" id="calc-risk" class="form-input risk-num-input" value="1.0" step="0.1" />
                  </div>
                </div>
                <div class="form-group" id="group-leverage">
                  <label>Broker Leverage (FX)</label>
                  <select id="calc-leverage" class="form-input">
                    <option value="100">1:100 (Standard)</option>
                    <option value="50">1:50 (Conservative)</option>
                    <option value="200">1:200 (Aggressive)</option>
                    <option value="30">1:30 (Regulated)</option>
                  </select>
                </div>
              </div>

              <div class="form-row-3">
                <div class="form-group">
                  <label>Entry Price</label>
                  <input type="number" id="calc-entry" class="form-input" value="${entry}" step="any" />
                </div>
                <div class="form-group">
                  <label>Stop Loss (SL)</label>
                  <input type="number" id="calc-sl" class="form-input" value="${sl}" step="any" />
                </div>
                <div class="form-group">
                  <label>Take Profit (TP)</label>
                  <input type="number" id="calc-tp" class="form-input" value="${tp}" step="any" />
                </div>
              </div>

              <button class="primary-btn btn-calculate" id="btn-do-calc">⚡ Calculate Position Sizing</button>
            </div>

            <!-- Right Results View -->
            <div class="calc-results-col" id="calc-results-container">
              <div class="results-placeholder">Click 'Calculate Position Sizing' to run quantitative model.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.overlay.querySelector('#calc-close-btn')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('#btn-do-calc')?.addEventListener('click', () => this.executeCalculation());

    // Risk chips
    this.overlay.querySelectorAll('.risk-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        this.overlay.querySelectorAll('.risk-chip').forEach(c => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const val = target.dataset.risk || '1.0';
        const numInput = this.overlay.querySelector('#calc-risk') as HTMLInputElement;
        if (numInput) numInput.value = val;
        this.executeCalculation();
      });
    });

    // Auto-calculate immediately
    this.executeCalculation();
  }

  private async executeCalculation() {
    const sym = (this.overlay.querySelector('#calc-sym') as HTMLInputElement)?.value || 'RELIANCE';
    const assetClass = (this.overlay.querySelector('#calc-asset-class') as HTMLSelectElement)?.value || 'INDIAN_EQUITY';
    const bal = parseFloat((this.overlay.querySelector('#calc-balance') as HTMLInputElement)?.value || '100000');
    const risk = parseFloat((this.overlay.querySelector('#calc-risk') as HTMLInputElement)?.value || '1.0');
    const entry = parseFloat((this.overlay.querySelector('#calc-entry') as HTMLInputElement)?.value || '1363.0');
    const sl = parseFloat((this.overlay.querySelector('#calc-sl') as HTMLInputElement)?.value || '1350.0');
    const tp = parseFloat((this.overlay.querySelector('#calc-tp') as HTMLInputElement)?.value || '1390.0');
    const lev = parseFloat((this.overlay.querySelector('#calc-leverage') as HTMLSelectElement)?.value || '100');

    const resContainer = this.overlay.querySelector('#calc-results-container');
    if (!resContainer) return;

    resContainer.innerHTML = `<div class="results-loading">Computing exact pip values & risk boundaries...</div>`;

    try {
      const res = await calculatePositionSize({
        symbol: sym,
        asset_class: assetClass,
        account_balance: bal,
        risk_percentage: risk,
        entry_price: entry,
        stop_loss_price: sl,
        take_profit_price: tp,
        leverage: lev,
      });
      this.currentResult = res;
      this.renderResults(res);
    } catch (e: any) {
      resContainer.innerHTML = `<div class="error-msg">${e.message}</div>`;
    }
  }

  private renderResults(res: PositionCalculationResult) {
    const resContainer = this.overlay.querySelector('#calc-results-container');
    if (!resContainer) return;

    const isFx = res.asset_class === 'FOREX';
    const currSym = isFx ? '$' : '₹';

    resContainer.innerHTML = `
      <div class="results-card">
        <div class="result-top-metric">
          <span class="res-lbl">Maximum Risk Budget (${res.risk_percentage}%)</span>
          <span class="res-risk-val">${currSym}${res.risk_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>

        <div class="res-metrics-grid">
          ${isFx ? `
            <div class="res-stat-box highlight">
              <span class="stat-lbl">Exact Lot Size</span>
              <span class="stat-num">${res.standard_lots} Lots</span>
              <span class="stat-sub">${res.mini_lots} Mini / ${res.micro_lots} Micro</span>
            </div>
            <div class="res-stat-box">
              <span class="stat-lbl">SL Distance (Pips)</span>
              <span class="stat-num">${res.sl_in_pips?.toFixed(1)} Pips</span>
              <span class="stat-sub">Pip Value: $${res.pip_value_usd?.toFixed(2)}</span>
            </div>
            <div class="res-stat-box">
              <span class="stat-lbl">Required Margin</span>
              <span class="stat-num">$${res.required_margin?.toFixed(2)}</span>
              <span class="stat-sub">Leverage Buffer Active</span>
            </div>
          ` : `
            <div class="res-stat-box highlight">
              <span class="stat-lbl">Recommended Shares</span>
              <span class="stat-num">${res.shares_quantity?.toLocaleString()} Shares</span>
              <span class="stat-sub">Capital: ₹${res.total_capital_required?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="res-stat-box">
              <span class="stat-lbl">F&O Lot Equivalent</span>
              <span class="stat-num">${res.fno_lots_count} Lot(s)</span>
              <span class="stat-sub">Contract Size: ${res.fno_contract_lot_size}</span>
            </div>
            <div class="res-stat-box">
              <span class="stat-lbl">Est. Statutory Charges</span>
              <span class="stat-num">₹${((res.estimated_brokerage || 0) + (res.estimated_stt || 0) + (res.estimated_gst_sebi || 0)).toFixed(2)}</span>
              <span class="stat-sub">STT + GST + SEBI + Brokerage</span>
            </div>
          `}

          <div class="res-stat-box success">
            <span class="stat-lbl">Potential Profit (TP)</span>
            <span class="stat-num">${currSym}${res.net_potential_profit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span class="stat-sub">Risk:Reward 1:${res.risk_reward_ratio}</span>
          </div>
        </div>

        <div class="res-summary-box">
          <div class="summary-title">Institutional Sizing Verdict:</div>
          <div class="summary-body">${res.summary_text}</div>
        </div>
      </div>
    `;
  }
}
