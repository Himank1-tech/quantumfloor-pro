"""
Global Session Clocks & Institutional Killzones Engine.
Tracks real-time session states across Indian Equities (NSE/BSE in IST)
and Global Forex (Sydney, Tokyo, London, New York in UTC and IST),
highlighting the high-liquidity London-NY Overlap Killzone.
"""

from typing import List, Dict, Optional, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field


class MarketSessionInfo(BaseModel):
    name: str
    status: str  # "OPEN", "CLOSED", "PRE_OPEN"
    opens_utc: str
    closes_utc: str
    opens_ist: str
    closes_ist: str
    time_remaining: str
    is_active: bool
    is_killzone: bool = False


class KillzoneInfo(BaseModel):
    name: str
    is_active: bool
    start_utc: str
    end_utc: str
    start_ist: str
    end_ist: str
    description: str


class SessionOverview(BaseModel):
    utc_time: str
    ist_time: str
    nse_bse_status: str  # "OPEN", "CLOSED", "PRE_OPEN"
    nse_bse_time_remaining: str
    active_forex_sessions: List[str]
    active_killzones: List[str]
    london_ny_overlap_active: bool
    sessions: List[MarketSessionInfo]
    killzones: List[KillzoneInfo]


def get_session_status(now_utc: Optional[datetime] = None) -> SessionOverview:
    """
    Computes real-time market session status and institutional killzones.
    """
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)

    # IST is UTC + 5:30
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now_utc + ist_offset

    utc_str = now_utc.strftime("%H:%M:%S UTC")
    ist_str = now_ist.strftime("%H:%M:%S IST")

    weekday = now_utc.weekday()  # 0 is Mon, 6 is Sun
    utc_minutes = now_utc.hour * 60 + now_utc.minute
    ist_minutes = now_ist.hour * 60 + now_ist.minute

    # ==================== 1. Indian Equities (NSE/BSE) ====================
    # Regular trading: 09:15 to 15:30 IST (555 to 930 mins)
    # Pre-open: 09:00 to 09:15 IST (540 to 555 mins)
    nse_status = "CLOSED"
    nse_remaining = "Closed until 09:15 IST"

    if weekday < 5:  # Monday to Friday
        if 540 <= ist_minutes < 555:
            nse_status = "PRE_OPEN"
            rem = 555 - ist_minutes
            nse_remaining = f"Pre-Open: {rem}m until market open"
        elif 555 <= ist_minutes < 930:
            nse_status = "OPEN"
            rem = 930 - ist_minutes
            hrs = rem // 60
            mins = rem % 60
            nse_remaining = f"Closes in {hrs}h {mins}m"
        elif ist_minutes < 540:
            rem = 555 - ist_minutes
            hrs = rem // 60
            mins = rem % 60
            nse_remaining = f"Opens in {hrs}h {mins}m"
        else:
            nse_remaining = "Market Closed (Reopens tomorrow 09:15 IST)"
    else:
        nse_remaining = "Weekend: Market Closed"

    # ==================== 2. Global Forex Sessions ====================
    # Forex is open 24/5 from Sunday 21:00 UTC to Friday 22:00 UTC
    forex_week_active = True
    if (weekday == 5) or (weekday == 4 and now_utc.hour >= 22) or (weekday == 6 and now_utc.hour < 21):
        forex_week_active = False

    def is_in_range(start_h: int, end_h: int, cur_m: int) -> bool:
        start_m = start_h * 60
        end_m = end_h * 60
        if start_m <= end_m:
            return start_m <= cur_m < end_m
        else:
            # Crosses midnight (e.g. Sydney 21:00 to 06:00)
            return cur_m >= start_m or cur_m < end_m

    # Sydney: 21:00 - 06:00 UTC
    syd_active = forex_week_active and is_in_range(21, 6, utc_minutes)
    # Tokyo: 00:00 - 09:00 UTC
    tok_active = forex_week_active and is_in_range(0, 9, utc_minutes)
    # London: 08:00 - 17:00 UTC
    lon_active = forex_week_active and is_in_range(8, 17, utc_minutes)
    # New York: 13:00 - 22:00 UTC
    ny_active = forex_week_active and is_in_range(13, 22, utc_minutes)

    # Format session details
    sessions_list: List[MarketSessionInfo] = [
        MarketSessionInfo(
            name="NSE / BSE India",
            status=nse_status,
            opens_utc="03:45 UTC",
            closes_utc="10:00 UTC",
            opens_ist="09:15 IST",
            closes_ist="15:30 IST",
            time_remaining=nse_remaining,
            is_active=(nse_status == "OPEN"),
        ),
        MarketSessionInfo(
            name="London (European)",
            status="OPEN" if lon_active else "CLOSED",
            opens_utc="08:00 UTC",
            closes_utc="17:00 UTC",
            opens_ist="13:30 IST",
            closes_ist="22:30 IST",
            time_remaining="Active Trading" if lon_active else "Opens at 13:30 IST",
            is_active=lon_active,
        ),
        MarketSessionInfo(
            name="New York (US)",
            status="OPEN" if ny_active else "CLOSED",
            opens_utc="13:00 UTC",
            closes_utc="22:00 UTC",
            opens_ist="18:30 IST",
            closes_ist="03:30 IST",
            time_remaining="Active Trading" if ny_active else "Opens at 18:30 IST",
            is_active=ny_active,
        ),
        MarketSessionInfo(
            name="Tokyo (Asian)",
            status="OPEN" if tok_active else "CLOSED",
            opens_utc="00:00 UTC",
            closes_utc="09:00 UTC",
            opens_ist="05:30 IST",
            closes_ist="14:30 IST",
            time_remaining="Active Trading" if tok_active else "Opens at 05:30 IST",
            is_active=tok_active,
        ),
        MarketSessionInfo(
            name="Sydney (Pacific)",
            status="OPEN" if syd_active else "CLOSED",
            opens_utc="21:00 UTC",
            closes_utc="06:00 UTC",
            opens_ist="02:30 IST",
            closes_ist="11:30 IST",
            time_remaining="Active Trading" if syd_active else "Opens at 02:30 IST",
            is_active=syd_active,
        ),
    ]

    # ==================== 3. Institutional Killzones ====================
    # London-NY Overlap Killzone: 13:00 to 17:00 UTC (18:30 to 22:30 IST)
    overlap_active = forex_week_active and (13 * 60 <= utc_minutes < 17 * 60)
    # London Open Killzone: 07:00 to 10:00 UTC (12:30 to 15:30 IST)
    lon_open_kz = forex_week_active and (7 * 60 <= utc_minutes < 10 * 60)
    # NY Open Killzone: 12:00 to 15:00 UTC (17:30 to 20:30 IST)
    ny_open_kz = forex_week_active and (12 * 60 <= utc_minutes < 15 * 60)
    # Asian Killzone: 00:00 to 04:00 UTC (05:30 to 09:30 IST)
    asian_kz = forex_week_active and (0 <= utc_minutes < 4 * 60)

    killzones_list: List[KillzoneInfo] = [
        KillzoneInfo(
            name="London-NY Overlap Killzone",
            is_active=overlap_active,
            start_utc="13:00 UTC",
            end_utc="17:00 UTC",
            start_ist="18:30 IST",
            end_ist="22:30 IST",
            description="Peak institutional liquidity window. Maximum volatility and cleanest SMC displacements.",
        ),
        KillzoneInfo(
            name="London Open Killzone",
            is_active=lon_open_kz,
            start_utc="07:00 UTC",
            end_utc="10:00 UTC",
            start_ist="12:30 IST",
            end_ist="15:30 IST",
            description="Judas Swing fakeouts and high-volume session high/low creation.",
        ),
        KillzoneInfo(
            name="NY Open Killzone",
            is_active=ny_open_kz,
            start_utc="12:00 UTC",
            end_utc="15:00 UTC",
            start_ist="17:30 IST",
            end_ist="20:30 IST",
            description="US economic data releases, Wall Street open expansion moves.",
        ),
        KillzoneInfo(
            name="Asian Range Killzone",
            is_active=asian_kz,
            start_utc="00:00 UTC",
            end_utc="04:00 UTC",
            start_ist="05:30 IST",
            end_ist="09:30 IST",
            description="Consolidation range establishing session liquidity boundaries for London sweeps.",
        ),
    ]

    active_forex: List[str] = [s.name for s in sessions_list[1:] if s.is_active]
    active_kz: List[str] = [kz.name for kz in killzones_list if kz.is_active]

    return SessionOverview(
        utc_time=utc_str,
        ist_time=ist_str,
        nse_bse_status=nse_status,
        nse_bse_time_remaining=nse_remaining,
        active_forex_sessions=active_forex,
        active_killzones=active_kz,
        london_ny_overlap_active=overlap_active,
        sessions=sessions_list,
        killzones=killzones_list,
    )
