"""
Long-Term Wealth Baskets & SIP Projections Engine.
Models institutional thematic portfolios (Nifty 50 Compounders, Clean Energy & EV,
Dividend Aristocrats, FX Carry) with fundamental health scoring and multi-year SIP growth projections.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
import math

from .basket_manager import basket_manager, ThematicBasket


class SIPProjectionYear(BaseModel):
    year: int
    total_invested: float
    future_value: float
    wealth_gain: float
    benchmark_fd_value: float


class SIPCalculationResult(BaseModel):
    basket_id: str
    monthly_sip_amount: float
    duration_years: int
    expected_cagr_pct: float
    total_invested: float
    projected_wealth: float
    wealth_gain: float
    yearly_trajectory: List[SIPProjectionYear]


class WealthBasketsEngine:
    def __init__(self):
        self.manager = basket_manager

    def get_all_baskets(self) -> List[ThematicBasket]:
        return self.manager.get_all_baskets()

    def get_basket(self, basket_id: str) -> Optional[ThematicBasket]:
        return self.manager.get_basket(basket_id)

    def calculate_sip_projection(
        self,
        basket_id: str,
        monthly_amount: float = 10000.0,
        years: int = 10
    ) -> SIPCalculationResult:
        """
        Computes multi-year compound interest wealth projection for a thematic basket.
        FV = P * [((1 + r)^n - 1) / r] * (1 + r)
        """
        basket = self.manager.get_basket(basket_id)
        cagr = getattr(basket, "cagr_3yr_pct", 16.5) if basket else 16.5
        r = (cagr / 100.0) / 12.0
        fd_r = (0.07 / 12.0)  # Standard 7% fixed deposit comparison

        trajectory: List[SIPProjectionYear] = []
        for y in range(1, years + 1):
            n = y * 12
            total_inv = monthly_amount * n
            
            # Future Value of SIP
            fv = monthly_amount * (((1 + r)**n - 1) / r) * (1 + r)
            fd_fv = monthly_amount * (((1 + fd_r)**n - 1) / fd_r) * (1 + fd_r)

            trajectory.append(SIPProjectionYear(
                year=y,
                total_invested=round(total_inv, 2),
                future_value=round(fv, 2),
                wealth_gain=round(fv - total_inv, 2),
                benchmark_fd_value=round(fd_fv, 2),
            ))

        final_inv = monthly_amount * years * 12
        final_wealth = trajectory[-1].future_value

        return SIPCalculationResult(
            basket_id=basket_id,
            monthly_sip_amount=monthly_amount,
            duration_years=years,
            expected_cagr_pct=cagr,
            total_invested=round(final_inv, 2),
            projected_wealth=round(final_wealth, 2),
            wealth_gain=round(final_wealth - final_inv, 2),
            yearly_trajectory=trajectory,
        )


wealth_baskets_engine = WealthBasketsEngine()
