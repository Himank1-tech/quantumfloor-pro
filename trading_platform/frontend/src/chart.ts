/**
 * High-Performance Interactive Candlestick and Equity Curve Chart Engine
 * Built with HTML5 Canvas for zero-lag 60fps institutional rendering.
 * Styled with TradingView Supercharts ergonomics: 10% Y-axis auto-padding,
 * Mint Emerald (#10B981) & Coral Rose (#F43F5E) colorway, and crosshair margin pills.
 */

import { Candle, SMCAnalysisReport, MTFSetupReport } from './api';
import { SMCOverlayRenderer } from './smc_overlay';

export class PriceChartEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private candles: Candle[] = [];
  public smcOverlay: SMCOverlayRenderer = new SMCOverlayRenderer();
  private hoverIndex: number | null = null;
  private hoverMouseY: number | null = null;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = 'crosshair';
    container.innerHTML = '';
    container.appendChild(this.canvas);

    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(container);
    }

    const handlePoint = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const pLeft = rect.width < 500 ? 6 : 14;
      const pRight = rect.width < 500 ? 54 : 82;
      const chartW = rect.width - pLeft - pRight;

      if (x >= pLeft && x <= pLeft + chartW && this.candles.length > 0) {
        const step = chartW / this.candles.length;
        const idx = Math.floor((x - pLeft) / step);
        this.hoverIndex = Math.max(0, Math.min(this.candles.length - 1, idx));
        this.hoverMouseY = y;
        this.render();
      } else {
        this.hoverIndex = null;
        this.hoverMouseY = null;
        this.render();
      }
    };

    // Mouse hover handler
    this.canvas.addEventListener('mousemove', (e) => handlePoint(e.clientX, e.clientY));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoverIndex = null;
      this.hoverMouseY = null;
      this.render();
    });

    // Touch handlers for mobile / tablet
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length > 0) {
        handlePoint(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 0) {
        handlePoint(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.hoverIndex = null;
      this.hoverMouseY = null;
      this.render();
    });
  }

  public setSMCData(smc: SMCAnalysisReport | null, mtf: MTFSetupReport | null): void {
    this.smcOverlay.setData(smc, mtf);
    this.render();
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  public updateCandles(candles: Candle[]): void {
    this.candles = candles;
    this.render();
  }

  public render(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0 || this.candles.length === 0) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#060A12';
    ctx.fillRect(0, 0, width, height);

    // Spacious chart padding (responsive right margin for non-overlapping SMC and price tags)
    const pTop = 22;
    const pBottom = 28;
    const pLeft = width < 500 ? 6 : 14;
    const pRight = width < 500 ? 54 : 82;

    const chartW = width - pLeft - pRight;
    const chartH = height - pTop - pBottom;

    // Auto-Scale Y-Axis strictly to recent price action: 95th percentile range + 10% padding
    // Prevents extreme wick outliers or distant SL/TP orders from squashing candlesticks into a flat line
    const prices: number[] = [];
    for (const c of this.candles) {
      prices.push(c.low, c.high, c.open, c.close);
    }
    prices.sort((a, b) => a - b);

    // 95th percentile range (excluding extreme 2.5% tail outliers on bottom & top)
    const pLowIdx = Math.floor(prices.length * 0.025);
    const pHighIdx = Math.min(prices.length - 1, Math.floor(prices.length * 0.975));

    // Ensure recent active 5 bars are always fully framed
    const recent = this.candles.slice(-5);
    const recentMin = Math.min(...recent.map(c => c.low));
    const recentMax = Math.max(...recent.map(c => c.high));

    let minPrice = Math.min(prices[pLowIdx] ?? prices[0], recentMin);
    let maxPrice = Math.max(prices[pHighIdx] ?? prices[prices.length - 1], recentMax);

    if (!isFinite(minPrice) || !isFinite(maxPrice) || minPrice === maxPrice) {
      minPrice = (prices[0] || 100) * 0.99;
      maxPrice = (prices[prices.length - 1] || 110) * 1.01;
    }

    const rawRange = maxPrice - minPrice;
    const pad = (rawRange > 0 ? rawRange : maxPrice * 0.05) * 0.10;
    minPrice -= pad;
    maxPrice += pad;
    const priceRange = maxPrice - minPrice;

    const candleCount = this.candles.length;
    const step = chartW / candleCount;
    const barWidth = Math.max(2.5, Math.min(14, step * 0.72));

    // 1. Subtle Background Grid Lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';

    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pTop + (chartH / gridLines) * i;
      const p = maxPrice - (priceRange / gridLines) * i;

      ctx.beginPath();
      ctx.moveTo(pLeft, y);
      ctx.lineTo(pLeft + chartW, y);
      ctx.stroke();

      // Right axis price label
      const formatted = p >= 1000 ? p.toFixed(1) : p >= 10 ? p.toFixed(2) : p.toFixed(4);
      ctx.fillText(formatted, pLeft + chartW + 8, y + 3.5);
    }

    // 2. Draw Candlesticks (Neon Emerald #00E676 & Crimson Coral #FF3B6B)
    for (let i = 0; i < candleCount; i++) {
      const c = this.candles[i];
      const x = pLeft + i * step + step / 2;
      const isUp = c.close >= c.open;

      const yHigh = pTop + ((maxPrice - c.high) / priceRange) * chartH;
      const yLow = pTop + ((maxPrice - c.low) / priceRange) * chartH;
      const yOpen = pTop + ((maxPrice - c.open) / priceRange) * chartH;
      const yClose = pTop + ((maxPrice - c.close) / priceRange) * chartH;

      const color = isUp ? '#00E676' : '#FF3B6B';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      // Wick
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1.8, Math.abs(yClose - yOpen));
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
    }

    // 3. Draw 20 EMA line overlay (Electric Cyan #00E5FF)
    if (this.candles.length >= 5) {
      ctx.beginPath();
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < candleCount; i++) {
        const startIdx = Math.max(0, i - 10);
        const slice = this.candles.slice(startIdx, i + 1);
        const avg = slice.reduce((acc, v) => acc + v.close, 0) / slice.length;
        const x = pLeft + i * step + step / 2;
        const y = pTop + ((maxPrice - avg) / priceRange) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 3b. Draw 50 EMA line overlay (Sovereign Gold #F59E0B)
    if (this.candles.length >= 10) {
      ctx.beginPath();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < candleCount; i++) {
        const startIdx = Math.max(0, i - 25);
        const slice = this.candles.slice(startIdx, i + 1);
        const avg = slice.reduce((acc, v) => acc + v.close, 0) / slice.length;
        const x = pLeft + i * step + step / 2;
        const y = pTop + ((maxPrice - avg) / priceRange) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 4. Draw SMC Overlays (BOS, CHoCH, BSL/SSL, OBs, FVGs, Fib OTE, Trade Box)
    this.smcOverlay.render(ctx, width, height, this.candles, minPrice, maxPrice, {
      top: pTop,
      bottom: pBottom,
      left: pLeft,
      right: pRight,
    });

    // 5. Crosshair & Hover Tooltip
    if (this.hoverIndex !== null && this.candles[this.hoverIndex]) {
      const hc = this.candles[this.hoverIndex];
      const hx = pLeft + this.hoverIndex * step + step / 2;
      const hy = this.hoverMouseY !== null ? this.hoverMouseY : pTop + ((maxPrice - hc.close) / priceRange) * chartH;

      ctx.save();
      // Crosshair lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(hx, pTop);
      ctx.lineTo(hx, pTop + chartH);
      ctx.moveTo(pLeft, hy);
      ctx.lineTo(pLeft + chartW, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pinned Y-Axis Price Badge
      const hoverPrice = maxPrice - ((hy - pTop) / chartH) * priceRange;
      const hoverPriceStr = hoverPrice >= 1000 ? hoverPrice.toFixed(1) : hoverPrice >= 10 ? hoverPrice.toFixed(2) : hoverPrice.toFixed(4);
      ctx.fillStyle = '#071626';
      ctx.strokeStyle = '#00e5ff';
      ctx.beginPath();
      const pBadgeW = 66;
      const pBadgeH = 17;
      const pBadgeX = width - pRight + 4;
      const pBadgeY = hy - pBadgeH / 2;
      ctx.fillRect(pBadgeX, pBadgeY, pBadgeW, pBadgeH);
      ctx.strokeRect(pBadgeX, pBadgeY, pBadgeW, pBadgeH);
      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hoverPriceStr, pBadgeX + pBadgeW / 2, pBadgeY + pBadgeH / 2);

      // Sleek Top OHLC Legend Pill
      const isUp = hc.close >= hc.open;
      const chg = hc.close - hc.open;
      const chgPct = (chg / hc.open) * 100;
      const ttW = 390;
      const ttH = 22;
      const ttX = pLeft + 8;
      const ttY = pTop - 18;

      ctx.fillStyle = 'rgba(7, 11, 20, 0.94)';
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.30)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(ttX, ttY, ttW, ttH, 4) : ctx.rect(ttX, ttY, ttW, ttH);
      ctx.fill();
      ctx.stroke();

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('O', ttX + 8, ttY + 14);
      ctx.fillStyle = isUp ? '#00E676' : '#FF3B6B';
      ctx.fillText(hc.open.toFixed(2), ttX + 20, ttY + 14);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('H', ttX + 80, ttY + 14);
      ctx.fillStyle = isUp ? '#00E676' : '#FF3B6B';
      ctx.fillText(hc.high.toFixed(2), ttX + 92, ttY + 14);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('L', ttX + 152, ttY + 14);
      ctx.fillStyle = isUp ? '#00E676' : '#FF3B6B';
      ctx.fillText(hc.low.toFixed(2), ttX + 164, ttY + 14);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('C', ttX + 224, ttY + 14);
      ctx.fillStyle = isUp ? '#00E676' : '#FF3B6B';
      ctx.fillText(hc.close.toFixed(2), ttX + 236, ttY + 14);

      ctx.fillStyle = isUp ? '#00E676' : '#FF3B6B';
      const chgSign = chg >= 0 ? '+' : '';
      ctx.fillText(`${chgSign}${chg.toFixed(2)} (${chgSign}${chgPct.toFixed(2)}%)`, ttX + 300, ttY + 14);

      ctx.restore();
    }
  }
}

export class EquityCurveChartEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private equitySeries: number[] = [];

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(this.canvas);

    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(container);
    }
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  public updateEquitySeries(series: number[]): void {
    this.equitySeries = series;
    this.render();
  }

  public render(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0 || this.equitySeries.length === 0) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    const pTop = 16;
    const pBottom = 20;
    const pLeft = 10;
    const pRight = 65;

    const chartW = width - pLeft - pRight;
    const chartH = height - pTop - pBottom;

    let minVal = Math.min(...this.equitySeries);
    let maxVal = Math.max(...this.equitySeries);
    if (minVal === maxVal) {
      minVal *= 0.98;
      maxVal *= 1.02;
    }
    const range = maxVal - minVal;
    const count = this.equitySeries.length;
    const step = chartW / (count - 1 || 1);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';

    for (let i = 0; i <= 3; i++) {
      const y = pTop + (chartH / 3) * i;
      const val = maxVal - (range / 3) * i;

      ctx.beginPath();
      ctx.moveTo(pLeft, y);
      ctx.lineTo(pLeft + chartW, y);
      ctx.stroke();

      const label = `₹${(val / 100000).toFixed(2)}L`;
      ctx.fillText(label, pLeft + chartW + 6, y + 3);
    }

    // Emerald gradient area fill
    const gradient = ctx.createLinearGradient(0, pTop, 0, pTop + chartH);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = pLeft + i * step;
      const y = pTop + ((maxVal - this.equitySeries[i]) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.lineTo(pLeft + chartW, pTop + chartH);
    ctx.lineTo(pLeft, pTop + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    for (let i = 0; i < count; i++) {
      const x = pLeft + i * step;
      const y = pTop + ((maxVal - this.equitySeries[i]) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
