/**
 * High-Performance Interactive Candlestick and Equity Curve Chart Engine
 * Built with HTML5 Canvas for zero-lag 60fps institutional rendering.
 * Daylight White Institutional Light Theme (#FFFFFF canvas, #F1F5F9 grid, Mint Emerald & Crimson).
 * Supports click & drag panning, mouse-wheel / button zooming, and auto-fit reset.
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

  // Movable / Zoomable Superchart state
  public panOffset: number = 0; // 0 = pinned to live edge
  public visibleBars: number = 65; // default visible candles
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartPan: number = 0;
  private touchStartDist: number | null = null;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = 'grab';
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

    const getSliceBounds = () => {
      const total = this.candles.length;
      if (total === 0) return { startIdx: 0, endIdx: 0, count: 0 };
      const count = Math.min(total, this.visibleBars);
      const maxPan = Math.max(0, total - count);
      const pan = Math.max(0, Math.min(maxPan, this.panOffset));
      const endIdx = total - pan;
      const startIdx = Math.max(0, endIdx - count);
      return { startIdx, endIdx, count: endIdx - startIdx };
    };

    const handlePoint = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const pLeft = rect.width < 500 ? 6 : 14;
      const pRight = rect.width < 500 ? 54 : 82;
      const chartW = rect.width - pLeft - pRight;

      const { startIdx, endIdx, count } = getSliceBounds();
      if (x >= pLeft && x <= pLeft + chartW && count > 0) {
        const step = chartW / count;
        const relIdx = Math.floor((x - pLeft) / step);
        const actualIdx = startIdx + Math.max(0, Math.min(count - 1, relIdx));
        this.hoverIndex = actualIdx;
        this.hoverMouseY = y;
        this.render();
      } else {
        this.hoverIndex = null;
        this.hoverMouseY = null;
        this.render();
      }
    };

    // Drag / Panning Handlers (Mouse)
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartPan = this.panOffset;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const rect = this.canvas.getBoundingClientRect();
        const pLeft = rect.width < 500 ? 6 : 14;
        const pRight = rect.width < 500 ? 54 : 82;
        const chartW = rect.width - pLeft - pRight;
        const count = Math.min(this.candles.length || 65, this.visibleBars);
        const step = chartW / count;

        const deltaX = e.clientX - this.dragStartX;
        const deltaBars = Math.round(deltaX / step);
        const maxPan = Math.max(0, this.candles.length - count);
        this.panOffset = Math.max(0, Math.min(maxPan, this.dragStartPan + deltaBars));
        this.render();
      } else {
        handlePoint(e.clientX, e.clientY);
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (!this.isDragging) {
        this.hoverIndex = null;
        this.hoverMouseY = null;
        this.render();
      }
    });

    // Mouse Wheel Zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }, { passive: false });

    // Touch Handlers for Mobile / Tablet Panning & Pinch Zoom
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartPan = this.panOffset;
        handlePoint(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchStartDist = Math.hypot(dx, dy);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const rect = this.canvas.getBoundingClientRect();
        const pLeft = rect.width < 500 ? 6 : 14;
        const pRight = rect.width < 500 ? 54 : 82;
        const chartW = rect.width - pLeft - pRight;
        const count = Math.min(this.candles.length || 65, this.visibleBars);
        const step = chartW / count;

        const deltaX = e.touches[0].clientX - this.dragStartX;
        const deltaBars = Math.round(deltaX / step);
        const maxPan = Math.max(0, this.candles.length - count);
        this.panOffset = Math.max(0, Math.min(maxPan, this.dragStartPan + deltaBars));
        this.render();
      } else if (e.touches.length === 2 && this.touchStartDist !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const curDist = Math.hypot(dx, dy);
        if (Math.abs(curDist - this.touchStartDist) > 20) {
          if (curDist > this.touchStartDist) {
            this.zoomIn();
          } else {
            this.zoomOut();
          }
          this.touchStartDist = curDist;
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
      this.touchStartDist = null;
      this.hoverIndex = null;
      this.hoverMouseY = null;
      this.render();
    });
  }

  public zoomIn(): void {
    this.visibleBars = Math.max(18, this.visibleBars - 6);
    this.render();
  }

  public zoomOut(): void {
    this.visibleBars = Math.min(this.candles.length || 150, this.visibleBars + 6);
    this.render();
  }

  public resetView(): void {
    this.panOffset = 0;
    this.visibleBars = 65;
    this.render();
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

    // Daylight White Institutional Canvas Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Padding configuration
    const pTop = 24;
    const pBottom = 28;
    const pLeft = width < 500 ? 6 : 14;
    const pRight = width < 500 ? 58 : 86;

    const chartW = width - pLeft - pRight;
    const chartH = height - pTop - pBottom;

    // Slice candles based on panOffset and visibleBars
    const totalBars = this.candles.length;
    const count = Math.min(totalBars, this.visibleBars);
    const maxPan = Math.max(0, totalBars - count);
    const currentPan = Math.max(0, Math.min(maxPan, this.panOffset));
    const endIdx = totalBars - currentPan;
    const startIdx = Math.max(0, endIdx - count);
    const visibleCandles = this.candles.slice(startIdx, endIdx);

    if (visibleCandles.length === 0) return;

    // Calculate Y-axis range strictly from visible candles
    const prices: number[] = [];
    for (const c of visibleCandles) {
      prices.push(c.low, c.high, c.open, c.close);
    }
    prices.sort((a, b) => a - b);

    const pLowIdx = Math.floor(prices.length * 0.02);
    const pHighIdx = Math.min(prices.length - 1, Math.floor(prices.length * 0.98));

    const recent = visibleCandles.slice(-5);
    const recentMin = Math.min(...recent.map((c) => c.low));
    const recentMax = Math.max(...recent.map((c) => c.high));

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

    const candleCount = visibleCandles.length;
    const step = chartW / candleCount;
    const barWidth = Math.max(2.5, Math.min(16, step * 0.72));

    // 1. Subtle Cool-Slate Grid Lines on White
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748B';
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

    // 1b. Render Vertical Dashed Day-Break Separator Lines with Date Labels
    let lastDateStr = '';
    const todayDateStr = new Date().toDateString();
    for (let i = 0; i < candleCount; i++) {
      const c = visibleCandles[i];
      const timeVal = c.time || (c as any).timestamp;
      if (!timeVal) continue;
      const d = new Date(timeVal);
      if (isNaN(d.getTime())) continue;
      const dateStr = d.toDateString();

      // Detect day transition across prior sessions
      if (lastDateStr && dateStr !== lastDateStr) {
        const x = pLeft + i * step;

        ctx.save();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, pTop);
        ctx.lineTo(x, pTop + chartH);
        ctx.stroke();

        // Date Label pill at top of separator line
        const isToday = dateStr === todayDateStr;
        const dayLabel = isToday ? 'Today' : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const labelW = ctx.measureText(dayLabel).width + 8;
        ctx.fillStyle = isToday ? '#2563EB' : '#64748B';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x - labelW / 2, pTop + 4, labelW, 14, 3) : ctx.rect(x - labelW / 2, pTop + 4, labelW, 14);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dayLabel, x, pTop + 11);
        ctx.restore();
      }
      lastDateStr = dateStr;
    }

    // 2. Draw Candlesticks (Emerald #10B981 & Crimson #EF4444)
    for (let i = 0; i < candleCount; i++) {
      const c = visibleCandles[i];
      const x = pLeft + i * step + step / 2;
      const isUp = c.close >= c.open;

      const yHigh = pTop + ((maxPrice - c.high) / priceRange) * chartH;
      const yLow = pTop + ((maxPrice - c.low) / priceRange) * chartH;
      const yOpen = pTop + ((maxPrice - c.open) / priceRange) * chartH;
      const yClose = pTop + ((maxPrice - c.close) / priceRange) * chartH;

      const color = isUp ? '#10B981' : '#EF4444';
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

    // 3. Draw 20 EMA line overlay (Royal Indigo #2563EB)
    if (visibleCandles.length >= 5) {
      ctx.beginPath();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < candleCount; i++) {
        const start = Math.max(0, i - 10);
        const slice = visibleCandles.slice(start, i + 1);
        const avg = slice.reduce((acc, v) => acc + v.close, 0) / slice.length;
        const x = pLeft + i * step + step / 2;
        const y = pTop + ((maxPrice - avg) / priceRange) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 3b. Draw 50 EMA line overlay (Amber #D97706)
    if (visibleCandles.length >= 10) {
      ctx.beginPath();
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < candleCount; i++) {
        const start = Math.max(0, i - 25);
        const slice = visibleCandles.slice(start, i + 1);
        const avg = slice.reduce((acc, v) => acc + v.close, 0) / slice.length;
        const x = pLeft + i * step + step / 2;
        const y = pTop + ((maxPrice - avg) / priceRange) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 4. Draw SMC Overlays (Passing startIdx for accurate historical positioning)
    this.smcOverlay.render(ctx, width, height, visibleCandles, minPrice, maxPrice, {
      top: pTop,
      bottom: pBottom,
      left: pLeft,
      right: pRight,
    }, startIdx);

    // 5. Crosshair & Hover Tooltip
    if (this.hoverIndex !== null && this.candles[this.hoverIndex]) {
      const hc = this.candles[this.hoverIndex];
      const relIdx = this.hoverIndex - startIdx;
      if (relIdx >= 0 && relIdx < candleCount) {
        const hx = pLeft + relIdx * step + step / 2;
        const hy = this.hoverMouseY !== null ? this.hoverMouseY : pTop + ((maxPrice - hc.close) / priceRange) * chartH;

        ctx.save();
        // Crosshair lines
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.40)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        ctx.beginPath();
        ctx.moveTo(hx, pTop);
        ctx.lineTo(hx, pTop + chartH);
        ctx.moveTo(pLeft, hy);
        ctx.lineTo(pLeft + chartW, hy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pinned Y-Axis Price Badge (Slate #0F172A with #FFFFFF text)
        const hoverPrice = maxPrice - ((hy - pTop) / chartH) * priceRange;
        const hoverPriceStr = hoverPrice >= 1000 ? hoverPrice.toFixed(1) : hoverPrice >= 10 ? hoverPrice.toFixed(2) : hoverPrice.toFixed(4);
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#2563EB';
        ctx.beginPath();
        const pBadgeW = 68;
        const pBadgeH = 18;
        const pBadgeX = width - pRight + 4;
        const pBadgeY = hy - pBadgeH / 2;
        ctx.fillRect(pBadgeX, pBadgeY, pBadgeW, pBadgeH);
        ctx.strokeRect(pBadgeX, pBadgeY, pBadgeW, pBadgeH);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hoverPriceStr, pBadgeX + pBadgeW / 2, pBadgeY + pBadgeH / 2);

        // Sleek Top OHLC Legend Pill (Daylight White Surface + Subtle Shadow)
        const isUp = hc.close >= hc.open;
        const chg = hc.close - hc.open;
        const chgPct = (chg / hc.open) * 100;
        const ttW = 390;
        const ttH = 22;
        const ttX = pLeft + 8;
        const ttY = pTop - 20;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.strokeStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(ttX, ttY, ttW, ttH, 4) : ctx.rect(ttX, ttY, ttW, ttH);
        ctx.fill();
        ctx.stroke();

        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748B';
        ctx.fillText('O', ttX + 8, ttY + 14);
        ctx.fillStyle = isUp ? '#10B981' : '#EF4444';
        ctx.fillText(hc.open.toFixed(2), ttX + 20, ttY + 14);

        ctx.fillStyle = '#64748B';
        ctx.fillText('H', ttX + 80, ttY + 14);
        ctx.fillStyle = isUp ? '#10B981' : '#EF4444';
        ctx.fillText(hc.high.toFixed(2), ttX + 92, ttY + 14);

        ctx.fillStyle = '#64748B';
        ctx.fillText('L', ttX + 152, ttY + 14);
        ctx.fillStyle = isUp ? '#10B981' : '#EF4444';
        ctx.fillText(hc.low.toFixed(2), ttX + 164, ttY + 14);

        ctx.fillStyle = '#64748B';
        ctx.fillText('C', ttX + 224, ttY + 14);
        ctx.fillStyle = isUp ? '#10B981' : '#EF4444';
        ctx.fillText(hc.close.toFixed(2), ttX + 236, ttY + 14);

        ctx.fillStyle = isUp ? '#10B981' : '#EF4444';
        const chgSign = chg >= 0 ? '+' : '';
        ctx.fillText(`${chgSign}${chg.toFixed(2)} (${chgSign}${chgPct.toFixed(2)}%)`, ttX + 300, ttY + 14);

        ctx.restore();
      }
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

    // Daylight White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

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
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748B';
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
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.20)');
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
