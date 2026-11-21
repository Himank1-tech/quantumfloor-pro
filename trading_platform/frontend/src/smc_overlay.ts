/**
 * Smart Money Concepts (SMC) & Multi-Timeframe Canvas Overlay Engine.
 * Clean, de-clustered institutional overlays modeled after TradingView Supercharts.
 * Pins sleek color-coded, collision-resolved price pills to the right-hand margin.
 */

import { SMCAnalysisReport, MTFSetupReport } from './api';

export interface SMCOverlayToggles {
  showStructure: boolean;    // BOS & CHoCH
  showLiquidity: boolean;    // BSL & SSL
  showOrderBlocks: boolean;  // OB & FVG
  showFibonacci: boolean;    // Fib OTE & 50% EQ
  showTradeBox: boolean;     // Active Entry/SL/TP Blueprint
}

export interface MarginTag {
  y: number;
  text: string;
  bgColor: string;
  textColor: string;
  priority: number;
}

export class SMCOverlayRenderer {
  public toggles: SMCOverlayToggles = {
    showStructure: true,
    showLiquidity: true,
    showOrderBlocks: true,
    showFibonacci: true,
    showTradeBox: true,
  };

  private smcData: SMCAnalysisReport | null = null;
  private mtfData: MTFSetupReport | null = null;

  public setData(smc: SMCAnalysisReport | null, mtf: MTFSetupReport | null) {
    this.smcData = smc;
    this.mtfData = mtf;
  }

  /**
   * Non-overlapping right-axis tag layout algorithm.
   * Resolves vertical collisions between tags using priority-weighted iterative relaxation.
   */
  private resolveTagOverlaps(
    tags: MarginTag[],
    minY: number,
    maxY: number,
    minDistance: number = 20
  ): Array<MarginTag & { actualY: number }> {
    if (tags.length === 0) return [];

    // Map to layout items and sort by target Y coordinate ascending (top to bottom)
    const items = tags
      .map((t) => ({ ...t, actualY: t.y }))
      .sort((a, b) => a.y - b.y);

    const n = items.length;
    const maxIterations = 30;

    for (let iter = 0; iter < maxIterations; iter++) {
      let hasOverlap = false;

      for (let i = 0; i < n - 1; i++) {
        const cur = items[i];
        const next = items[i + 1];
        const overlap = minDistance - (next.actualY - cur.actualY);

        if (overlap > 0) {
          hasOverlap = true;
          const pCur = Math.max(1, cur.priority || 50);
          const pNext = Math.max(1, next.priority || 50);
          const sumP = pCur + pNext;
          const shiftCur = overlap * (pNext / sumP);
          const shiftNext = overlap * (pCur / sumP);

          cur.actualY -= shiftCur;
          next.actualY += shiftNext;
        }
      }

      // Constrain within bounds
      if (items[0].actualY < minY) {
        items[0].actualY = minY;
      }
      for (let i = 1; i < n; i++) {
        if (items[i].actualY < items[i - 1].actualY + minDistance) {
          items[i].actualY = items[i - 1].actualY + minDistance;
        }
      }
      if (items[n - 1].actualY > maxY) {
        items[n - 1].actualY = maxY;
        for (let i = n - 2; i >= 0; i--) {
          if (items[i].actualY > items[i + 1].actualY - minDistance) {
            items[i].actualY = items[i + 1].actualY - minDistance;
          }
        }
      }

      if (!hasOverlap) break;
    }

    // Final boundary clamp
    for (let i = 0; i < n; i++) {
      items[i].actualY = Math.max(minY, Math.min(maxY, items[i].actualY));
    }

    return items;
  }

  /**
   * Helper to draw a sleek, rounded price pill pinned to the right margin with connector if shifted.
   */
  private drawMarginPill(
    ctx: CanvasRenderingContext2D,
    actualY: number,
    targetY: number,
    text: string,
    bgColor: string,
    textColor: string,
    width: number,
    pRight: number
  ) {
    ctx.save();
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    const textMetrics = ctx.measureText(text);
    const pillW = Math.max(textMetrics.width + 12, 64);
    const pillH = 17;
    const pillX = width - pRight + 4;
    const pillY = Math.round(actualY - pillH / 2);

    // If displaced vertically by >= 3px, draw an elegant connecting hairline
    if (Math.abs(actualY - targetY) >= 3) {
      ctx.save();
      ctx.strokeStyle = bgColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(width - pRight, targetY);
      ctx.lineTo(pillX, actualY);
      ctx.stroke();
      ctx.restore();
    }

    // Pill background with rounded corners
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(pillX, pillY, pillW, pillH, 3) : ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pill Text
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pillX + pillW / 2, pillY + pillH / 2 + 0.5);
    ctx.restore();
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    candles: any[],
    minPrice: number,
    maxPrice: number,
    padding: { top: number; bottom: number; left: number; right: number },
    startIdx: number = 0
  ) {
    if (!candles || candles.length === 0 || maxPrice <= minPrice) return;

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const priceRange = maxPrice - minPrice;

    // Coordinate conversion helpers with startIdx offset for multi-day panning
    const getX = (absIndex: number): number => {
      const step = chartW / candles.length;
      const relIdx = absIndex - startIdx;
      return padding.left + relIdx * step + step / 2;
    };

    const getY = (price: number): number => {
      const normalized = (price - minPrice) / priceRange;
      return padding.top + chartH * (1 - normalized);
    };

    // Queue of strictly the top 4 active margin tags (Live Price, ENTRY, SL, TP1)
    const tags: MarginTag[] = [];

    ctx.save();

    // 1. Auto-Fibonacci Golden Pocket & 50% Equilibrium Line (Labels rendered cleanly inside chart)
    if (this.toggles.showFibonacci && this.smcData?.fibonacci) {
      const fib = this.smcData.fibonacci;
      const eqY = getY(fib.equilibrium_price);
      const oteTopY = getY(fib.ote_pocket_high);
      const oteBotY = getY(fib.ote_pocket_low);

      // Shaded OTE Golden Pocket
      ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
      ctx.fillRect(padding.left, Math.min(oteTopY, oteBotY), chartW, Math.abs(oteBotY - oteTopY));

      // 50% Equilibrium Line
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, eqY);
      ctx.lineTo(width - padding.right, eqY);
      ctx.stroke();

      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748B';
      ctx.fillText('50% EQUILIBRIUM', padding.left + 14, eqY - 4);

      // OTE Sweet Spot (0.705)
      const sweetY = getY(fib.ote_sweet_spot);
      ctx.strokeStyle = '#D97706';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(padding.left, sweetY);
      ctx.lineTo(width - padding.right, sweetY);
      ctx.stroke();

      ctx.fillStyle = '#D97706';
      ctx.fillText('FIB OTE 0.705 SWEET-SPOT', padding.left + 14, sweetY - 4);
      ctx.setLineDash([]);
    }

    // 2. Order Blocks (OB) & Fair Value Gaps (FVG) - Labels rendered cleanly INSIDE the chart canvas
    if (this.toggles.showOrderBlocks && this.smcData?.poi) {
      const poi = this.smcData.poi;

      // Order Blocks (last 2 max)
      const activeOBs = poi.order_blocks.slice(-2);
      for (const ob of activeOBs) {
        const topY = getY(ob.top);
        const botY = getY(ob.bottom);
        const obH = Math.max(3, Math.abs(botY - topY));
        const rawStartX = getX(Math.max(0, ob.candle_index));
        const startX = Math.max(padding.left, rawStartX);
        const isDemand = ob.block_type === 'BULLISH_DEMAND';

        ctx.fillStyle = isDemand ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
        ctx.strokeStyle = isDemand ? '#059669' : '#DC2626';
        ctx.lineWidth = ob.is_mitigated ? 1 : 1.5;
        ctx.setLineDash(ob.is_mitigated ? [3, 3] : []);

        const obWidth = Math.max(0, width - padding.right - startX);
        if (obWidth > 0 && rawStartX <= width - padding.right) {
          ctx.fillRect(startX, Math.min(topY, botY), obWidth, obH);
          ctx.strokeRect(startX, Math.min(topY, botY), obWidth, obH);

          // Render OB Label cleanly inside canvas (no colliding margin pills)
          if (obWidth > 30) {
            ctx.save();
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.fillStyle = isDemand ? '#059669' : '#DC2626';
            const labelX = Math.max(padding.left + 6, startX + 6);
            const labelY = Math.min(topY, botY) + 11;
            ctx.fillText(isDemand ? 'DEMAND OB (92%+)' : 'SUPPLY OB (94%+)', labelX, labelY);
            ctx.restore();
          }
        }
      }

      // FVGs (last 2 max)
      const activeFVGs = poi.unmitigated_fvgs.slice(-2);
      for (const fvg of activeFVGs) {
        const topY = getY(fvg.top);
        const botY = getY(fvg.bottom);
        const fvgH = Math.max(3, Math.abs(botY - topY));
        const rawStartX = getX(Math.max(0, fvg.candle_index));
        const startX = Math.max(padding.left, rawStartX);
        const isBull = fvg.direction === 'BULLISH';

        ctx.fillStyle = isBull ? 'rgba(37, 99, 235, 0.10)' : 'rgba(217, 119, 6, 0.10)';
        ctx.strokeStyle = isBull ? '#2563EB' : '#D97706';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        const fvgWidth = Math.max(0, width - padding.right - startX);
        if (fvgWidth > 0 && rawStartX <= width - padding.right) {
          ctx.fillRect(startX, Math.min(topY, botY), fvgWidth, fvgH);
          ctx.strokeRect(startX, Math.min(topY, botY), fvgWidth, fvgH);

          const ceY = getY(fvg.midpoint_consequent_encroachment);
          ctx.beginPath();
          ctx.moveTo(startX, ceY);
          ctx.lineTo(width - padding.right, ceY);
          ctx.stroke();

          // Render FVG Label cleanly inside canvas (no colliding margin pills)
          if (fvgWidth > 30) {
            ctx.save();
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.fillStyle = isBull ? '#2563EB' : '#D97706';
            const labelX = Math.max(padding.left + 6, startX + 6);
            const labelY = Math.min(topY, botY) + 11;
            ctx.fillText(isBull ? 'BULLISH FVG (90%+)' : 'BEARISH FVG (90%+)', labelX, labelY);
            ctx.fillText('50% CE', labelX, ceY - 3);
            ctx.restore();
          }
        }
      }
      ctx.setLineDash([]);
    }

    // 3. Liquidity Pools (BSL & SSL) - Labels rendered cleanly inside canvas along line
    if (this.toggles.showLiquidity && this.smcData?.poi) {
      const poi = this.smcData.poi;

      if (poi.bsl_pools.length > 0) {
        const bsl = poi.bsl_pools[poi.bsl_pools.length - 1];
        const bslY = getY(bsl.price_level);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);

        ctx.beginPath();
        ctx.moveTo(padding.left, bslY);
        ctx.lineTo(width - padding.right, bslY);
        ctx.stroke();

        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#DC2626';
        ctx.fillText('BSL POOL • Buy-Side External Liquidity', padding.left + 14, bslY - 4);
      }

      if (poi.ssl_pools.length > 0) {
        const ssl = poi.ssl_pools[poi.ssl_pools.length - 1];
        const sslY = getY(ssl.price_level);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);

        ctx.beginPath();
        ctx.moveTo(padding.left, sslY);
        ctx.lineTo(width - padding.right, sslY);
        ctx.stroke();

        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#059669';
        ctx.fillText('SSL POOL • Sell-Side Internal Liquidity', padding.left + 14, sslY - 4);
      }
      ctx.setLineDash([]);
    }

    // 4. Market Structure (BOS & CHoCH) - Last 2 breaks max with neat indicators
    if (this.toggles.showStructure && this.smcData?.structure) {
      const st = this.smcData.structure;
      const breaks = st.structure_breaks.slice(-2);

      for (const brk of breaks) {
        const brkY = getY(brk.broken_swing_price);
        const endX = getX(Math.min(candles.length - 1, brk.candle_index));
        const startX = Math.max(padding.left, endX - 100);

        const isBos = brk.structure_type === 'BOS';
        const isBull = brk.direction === 'BULLISH';
        const color = isBos ? '#00e5ff' : '#f59e0b';

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash(isBos ? [] : [3, 3]);

        ctx.beginPath();
        ctx.moveTo(startX, brkY);
        ctx.lineTo(endX, brkY);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(endX, brkY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        const badgeText = `${brk.structure_type} ${isBull ? '▲' : '▼'}`;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = color;
        ctx.fillText(badgeText, endX - 42, isBull ? brkY - 6 : brkY + 12);
      }
      ctx.setLineDash([]);
    }

    // 5. Active MTF Trade Blueprint Box (TradingView-style two-tone rectangle & SL/TP tags)
    if (this.toggles.showTradeBox && this.mtfData?.blueprint) {
      const bp = this.mtfData.blueprint;
      const entryY = getY(bp.entry_price);
      const slY = getY(bp.stop_loss);
      const tp1Y = getY(bp.take_profit_1);

      const boxW = Math.min(220, chartW * 0.35);
      const boxX = width - padding.right - boxW;

      // Risk Box (Entry to SL - Crimson soft fill)
      const riskH = Math.abs(slY - entryY);
      const riskTop = Math.min(entryY, slY);
      ctx.fillStyle = 'rgba(255, 59, 107, 0.14)';
      ctx.fillRect(boxX, riskTop, boxW, riskH);
      ctx.strokeStyle = 'rgba(255, 59, 107, 0.60)';
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, riskTop, boxW, riskH);

      // Reward Box (Entry to TP1 - Neon Emerald soft fill)
      const rewardH = Math.abs(tp1Y - entryY);
      const rewardTop = Math.min(entryY, tp1Y);
      ctx.fillStyle = 'rgba(0, 230, 118, 0.14)';
      ctx.fillRect(boxX, rewardTop, boxW, rewardH);
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.60)';
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, rewardTop, boxW, rewardH);

      // Entry Horizontal Ray
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(boxX - 20, entryY);
      ctx.lineTo(width - padding.right, entryY);
      ctx.stroke();
      ctx.setLineDash([]);

      const slFormatted = bp.stop_loss >= 100 ? bp.stop_loss.toFixed(1) : bp.stop_loss.toFixed(4);
      tags.push({ y: entryY, text: 'ENTRY', bgColor: '#2563EB', textColor: '#FFFFFF', priority: 100 });
      tags.push({ y: slY, text: `SL ${slFormatted}`, bgColor: '#DC2626', textColor: '#FFFFFF', priority: 100 });
      tags.push({ y: tp1Y, text: `TP1 1:${bp.risk_reward_1}`, bgColor: '#059669', textColor: '#FFFFFF', priority: 95 });
    }

    // 6. Live Current Price Tag from Last Candle
    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      const liveY = getY(last.close);
      const isUp = last.close >= last.open;
      const priceFormatted = last.close >= 100 ? last.close.toFixed(2) : last.close.toFixed(4);

      tags.push({
        y: liveY,
        text: priceFormatted,
        bgColor: isUp ? '#059669' : '#DC2626',
        textColor: '#FFFFFF',
        priority: 120, // highest priority
      });

      // Subtle horizontal dashed line across chart
      ctx.save();
      ctx.strokeStyle = isUp ? 'rgba(0, 230, 118, 0.55)' : 'rgba(255, 59, 107, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, liveY);
      ctx.lineTo(width - padding.right, liveY);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Non-Overlapping Layout & Rendering Pass for All Right-Axis Tags
    const minY = padding.top + 8;
    const maxY = height - padding.bottom - 8;
    const resolvedTags = this.resolveTagOverlaps(tags, minY, maxY, 20);

    for (const tag of resolvedTags) {
      this.drawMarginPill(ctx, tag.actualY, tag.y, tag.text, tag.bgColor, tag.textColor, width, padding.right);
    }

    ctx.restore();
  }
}
