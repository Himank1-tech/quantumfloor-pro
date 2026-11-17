"""
Floor Manager: Multi-Agent Orchestrator and Consensus Coordinator.
Directs dual-agent debates (Bull vs. Bear) with MCP tool access, synthesizes consensus,
submits proposals to the Risk Governor, and executes approved orders.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import uuid
import datetime
import math
import os
from .mcp_servers import TradingMCPServer
from ..risk.governor import RiskGovernor, RiskAssessmentResult
from ..brokers.base import OrderSide, OrderType, AssetClass

try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


class AgentDebateResult(BaseModel):
    debate_id: str
    symbol: str
    asset_class: str
    timestamp: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    bull_thesis: Dict[str, Any]
    bear_thesis: Dict[str, Any]
    consensus_score: float  # -1.0 (Extreme Bear) to +1.0 (Extreme Bull)
    signal: str            # STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
    action: str            # BUY, SELL, HOLD
    confidence_pct: float
    current_price: float
    recommended_entry: float
    stop_loss: float
    take_profit: float
    risk_reward_ratio: float
    proposed_quantity: float
    executive_rationale: str
    risk_assessment: Optional[Dict[str, Any]] = None
    execution_result: Optional[Dict[str, Any]] = None


class FloorManager:
    """
    Chief Investment Officer & Multi-Agent Floor Orchestrator.
    """

    def __init__(
        self,
        mcp_server: TradingMCPServer,
        risk_governor: RiskGovernor,
        indian_broker=None,
        forex_broker=None,
        database=None,
    ):
        self.mcp = mcp_server
        self.risk_governor = risk_governor
        self.indian_broker = indian_broker
        self.forex_broker = forex_broker
        self.database = database
        self.recent_debates: List[AgentDebateResult] = []
        self.is_auto_trading_enabled: bool = True

        self.gemini_client = None
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if HAS_GENAI and gemini_key:
            try:
                self.gemini_client = genai.Client(api_key=gemini_key)
            except Exception:
                self.gemini_client = None

    def set_auto_trading(self, enabled: bool) -> bool:
        self.is_auto_trading_enabled = enabled
        return self.is_auto_trading_enabled

    def conduct_debate(
        self,
        symbol: str,
        asset_class: Optional[str] = None,
        force_execute: bool = False,
    ) -> AgentDebateResult:
        """
        Orchestrate full 3-Tier Pipeline:
        Layer 1: Gather MCP data & execute adversarial Bull vs Bear debate.
        Layer 2: Run proposed order through Risk Governor.
        Layer 3: Execute trade if risk approved.
        """
        symbol = symbol.upper()
        if not asset_class:
            asset_class = "INDIAN_EQUITY" if "/" not in symbol else "FOREX"

        # 1. MCP Data Ingestion
        quote = self.mcp.get_live_quote(symbol)
        order_book = self.mcp.get_order_book_depth(symbol)
        technicals = self.mcp.get_technical_indicators(symbol, timeframe="1m")
        news = self.mcp.get_market_news_sentiment(symbol)
        portfolio = self.mcp.get_portfolio_exposure()

        current_price = technicals["current_price"]
        rsi = technicals["rsi_14"]
        ema20 = technicals["ema_20"]
        ema50 = technicals["ema_50"]
        macd_hist = technicals["macd"]["histogram"]
        bb = technicals["bollinger_bands"]
        atr = technicals["atr_14"]
        imbalance = order_book["order_book_imbalance"]
        macro_sentiment = news["macro_sentiment_score"]

        # 2. Bull Strategist Analysis
        bull_arguments = []
        bull_score = 50.0  # baseline

        if current_price > ema20:
            bull_arguments.append(f"Price ({current_price:.2f}) trading above 20 EMA ({ema20:.2f}), confirming intraday trend momentum.")
            bull_score += 15.0
        if rsi < 35.0:
            bull_arguments.append(f"RSI-14 is in deeply oversold territory ({rsi:.1f}), signaling high-probability mean reversion bounce.")
            bull_score += 15.0
        elif 50.0 <= rsi <= 65.0:
            bull_arguments.append(f"RSI-14 ({rsi:.1f}) displays healthy bullish continuation without overbought exhaustion.")
            bull_score += 10.0

        if macd_hist > 0:
            bull_arguments.append(f"MACD histogram positive (+{macd_hist:.4f}), indicating accelerating upward momentum.")
            bull_score += 12.0

        if imbalance > 0.05:
            bull_arguments.append(f"Order book displays bid dominance (Liquidity imbalance: +{imbalance * 100.0:.1f}%), indicating institutional bid absorption.")
            bull_score += 12.0

        if macro_sentiment > 0.1:
            bull_arguments.append(f"Macro sentiment is supportive (+{macro_sentiment:.2f}) with favorable domestic policy and economic stability.")
            bull_score += 10.0

        bull_conviction = min(98.0, max(10.0, bull_score))
        bull_target = round(current_price + (2.0 * atr), 4)
        bull_invalidation = round(current_price - (1.2 * atr), 4)

        bull_thesis = {
            "agent": "Senior Bull Strategist",
            "conviction_pct": round(bull_conviction, 1),
            "key_arguments": bull_arguments or ["Accumulation detected near technical support bands."],
            "target_price": bull_target,
            "invalidation_price": bull_invalidation,
            "catalyst": "Momentum continuation with order book bid absorption.",
        }

        # 3. Bear Strategist Analysis
        bear_arguments = []
        bear_score = 50.0

        if current_price < ema50:
            bear_arguments.append(f"Price ({current_price:.2f}) is suppressed below 50 EMA ({ema50:.2f}), confirming medium-term trend degradation.")
            bear_score += 15.0
        if rsi > 68.0:
            bear_arguments.append(f"RSI-14 ({rsi:.1f}) is heavily overbought; risk of immediate buyer exhaustion and sharp pullback.")
            bear_score += 18.0
        elif 35.0 <= rsi < 48.0:
            bear_arguments.append(f"RSI-14 ({rsi:.1f}) remains trapped below midline, indicating lack of institutional buy demand.")
            bear_score += 10.0

        if macd_hist < 0:
            bear_arguments.append(f"MACD histogram in negative territory ({macd_hist:.4f}), reinforcing distribution pressure.")
            bear_score += 12.0

        if imbalance < -0.05:
            bear_arguments.append(f"Order book shows strong ask wall resistance (Imbalance: {imbalance * 100.0:.1f}%), sellers capping upside.")
            bear_score += 12.0

        if current_price >= bb["upper"] * 0.998:
            bear_arguments.append(f"Price testing upper Bollinger Band ({bb['upper']:.2f}), presenting elevated mean-reversion risk.")
            bear_score += 10.0

        bear_conviction = min(98.0, max(10.0, bear_score))
        bear_target = round(current_price - (2.0 * atr), 4)
        bear_invalidation = round(current_price + (1.2 * atr), 4)

        bear_thesis = {
            "agent": "Senior Bear Strategist",
            "conviction_pct": round(bear_conviction, 1),
            "key_arguments": bear_arguments or ["Exhaustion near upper resistance bands."],
            "target_price": bear_target,
            "invalidation_price": bear_invalidation,
            "catalyst": "Overhead supply resistance with momentum distribution.",
        }

        # 4. Floor Manager Synthesis & Consensus Calculation
        # Raw consensus score: -1.0 to +1.0
        delta_conviction = (bull_conviction - bear_conviction) / 100.0
        consensus_score = (delta_conviction * 0.6) + (imbalance * 0.25) + (macro_sentiment * 0.15)
        consensus_score = max(-1.0, min(1.0, round(consensus_score, 3)))

        if consensus_score >= 0.50:
            signal = "STRONG_BUY"
            action = "BUY"
        elif consensus_score >= 0.20:
            signal = "BUY"
            action = "BUY"
        elif consensus_score <= -0.50:
            signal = "STRONG_SELL"
            action = "SELL"
        elif consensus_score <= -0.20:
            signal = "SELL"
            action = "SELL"
        else:
            signal = "NEUTRAL"
            action = "HOLD"

        confidence_pct = round(abs(consensus_score) * 100.0, 1)

        # Structure Entry, Stop-Loss, and Take-Profit
        if action == "BUY":
            recommended_entry = current_price
            stop_loss = round(current_price - (1.5 * atr), 4)
            take_profit = round(current_price + (3.0 * atr), 4)
            risk = current_price - stop_loss
            reward = take_profit - current_price
            rr_ratio = round(reward / risk, 2) if risk > 0 else 2.0
            rationale = (
                f"Consensus BUY (+{confidence_pct:.1f}% confidence). Bull thesis dominated with {bull_conviction:.1f}% conviction vs {bear_conviction:.1f}% bear resistance. "
                f"Targeting {take_profit:.2f} with protective stop at {stop_loss:.2f} (R:R 1:{rr_ratio:.2f})."
            )
        elif action == "SELL":
            recommended_entry = current_price
            stop_loss = round(current_price + (1.5 * atr), 4)
            take_profit = round(current_price - (3.0 * atr), 4)
            risk = stop_loss - current_price
            reward = current_price - take_profit
            rr_ratio = round(reward / risk, 2) if risk > 0 else 2.0
            rationale = (
                f"Consensus SELL (-{confidence_pct:.1f}% conviction). Bear defense confirmed breakdown below moving average support with {bear_conviction:.1f}% conviction. "
                f"Targeting downside {take_profit:.2f} with risk stop at {stop_loss:.2f} (R:R 1:{rr_ratio:.2f})."
            )
        else:
            recommended_entry = current_price
            stop_loss = round(current_price * 0.985, 4)
            take_profit = round(current_price * 1.03, 4)
            rr_ratio = 2.0
            rationale = f"Consensus NEUTRAL (Score {consensus_score:+.2f}). Bull and Bear forces balanced. Quantitative mandate requires preserving capital on sidelines."

        # Optional Gemini Generative Synthesis
        if self.gemini_client:
            try:
                gen_prompt = (
                    f"Symbol: {symbol} ({asset_class}), Price: {current_price}, RSI-14: {rsi:.1f}, "
                    f"Order Book Skew: {imbalance * 100:+.1f}%, Action: {action}. Provide a 1-sentence institutional CIO rationale."
                )
                res = self.gemini_client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=gen_prompt,
                )
                if res.text:
                    rationale = f"{rationale} [Gemini CIO Insight: {res.text.strip()}]"
            except Exception:
                pass

        # Estimate proposed quantity
        nav = portfolio.get("total_nav_inr", 3_000_000.0) if asset_class == "INDIAN_EQUITY" else portfolio.get("usd_equity", 25_000.0)
        # Allocate nominally 5% of NAV
        target_allocation_val = nav * 0.05
        if asset_class == "INDIAN_EQUITY":
            proposed_quantity = max(1.0, math.floor(target_allocation_val / current_price))
        else:
            # Forex units (e.g. 10,000 to 50,000 units)
            proposed_quantity = max(1000.0, round(target_allocation_val * 10, -2))

        debate_id = f"DEBATE-{uuid.uuid4().hex[:8].upper()}"
        risk_result: Optional[RiskAssessmentResult] = None
        execution_dict: Optional[Dict[str, Any]] = None

        # 5. Layer 2: Deterministic Quantitative Risk Governor Validation
        if action in ("BUY", "SELL"):
            # Current asset exposure
            current_exposure = 0.0
            if asset_class == "INDIAN_EQUITY" and self.indian_broker:
                pos = self.indian_broker.positions.get(symbol)
                if pos:
                    current_exposure = abs(pos.quantity * pos.current_price)
            elif asset_class == "FOREX" and self.forex_broker:
                pos = self.forex_broker.positions.get(symbol)
                if pos:
                    current_exposure = abs(pos.quantity)

            risk_result = self.risk_governor.validate_trade_proposal(
                symbol=symbol,
                asset_class=asset_class,
                side=action,
                proposed_quantity=proposed_quantity,
                price=current_price,
                total_portfolio_nav=nav,
                current_asset_exposure=current_exposure,
                current_volatility_ratio=technicals.get("volatility_ratio", 1.0),
                win_rate=max(0.40, min(0.75, (confidence_pct / 100.0))),
                payoff_ratio=rr_ratio,
                stop_loss=stop_loss,
                take_profit=take_profit,
            )

            # 6. Layer 3: Broker Execution (if auto trading is enabled and risk governor approved)
            if risk_result.approved and (self.is_auto_trading_enabled or force_execute):
                order_side = OrderSide.BUY if action == "BUY" else OrderSide.SELL
                approved_qty = risk_result.approved_quantity

                if asset_class == "INDIAN_EQUITY" and self.indian_broker:
                    broker_res = self.indian_broker.place_order(
                        symbol=symbol,
                        side=order_side,
                        order_type=OrderType.MARKET,
                        quantity=approved_qty,
                        price=current_price,
                        stop_loss=stop_loss,
                        take_profit=take_profit,
                        tag=f"AI_DEBATE_{debate_id}",
                    )
                    execution_dict = {
                        "success": broker_res.success,
                        "message": broker_res.message,
                        "order": broker_res.order.model_dump() if broker_res.order else None,
                    }
                elif asset_class == "FOREX" and self.forex_broker:
                    broker_res = self.forex_broker.place_order(
                        symbol=symbol,
                        side=order_side,
                        order_type=OrderType.MARKET,
                        quantity=approved_qty,
                        price=current_price,
                        stop_loss=stop_loss,
                        take_profit=take_profit,
                        tag=f"AI_DEBATE_{debate_id}",
                    )
                    execution_dict = {
                        "success": broker_res.success,
                        "message": broker_res.message,
                        "order": broker_res.order.model_dump() if broker_res.order else None,
                    }

        debate_record = AgentDebateResult(
            debate_id=debate_id,
            symbol=symbol,
            asset_class=asset_class,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            bull_thesis=bull_thesis,
            bear_thesis=bear_thesis,
            consensus_score=consensus_score,
            signal=signal,
            action=action,
            confidence_pct=confidence_pct,
            current_price=current_price,
            recommended_entry=recommended_entry,
            stop_loss=stop_loss,
            take_profit=take_profit,
            risk_reward_ratio=rr_ratio,
            proposed_quantity=proposed_quantity,
            executive_rationale=rationale,
            risk_assessment=risk_result.model_dump() if risk_result else None,
            execution_result=execution_dict,
        )

        self.recent_debates.insert(0, debate_record)
        if len(self.recent_debates) > 50:
            self.recent_debates.pop()

        if self.database and hasattr(self.database, "save_debate"):
            self.database.save_debate(debate_record.model_dump())

        return debate_record

    def get_recent_debates(self, limit: int = 20, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        debates = self.recent_debates
        if symbol:
            clean_sym = symbol.upper()
            debates = [d for d in debates if d.symbol.upper() == clean_sym]
        return [d.model_dump() for d in debates[:limit]]

    def get_debate_for_symbol(self, symbol: str) -> AgentDebateResult:
        clean_sym = symbol.upper()
        for d in self.recent_debates:
            if d.symbol.upper() == clean_sym:
                return d
        # If not present in memory, conduct debate immediately for this symbol
        return self.conduct_debate(symbol=clean_sym)
