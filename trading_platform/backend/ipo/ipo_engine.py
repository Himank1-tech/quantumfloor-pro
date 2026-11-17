"""
IPO Engine Module.
Bridges scraper, DRHP analyzer, and live GMP/Subscription tracker into unified endpoint models.
"""

from typing import List, Dict, Optional, Any
from .scraper import ipo_scraper, IPOSummary
from .analyzer import ipo_analyzer, IPOIntelligenceReport


class IPOEngine:
    def __init__(self):
        self.scraper = ipo_scraper
        self.analyzer = ipo_analyzer

    def get_all_ipos(self, status: Optional[str] = None) -> List[IPOSummary]:
        return self.scraper.get_all_ipos(status=status)

    def get_ipo_by_id(self, ipo_id: str) -> Optional[IPOSummary]:
        return self.scraper.get_ipo_by_id(ipo_id)

    def analyze_ipo(self, ipo_id: str) -> Optional[IPOIntelligenceReport]:
        ipo = self.scraper.get_ipo_by_id(ipo_id)
        if not ipo:
            return None
        return self.analyzer.analyze_ipo(ipo)


ipo_engine = IPOEngine()
