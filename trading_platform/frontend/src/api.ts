/**
 * Institutional Strongly Typed API Client & EventSource SSE Subscriber
 * Expanded for Enterprise Features: IPO Intelligence, Grounded Advisory,
 * Thematic Baskets / SIP, and Multi-User RBAC & Key Vault.
 */

export interface Quote {
  symbol: string;
  asset_class: 'INDIAN_EQUITY' | 'FOREX';
  bid: number;
  ask: number;
  last_price: number;
  open: number;
  high: number;
  low: number;
  previous_close: number;
  change_pct: number;
  volume: number;
  timestamp: string;
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderBookDepth {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  total_bid_liquidity: number;
  total_ask_liquidity: number;
  order_book_imbalance: number;
  timestamp: string;
}

export interface AccountSummary {
  total_nav_inr: number;
  total_nav_usd: number;
  usd_inr_rate: number;
  daily_pnl_inr: number;
  daily_pnl_pct: number;
  total_return_pct: number;
  current_drawdown_pct: number;
  high_water_mark_inr: number;
  inr_account: {
    currency: string;
    symbol: string;
    cash: number;
    margin_used: number;
    unrealized_pnl: number;
    total_equity: number;
    allocation_pct: number;
  };
  usd_account: {
    currency: string;
    symbol: string;
    cash: number;
    margin_used: number;
    unrealized_pnl: number;
    total_equity: number;
    allocation_pct: number;
  };
  timestamp: string;
}

export interface QuantMetrics {
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown_pct: number;
  current_drawdown_pct: number;
  peak_equity: number;
  trough_equity: number;
  drawdown_duration: number;
  annualized_volatility_pct: number;
  beta: number;
  var_95_pct: number;
  cvar_95_pct: number;
  kelly_recommended_pct: number;
  win_rate_pct: number;
  profit_factor: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_win: number;
  avg_loss: number;
  total_return_pct: number;
  current_equity: number;
  initial_equity: number;
  equity_series?: Array<{
    timestamp: string;
    total_nav_inr: number;
    drawdown_pct: number;
  }>;
}

export interface AgentThesis {
  agent: string;
  conviction_pct: number;
  key_arguments: string[];
  target_price: number;
  invalidation_price: number;
  catalyst: string;
}

export interface AgentDebate {
  debate_id: string;
  symbol: string;
  asset_class: string;
  timestamp: string;
  bull_thesis: AgentThesis;
  bear_thesis: AgentThesis;
  consensus_score: number;
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence_pct: number;
  current_price: number;
  recommended_entry: number;
  stop_loss: number;
  take_profit: number;
  risk_reward_ratio: number;
  proposed_quantity: number;
  executive_rationale: string;
  risk_assessment?: {
    approved: boolean;
    approved_quantity: number;
    risk_score: number;
    circuit_breaker_state: string;
    audit_trail: string[];
  };
  execution_result?: {
    success: boolean;
    message: string;
  };
}

export interface Position {
  symbol: string;
  asset_class: 'INDIAN_EQUITY' | 'FOREX';
  quantity: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  currency: string;
  stop_loss?: number;
  take_profit?: number;
  opened_at: string;
}

export interface OrderRecord {
  order_id: string;
  symbol: string;
  asset_class: string;
  side: 'BUY' | 'SELL';
  order_type: string;
  quantity: number;
  price: number;
  status: string;
  avg_fill_price: number;
  fee: number;
  slippage: number;
  tag: string;
  created_at: string;
  rejection_reason?: string;
}

export interface TradeRecord {
  trade_id: string;
  order_id: string;
  symbol: string;
  asset_class: string;
  side: string;
  quantity: number;
  price: number;
  pnl: number;
  fee: number;
  slippage: number;
  timestamp: string;
}

export interface RiskStatus {
  circuit_breaker_state: 'NORMAL' | 'SOFT_BRAKE' | 'HARD_HALT' | 'MANUAL_OVERRIDE';
  max_asset_concentration_pct: number;
  soft_daily_drawdown_limit_pct: number;
  hard_daily_drawdown_limit_pct: number;
  max_total_drawdown_limit_pct: number;
  volatility_brake_multiplier: number;
  kelly_fraction: number;
  recent_events: Array<{
    timestamp: string;
    event_type: string;
    details: string;
    state: string;
  }>;
}

// ==================== ENTERPRISE MODELS ====================

export interface SubscriptionData {
  qib_times: number;
  nii_times: number;
  retail_times: number;
  total_times: number;
  last_updated: string;
}

export interface GMPData {
  current_gmp: number;
  gmp_pct: number;
  expected_listing_price: number;
  gmp_trend: 'RISING' | 'STABLE' | 'FALLING';
  history: Array<{ date: string; gmp: number; pct: number }>;
}

export interface IPOSummary {
  ipo_id: string;
  company_name: string;
  symbol: string;
  sector: string;
  issue_size_cr: number;
  fresh_issue_cr: number;
  ofs_cr: number;
  price_band_low: number;
  price_band_high: number;
  lot_size: number;
  open_date: string;
  close_date: string;
  allotment_date: string;
  listing_date: string;
  status: 'ACTIVE' | 'UPCOMING' | 'CLOSED' | 'LISTED';
  exchange: string;
  subscription: SubscriptionData;
  gmp: GMPData;
  anchor_investors: string[];
  lead_managers: string[];
}

export interface PeerValuation {
  company_name: string;
  symbol: string;
  pe_ratio: number;
  pb_ratio: number;
  roe_pct: number;
  market_cap_cr: number;
}

export interface IPOIntelligenceReport {
  ipo_id: string;
  company_name: string;
  symbol: string;
  verdict: 'APPLY_LISTING_GAINS' | 'APPLY_LONG_TERM' | 'AVOID' | 'NEUTRAL';
  composite_score: number;
  expected_listing_gain_pct: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH';
  revenue_cagr_3yr_pct: number;
  ebitda_margin_pct: number;
  pat_margin_pct: number;
  roe_pct: number;
  roce_pct: number;
  debt_to_equity: number;
  fresh_issue_ratio_pct: number;
  post_issue_pe: number;
  industry_average_pe: number;
  fair_value_estimate: number;
  valuation_status: string;
  listed_peers: PeerValuation[];
  strengths: string[];
  risks: string[];
  anchor_assessment: string;
  subscription_assessment: string;
  recommendation_summary: string;
  timestamp: string;
}

export interface ProofEvidenceItem {
  category: 'BALANCE_SHEET' | 'TECHNICAL_LEVEL' | 'SEBI_FILING' | 'MACRO_CATALYST' | 'ORDER_BOOK_MICROSTRUCTURE';
  claim: string;
  verified_data_point: string;
  source_citation: string;
  timestamp: string;
  verified: boolean;
}

export interface GroundedAdviceSignal {
  signal_id: string;
  symbol: string;
  asset_class: string;
  horizon: 'INTRADAY' | 'SWING_TRADE' | 'LONG_TERM_WEALTH';
  action: 'STRONG_BUY' | 'ACCUMULATE' | 'HOLD' | 'TRIM' | 'EXIT';
  conviction_pct: number;
  current_price: number;
  entry_range: number[];
  target_price: number;
  invalidation_stop: number;
  risk_reward_ratio: number;
  suggested_portfolio_allocation_pct: number;
  thesis_title: string;
  executive_summary: string;
  verifiable_proof: ProofEvidenceItem[];
  invalidation_criteria: string;
  status: string;
  created_at: string;
  validation_result?: {
    is_valid: boolean;
    calculated_risk_reward: number;
    effective_entry_buffer: number;
    approved_allocation_pct: number;
    audit_notes: string[];
  };
}

export interface BasketConstituent {
  symbol: string;
  company_name: string;
  sector: string;
  weight_pct: number;
  current_price: number;
  target_shares?: number;
}

export interface ThematicBasket {
  basket_id: string;
  title: string;
  tagline: string;
  currency: 'INR' | 'USD';
  risk_profile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  rebalance_frequency: string;
  min_investment_amount: number;
  cagr_3yr_pct: number;
  annualized_sharpe: number;
  max_drawdown_pct: number;
  dividend_yield_pct: number;
  constituents: BasketConstituent[];
  description: string;
  methodology: string;
  is_active: boolean;
}

export interface SIPExecutionRecord {
  execution_id: string;
  basket_id: string;
  user_id: string;
  amount_invested: number;
  allocated_shares: Record<string, number>;
  timestamp: string;
  status: string;
}

export interface UserProfile {
  user_id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'PORTFOLIO_MANAGER' | 'TRADER' | 'INVESTOR' | 'VIEWER';
  investment_mode: 'AUTONOMOUS_TRADING' | 'LONG_TERM_WEALTH';
  totp_enabled: boolean;
}

export interface BrokerKeyVaultItem {
  broker_name: string;
  api_key_masked: string;
  secret_masked: string;
  is_connected: boolean;
  environment: string;
  updated_at: string;
}

export interface AuditLogEntry {
  log_id: string;
  user_id: string;
  username: string;
  action: string;
  resource: string;
  status: string;
  ip_address: string;
  details: Record<string, any>;
  timestamp: string;
}

// Token management in localStorage
let _authToken: string | null = localStorage.getItem('quantumfloor_jwt_token');

export function setAuthToken(token: string | null): void {
  _authToken = token;
  if (token) {
    localStorage.setItem('quantumfloor_jwt_token', token);
  } else {
    localStorage.removeItem('quantumfloor_jwt_token');
  }
}

export function getAuthToken(): string | null {
  return _authToken;
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }
  return headers;
}

const API_BASE = '/api';

export async function fetchHealth(): Promise<any> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchQuotes(): Promise<Quote[]> {
  const res = await fetch(`${API_BASE}/market/quotes`);
  return res.json();
}

export async function fetchCandles(symbol: string, limit: number = 60): Promise<Candle[]> {
  const res = await fetch(`${API_BASE}/market/candles?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
  return res.json();
}

export async function fetchOrderBook(symbol: string): Promise<OrderBookDepth> {
  const res = await fetch(`${API_BASE}/market/orderbook?symbol=${encodeURIComponent(symbol)}`);
  return res.json();
}

export async function fetchAccountSummary(): Promise<AccountSummary> {
  const res = await fetch(`${API_BASE}/accounts/summary`);
  return res.json();
}

export async function fetchQuantMetrics(): Promise<QuantMetrics> {
  const res = await fetch(`${API_BASE}/analytics/quant`);
  return res.json();
}

export async function fetchDebates(limit: number = 20, symbol?: string): Promise<AgentDebate[]> {
  const url = symbol
    ? `${API_BASE}/agents/debates?limit=${limit}&symbol=${encodeURIComponent(symbol)}`
    : `${API_BASE}/agents/debates?limit=${limit}`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchPositions(): Promise<{
  indian_equities: Position[];
  forex: Position[];
  total_active_positions: number;
}> {
  const res = await fetch(`${API_BASE}/positions`);
  return res.json();
}

export async function fetchOrders(): Promise<OrderRecord[]> {
  const res = await fetch(`${API_BASE}/orders`);
  return res.json();
}

export async function fetchTrades(limit: number = 50): Promise<TradeRecord[]> {
  const res = await fetch(`${API_BASE}/trades?limit=${limit}`);
  return res.json();
}

export async function fetchRiskMetrics(): Promise<RiskStatus> {
  const res = await fetch(`${API_BASE}/risk/metrics`);
  return res.json();
}

export async function triggerDebateCycle(symbol: string, forceExecute: boolean = false): Promise<AgentDebate> {
  const res = await fetch(`${API_BASE}/agents/run-cycle`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ symbol, force_execute: forceExecute }),
  });
  return res.json();
}

export async function toggleAutoTrading(enabled: boolean): Promise<{ auto_trading_enabled: boolean }> {
  const res = await fetch(`${API_BASE}/system/toggle-auto-trade`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ enabled }),
  });
  return res.json();
}

export async function resetCircuitBreaker(): Promise<any> {
  const res = await fetch(`${API_BASE}/risk/reset-circuit-breaker`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return res.json();
}

export async function submitManualOrder(orderData: {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  stop_loss?: number;
  take_profit?: number;
  execution_mode?: 'PAPER' | 'LIVE';
}): Promise<any> {
  const res = await fetch(`${API_BASE}/manual/order`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(orderData),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail?.message || err.detail || 'Order placement failed');
  }
  return res.json();
}

// ==================== ENTERPRISE API METHODS ====================

export async function fetchIPOs(status?: string): Promise<IPOSummary[]> {
  const url = status ? `${API_BASE}/ipo/all?status=${encodeURIComponent(status)}` : `${API_BASE}/ipo/all`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchIPOAnalysis(ipoId: string): Promise<IPOIntelligenceReport> {
  const res = await fetch(`${API_BASE}/ipo/${encodeURIComponent(ipoId)}/analysis`);
  if (!res.ok) throw new Error('Failed to fetch IPO analysis report');
  return res.json();
}

export async function applyForIPO(ipoId: string, data: { lots: number; bid_price?: number; upi_id: string }): Promise<any> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${API_BASE}/ipo/${encodeURIComponent(ipoId)}/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'IPO application failed' }));
    throw new Error(err.detail || 'IPO application failed');
  }
  return res.json();
}

export async function fetchAdvisorySignals(symbol?: string, horizon?: string): Promise<GroundedAdviceSignal[]> {
  let url = `${API_BASE}/advisory/signals`;
  const params: string[] = [];
  if (symbol) params.push(`symbol=${encodeURIComponent(symbol)}`);
  if (horizon) params.push(`horizon=${encodeURIComponent(horizon)}`);
  if (params.length > 0) url += `?${params.join('&')}`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchAdvisorySignalDetail(signalId: string): Promise<GroundedAdviceSignal> {
  const res = await fetch(`${API_BASE}/advisory/signals/${encodeURIComponent(signalId)}`);
  if (!res.ok) throw new Error('Failed to fetch signal details');
  return res.json();
}

export async function fetchBaskets(): Promise<ThematicBasket[]> {
  const res = await fetch(`${API_BASE}/baskets`);
  return res.json();
}

export async function fetchBasketDetail(basketId: string): Promise<ThematicBasket> {
  const res = await fetch(`${API_BASE}/baskets/${encodeURIComponent(basketId)}`);
  return res.json();
}

export async function investInBasket(basketId: string, amount: number): Promise<any> {
  const res = await fetch(`${API_BASE}/baskets/${encodeURIComponent(basketId)}/invest`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to execute basket investment');
  }
  return res.json();
}

export async function fetchSIPHistory(): Promise<SIPExecutionRecord[]> {
  const res = await fetch(`${API_BASE}/baskets/history/sip`);
  return res.json();
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
  return res.json();
}

export async function loginUser(credentials: { username: string; password: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Login failed');
  }
  const data = await res.json();
  setAuthToken(data.access_token);
  return data;
}

export async function oauthSocialLogin(provider: string, email: string, name?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/oauth/social-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, email, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'OAuth login failed' }));
    throw new Error(err.detail || 'OAuth login failed');
  }
  const data = await res.json();
  setAuthToken(data.access_token);
  return data;
}

export async function exportTradeBlotterReport(): Promise<{ url: string; filename: string; count: number }> {
  const res = await fetch(`${API_BASE}/storage/export-blotter`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to export trade blotter to Neon Object Storage');
  return res.json();
}

export async function exportBacktestReport(backtestData: any): Promise<{ url: string; filename: string }> {
  const res = await fetch(`${API_BASE}/storage/export-backtest`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(backtestData),
  });
  if (!res.ok) throw new Error('Failed to export backtest to Neon Object Storage');
  return res.json();
}

export async function exportPayoffReport(payoffData: any): Promise<{ url: string; filename: string }> {
  const res = await fetch(`${API_BASE}/storage/export-payoff`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payoffData),
  });
  if (!res.ok) throw new Error('Failed to export payoff matrix to Neon Object Storage');
  return res.json();
}

export async function fetchStorageReports(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/storage/reports`, { headers: getAuthHeaders() });
  return res.json();
}

export function subscribeNeonRealtime(onData: (data: any) => void): () => void {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/realtime`;
  let socket: WebSocket | null = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onData(payload);
        } catch (e) {
          console.warn('Realtime JSON parse error', e);
        }
      };
      socket.onerror = () => {
        if (socket) socket.close();
      };
      socket.onclose = () => {
        if (!isClosed) setTimeout(connect, 4000);
      };
    } catch (e) {
      console.warn('WebSocket connection attempt failed', e);
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (socket) socket.close();
  };
}

export async function registerUser(userData: {
  username: string;
  email: string;
  password: string;
  role?: string;
  investment_mode?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Registration failed');
  }
  const data = await res.json();
  setAuthToken(data.access_token);
  return data;
}

export async function switchInvestmentMode(mode: 'AUTONOMOUS_TRADING' | 'LONG_TERM_WEALTH'): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/switch-mode`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ investment_mode: mode }),
  });
  return res.json();
}

export async function fetchVaultKeys(): Promise<BrokerKeyVaultItem[]> {
  const res = await fetch(`${API_BASE}/auth/vault/keys`, { headers: getAuthHeaders() });
  return res.json();
}

export interface BrokerKeyPayload {
  broker_name: string;
  api_key: string;
  api_secret?: string;
  client_code?: string;
  pin?: string;
  totp_secret?: string;
  account_id?: string;
  environment?: string;
  extra_token?: string;
}

export async function saveVaultKey(data: BrokerKeyPayload): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/vault/keys`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to save broker credentials' }));
    throw new Error(err.detail || 'Failed to save broker credentials');
  }
  return res.json();
}

export async function verifyBrokerConnection(payload: {
  broker_name: string;
  api_key?: string;
  api_secret?: string;
  client_code?: string;
  pin?: string;
  totp_secret?: string;
  account_id?: string;
  environment?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/brokers/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchAuditLogs(limit: number = 50): Promise<AuditLogEntry[]> {
  const res = await fetch(`${API_BASE}/audit/logs?limit=${limit}`, { headers: getAuthHeaders() });
  return res.json();
}

export async function demoLogin(): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Demo login failed');
  const data = await res.json();
  if (data.access_token) setAuthToken(data.access_token);
  return data;
}

export async function resetPassword(identifier: string, newPassword: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Password reset failed');
  }
  return await res.json();
}

export async function logoutUser(): Promise<any> {
  setAuthToken(null);
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: getAuthHeaders(),
  }).catch(() => {});
}

export async function deleteVaultKey(brokerName: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/vault/keys/${encodeURIComponent(brokerName)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete vault key');
  return await res.json();
}

export async function disconnectVaultBroker(brokerName: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/vault/disconnect`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ broker_name: brokerName }),
  });
  if (!res.ok) throw new Error('Failed to disconnect broker');
  return await res.json();
}

export function downloadTradesCSV(): void {
  window.location.href = `${API_BASE}/trades/export-csv`;
}

export async function downloadBacktestCSV(reportData?: any): Promise<void> {
  if (reportData) {
    const res = await fetch(`${API_BASE}/backtest/export-csv`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });
    if (!res.ok) throw new Error('Failed to generate backtest CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QuantumFloor_Backtest_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } else {
    window.location.href = `${API_BASE}/backtest/export-csv`;
  }
}

/**
 * EventSource SSE Streaming Telemetry with automatic reconnection
 */
export function subscribeTelemetry(
  onTick: (quotes: Quote[]) => void,
  onHeartbeat?: (data: any) => void,
  onError?: (err: any) => void
): () => void {
  let eventSource: EventSource | null = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    eventSource = new EventSource(`${API_BASE}/stream/telemetry`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'TICK_UPDATE' && payload.quotes) {
          onTick(payload.quotes);
        } else if (payload.event === 'HEARTBEAT' && onHeartbeat) {
          onHeartbeat(payload);
        }
      } catch (e) {
        console.error('Failed to parse SSE payload', e);
      }
    };

    eventSource.onerror = (e) => {
      if (onError) onError(e);
      if (eventSource) {
        eventSource.close();
      }
      if (!isClosed) {
        setTimeout(connect, 3000);
      }
    };
  }

  connect();

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
    }
  };
}

// ==================== QUANTUMFLOOR PRO INTERFACES & API CALLS ====================

export interface LiveQuotePro {
  symbol: string;
  display_symbol: string;
  asset_class: string;
  price: number;
  bid: number;
  ask: number;
  open: number;
  high: number;
  low: number;
  previous_close: number;
  change: number;
  change_pct: number;
  volume: number;
  currency: string;
  exchange: string;
  timestamp: string;
  is_live: boolean;
}

export interface SwingPoint {
  index: number;
  timestamp: string;
  swing_type: 'SWING_HIGH' | 'SWING_LOW';
  price: number;
  confirmed: boolean;
}

export interface StructureBreak {
  structure_type: 'BOS' | 'CHOCH' | 'TGL';
  direction: 'BULLISH' | 'BEARISH';
  break_price: number;
  broken_swing_price: number;
  candle_index: number;
  timestamp: string;
  description: string;
}

export interface LiquidityPool {
  pool_type: 'BSL' | 'SSL';
  price_level: number;
  touches: number;
  source_indices: number[];
  is_swept: boolean;
  description: string;
}

export interface OrderBlock {
  block_type: 'BULLISH_DEMAND' | 'BEARISH_SUPPLY';
  top: number;
  bottom: number;
  candle_index: number;
  timestamp: string;
  is_mitigated: boolean;
  mitigated_at_index?: number;
  volume: number;
  strength_score: number;
}

export interface FairValueGap {
  direction: 'BULLISH' | 'BEARISH';
  top: number;
  bottom: number;
  gap_size: number;
  candle_index: number;
  timestamp: string;
  is_mitigated: boolean;
  midpoint_consequent_encroachment: number;
}

export interface FibLevel {
  ratio: number;
  price: number;
  label: string;
  is_ote: boolean;
}

export interface FibLevels {
  anchor_low: number;
  anchor_high: number;
  impulse_direction: 'BULLISH' | 'BEARISH';
  equilibrium_price: number;
  ote_pocket_low: number;
  ote_pocket_high: number;
  ote_sweet_spot: number;
  is_price_in_ote: boolean;
  is_price_in_discount: boolean;
  is_price_in_premium: boolean;
  current_price: number;
  levels: FibLevel[];
}

export interface CandlePattern {
  candle_index: number;
  timestamp: string;
  pattern_name: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence_score: number;
  description: string;
  body_ratio: number;
  upper_wick_ratio: number;
  lower_wick_ratio: number;
}

export interface SMCAnalysisReport {
  symbol: string;
  timeframe: string;
  current_price: number;
  structure: {
    active_trend: string;
    swing_highs: SwingPoint[];
    swing_lows: SwingPoint[];
    structure_breaks: StructureBreak[];
    last_bos?: StructureBreak;
    last_choch?: StructureBreak;
  };
  poi: {
    bsl_pools: LiquidityPool[];
    ssl_pools: LiquidityPool[];
    order_blocks: OrderBlock[];
    unmitigated_order_blocks: OrderBlock[];
    fair_value_gaps: FairValueGap[];
    unmitigated_fvgs: FairValueGap[];
  };
  fibonacci: FibLevels;
  candlestick_patterns: CandlePattern[];
}

export interface TradeBlueprint {
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3?: number;
  risk_reward_1: number;
  risk_reward_2: number;
  risk_reward_3?: number;
  stop_loss_pts?: number;
  stop_loss_pips?: number;
  tp1_pts?: number;
  tp1_pips?: number;
  tp2_pts?: number;
  tp2_pips?: number;
  tp3_pts?: number;
  tp3_pips?: number;
  potential_risk_amount: number;
  potential_reward_1: number;
  potential_reward_2: number;
  potential_reward_3?: number;
  confluence_score: number;
  status: 'ACTIVE_SETUP' | 'PENDING_TAP' | 'INVALIDATED';
  step1_htf_bias: string;
  step2_refined_zone: string;
  step3_confirmation: string;
  step4_blueprint_summary: string;
}

export interface SupportResistanceLevel {
  level: string;
  price: number;
  distance_pts: number;
  distance_pips: number;
  strength: string;
}

export interface MTFSetupReport {
  symbol: string;
  timestamp: string;
  current_price: number;
  macro_bias: string;
  blueprint?: TradeBlueprint;
  executive_rationale: string;
  support_levels?: SupportResistanceLevel[];
  resistance_levels?: SupportResistanceLevel[];
  internal_liquidity?: {
    inducement_idm: number;
    idm_pips: number;
    eqh_eql_status: string;
    sweep_readiness: string;
  };
  external_liquidity?: {
    bsl_target: number;
    bsl_pips: number;
    ssl_target: number;
    ssl_pips: number;
    expansion_potential: string;
  };
  order_block_quality?: {
    primary_ob_strength: string;
    unmitigated_count: number;
    fvg_fill_pct: string;
    ote_confluence: string;
  };
  quant_telemetry?: {
    recommended_lots: number;
    pip_risk: number;
    risk_reward_summary: string;
    var_95: string;
    drawdown_guard: string;
    kelly_fraction: string;
  };
}

export interface MarketSessionInfo {
  name: string;
  status: 'OPEN' | 'CLOSED' | 'PRE_OPEN';
  opens_utc: string;
  closes_utc: string;
  opens_ist: string;
  closes_ist: string;
  time_remaining: string;
  is_active: boolean;
  is_killzone?: boolean;
}

export interface KillzoneInfo {
  name: string;
  is_active: boolean;
  start_utc: string;
  end_utc: string;
  start_ist: string;
  end_ist: string;
  description: string;
}

export interface SessionOverview {
  utc_time: string;
  ist_time: string;
  nse_bse_status: string;
  nse_bse_time_remaining: string;
  active_forex_sessions: string[];
  active_killzones: string[];
  london_ny_overlap_active: boolean;
  sessions: MarketSessionInfo[];
  killzones: KillzoneInfo[];
}

export interface EconomicEvent {
  event_id: string;
  currency: string;
  event_name: string;
  impact: 'HIGH_RED' | 'MEDIUM_ORANGE' | 'LOW_YELLOW';
  scheduled_utc: string;
  scheduled_ist: string;
  forecast: string;
  previous: string;
  actual?: string;
  minutes_away: number;
  is_imminent: boolean;
  description: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  published: string;
  source: string;
  summary: string;
  affected_tickers: string[];
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentiment_score: number;
}

export interface CalendarReport {
  timestamp_utc: string;
  timestamp_ist: string;
  high_impact_warning_active: boolean;
  warning_message?: string;
  next_high_impact_event?: EconomicEvent;
  events: EconomicEvent[];
  news_articles?: NewsArticle[];
}

export interface PositionCalculationResult {
  symbol: string;
  asset_class: string;
  currency: string;
  account_balance: number;
  risk_percentage: number;
  risk_amount: number;
  entry_price: number;
  stop_loss_price: number;
  take_profit_price?: number;
  stop_loss_distance: number;
  risk_reward_ratio: number;
  sl_in_pips?: number;
  pip_value_usd?: number;
  exact_lots?: number;
  standard_lots?: number;
  mini_lots?: number;
  micro_lots?: number;
  required_margin?: number;
  shares_quantity?: number;
  fno_lots_count?: number;
  fno_contract_lot_size?: number;
  total_capital_required?: number;
  estimated_brokerage?: number;
  estimated_stt?: number;
  estimated_gst_sebi?: number;
  net_potential_profit?: number;
  summary_text: string;
}

export interface AICopilotResponse {
  markdown_answer: string;
  voice_script: string;
  active_action?: string;
  suggested_chips: string[];
  model_used: string;
}

export interface SimulatedTrade {
  trade_id: string;
  symbol: string;
  side: string;
  entry_index: number;
  exit_index?: number;
  entry_time: string;
  exit_time?: string;
  entry_price: number;
  exit_price?: number;
  stop_loss: number;
  take_profit: number;
  quantity: number;
  pnl: number;
  return_pct: number;
  exit_reason?: string;
  status: string;
}

export interface EquityPoint {
  index: number;
  timestamp: string;
  equity: number;
  drawdown_pct: number;
}

export interface BacktestReport {
  symbol: string;
  timeframe: string;
  initial_capital: number;
  final_equity: number;
  net_profit: number;
  net_return_pct: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: number;
  profit_factor: number;
  max_drawdown_pct: number;
  avg_risk_reward: number;
  trades: SimulatedTrade[];
  equity_curve: EquityPoint[];
}

export interface SIPProjectionYear {
  year: number;
  total_invested: number;
  future_value: number;
  wealth_gain: number;
  benchmark_fd_value: number;
}

export interface SIPCalculationResult {
  basket_id: string;
  monthly_sip_amount: number;
  duration_years: number;
  expected_cagr_pct: number;
  total_invested: number;
  projected_wealth: number;
  wealth_gain: number;
  yearly_trajectory: SIPProjectionYear[];
}

// ==================== PRO API CLIENT CALLS ====================

export async function fetchLiveQuotesPro(): Promise<LiveQuotePro[]> {
  const res = await fetch(`${API_BASE}/market/live-quotes`);
  if (!res.ok) throw new Error('Failed to fetch live quotes');
  return res.json();
}

export async function fetchCandlesPro(symbol: string, timeframe: string = '15M', limit: number = 350): Promise<any[]> {
  const res = await fetch(`${API_BASE}/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch candles');
  return res.json();
}

export async function fetchSMCAnalysis(symbol: string, timeframe: string = '15M'): Promise<SMCAnalysisReport> {
  const res = await fetch(`${API_BASE}/smc/analysis?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`);
  if (!res.ok) throw new Error('Failed to fetch SMC analysis');
  return res.json();
}

export async function fetchMTFSetup(symbol: string): Promise<MTFSetupReport> {
  const res = await fetch(`${API_BASE}/smc/mtf-setup?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error('Failed to fetch MTF setup blueprint');
  return res.json();
}

export async function fetchSessionOverview(): Promise<SessionOverview> {
  const res = await fetch(`${API_BASE}/macro/sessions`);
  if (!res.ok) throw new Error('Failed to fetch macro session overview');
  return res.json();
}

export async function fetchEconomicNews(): Promise<CalendarReport> {
  const res = await fetch(`${API_BASE}/macro/news`);
  if (!res.ok) throw new Error('Failed to fetch economic calendar');
  return res.json();
}

export async function calculatePositionSize(data: any): Promise<PositionCalculationResult> {
  const res = await fetch(`${API_BASE}/execution/calculate-position`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to calculate position size');
  return res.json();
}

export async function sendCopilotChat(data: {
  user_query: string;
  active_symbol: string;
  active_timeframe?: string;
  current_price?: number;
  mtf_blueprint?: any;
  macro_session?: any;
  news_calendar?: any;
}): Promise<AICopilotResponse> {
  const res = await fetch(`${API_BASE}/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to communicate with AI Co-Pilot');
  return res.json();
}

export async function runBacktest(data: {
  symbol: string;
  timeframe: string;
  initial_capital: number;
  risk_pct_per_trade: number;
}): Promise<BacktestReport> {
  const res = await fetch(`${API_BASE}/backtest/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to execute backtest');
  return res.json();
}

export async function fetchReplayStep(symbol: string, timeframe: string, stepIndex: number): Promise<any> {
  const res = await fetch(`${API_BASE}/backtest/replay-step?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&step_index=${stepIndex}`);
  if (!res.ok) throw new Error('Failed to fetch replay step');
  return res.json();
}

export async function fetchSIPProjections(basketId: string, monthly: number = 10000, years: number = 10): Promise<SIPCalculationResult> {
  const res = await fetch(`${API_BASE}/wealth/sip-projection?basket_id=${encodeURIComponent(basketId)}&monthly_amount=${monthly}&years=${years}`);
  if (!res.ok) throw new Error('Failed to fetch SIP projections');
  return res.json();
}

