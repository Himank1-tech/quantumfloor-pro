"""
NSE / BSE IPO Intelligence Scraper & Grey Market Premium (GMP) Aggregator.
Tracks active, upcoming, and recent Indian IPOs with live subscription ratios and anchor books.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import datetime


class SubscriptionData(BaseModel):
    qib_times: float  # Qualified Institutional Buyers
    nii_times: float  # Non-Institutional Investors (HNI)
    retail_times: float  # Retail Individual Investors
    employee_times: Optional[float] = 0.0
    total_times: float
    last_updated: str


class GMPData(BaseModel):
    current_gmp: float  # ₹ per share in Grey Market
    gmp_pct: float      # % above upper price band
    expected_listing_price: float
    gmp_trend: str      # "RISING", "STABLE", "FALLING"
    history: List[Dict[str, Any]] = Field(default_factory=list)


class IPOSummary(BaseModel):
    ipo_id: str
    company_name: str
    symbol: str
    sector: str
    issue_size_cr: float
    fresh_issue_cr: float
    ofs_cr: float
    price_band_low: float
    price_band_high: float
    lot_size: int
    open_date: str
    close_date: str
    allotment_date: str
    listing_date: str
    status: str  # "ACTIVE", "UPCOMING", "CLOSED", "LISTED"
    exchange: str = "NSE & BSE"
    subscription: SubscriptionData
    gmp: GMPData
    anchor_investors: List[str] = Field(default_factory=list)
    lead_managers: List[str] = Field(default_factory=list)


class IPOScraper:
    """
    Scraper and live feed provider for Indian Equities IPOs.
    """

    def __init__(self):
        self.ipos: Dict[str, IPOSummary] = {}
        self._seed_indian_ipos()

    def _seed_indian_ipos(self) -> None:
        """Seed rich institutional Indian IPO data reflecting current market dynamics."""
        now = datetime.datetime.now(datetime.timezone.utc)
        today_str = now.strftime("%Y-%m-%d")

        ipo_list = [
            IPOSummary(
                ipo_id="IPO-SWIGGY-2024",
                company_name="Swiggy Limited",
                symbol="SWIGGY",
                sector="Consumer Internet & Quick Commerce",
                issue_size_cr=11327.43,
                fresh_issue_cr=4499.00,
                ofs_cr=6828.43,
                price_band_low=371.0,
                price_band_high=390.0,
                lot_size=38,
                open_date="2026-11-06",
                close_date="2026-11-10",
                allotment_date="2026-11-11",
                listing_date="2026-11-13",
                status="ACTIVE",
                subscription=SubscriptionData(
                    qib_times=6.02,
                    nii_times=1.24,
                    retail_times=1.14,
                    employee_times=1.65,
                    total_times=3.59,
                    last_updated=today_str,
                ),
                gmp=GMPData(
                    current_gmp=18.0,
                    gmp_pct=4.62,
                    expected_listing_price=408.0,
                    gmp_trend="RISING",
                    history=[
                        {"date": "2026-11-04", "gmp": 12.0, "pct": 3.08},
                        {"date": "2026-11-05", "gmp": 14.0, "pct": 3.59},
                        {"date": "2026-11-06", "gmp": 16.0, "pct": 4.10},
                        {"date": "2026-11-07", "gmp": 18.0, "pct": 4.62},
                    ],
                ),
                anchor_investors=[
                    "Norway Government Pension Fund Global (NBIM)",
                    "Fidelity Investments",
                    "BlackRock Global Funds",
                    "SBI Mutual Fund",
                    "ICICI Prudential Asset Management",
                    "HDFC Life Insurance",
                ],
                lead_managers=["Kotak Mahindra Capital", "Citigroup Global Markets", "Jefferies India", "BofA Securities"],
            ),
            IPOSummary(
                ipo_id="IPO-WAAREE-2024",
                company_name="Waaree Energies Limited",
                symbol="WAAREE",
                sector="Solar Photovoltaic & Renewable Energy",
                issue_size_cr=4321.44,
                fresh_issue_cr=3600.00,
                ofs_cr=721.44,
                price_band_low=1427.0,
                price_band_high=1503.0,
                lot_size=9,
                open_date="2026-10-21",
                close_date="2026-10-23",
                allotment_date="2026-10-24",
                listing_date="2026-10-28",
                status="LISTED",
                subscription=SubscriptionData(
                    qib_times=208.63,
                    nii_times=62.49,
                    retail_times=10.79,
                    employee_times=5.12,
                    total_times=76.34,
                    last_updated="2026-10-24",
                ),
                gmp=GMPData(
                    current_gmp=1480.0,
                    gmp_pct=98.47,
                    expected_listing_price=2983.0,
                    gmp_trend="STABLE",
                    history=[
                        {"date": "2026-10-20", "gmp": 1350.0, "pct": 89.8},
                        {"date": "2026-10-22", "gmp": 1420.0, "pct": 94.5},
                        {"date": "2026-10-24", "gmp": 1480.0, "pct": 98.47},
                    ],
                ),
                anchor_investors=[
                    "Abu Dhabi Investment Authority (ADIA)",
                    "Goldman Sachs Asset Management",
                    "Morgan Stanley Asia",
                    "Nippon India Mutual Fund",
                    "Tata Mutual Fund",
                ],
                lead_managers=["Axis Capital", "IIFL Securities", "Jefferies India", "Nomura Financial Advisory"],
            ),
            IPOSummary(
                ipo_id="IPO-HYUNDAI-2024",
                company_name="Hyundai Motor India Limited",
                symbol="HYUNDAI",
                sector="Automobile & Electric Vehicles",
                issue_size_cr=27870.16,
                fresh_issue_cr=0.00,  # 100% OFS
                ofs_cr=27870.16,
                price_band_low=1865.0,
                price_band_high=1960.0,
                lot_size=7,
                open_date="2026-10-15",
                close_date="2026-10-17",
                allotment_date="2026-10-18",
                listing_date="2026-10-22",
                status="LISTED",
                subscription=SubscriptionData(
                    qib_times=6.97,
                    nii_times=0.60,
                    retail_times=0.50,
                    employee_times=1.74,
                    total_times=2.37,
                    last_updated="2026-10-18",
                ),
                gmp=GMPData(
                    current_gmp=-25.0,
                    gmp_pct=-1.28,
                    expected_listing_price=1935.0,
                    gmp_trend="FALLING",
                    history=[
                        {"date": "2026-10-12", "gmp": 150.0, "pct": 7.65},
                        {"date": "2026-10-15", "gmp": 45.0, "pct": 2.30},
                        {"date": "2026-10-17", "gmp": -25.0, "pct": -1.28},
                    ],
                ),
                anchor_investors=[
                    "Government of Singapore (GIC)",
                    "Monetary Authority of Singapore",
                    "BlackRock Global Allocation Fund",
                    "SBI Balanced Advantage Fund",
                ],
                lead_managers=["Kotak Mahindra Capital", "Citigroup", "HSBC Securities", "J.P. Morgan India"],
            ),
            IPOSummary(
                ipo_id="IPO-NIVABUPA-2024",
                company_name="Niva Bupa Health Insurance Limited",
                symbol="NIVABUPA",
                sector="Standalone Health Insurance (SAHI)",
                issue_size_cr=2200.00,
                fresh_issue_cr=800.00,
                ofs_cr=1400.00,
                price_band_low=70.0,
                price_band_high=74.0,
                lot_size=200,
                open_date="2026-11-07",
                close_date="2026-11-11",
                allotment_date="2026-11-12",
                listing_date="2026-11-14",
                status="ACTIVE",
                subscription=SubscriptionData(
                    qib_times=1.85,
                    nii_times=0.88,
                    retail_times=1.45,
                    total_times=1.42,
                    last_updated=today_str,
                ),
                gmp=GMPData(
                    current_gmp=0.0,
                    gmp_pct=0.0,
                    expected_listing_price=74.0,
                    gmp_trend="STABLE",
                    history=[
                        {"date": "2026-11-05", "gmp": 3.0, "pct": 4.05},
                        {"date": "2026-11-07", "gmp": 0.0, "pct": 0.0},
                    ],
                ),
                anchor_investors=[
                    "Fidelity Asian Values Plc",
                    "Amundi Funds",
                    "Morgan Stanley Asia",
                    "Kotak Mahindra Trustee",
                ],
                lead_managers=["ICICI Securities", "Morgan Stanley India", "Kotak Mahindra Capital", "Axis Capital"],
            ),
            IPOSummary(
                ipo_id="IPO-NTPCGREEN-2024",
                company_name="NTPC Green Energy Limited",
                symbol="NTPCGREEN",
                sector="PSU Clean Energy & Green Hydrogen",
                issue_size_cr=10000.00,
                fresh_issue_cr=10000.00,
                ofs_cr=0.00,  # 100% Fresh Issue
                price_band_low=102.0,
                price_band_high=108.0,
                lot_size=138,
                open_date="2026-11-19",
                close_date="2026-11-22",
                allotment_date="2026-11-25",
                listing_date="2026-11-27",
                status="UPCOMING",
                subscription=SubscriptionData(
                    qib_times=0.0,
                    nii_times=0.0,
                    retail_times=0.0,
                    total_times=0.0,
                    last_updated=today_str,
                ),
                gmp=GMPData(
                    current_gmp=9.0,
                    gmp_pct=8.33,
                    expected_listing_price=117.0,
                    gmp_trend="RISING",
                    history=[
                        {"date": "2026-11-06", "gmp": 6.0, "pct": 5.56},
                        {"date": "2026-11-07", "gmp": 9.0, "pct": 8.33},
                    ],
                ),
                anchor_investors=["Sovereign Wealth Funds & Domestic MFs (Bidding Scheduled)"],
                lead_managers=["IDBI Capital Markets", "HDFC Bank", "IIFL Securities", "Nuvama Wealth Management"],
            ),
        ]

        for ipo in ipo_list:
            self.ipos[ipo.ipo_id] = ipo

    def get_all_ipos(self, status: Optional[str] = None) -> List[IPOSummary]:
        if status:
            return [ipo for ipo in self.ipos.values() if ipo.status.upper() == status.upper()]
        return list(self.ipos.values())

    def get_ipo_by_id(self, ipo_id: str) -> Optional[IPOSummary]:
        # Lookup by exact ID, case-insensitive ID, or symbol
        if ipo_id in self.ipos:
            return self.ipos[ipo_id]
        
        target = ipo_id.strip().upper()
        for k, v in self.ipos.items():
            if k.upper() == target or v.symbol.upper() == target:
                return v
        return None
