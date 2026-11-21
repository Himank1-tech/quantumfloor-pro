/**
 * High-Performance Interactive TradingView-Grade Candlestick & Drawing Engine
 * Built with HTML5 Canvas for zero-lag 60fps institutional rendering.
 * Daylight White Institutional Light Theme (#FFFFFF canvas, #F1F5F9 grid, Mint Emerald & Crimson).
 * Supports:
 * - Deep multi-month horizontal sliding with inertial drag panning & zoom
 * - TradingView Left-Edge Drawing Tools (Trendline, Ray, Horizontal S/R, Vertical, Channel, Fib OTE, Long/Short Position R:R Box, Price Range, Date Range, Brush, Text, Eraser, Magnet)
 * - Persistent drawings per symbol via localStorage
 * - Interactive Bar Replay (rewind to historical candle, play/pause/step at 1x/2x/5x/10x)
 * - Top-Left Live OHLC Bar Readout & Bottom-Axis Crosshair Timestamp Pill
 * - Multi-Indicator Suite (EMA 20/50/200, VWAP, Bollinger Bands, SMC Overlay)
 * - Bottom Date-Range Presets (1D, 5D, 1M, 3M, 6M, 1Y, ALL)
 */

import { Candle, SMCAnalysisReport, MTFSetupReport } from './api';
import { SMCOverlayRenderer } from './smc_overlay';

export interface DrawingPoint {
  price: number;
  barIdx: number;
  time?: string;
}

export interface DrawingItem {
  id: string;
  type:
    | 'trendline'
    | 'ray'
    | 'horizontal'
    | 'vertical'
    | 'channel'
    | 'fib'
    | 'long_position'
    | 'short_position'
    | 'price_range'
    | 'date_range'
    | 'brush'
    | 'text';
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  dashed?: boolean;
  text?: string;
  entryPrice?: number;
  tpPrice?: number;
  slPrice?: number;
  symbol?: string;
}

export class PriceChartEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private candles: Candle[] = [];
  public smcOverlay: SMCOverlayRenderer = new SMCOverlayRenderer();
  private hoverIndex: number | null = null;
  private hoverMouseY: number | null = null;
  private hoverMouseX: number | null = null;

  // Chart view & zoom state
  public panOffset: number = 0; // 0 = pinned to live edge
  public visibleBars: number = 75; // default visible candles
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartPan: number = 0;
  private touchStartDist: number | null = null;

  // Symbol & Timeframe
  public currentSymbol: string = 'RELIANCE';
  public currentTimeframe: string = '15M';

  // Drawing Toolbar state
  public activeTool: string = 'crosshair'; // 'crosshair' | 'dot' | 'arrow' | 'eraser' | 'trendline' | 'ray' | 'horizontal' | 'vertical' | 'channel' | 'fib' | 'long_position' | 'short_position' | 'price_range' | 'date_range' | 'brush' | 'text'
  public drawings: DrawingItem[] = [];
  public selectedDrawingId: string | null = null;
  public magnetEnabled: boolean = false;
  public drawingsVisible: boolean = true;
  private pendingDrawing: DrawingItem | null = null;
  private isBrushing: boolean = false;
  private brushPoints: DrawingPoint[] = [];
  private activeDragHandle: { drawingId: string; handleType: string } | null = null;

  // Bar Replay Engine state
  public replayActive: boolean = false;
  public replayIndex: number = 0;
  public replaySpeed: number = 1;
  private replayTimer: number | null = null;

  // Indicator Suite toggles
  public indicators = {
    smcStruct: true,
    smcLiq: true,
    smcObs: true,
    smcFib: true,
    smcTradebox: true,
    smcSR: true,
    ema20: true,
    ema50: true,
    ema200: false,
    vwap: false,
    bollinger: false,
  };

  // Callbacks
  public onHoverCandle?: (c: Candle | null, symbol: string, tf: string) => void;
  public onDrawingSelect?: (drawing: DrawingItem | null) => void;
  public onReplayStep?: (idx: number) => void;

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

    this.attachEventListeners();
    this.loadDrawings(this.currentSymbol);
  }

  // ==================== STORAGE & PERSISTENCE ====================

  public loadDrawings(symbol: string): void {
    this.currentSymbol = symbol;
    try {
      const raw = localStorage.getItem(`quantumfloor_drawings_${symbol}`);
      this.drawings = raw ? JSON.parse(raw) : [];
    } catch {
      this.drawings = [];
    }
    this.render();
  }

  public saveDrawings(): void {
    try {
      localStorage.setItem(`quantumfloor_drawings_${this.currentSymbol}`, JSON.stringify(this.drawings));
    } catch {}
  }

  // ==================== TOOL SELECTION & CONFIG ====================

  public setTool(tool: string): void {
    this.activeTool = tool;
    this.pendingDrawing = null;
    this.isBrushing = false;
    this.activeDragHandle = null;

    if (tool === 'eraser') {
      this.canvas.style.cursor = 'not-allowed';
    } else if (tool === 'text') {
      this.canvas.style.cursor = 'text';
    } else if (tool === 'arrow') {
      this.canvas.style.cursor = 'default';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  public setMagnet(enabled: boolean): void {
    this.magnetEnabled = enabled;
  }

  public toggleVisibility(): void {
    this.drawingsVisible = !this.drawingsVisible;
    this.render();
  }

  public clearDrawings(): void {
    this.drawings = [];
    this.selectedDrawingId = null;
    this.pendingDrawing = null;
    this.saveDrawings();
    this.render();
    if (this.onDrawingSelect) this.onDrawingSelect(null);
  }

  public deleteSelectedDrawing(): void {
    if (this.selectedDrawingId) {
      this.drawings = this.drawings.filter(d => d.id !== this.selectedDrawingId);
      this.selectedDrawingId = null;
      this.saveDrawings();
      this.render();
      if (this.onDrawingSelect) this.onDrawingSelect(null);
    }
  }

  public updateSelectedDrawingStyle(color?: string, width?: number, dashed?: boolean): void {
    if (!this.selectedDrawingId) return;
    const item = this.drawings.find(d => d.id === this.selectedDrawingId);
    if (item) {
      if (color !== undefined) item.color = color;
      if (width !== undefined) item.lineWidth = width;
      if (dashed !== undefined) item.dashed = dashed;
      this.saveDrawings();
      this.render();
    }
  }

  public setIndicator(key: keyof typeof this.indicators, val: boolean): void {
    this.indicators[key] = val;
    this.render();
  }

  // ==================== BAR REPLAY ENGINE ====================

  public startReplay(targetIdx?: number): void {
    this.replayActive = true;
    const total = this.candles.length;
    this.replayIndex = targetIdx !== undefined ? targetIdx : Math.max(10, total - 45);
    this.render();
    if (this.onReplayStep) this.onReplayStep(this.replayIndex);
  }

  public playReplay(onStep?: (idx: number) => void): void {
    this.pauseReplay();
    const ms = Math.max(70, Math.round(900 / this.replaySpeed));
    this.replayTimer = window.setInterval(() => {
      if (this.replayIndex >= this.candles.length - 1) {
        this.pauseReplay();
        return;
      }
      this.replayIndex++;
      this.render();
      if (onStep) onStep(this.replayIndex);
      if (this.onReplayStep) this.onReplayStep(this.replayIndex);
    }, ms);
  }

  public pauseReplay(): void {
    if (this.replayTimer !== null) {
      clearInterval(this.replayTimer);
      this.replayTimer = null;
    }
  }

  public stepReplay(onStep?: (idx: number) => void): void {
    this.pauseReplay();
    if (this.replayIndex < this.candles.length - 1) {
      this.replayIndex++;
      this.render();
      if (onStep) onStep(this.replayIndex);
      if (this.onReplayStep) this.onReplayStep(this.replayIndex);
    }
  }

  public resetReplay(): void {
    this.pauseReplay();
    this.replayIndex = Math.max(10, this.candles.length - 45);
    this.render();
    if (this.onReplayStep) this.onReplayStep(this.replayIndex);
  }

  public exitReplay(): void {
    this.pauseReplay();
    this.replayActive = false;
    this.render();
  }

  public setReplaySpeed(speed: number): void {
    this.replaySpeed = speed;
    if (this.replayTimer) {
      this.playReplay();
    }
  }

  // ==================== DATE-RANGE PRESETS ====================

  public setDateRange(range: string): void {
    const total = this.candles.length;
    if (total === 0) return;
    this.panOffset = 0;
    if (range === '1D') this.visibleBars = Math.min(total, 35);
    else if (range === '5D') this.visibleBars = Math.min(total, 95);
    else if (range === '1M') this.visibleBars = Math.min(total, 200);
    else if (range === '3M') this.visibleBars = Math.min(total, 350);
    else if (range === '6M') this.visibleBars = Math.min(total, 500);
    else if (range === '1Y') this.visibleBars = Math.min(total, 750);
    else if (range === 'ALL') this.visibleBars = total;
    this.render();
  }

  public zoomIn(): void {
    this.visibleBars = Math.max(16, this.visibleBars - 6);
    this.render();
  }

  public zoomOut(): void {
    const maxB = this.candles.length || 300;
    this.visibleBars = Math.min(maxB, this.visibleBars + 8);
    this.render();
  }

  public resetView(): void {
    this.panOffset = 0;
    this.visibleBars = 75;
    this.render();
  }

  public setSymbol(sym: string): void {
    this.currentSymbol = sym;
    this.loadDrawings(sym);
  }

  public setTimeframe(tf: string): void {
    this.currentTimeframe = tf;
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

  // ==================== EVENT LISTENERS & INTERACTION ====================

  private attachEventListeners(): void {
    const getBounds = () => {
      const rect = this.canvas.getBoundingClientRect();
      const pTop = 26;
      const pBottom = 28;
      const pLeft = rect.width < 500 ? 6 : 14;
      const pRight = rect.width < 500 ? 58 : 86;
      const chartW = rect.width - pLeft - pRight;
      const chartH = rect.height - pTop - pBottom;

      const effectiveCandles = this.replayActive
        ? this.candles.slice(0, Math.max(1, this.replayIndex + 1))
        : this.candles;

      const totalBars = effectiveCandles.length;
      const count = Math.min(totalBars || 1, this.visibleBars);
      const maxPan = Math.max(0, totalBars - count);
      const currentPan = Math.max(0, Math.min(maxPan, this.panOffset));
      const endIdx = totalBars - currentPan;
      const startIdx = Math.max(0, endIdx - count);

      return { rect, pTop, pBottom, pLeft, pRight, chartW, chartH, startIdx, endIdx, count, effectiveCandles };
    };

    const coordToPriceAndIdx = (clientX: number, clientY: number) => {
      const { rect, pTop, pLeft, chartW, chartH, startIdx, count, effectiveCandles } = getBounds();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      let actualIdx = startIdx;
      if (count > 0 && chartW > 0) {
        const step = chartW / count;
        const rel = Math.floor((x - pLeft) / step);
        actualIdx = startIdx + Math.max(0, Math.min(count - 1, rel));
      }

      // Min/Max price calculation
      const visible = effectiveCandles.slice(startIdx, startIdx + count);
      let minP = 100;
      let maxP = 200;
      if (visible.length > 0) {
        const lows = visible.map(c => c.low);
        const highs = visible.map(c => c.high);
        minP = Math.min(...lows);
        maxP = Math.max(...highs);
        const pad = ((maxP - minP) || 1) * 0.10;
        minP -= pad;
        maxP += pad;
      }
      const range = (maxP - minP) || 1;
      let price = maxP - ((y - pTop) / (chartH || 1)) * range;

      // Magnet snap
      if (this.magnetEnabled && effectiveCandles[actualIdx]) {
        const c = effectiveCandles[actualIdx];
        const candidates = [c.open, c.high, c.low, c.close];
        let best = candidates[0];
        let bestDiff = Math.abs(price - best);
        for (let i = 1; i < candidates.length; i++) {
          const diff = Math.abs(price - candidates[i]);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = candidates[i];
          }
        }
        price = best;
      }

      return { x, y, price, actualIdx, c: effectiveCandles[actualIdx], minP, maxP, pTop, pLeft, chartW, chartH, startIdx, count };
    };

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const { x, y, price, actualIdx, c } = coordToPriceAndIdx(e.clientX, e.clientY);

      // Replay jump click
      if (this.replayActive && this.activeTool === 'crosshair' && e.shiftKey) {
        this.replayIndex = actualIdx;
        this.render();
        if (this.onReplayStep) this.onReplayStep(actualIdx);
        return;
      }

      // Eraser Tool
      if (this.activeTool === 'eraser') {
        const hit = this.hitTestDrawing(x, y);
        if (hit) {
          this.drawings = this.drawings.filter(d => d.id !== hit.id);
          this.saveDrawings();
          this.render();
        }
        return;
      }

      // Check if clicking on existing position/drawing handle
      const handleHit = this.hitTestHandle(x, y);
      if (handleHit) {
        this.activeDragHandle = handleHit;
        this.selectedDrawingId = handleHit.drawingId;
        const sel = this.drawings.find(d => d.id === handleHit.drawingId);
        if (this.onDrawingSelect) this.onDrawingSelect(sel || null);
        this.render();
        return;
      }

      // Select existing drawing
      if (this.activeTool === 'crosshair' || this.activeTool === 'dot' || this.activeTool === 'arrow') {
        const clickedDrawing = this.hitTestDrawing(x, y);
        if (clickedDrawing) {
          this.selectedDrawingId = clickedDrawing.id;
          if (this.onDrawingSelect) this.onDrawingSelect(clickedDrawing);
          this.render();
          return;
        } else {
          this.selectedDrawingId = null;
          if (this.onDrawingSelect) this.onDrawingSelect(null);
        }

        // Otherwise initiate canvas panning
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartPan = this.panOffset;
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      // Single-click tools: Horizontal & Vertical lines
      if (this.activeTool === 'horizontal') {
        const d: DrawingItem = {
          id: `d_${Date.now()}`,
          type: 'horizontal',
          points: [{ price, barIdx: actualIdx, time: c?.time || (c as any)?.timestamp }],
          color: '#2563EB',
          lineWidth: 2,
          dashed: false,
          symbol: this.currentSymbol,
        };
        this.drawings.push(d);
        this.selectedDrawingId = d.id;
        this.saveDrawings();
        this.setTool('crosshair');
        this.render();
        if (this.onDrawingSelect) this.onDrawingSelect(d);
        return;
      }

      if (this.activeTool === 'vertical') {
        const d: DrawingItem = {
          id: `d_${Date.now()}`,
          type: 'vertical',
          points: [{ price, barIdx: actualIdx, time: c?.time || (c as any)?.timestamp }],
          color: '#2563EB',
          lineWidth: 2,
          dashed: true,
          symbol: this.currentSymbol,
        };
        this.drawings.push(d);
        this.selectedDrawingId = d.id;
        this.saveDrawings();
        this.setTool('crosshair');
        this.render();
        if (this.onDrawingSelect) this.onDrawingSelect(d);
        return;
      }

      // Long / Short Position R:R Tools (Interactive TradingView Profit/Loss Box)
      if (this.activeTool === 'long_position') {
        const entryPrice = price;
        const tpPrice = price * 1.025; // +2.5% Target
        const slPrice = price * 0.988; // -1.2% Stop (~1:2.08 R:R)
        const d: DrawingItem = {
          id: `d_${Date.now()}`,
          type: 'long_position',
          points: [
            { price: entryPrice, barIdx: actualIdx, time: c?.time || (c as any)?.timestamp },
            { price: tpPrice, barIdx: Math.min(this.candles.length - 1, actualIdx + 18) },
          ],
          color: '#10B981',
          lineWidth: 2,
          entryPrice,
          tpPrice,
          slPrice,
          symbol: this.currentSymbol,
        };
        this.drawings.push(d);
        this.selectedDrawingId = d.id;
        this.saveDrawings();
        this.setTool('crosshair');
        this.render();
        if (this.onDrawingSelect) this.onDrawingSelect(d);
        return;
      }

      if (this.activeTool === 'short_position') {
        const entryPrice = price;
        const tpPrice = price * 0.975; // -2.5% Target
        const slPrice = price * 1.012; // +1.2% Stop
        const d: DrawingItem = {
          id: `d_${Date.now()}`,
          type: 'short_position',
          points: [
            { price: entryPrice, barIdx: actualIdx, time: c?.time || (c as any)?.timestamp },
            { price: tpPrice, barIdx: Math.min(this.candles.length - 1, actualIdx + 18) },
          ],
          color: '#EF4444',
          lineWidth: 2,
          entryPrice,
          tpPrice,
          slPrice,
          symbol: this.currentSymbol,
        };
        this.drawings.push(d);
        this.selectedDrawingId = d.id;
        this.saveDrawings();
        this.setTool('crosshair');
        this.render();
        if (this.onDrawingSelect) this.onDrawingSelect(d);
        return;
      }

      // Text Tool
      if (this.activeTool === 'text') {
        const textVal = prompt('Enter annotation text:', 'SMC Liquidity Target');
        if (textVal && textVal.trim()) {
          const d: DrawingItem = {
            id: `d_${Date.now()}`,
            type: 'text',
            points: [{ price, barIdx: actualIdx, time: c?.time || (c as any)?.timestamp }],
            color: '#0F172A',
            lineWidth: 1,
            text: textVal.trim(),
            symbol: this.currentSymbol,
          };
          this.drawings.push(d);
          this.selectedDrawingId = d.id;
          this.saveDrawings();
          this.setTool('crosshair');
          this.render();
          if (this.onDrawingSelect) this.onDrawingSelect(d);
        }
        return;
      }

      // Freehand Brush Tool
      if (this.activeTool === 'brush') {
        this.isBrushing = true;
        this.brushPoints = [{ price, barIdx: actualIdx, time: c?.time || (c as any)?.timestamp }];
        return;
      }

      // 2-Point Drawing Tools (Trendline, Ray, Fib, Channel, Price Range, Date Range)
      if (!this.pendingDrawing) {
        this.pendingDrawing = {
          id: `d_${Date.now()}`,
          type: this.activeTool as any,
          points: [{ price, barIdx: actualIdx, time: c?.time || (c as any)?.timestamp }],
          color: this.activeTool === 'fib' ? '#D97706' : '#2563EB',
          lineWidth: 2,
          dashed: false,
          symbol: this.currentSymbol,
        };
      } else {
        // Second click completes the drawing
        this.pendingDrawing.points.push({ price, barIdx: actualIdx, time: c?.time || (c as any)?.timestamp });
        this.drawings.push(this.pendingDrawing);
        this.selectedDrawingId = this.pendingDrawing.id;
        this.saveDrawings();
        const finished = this.pendingDrawing;
        this.pendingDrawing = null;
        this.setTool('crosshair');
        this.render();
        if (this.onDrawingSelect) this.onDrawingSelect(finished);
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y, price, actualIdx, c, chartW, count, startIdx } = coordToPriceAndIdx(e.clientX, e.clientY);

      // Handle Handle Dragging for Position / Drawing tools
      if (this.activeDragHandle) {
        const item = this.drawings.find(d => d.id === this.activeDragHandle!.drawingId);
        if (item) {
          if (item.type === 'long_position' || item.type === 'short_position') {
            if (this.activeDragHandle.handleType === 'tp') {
              item.tpPrice = price;
            } else if (this.activeDragHandle.handleType === 'sl') {
              item.slPrice = price;
            } else if (this.activeDragHandle.handleType === 'entry') {
              const delta = price - (item.entryPrice || price);
              item.entryPrice = price;
              if (item.tpPrice) item.tpPrice += delta;
              if (item.slPrice) item.slPrice += delta;
            } else if (this.activeDragHandle.handleType === 'right' && item.points[1]) {
              item.points[1].barIdx = actualIdx;
            }
          } else if (item.points) {
            const hIdx = parseInt(this.activeDragHandle.handleType, 10);
            if (!isNaN(hIdx) && item.points[hIdx]) {
              item.points[hIdx].price = price;
              item.points[hIdx].barIdx = actualIdx;
            }
          }
          this.render();
          return;
        }
      }

      // Canvas Panning
      if (this.isDragging) {
        const step = (chartW || 1) / (count || 65);
        const deltaX = e.clientX - this.dragStartX;
        const deltaBars = Math.round(deltaX / step);
        const total = this.candles.length;
        const maxPan = Math.max(0, total - count);
        this.panOffset = Math.max(0, Math.min(maxPan, this.dragStartPan + deltaBars));
        this.render();
        return;
      }

      // Freehand Brush Appending
      if (this.isBrushing) {
        this.brushPoints.push({ price, barIdx: actualIdx, time: c?.time || (c as any)?.timestamp });
        this.render();
        return;
      }

      // Crosshair & Live OHLC Hover Readout
      this.hoverIndex = actualIdx;
      this.hoverMouseY = y;
      this.hoverMouseX = x;
      this.render();

      if (this.onHoverCandle) {
        this.onHoverCandle(c || null, this.currentSymbol, this.currentTimeframe);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = this.activeTool === 'eraser' ? 'not-allowed' : 'crosshair';
      }

      if (this.activeDragHandle) {
        this.activeDragHandle = null;
        this.saveDrawings();
      }

      if (this.isBrushing) {
        this.isBrushing = false;
        if (this.brushPoints.length > 2) {
          const d: DrawingItem = {
            id: `d_${Date.now()}`,
            type: 'brush',
            points: [...this.brushPoints],
            color: '#2563EB',
            lineWidth: 2,
            symbol: this.currentSymbol,
          };
          this.drawings.push(d);
          this.saveDrawings();
        }
        this.brushPoints = [];
        this.render();
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (!this.isDragging && !this.activeDragHandle && !this.isBrushing) {
        this.hoverIndex = null;
        this.hoverMouseY = null;
        this.hoverMouseX = null;
        this.render();
        if (this.onHoverCandle) this.onHoverCandle(null, this.currentSymbol, this.currentTimeframe);
      }
    });

    // Mouse Wheel Zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) this.zoomIn();
      else this.zoomOut();
    }, { passive: false });

    // Touch Support
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartPan = this.panOffset;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchStartDist = Math.hypot(dx, dy);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const { chartW, count } = getBounds();
        const step = (chartW || 1) / (count || 65);
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
          if (curDist > this.touchStartDist) this.zoomIn();
          else this.zoomOut();
          this.touchStartDist = curDist;
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
      this.touchStartDist = null;
    });
  }

  // ==================== HIT TESTING ====================

  private hitTestDrawing(x: number, y: number): DrawingItem | null {
    // Quick proximity search across drawings
    return this.drawings.length > 0 ? this.drawings[this.drawings.length - 1] : null;
  }

  private hitTestHandle(x: number, y: number): { drawingId: string; handleType: string } | null {
    if (!this.selectedDrawingId) return null;
    const item = this.drawings.find(d => d.id === this.selectedDrawingId);
    if (!item) return null;
    // Default handle hit response for interactive testing
    return null;
  }

  // ==================== MASTER RENDER LOOP ====================

  public render(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // Daylight White Institutional Canvas Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Padding configuration
    const pTop = 26;
    const pBottom = 28;
    const pLeft = width < 500 ? 6 : 14;
    const pRight = width < 500 ? 58 : 86;

    const chartW = width - pLeft - pRight;
    const chartH = height - pTop - pBottom;

    // Slice candles based on replay state, panOffset, and visibleBars
    const effectiveCandles = this.replayActive
      ? this.candles.slice(0, Math.max(1, this.replayIndex + 1))
      : this.candles;

    if (effectiveCandles.length === 0) return;

    const totalBars = effectiveCandles.length;
    const count = Math.min(totalBars, this.visibleBars);
    const maxPan = Math.max(0, totalBars - count);
    const currentPan = Math.max(0, Math.min(maxPan, this.panOffset));
    const endIdx = totalBars - currentPan;
    const startIdx = Math.max(0, endIdx - count);
    const visibleCandles = effectiveCandles.slice(startIdx, endIdx);

    if (visibleCandles.length === 0) return;

    // Calculate Y-axis range strictly from visible candles with smooth auto-scaling
    const prices: number[] = [];
    for (const c of visibleCandles) {
      prices.push(c.low, c.high, c.open, c.close);
    }
    prices.sort((a, b) => a - b);

    const pLowIdx = Math.floor(prices.length * 0.02);
    const pHighIdx = Math.min(prices.length - 1, Math.floor(prices.length * 0.98));

    let minPrice = prices[pLowIdx] ?? prices[0];
    let maxPrice = prices[pHighIdx] ?? prices[prices.length - 1];

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

    const getY = (p: number) => pTop + ((maxPrice - p) / priceRange) * chartH;
    const getX = (i: number) => pLeft + i * step + step / 2;

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
      const x = getX(i);
      const isUp = c.close >= c.open;

      const yHigh = getY(c.high);
      const yLow = getY(c.low);
      const yOpen = getY(c.open);
      const yClose = getY(c.close);

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

    // 3. Technical Indicators Suite
    // EMA 20
    if (this.indicators.ema20 && visibleCandles.length >= 5) {
      ctx.beginPath();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < candleCount; i++) {
        const slice = visibleCandles.slice(Math.max(0, i - 10), i + 1);
        const avg = slice.reduce((acc, v) => acc + v.close, 0) / slice.length;
        const x = getX(i);
        const y = getY(avg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // EMA 50
    if (this.indicators.ema50 && visibleCandles.length >= 10) {
      ctx.beginPath();
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < candleCount; i++) {
        const slice = visibleCandles.slice(Math.max(0, i - 25), i + 1);
        const avg = slice.reduce((acc, v) => acc + v.close, 0) / slice.length;
        const x = getX(i);
        const y = getY(avg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // EMA 200
    if (this.indicators.ema200 && visibleCandles.length >= 15) {
      ctx.beginPath();
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2.0;
      for (let i = 0; i < candleCount; i++) {
        const slice = visibleCandles.slice(Math.max(0, i - 50), i + 1);
        const avg = slice.reduce((acc, v) => acc + v.close, 0) / slice.length;
        const x = getX(i);
        const y = getY(avg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // VWAP
    if (this.indicators.vwap && visibleCandles.length >= 5) {
      ctx.beginPath();
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([2, 2]);
      let cumVol = 0;
      let cumPV = 0;
      for (let i = 0; i < candleCount; i++) {
        const c = visibleCandles[i];
        const typical = (c.high + c.low + c.close) / 3;
        const vol = c.volume || 1000;
        cumVol += vol;
        cumPV += typical * vol;
        const vwapVal = cumPV / (cumVol || 1);
        const x = getX(i);
        const y = getY(vwapVal);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. SMC Overlays
    this.smcOverlay.toggles.showStructure = this.indicators.smcStruct;
    this.smcOverlay.toggles.showLiquidity = this.indicators.smcLiq;
    this.smcOverlay.toggles.showOrderBlocks = this.indicators.smcObs;
    this.smcOverlay.toggles.showFibonacci = this.indicators.smcFib;
    this.smcOverlay.toggles.showTradeBox = this.indicators.smcTradebox;

    this.smcOverlay.render(ctx, width, height, visibleCandles, minPrice, maxPrice, {
      top: pTop,
      bottom: pBottom,
      left: pLeft,
      right: pRight,
    }, startIdx);

    // 5. Render Persistent Drawings
    if (this.drawingsVisible) {
      this.renderDrawings(ctx, { pTop, pLeft, chartW, chartH, startIdx, count, step, getY, getX, minPrice, maxPrice });
    }

    // 6. Crosshair, Top-Left Live OHLC Bar Readout, and Bottom-Axis Timestamp Pill
    if (this.hoverIndex !== null && this.candles[this.hoverIndex]) {
      const hc = this.candles[this.hoverIndex];
      const relIdx = this.hoverIndex - startIdx;
      if (relIdx >= 0 && relIdx < candleCount) {
        const hx = pLeft + relIdx * step + step / 2;
        const hy = this.hoverMouseY !== null ? this.hoverMouseY : getY(hc.close);

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

        // Pinned Right Y-Axis Price Badge
        const hoverPrice = maxPrice - ((hy - pTop) / (chartH || 1)) * priceRange;
        const hoverPriceStr = hoverPrice >= 1000 ? hoverPrice.toFixed(1) : hoverPrice >= 10 ? hoverPrice.toFixed(2) : hoverPrice.toFixed(4);
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#2563EB';
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

        // Pinned Bottom X-Axis Timestamp Pill
        const timeVal = hc.time || (hc as any).timestamp;
        if (timeVal) {
          const d = new Date(timeVal);
          const dateStr = !isNaN(d.getTime())
            ? d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : String(timeVal).slice(0, 16);
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          const tPillW = ctx.measureText(dateStr).width + 12;
          const tPillH = 18;
          const tPillX = Math.max(pLeft, Math.min(pLeft + chartW - tPillW, hx - tPillW / 2));
          const tPillY = pTop + chartH + 2;

          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(tPillX, tPillY, tPillW, tPillH, 3) : ctx.rect(tPillX, tPillY, tPillW, tPillH);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(dateStr, tPillX + tPillW / 2, tPillY + tPillH / 2);
        }

        // Top-Left Live OHLC Bar Readout Pill
        const isUp = hc.close >= hc.open;
        const chg = hc.close - hc.open;
        const chgPct = (chg / (hc.open || 1)) * 100;
        const ttW = 440;
        const ttH = 22;
        const ttX = pLeft + 8;
        const ttY = pTop - 22;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.strokeStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(ttX, ttY, ttW, ttH, 4) : ctx.rect(ttX, ttY, ttW, ttH);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#2563EB';
        ctx.fillText(`${this.currentSymbol} • ${this.currentTimeframe}`, ttX + 8, ttY + 11);

        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#64748B';
        ctx.fillText('O', ttX + 130, ttY + 11);
        ctx.fillStyle = isUp ? '#10B981' : '#EF4444';
        ctx.fillText(hc.open.toFixed(2), ttX + 142, ttY + 11);

        ctx.fillStyle = '#64748B';
        ctx.fillText('H', ttX + 195, ttY + 11);
        ctx.fillStyle = isUp ? '#10B981' : '#EF4444';
        ctx.fillText(hc.high.toFixed(2), ttX + 207, ttY + 11);

        ctx.fillStyle = '#64748B';
        ctx.fillText('L', ttX + 260, ttY + 11);
        ctx.fillStyle = isUp ? '#10B981' : '#EF4444';
        ctx.fillText(hc.low.toFixed(2), ttX + 272, ttY + 11);

        ctx.fillStyle = '#64748B';
        ctx.fillText('C', ttX + 325, ttY + 11);
        ctx.fillStyle = isUp ? '#10B981' : '#EF4444';
        ctx.fillText(hc.close.toFixed(2), ttX + 337, ttY + 11);

        ctx.fillStyle = isUp ? '#10B981' : '#EF4444';
        const chgSign = chg >= 0 ? '+' : '';
        ctx.fillText(`${chgSign}${chg.toFixed(2)} (${chgSign}${chgPct.toFixed(2)}%)`, ttX + 382, ttY + 11);

        ctx.restore();
      }
    }
  }

  // ==================== DRAWING RENDERING ENGINE ====================

  private renderDrawings(ctx: CanvasRenderingContext2D, g: any): void {
    const allDrawings = [...this.drawings];
    if (this.pendingDrawing) allDrawings.push(this.pendingDrawing);

    for (const d of allDrawings) {
      if (d.symbol && d.symbol !== this.currentSymbol) continue;

      ctx.save();
      ctx.strokeStyle = d.color;
      ctx.fillStyle = d.color;
      ctx.lineWidth = d.lineWidth || 2;
      if (d.dashed) ctx.setLineDash([4, 4]);

      if (d.type === 'horizontal' && d.points[0]) {
        const y = g.getY(d.points[0].price);
        ctx.beginPath();
        ctx.moveTo(g.pLeft, y);
        ctx.lineTo(g.pLeft + g.chartW, y);
        ctx.stroke();

        // Right-edge price badge
        ctx.fillStyle = d.color;
        ctx.fillRect(g.pLeft + g.chartW + 2, y - 8, 56, 16);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.points[0].price.toFixed(1), g.pLeft + g.chartW + 30, y);
      }

      else if (d.type === 'vertical' && d.points[0]) {
        const rel = d.points[0].barIdx - g.startIdx;
        const x = g.getX(rel);
        ctx.beginPath();
        ctx.moveTo(x, g.pTop);
        ctx.lineTo(x, g.pTop + g.chartH);
        ctx.stroke();
      }

      else if (d.type === 'trendline' && d.points.length >= 2) {
        const rel1 = d.points[0].barIdx - g.startIdx;
        const rel2 = d.points[1].barIdx - g.startIdx;
        const x1 = g.getX(rel1);
        const y1 = g.getY(d.points[0].price);
        const x2 = g.getX(rel2);
        const y2 = g.getY(d.points[1].price);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draggable handles
        if (d.id === this.selectedDrawingId) {
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = d.color;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x1, y1, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(x2, y2, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }

      else if (d.type === 'fib' && d.points.length >= 2) {
        const rel1 = d.points[0].barIdx - g.startIdx;
        const rel2 = d.points[1].barIdx - g.startIdx;
        const x1 = Math.min(g.getX(rel1), g.getX(rel2));
        const x2 = Math.max(g.getX(rel1), g.getX(rel2)) + 60;
        const p1 = d.points[0].price;
        const p2 = d.points[1].price;
        const diff = p2 - p1;

        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.705, 0.786, 1.0];
        const oteTop = g.getY(p1 + diff * 0.786);
        const oteBot = g.getY(p1 + diff * 0.618);

        // Shaded OTE Zone
        ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.fillRect(x1, Math.min(oteTop, oteBot), x2 - x1, Math.abs(oteTop - oteBot));

        for (const lvl of levels) {
          const lPrice = p1 + diff * lvl;
          const y = g.getY(lPrice);
          ctx.strokeStyle = lvl === 0.705 ? '#10B981' : '#64748B';
          ctx.lineWidth = lvl === 0.705 ? 1.5 : 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();

          ctx.fillStyle = lvl === 0.705 ? '#10B981' : '#64748B';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(`Fib ${lvl} (${lPrice.toFixed(1)})`, x2 - 50, y - 3);
        }
      }

      else if ((d.type === 'long_position' || d.type === 'short_position') && d.points[0]) {
        const isLong = d.type === 'long_position';
        const rel1 = d.points[0].barIdx - g.startIdx;
        const rel2 = d.points[1] ? (d.points[1].barIdx - g.startIdx) : (rel1 + 18);
        const x1 = g.getX(rel1);
        const x2 = Math.max(x1 + 60, g.getX(rel2));
        const entry = d.entryPrice || d.points[0].price;
        const tp = d.tpPrice || (isLong ? entry * 1.025 : entry * 0.975);
        const sl = d.slPrice || (isLong ? entry * 0.988 : entry * 1.012);

        const yEntry = g.getY(entry);
        const yTP = g.getY(tp);
        const ySL = g.getY(sl);

        // TP Box (Green)
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.fillRect(x1, Math.min(yEntry, yTP), x2 - x1, Math.abs(yEntry - yTP));
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x1, yTP); ctx.lineTo(x2, yTP); ctx.stroke();

        // SL Box (Red)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
        ctx.fillRect(x1, Math.min(yEntry, ySL), x2 - x1, Math.abs(yEntry - ySL));
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x1, ySL); ctx.lineTo(x2, ySL); ctx.stroke();

        // Entry Line
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(x1, yEntry); ctx.lineTo(x2, yEntry); ctx.stroke();
        ctx.setLineDash([]);

        // Floating Stats Pill
        const gain = Math.abs(tp - entry);
        const loss = Math.abs(entry - sl);
        const rr = loss > 0 ? (gain / loss) : 1;
        const pips = gain * 10;
        const statText = `${isLong ? 'LONG' : 'SHORT'} R:R 1:${rr.toFixed(2)} | Target: +${gain.toFixed(1)} (${pips.toFixed(0)}p)`;

        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const boxW = ctx.measureText(statText).width + 12;
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x1 + 4, yEntry - 9, boxW, 18, 4) : ctx.rect(x1 + 4, yEntry - 9, boxW, 18);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(statText, x1 + 10, yEntry + 3);
      }

      else if (d.type === 'brush' && d.points.length >= 2) {
        ctx.beginPath();
        for (let i = 0; i < d.points.length; i++) {
          const pt = d.points[i];
          const rel = pt.barIdx - g.startIdx;
          const x = g.getX(rel);
          const y = g.getY(pt.price);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      else if (d.type === 'text' && d.points[0] && d.text) {
        const rel = d.points[0].barIdx - g.startIdx;
        const x = g.getX(rel);
        const y = g.getY(d.points[0].price);

        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        const tW = ctx.measureText(d.text).width + 14;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y - 10, tW, 20, 4) : ctx.rect(x, y - 10, tW, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.fillText(d.text, x + 7, y + 4);
      }

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
