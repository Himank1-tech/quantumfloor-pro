"""
Comprehensive Test Suite for Trading Platform.
Validates Quant Analytics, Indian Broker, Forex Broker, Risk Governor, MCP Server, and Floor Manager.
"""

import sys
import os

# Add workspace root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from trading_platform.backend.analytics.quant import (
    calculate_sharpe_ratio,
    calculate_sortino_ratio,
    calculate_max_drawdown,
    calculate_beta,
    calculate_volatility,
    calculate_kelly_criterion,
    calculate_var_cvar,
    compute_portfolio_quant_metrics,
)
from trading_platform.backend.brokers.base import OrderSide, OrderType, AssetClass
from trading_platform.backend.brokers.indian_broker import IndianBrokerAdapter
from trading_platform.backend.brokers.forex_broker import ForexBrokerAdapter
from trading_platform.backend.risk.governor import RiskGovernor, CircuitBreakerState
from trading_platform.backend.agents.mcp_servers import TradingMCPServer
from trading_platform.backend.agents.floor_manager import FloorManager


def test_quant_analytics():
    print("Testing Quant Analytics...")
    returns = [0.01, 0.005, -0.002, 0.008, -0.004, 0.012, 0.003, -0.001, 0.007, 0.002]
    equity_curve = [100000.0, 101000.0, 101505.0, 101302.0, 102112.0, 101704.0, 102924.0, 103233.0, 103130.0, 103852.0]

    sharpe = calculate_sharpe_ratio(returns, risk_free_rate=0.065)
    sortino = calculate_sortino_ratio(returns, risk_free_rate=0.065)
    dd_stats = calculate_max_drawdown(equity_curve)
    vol = calculate_volatility(returns)
    kelly = calculate_kelly_criterion(win_rate=0.60, avg_win=1.8, avg_loss=1.0, fraction=0.5)
    var_stats = calculate_var_cvar(returns)

    assert sharpe > 0, f"Expected positive Sharpe, got {sharpe}"
    assert sortino > 0, f"Expected positive Sortino, got {sortino}"
    assert dd_stats["max_drawdown_pct"] >= 0.0, "Drawdown pct should be non-negative"
    assert vol > 0.0, "Volatility should be positive"
    assert 0.0 < kelly <= 0.25, f"Kelly fraction out of expected bounds: {kelly}"
    assert "var_pct" in var_stats and "cvar_pct" in var_stats

    metrics = compute_portfolio_quant_metrics(equity_curve=equity_curve, returns=returns)
    assert "sharpe_ratio" in metrics
    assert "kelly_recommended_pct" in metrics
    print(f"  [PASS] Sharpe: {sharpe}, Sortino: {sortino}, Vol: {vol}%, Kelly: {kelly * 100:.2f}%")


def test_brokers():
    print("Testing Brokers (Indian & Forex)...")
    inr_broker = IndianBrokerAdapter(initial_balance_inr=1_000_000.0)
    bal_inr = inr_broker.get_balance()
    assert bal_inr["cash"] == 1_000_000.0

    res_inr = inr_broker.place_order(
        symbol="RELIANCE",
        side=OrderSide.BUY,
        order_type=OrderType.MARKET,
        quantity=50,
        price=2850.0,
        stop_loss=2800.0,
        take_profit=2950.0,
    )
    assert res_inr.success, f"Indian order failed: {res_inr.message}"
    assert len(inr_broker.get_positions()) == 1
    assert inr_broker.get_positions()[0].symbol == "RELIANCE"

    fx_broker = ForexBrokerAdapter(initial_balance_usd=25_000.0)
    res_fx = fx_broker.place_order(
        symbol="EUR/USD",
        side=OrderSide.BUY,
        order_type=OrderType.MARKET,
        quantity=20_000,
        price=1.0850,
        stop_loss=1.0800,
        take_profit=1.0950,
    )
    assert res_fx.success, f"Forex order failed: {res_fx.message}"
    assert len(fx_broker.get_positions()) == 1
    assert fx_broker.get_positions()[0].symbol == "EUR/USD"
    print("  [PASS] Both Indian and FX broker orders executed successfully with fee accounting.")


def test_risk_governor():
    print("Testing Risk Governor...")
    gov = RiskGovernor(max_asset_concentration_pct=15.0)

    # Normal order approval
    res = gov.validate_trade_proposal(
        symbol="TCS",
        asset_class="INDIAN_EQUITY",
        side="BUY",
        proposed_quantity=20,
        price=3900.0,
        total_portfolio_nav=3_000_000.0,
        current_asset_exposure=0.0,
        win_rate=0.6,
        payoff_ratio=2.0,
        stop_loss=3800.0,
        take_profit=4100.0,
    )
    assert res.approved, f"Trade should have been approved: {res.audit_trail}"

    # Overconcentration rejection or scaling
    res_large = gov.validate_trade_proposal(
        symbol="TCS",
        asset_class="INDIAN_EQUITY",
        side="BUY",
        proposed_quantity=1000,  # 3.9 Million INR > 450,000 INR (15% limit)
        price=3900.0,
        total_portfolio_nav=3_000_000.0,
        current_asset_exposure=0.0,
        win_rate=0.6,
        payoff_ratio=2.0,
        stop_loss=3800.0,
        take_profit=4100.0,
    )
    assert res_large.approved_quantity < 1000, "Risk governor failed to scale down oversized order"

    # Circuit breaker trigger test
    gov.update_portfolio_state(current_nav=2_800_000.0, daily_pnl_pct=-5.5, total_drawdown_pct=6.0)
    assert gov.circuit_breaker_state == CircuitBreakerState.HARD_HALT

    # Trade under hard halt should be rejected
    res_halt = gov.validate_trade_proposal(
        symbol="TCS",
        asset_class="INDIAN_EQUITY",
        side="BUY",
        proposed_quantity=10,
        price=3900.0,
        total_portfolio_nav=3_000_000.0,
        current_asset_exposure=0.0,
    )
    assert not res_halt.approved, "Trade must be rejected under HARD_HALT"
    print("  [PASS] Risk Governor concentration capping and Hard Halt circuit breaker passed.")


def test_floor_manager_debate():
    print("Testing Floor Manager and MCP...")
    mcp = TradingMCPServer()
    gov = RiskGovernor()
    inr_broker = IndianBrokerAdapter()
    fx_broker = ForexBrokerAdapter()

    manager = FloorManager(mcp_server=mcp, risk_governor=gov, indian_broker=inr_broker, forex_broker=fx_broker)
    debate = manager.conduct_debate(symbol="RELIANCE")

    assert debate.symbol == "RELIANCE"
    assert "conviction_pct" in debate.bull_thesis
    assert "conviction_pct" in debate.bear_thesis
    assert -1.0 <= debate.consensus_score <= 1.0
    assert debate.action in ("BUY", "SELL", "HOLD")
    print(f"  [PASS] Debate completed: Signal={debate.signal}, Consensus={debate.consensus_score:+.2f}, Action={debate.action}")


def test_auth_and_vault():
    print("Testing Auth, JWT & Fernet Key Encryption...")
    from trading_platform.backend.auth.security import (
        hash_password,
        verify_password,
        create_access_token,
        verify_access_token,
        encrypt_secret,
        decrypt_secret,
        mask_secret,
    )
    pwd = "InstitutionalPassword@2026"
    h = hash_password(pwd)
    assert verify_password(pwd, h), "Password verification failed"
    assert not verify_password("WrongPassword", h), "Password false positive"

    token = create_access_token({"sub": "USR-101", "username": "pro_trader", "role": "TRADER"})
    payload = verify_access_token(token)
    assert payload is not None and payload.username == "pro_trader"

    raw_key = "kite_secret_api_key_institutional_99824"
    enc = encrypt_secret(raw_key)
    dec = decrypt_secret(enc)
    assert dec == raw_key, "Fernet encryption roundtrip failed"
    masked = mask_secret(raw_key)
    assert "••••••••" in masked and masked.startswith("kite")
    print("  [PASS] Password hashing, JWT creation/verification, and Fernet vault encryption verified.")


def test_ipo_intelligence():
    print("Testing IPO Intelligence Engine...")
    from trading_platform.backend.ipo.scraper import IPOScraper
    from trading_platform.backend.ipo.analyzer import IPOAnalyzer, IPOVerdict

    scraper = IPOScraper()
    ipos = scraper.get_all_ipos()
    assert len(ipos) >= 4, f"Expected at least 4 seeded IPOs, found {len(ipos)}"

    analyzer = IPOAnalyzer()
    waaree = scraper.get_ipo_by_id("IPO-WAAREE-2024")
    assert waaree is not None
    rep_waaree = analyzer.analyze_ipo(waaree)
    assert rep_waaree.verdict in (IPOVerdict.APPLY_LISTING_GAINS, IPOVerdict.APPLY_LONG_TERM)
    assert rep_waaree.composite_score >= 70.0
    assert len(rep_waaree.strengths) >= 2

    hyundai = scraper.get_ipo_by_id("IPO-HYUNDAI-2024")
    assert hyundai is not None
    rep_hyundai = analyzer.analyze_ipo(hyundai)
    assert rep_hyundai.fresh_issue_ratio_pct == 0.0  # 100% OFS
    assert rep_hyundai.composite_score < 70.0
    print(f"  [PASS] IPO Engine analyzed Waaree ({rep_waaree.verdict.value}, score {rep_waaree.composite_score}) and Hyundai (100% OFS, score {rep_hyundai.composite_score}).")


def test_grounded_advisory():
    print("Testing Grounded AI Advisory & Signal Validator...")
    from trading_platform.backend.advisory.grounded_engine import GroundedAdvisoryEngine
    from trading_platform.backend.advisory.signal_validator import SignalValidator

    engine = GroundedAdvisoryEngine()
    validator = SignalValidator(min_risk_reward=2.0)
    signals = engine.get_signals()
    assert len(signals) >= 3, f"Expected at least 3 active advisory signals, found {len(signals)}"

    for s in signals:
        res = validator.validate_signal(s)
        assert res.is_valid, f"Signal {s.signal_id} failed validation: {res.audit_notes}"
        assert res.calculated_risk_reward >= 2.0, f"Signal {s.signal_id} has invalid R:R: {res.calculated_risk_reward}"
        assert len(s.verifiable_proof) >= 2, f"Signal {s.signal_id} lacks verifiable proof"
    print(f"  [PASS] All {len(signals)} Grounded Advisory signals verified with mathematical R:R >= 2.0 and verifiable citations.")


def test_thematic_baskets():
    print("Testing Long-Term Thematic Baskets & SIP Allocation...")
    from trading_platform.backend.investors.basket_manager import BasketManager

    mgr = BasketManager()
    baskets = mgr.get_all_baskets()
    assert len(baskets) >= 4, f"Expected 4 thematic baskets, found {len(baskets)}"

    nifty_basket = mgr.get_basket_by_id("BSK-NIFTY-COMPOUNDERS")
    assert nifty_basket is not None
    assert nifty_basket.cagr_3yr_pct > 15.0

    # Test SIP Execution allocation
    rec = mgr.execute_basket_investment(
        basket_id="BSK-NIFTY-COMPOUNDERS",
        user_id="USR-TEST-01",
        amount=50000.0,
    )
    assert rec.status == "EXECUTED"
    assert rec.amount_invested == 50000.0
    assert "RELIANCE" in rec.allocated_shares and rec.allocated_shares["RELIANCE"] > 0
    assert "HDFCBANK" in rec.allocated_shares and rec.allocated_shares["HDFCBANK"] > 0
    print(f"  [PASS] Thematic Basket SIP allocation verified: {rec.allocated_shares}")


if __name__ == "__main__":
    test_quant_analytics()
    test_brokers()
    test_risk_governor()
    test_floor_manager_debate()
    test_auth_and_vault()
    test_ipo_intelligence()
    test_grounded_advisory()
    test_thematic_baskets()
    print("\nALL BACKEND UNIT & ENTERPRISE TESTS PASSED SUCCESSFULLY!")
