"""
Comprehensive Test Suite for QuantumFloor Pro.
Tests Live Market Data, SMC Institutional Suite, MTF Confluence,
Sessions & Killzones, Forex Factory News, Precision Pip/Lot Calculator,
AI Co-Pilot, and Backtesting Lab.
"""

import asyncio
import sys
import os

# Ensure repository root is in python path
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from trading_platform.backend.market_data.live_feed import live_market_feed, SYMBOL_MAPPINGS
from trading_platform.backend.market_data.historical import historical_candle_loader
from trading_platform.backend.smc.structure import detect_market_structure
from trading_platform.backend.smc.liquidity import detect_liquidity_and_poi
from trading_platform.backend.smc.fibonacci import calculate_auto_fibonacci
from trading_platform.backend.smc.candlesticks import detect_candlestick_patterns
from trading_platform.backend.smc.mtf_confluence import synthesize_mtf_setup
from trading_platform.backend.macro.sessions import get_session_status
from trading_platform.backend.macro.news_calendar import get_economic_calendar
from trading_platform.backend.execution.position_calculator import calculate_position_size, PositionInput
from trading_platform.backend.copilot.ai_advisor_chat import get_copilot_response, AICopilotRequest
from trading_platform.backend.backtest.replay_engine import backtest_engine, BacktestRequest
from trading_platform.backend.investors.wealth_baskets import wealth_baskets_engine


async def run_all_pro_tests():
    print("================================================================================")
    print("           QUANTUMFLOOR PRO: COMPREHENSIVE INSTITUTIONAL TEST SUITE             ")
    print("================================================================================")

    # 1. Market Data
    print("\n[1/8] Testing Live Market Feed & Multi-Timeframe Historical Candles...")
    quotes = await live_market_feed.get_all_quotes()
    assert len(quotes) >= 10, f"Expected at least 10 live quotes, got {len(quotes)}"
    rel_quote = await live_market_feed.fetch_real_quote("RELIANCE")
    assert rel_quote.price > 0, "Reliance price should be positive"
    fx_quote = await live_market_feed.fetch_real_quote("EUR/USD")
    assert fx_quote.price > 0, "EUR/USD price should be positive"

    candles_15m = await historical_candle_loader.get_candles("RELIANCE", timeframe="15M", limit=50)
    assert len(candles_15m) == 50, f"Expected 50 candles, got {len(candles_15m)}"
    candles_4h = await historical_candle_loader.get_candles("EUR/USD", timeframe="4H", limit=40)
    assert len(candles_4h) >= 30, f"Expected at least 30 4H candles, got {len(candles_4h)}"
    print(f"  [PASS] Live quotes loaded: {len(quotes)} symbols. RELIANCE: {rel_quote.price}, EUR/USD: {fx_quote.price}")

    # 2. SMC Structure, Liquidity & Fibonacci
    print("\n[2/8] Testing SMC Structure, Liquidity POIs, and Auto-Fibonacci...")
    struct = detect_market_structure(candles_15m, pivot_depth=2)
    assert struct.active_trend in ("BULLISH", "BEARISH", "RANGING")
    poi = detect_liquidity_and_poi(candles_15m)
    assert len(poi.bsl_pools) > 0, "Expected BSL pools"
    assert len(poi.ssl_pools) > 0, "Expected SSL pools"

    fib = calculate_auto_fibonacci(candles_15m, struct.swing_highs, struct.swing_lows, active_trend=struct.active_trend)
    assert fib.equilibrium_price > 0, "Equilibrium price must be positive"
    assert len(fib.levels) == 10, f"Expected 10 Fib levels, got {len(fib.levels)}"

    patterns = detect_candlestick_patterns(candles_15m)
    print(f"  [PASS] SMC detected: Trend={struct.active_trend}, BSL pools={len(poi.bsl_pools)}, "
          f"OBs={len(poi.order_blocks)}, FVGs={len(poi.fair_value_gaps)}, Fib EQ={fib.equilibrium_price:.2f}, Patterns={len(patterns)}")

    # 3. MTF 4-Step Confluence Engine
    print("\n[3/8] Testing Multi-Timeframe (MTF) 4-Step Confluence Engine...")
    mtf_setup = await synthesize_mtf_setup("RELIANCE")
    assert mtf_setup.blueprint is not None, "Trade blueprint must be generated"
    assert mtf_setup.blueprint.risk_reward_1 >= 1.5, f"R:R must be >= 1.5, got {mtf_setup.blueprint.risk_reward_1}"
    print(f"  [PASS] MTF Blueprint for RELIANCE: Action={mtf_setup.blueprint.action}, "
          f"Entry={mtf_setup.blueprint.entry_price}, SL={mtf_setup.blueprint.stop_loss}, "
          f"TP1={mtf_setup.blueprint.take_profit_1} (1:{mtf_setup.blueprint.risk_reward_1} R:R), "
          f"Confluence={mtf_setup.blueprint.confluence_score}%")

    # 4. Macro Sessions & Institutional Killzones
    print("\n[4/8] Testing Global Session Clocks & Institutional Killzones...")
    sessions = get_session_status()
    assert len(sessions.sessions) == 5, "Expected 5 global sessions"
    assert len(sessions.killzones) == 4, "Expected 4 institutional killzones"
    print(f"  [PASS] Sessions: UTC={sessions.utc_time}, IST={sessions.ist_time}, "
          f"NSE/BSE={sessions.nse_bse_status}, Active FX Sessions={sessions.active_forex_sessions}, "
          f"London-NY Overlap Active={sessions.london_ny_overlap_active}")

    # 5. Forex Factory News Calendar
    print("\n[5/8] Testing Forex Factory Economic News Calendar...")
    calendar = get_economic_calendar()
    assert len(calendar.events) >= 5, "Expected at least 5 economic events"
    assert calendar.timestamp_ist is not None
    print(f"  [PASS] Economic Calendar: {len(calendar.events)} scheduled events. "
          f"Next High-Impact: {calendar.next_high_impact_event.event_name if calendar.next_high_impact_event else 'None'}")

    # 6. Precision Position, Pip & Lot Sizing Calculator
    print("\n[6/8] Testing Universal Position & Pip/Lot Calculator...")
    # Forex Test
    fx_inp = PositionInput(
        symbol="EUR/USD",
        asset_class="FOREX",
        account_balance=10000.0,
        risk_percentage=1.0,
        entry_price=1.0850,
        stop_loss_price=1.0825,  # 25 pips SL
        take_profit_price=1.0910,
        leverage=100.0,
    )
    fx_res = calculate_position_size(fx_inp)
    assert fx_res.exact_lots > 0, "Exact lots must be positive"
    assert fx_res.sl_in_pips == 25.0, f"Expected 25.0 pips SL, got {fx_res.sl_in_pips}"

    # NSE Test
    nse_inp = PositionInput(
        symbol="RELIANCE",
        asset_class="INDIAN_EQUITY",
        account_balance=500000.0,
        risk_percentage=1.0,
        entry_price=2840.0,
        stop_loss_price=2815.0,  # ₹25 SL
        take_profit_price=2895.0,
    )
    nse_res = calculate_position_size(nse_inp)
    assert nse_res.shares_quantity == 200, f"Expected 200 shares (5000 / 25), got {nse_res.shares_quantity}"
    print(f"  [PASS] Forex Sizing (EUR/USD): {fx_res.standard_lots} Lots, {fx_res.sl_in_pips} pips SL, Margin: ${fx_res.required_margin:.2f}")
    print(f"  [PASS] NSE Sizing (RELIANCE): {nse_res.shares_quantity} Shares, Capital: INR {nse_res.total_capital_required:,.2f}, F&O: {nse_res.fno_lots_count} Lot(s)")

    # 7. AI Co-Pilot with Voice Text Synthesis
    print("\n[7/8] Testing Interactive Context-Aware AI Co-Pilot...")
    copilot_req = AICopilotRequest(
        user_query="What should I trade on RELIANCE right now and where is my stop loss?",
        active_symbol="RELIANCE",
        current_price=2840.0,
        mtf_blueprint=mtf_setup.blueprint.model_dump(),
    )
    copilot_res = await get_copilot_response(copilot_req)
    assert len(copilot_res.markdown_answer) > 50, "Markdown answer must be substantive"
    assert len(copilot_res.voice_script) > 20, "Voice script must be generated for TTS"
    assert len(copilot_res.suggested_chips) >= 3, "Suggested quick chips must be provided"
    print(f"  [PASS] AI Co-Pilot responded via {copilot_res.model_used}. Action: {copilot_res.active_action}. Voice script length: {len(copilot_res.voice_script)} chars.")

    # 8. Historical Strategy Backtest & Replay
    print("\n[8/8] Testing Historical Strategy Backtest & Replay Engine...")
    bt_req = BacktestRequest(
        symbol="RELIANCE",
        timeframe="15M",
        initial_capital=100000.0,
        risk_pct_per_trade=1.0,
    )
    bt_res = await backtest_engine.run_backtest(bt_req)
    assert bt_res.total_trades > 0, "Expected at least 1 simulated trade"
    assert len(bt_res.equity_curve) > 20, "Expected equity curve progression"

    replay_step = await backtest_engine.get_replay_step("RELIANCE", timeframe="15M", step_index=35)
    assert replay_step.current_index == 35, "Replay step index mismatch"
    print(f"  [PASS] Backtest complete: Total Trades={bt_res.total_trades}, Win Rate={bt_res.win_rate_pct}%, "
          f"Profit Factor={bt_res.profit_factor}, Max DD={bt_res.max_drawdown_pct}%, Final Equity=INR {bt_res.final_equity:,.2f}")

    # SIP Projections
    sip_proj = wealth_baskets_engine.calculate_sip_projection("BSK-NIFTY-COMPOUNDERS", monthly_amount=15000.0, years=10)
    assert sip_proj.projected_wealth > sip_proj.total_invested
    print(f"  [PASS] Wealth SIP: INR 15,000/mo over 10Y -> Invested: INR {sip_proj.total_invested:,.2f}, Projected: INR {sip_proj.projected_wealth:,.2f} at {sip_proj.expected_cagr_pct}% CAGR")

    print("\n================================================================================")
    print("           ALL QUANTUMFLOOR PRO INSTITUTIONAL TESTS PASSED (8/8)                ")
    print("================================================================================")


if __name__ == "__main__":
    asyncio.run(run_all_pro_tests())
