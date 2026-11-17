"""
Multi-Agent Autonomous Trading Floor Package.
"""

from .prompts import (
    BULL_AGENT_SYSTEM_PROMPT,
    BEAR_AGENT_SYSTEM_PROMPT,
    FLOOR_MANAGER_SYSTEM_PROMPT,
)
from .mcp_servers import TradingMCPServer
from .floor_manager import FloorManager, AgentDebateResult

__all__ = [
    "BULL_AGENT_SYSTEM_PROMPT",
    "BEAR_AGENT_SYSTEM_PROMPT",
    "FLOOR_MANAGER_SYSTEM_PROMPT",
    "TradingMCPServer",
    "FloorManager",
    "AgentDebateResult",
]
