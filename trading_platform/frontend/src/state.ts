/**
 * Reactive Client-Side State Store
 * Extended with Enterprise Multi-User, IPO Intelligence,
 * Grounded Advisory, and Thematic Baskets state.
 */

import {
  Quote,
  Candle,
  OrderBookDepth,
  AccountSummary,
  QuantMetrics,
  AgentDebate,
  Position,
  OrderRecord,
  TradeRecord,
  RiskStatus,
  IPOSummary,
  IPOIntelligenceReport,
  GroundedAdviceSignal,
  ThematicBasket,
  UserProfile,
  BrokerKeyVaultItem,
  AuditLogEntry,
} from './api';

export type StateListener = () => void;
export type MainViewTab = 'FLOOR' | 'IPO' | 'ADVISORY' | 'BASKETS' | 'BACKTEST' | 'NEWS' | 'SECURITY';

class StateStore {
  // Navigation & View
  public activeMainView: MainViewTab = 'FLOOR';
  public selectedSymbol: string = 'RELIANCE';
  public activeTimeframe: string = '15M';
  public activeTab: 'INDIAN_EQUITY' | 'FOREX' = 'INDIAN_EQUITY';
  public autoTradingEnabled: boolean = true;

  // User & Auth
  public currentUser: UserProfile | null = {
    user_id: 'USR-ADMIN-01',
    username: 'admin',
    email: 'admin@quantumfloor.institutional',
    role: 'ADMIN',
    investment_mode: 'AUTONOMOUS_TRADING',
    totp_enabled: true,
  };

  // Floor Data
  public quotes: Map<string, Quote> = new Map();
  public candles: Candle[] = [];
  public orderBook: OrderBookDepth | null = null;
  public accountSummary: AccountSummary | null = null;
  public quantMetrics: QuantMetrics | null = null;
  public debates: AgentDebate[] = [];
  public positions: { indian_equities: Position[]; forex: Position[] } = { indian_equities: [], forex: [] };
  public orders: OrderRecord[] = [];
  public trades: TradeRecord[] = [];
  public riskStatus: RiskStatus | null = null;
  public connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' = 'CONNECTED';

  // Enterprise Modules
  public ipos: IPOSummary[] = [];
  public selectedIpoAnalysis: IPOIntelligenceReport | null = null;
  public advisorySignals: GroundedAdviceSignal[] = [];
  public selectedSignal: GroundedAdviceSignal | null = null;
  public thematicBaskets: ThematicBasket[] = [];
  public selectedBasket: ThematicBasket | null = null;
  public vaultKeys: BrokerKeyVaultItem[] = [];
  public auditLogs: AuditLogEntry[] = [];

  private listeners: Set<StateListener> = new Set();

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('State subscriber error', err);
      }
    }
  }

  public setMainView(view: MainViewTab): void {
    this.activeMainView = view;
    this.notify();
  }

  public setQuotes(quoteList: Quote[]): void {
    for (const q of quoteList) {
      if ((q as any).last_price === undefined && (q as any).price !== undefined) {
        q.last_price = (q as any).price;
      }
      this.quotes.set(q.symbol, q);
    }
    this.notify();
  }

  public setSelectedSymbol(symbol: string): void {
    this.selectedSymbol = symbol;
    if (symbol.includes('/')) {
      this.activeTab = 'FOREX';
    } else {
      this.activeTab = 'INDIAN_EQUITY';
    }
    this.notify();
  }

  public setActiveTab(tab: 'INDIAN_EQUITY' | 'FOREX'): void {
    this.activeTab = tab;
    if (tab === 'INDIAN_EQUITY' && this.selectedSymbol.includes('/')) {
      this.selectedSymbol = 'RELIANCE';
    } else if (tab === 'FOREX' && !this.selectedSymbol.includes('/')) {
      this.selectedSymbol = 'EUR/USD';
    }
    this.notify();
  }

  public getSelectedQuote(): Quote | undefined {
    return this.quotes.get(this.selectedSymbol);
  }
}

export const store = new StateStore();
