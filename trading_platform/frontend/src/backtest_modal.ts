/**
 * Historical Strategy Backtest & Bar-by-Bar Replay Lab.
 * Replays candlestick sequences bar-by-bar, dynamically rendering SMC levels,
 * executing simulated MTF trades, and outputting complete Tear-Sheet analytics.
 */

import { runBacktest, fetchReplayStep, exportBacktestReport, BacktestReport, SimulatedTrade } from './api';

export class BacktestModal {
  private container: HTMLElement;
  private currentReport: BacktestReport | null = null;
  private replayActive: boolean = false;
  private replayTimer: number | null = null;
  private currentStepIndex: number = 20;
  private maxStepIndex: number = 100;
  private replaySpeedMs: number = 800;

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
    this.render();
    await this.executeBacktest();
  }

  public render() {
    this.container.innerHTML = `
      <div class="backtest-lab-view">
        <div class="lab-header-row">
          <div>
            <h2>🔬 Institutional Strategy Backtest & Candle Replay Lab</h2>
            <p class="section-desc">Simulate 4-step SMC MTF confluence across historical data with automated execution, bar-by-bar replay, and institutional tear-sheets.</p>
          </div>
        </div>

        <!-- Strategy Configuration Strip -->
        <div class="backtest-controls-card">
          <div class="bt-form-inline">
            <div class="bt-input-grp">
              <label>Symbol</label>
              <select id="bt-symbol" class="form-input">
                <option value="RELIANCE" selected>RELIANCE (NSE)</option>
                <option value="TCS">TCS (NSE)</option>
                <option value="HDFCBANK">HDFCBANK (NSE)</option>
                <option value="EUR/USD">EUR/USD (Forex)</option>
                <option value="GBP/USD">GBP/USD (Forex)</option>
                <option value="XAU/USD">XAU/USD (Gold)</option>
              </select>
            </div>

            <div class="bt-input-grp">
              <label>Timeframe</label>
              <select id="bt-timeframe" class="form-input">
                <option value="5M">5-Minute (Scalping)</option>
                <option value="15M" selected>15-Minute (Intraday)</option>
                <option value="1H">1-Hour (Swing)</option>
                <option value="4H">4-Hour (Institutional)</option>
              </select>
            </div>

            <div class="bt-input-grp">
              <label>Initial Capital</label>
              <input type="number" id="bt-capital" class="form-input" value="100000" step="10000" />
            </div>

            <div class="bt-input-grp">
              <label>Risk Per Trade (%)</label>
              <input type="number" id="bt-risk" class="form-input" value="1.0" step="0.5" />
            </div>

            <button class="primary-btn btn-run-bt" id="btn-run-strategy">
              🚀 Run Full Backtest
            </button>
            <button class="btn-toggle" id="btn-export-backtest-s3" style="width:100%; margin-top:8px; font-size:10px; border-color:var(--color-cyan); color:var(--color-cyan); justify-content:center;">
              ☁️ Export Tear-Sheet to Neon Storage
            </button>
          </div>
        </div>

        <!-- Bar-by-Bar Replay Player Toolbar -->
        <div class="replay-toolbar-card">
          <div class="replay-left-group">
            <span class="replay-icon">⏮️</span>
            <span class="replay-title">Historical Bar-by-Bar Replay Player:</span>
            <span class="step-counter" id="lbl-step-counter">Bar ${this.currentStepIndex} / ${this.maxStepIndex}</span>
          </div>

          <div class="replay-buttons-group">
            <button class="replay-btn" id="btn-replay-play">▶ Play</button>
            <button class="replay-btn" id="btn-replay-pause">⏸ Pause</button>
            <button class="replay-btn highlight" id="btn-replay-step">⏭ Step +1 Bar</button>
            <button class="replay-btn" id="btn-replay-reset">↺ Reset</button>
          </div>

          <div class="replay-speed-group">
            <label>Speed:</label>
            <button class="speed-chip ${this.replaySpeedMs === 1200 ? 'active' : ''}" data-speed="1200">1x</button>
            <button class="speed-chip ${this.replaySpeedMs === 600 ? 'active' : ''}" data-speed="600">2x</button>
            <button class="speed-chip ${this.replaySpeedMs === 250 ? 'active' : ''}" data-speed="250">5x</button>
          </div>
        </div>

        <!-- Replay Visualizer & Tear-Sheet Stats -->
        <div class="bt-results-layout" id="bt-results-area">
          <div class="results-loading">Simulating institutional strategy...</div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents() {
    this.container.querySelector('#btn-run-strategy')?.addEventListener('click', () => this.executeBacktest());

    this.container.querySelector('#btn-export-backtest-s3')?.addEventListener('click', async () => {
      if (!this.currentReport) {
        alert('Please run a backtest first before exporting.');
        return;
      }
      try {
        const res = await exportBacktestReport(this.currentReport);
        alert(`Backtest Tear-Sheet saved to Neon Object Storage!\nFile: ${res.filename}\n\nPresigned URL generated (valid 24h). Opening download...`);
        window.open(res.url, '_blank');
      } catch (err: any) {
        alert(`Export Failed: ${err.message}`);
      }
    });

    this.container.querySelector('#btn-replay-play')?.addEventListener('click', () => this.startReplay());
    this.container.querySelector('#btn-replay-pause')?.addEventListener('click', () => this.pauseReplay());
    this.container.querySelector('#btn-replay-step')?.addEventListener('click', () => this.stepReplay());
    this.container.querySelector('#btn-replay-reset')?.addEventListener('click', () => this.resetReplay());

    this.container.querySelectorAll('.speed-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        this.container.querySelectorAll('.speed-chip').forEach(c => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.replaySpeedMs = parseInt(target.dataset.speed || '600', 10);
        if (this.replayActive) {
          this.pauseReplay();
          this.startReplay();
        }
      });
    });
  }

  public async executeBacktest() {
    const sym = (this.container.querySelector('#bt-symbol') as HTMLSelectElement)?.value || 'RELIANCE';
    const tf = (this.container.querySelector('#bt-timeframe') as HTMLSelectElement)?.value || '15M';
    const cap = parseFloat((this.container.querySelector('#bt-capital') as HTMLInputElement)?.value || '100000');
    const risk = parseFloat((this.container.querySelector('#bt-risk') as HTMLInputElement)?.value || '1.0');

    const area = this.container.querySelector('#bt-results-area');
    if (area) area.innerHTML = `<div class="results-loading">Simulating 4-step SMC MTF trades across ${sym} (${tf})...</div>`;

    try {
      this.currentReport = await runBacktest({
        symbol: sym,
        timeframe: tf,
        initial_capital: cap,
        risk_pct_per_trade: risk,
      });

      this.maxStepIndex = this.currentReport.equity_curve.length - 1;
      this.currentStepIndex = Math.min(30, this.maxStepIndex);
      this.renderReport(this.currentReport);
    } catch (e: any) {
      if (area) area.innerHTML = `<div class="error-msg">Backtest error: ${e.message}</div>`;
    }
  }

  private renderReport(rep: BacktestReport) {
    const area = this.container.querySelector('#bt-results-area');
    if (!area) return;

    const isProfit = rep.net_profit >= 0;
    const currSym = rep.symbol.includes('/') ? '$' : '₹';

    area.innerHTML = `
      <!-- Top Tear-Sheet Badges -->
      <div class="tearsheet-metrics-row">
        <div class="tear-stat-card ${isProfit ? 'stat-green' : 'stat-red'}">
          <span class="tear-lbl">Net Return & P&L</span>
          <span class="tear-val">${isProfit ? '+' : ''}${rep.net_return_pct.toFixed(2)}%</span>
          <span class="tear-sub">${currSym}${rep.net_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>

        <div class="tear-stat-card">
          <span class="tear-lbl">Win Rate</span>
          <span class="tear-val text-green">${rep.win_rate_pct.toFixed(1)}%</span>
          <span class="tear-sub">${rep.winning_trades} Wins / ${rep.losing_trades} Losses</span>
        </div>

        <div class="tear-stat-card">
          <span class="tear-lbl">Profit Factor</span>
          <span class="tear-val text-gold">${rep.profit_factor.toFixed(2)}</span>
          <span class="tear-sub">Gross Win / Gross Loss</span>
        </div>

        <div class="tear-stat-card">
          <span class="tear-lbl">Max Drawdown</span>
          <span class="tear-val text-red">-${rep.max_drawdown_pct.toFixed(2)}%</span>
          <span class="tear-sub">Peak-to-Trough NAV drop</span>
        </div>

        <div class="tear-stat-card">
          <span class="tear-lbl">Total Executed Trades</span>
          <span class="tear-val">${rep.total_trades}</span>
          <span class="tear-sub">Avg R:R 1:${rep.avg_risk_reward}</span>
        </div>
      </div>

      <!-- Historical Trade Blotter Table -->
      <div class="bt-blotter-card">
        <div class="blotter-head">
          <h4>📋 Historical Replay Executed Trades Blotter</h4>
          <span class="trade-count">${rep.trades.length} Trades Simulated</span>
        </div>

        <div class="blotter-table-wrap">
          <table class="bt-table">
            <thead>
              <tr>
                <th>Trade ID</th>
                <th>Time</th>
                <th>Side</th>
                <th>Entry Price</th>
                <th>Exit Price</th>
                <th>Stop Loss</th>
                <th>Take Profit</th>
                <th>Net P&L</th>
                <th>Return %</th>
                <th>Exit Trigger</th>
              </tr>
            </thead>
            <tbody>
              ${rep.trades.map(t => {
                const isWin = t.pnl > 0;
                return `
                  <tr class="${isWin ? 'row-win' : 'row-loss'}">
                    <td class="font-mono">${t.trade_id}</td>
                    <td>${t.entry_time.replace('T', ' ').slice(5, 16)}</td>
                    <td><span class="badge-${t.side.toLowerCase()}">${t.side}</span></td>
                    <td>${currSym}${t.entry_price.toFixed(2)}</td>
                    <td>${t.exit_price ? `${currSym}${t.exit_price.toFixed(2)}` : '--'}</td>
                    <td>${currSym}${t.stop_loss.toFixed(2)}</td>
                    <td>${currSym}${t.take_profit.toFixed(2)}</td>
                    <td class="${isWin ? 'text-green' : 'text-red'} font-bold">
                      ${isWin ? '+' : ''}${currSym}${t.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td class="${isWin ? 'text-green' : 'text-red'} font-bold">
                      ${isWin ? '+' : ''}${t.return_pct.toFixed(2)}%
                    </td>
                    <td><span class="badge-trigger tag-${(t.exit_reason || '').toLowerCase()}">${t.exit_reason}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.updateStepLabel();
  }

  private updateStepLabel() {
    const lbl = this.container.querySelector('#lbl-step-counter');
    if (lbl) lbl.textContent = `Bar ${this.currentStepIndex} / ${this.maxStepIndex}`;
  }

  private startReplay() {
    if (this.replayActive) return;
    this.replayActive = true;
    const playBtn = this.container.querySelector('#btn-replay-play');
    if (playBtn) playBtn.classList.add('active');

    this.replayTimer = window.setInterval(async () => {
      if (this.currentStepIndex >= this.maxStepIndex) {
        this.pauseReplay();
        return;
      }
      this.currentStepIndex++;
      this.updateStepLabel();
      await this.triggerStepUpdate();
    }, this.replaySpeedMs);
  }

  private pauseReplay() {
    this.replayActive = false;
    if (this.replayTimer) {
      clearInterval(this.replayTimer);
      this.replayTimer = null;
    }
    const playBtn = this.container.querySelector('#btn-replay-play');
    if (playBtn) playBtn.classList.remove('active');
  }

  private async stepReplay() {
    this.pauseReplay();
    if (this.currentStepIndex < this.maxStepIndex) {
      this.currentStepIndex++;
      this.updateStepLabel();
      await this.triggerStepUpdate();
    }
  }

  private async resetReplay() {
    this.pauseReplay();
    this.currentStepIndex = 15;
    this.updateStepLabel();
    await this.triggerStepUpdate();
  }

  private async triggerStepUpdate() {
    const sym = (this.container.querySelector('#bt-symbol') as HTMLSelectElement)?.value || 'RELIANCE';
    const tf = (this.container.querySelector('#bt-timeframe') as HTMLSelectElement)?.value || '15M';
    try {
      await fetchReplayStep(sym, tf, this.currentStepIndex);
    } catch (e) {
      // Step update
    }
  }

  public destroy() {
    this.pauseReplay();
  }
}
