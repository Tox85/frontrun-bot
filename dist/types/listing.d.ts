/**
 * Types et interfaces pour le système de détection de listings coréens
 */
export interface KRBaselineToken {
    symbol: string;
    source: 'upbit' | 'bithumb';
    listed_at_utc: string;
    updated_at_utc: string;
}
export interface NoticeData {
    source: 'upbit' | 'bithumb';
    title: string;
    content: string;
    url: string;
    published_at: string;
    token_base: string;
    markets_announced: string[];
    deposit_time?: string;
    trade_time?: string;
    is_future: boolean;
    confidence_score: number;
}
export interface ListingEvent {
    eventId: string;
    source: 'upbit' | 'bithumb';
    token_base: string;
    markets: string[];
    deposit_time?: string;
    trade_time?: string;
    notice_url: string;
    detected_at: string;
    is_krw_listing: boolean;
    confidence_score: number;
}
export interface PerpAvailability {
    exchange: 'bybit' | 'hyperliquid' | 'binance';
    symbol: string;
    available: boolean;
    testnet: boolean;
}
export interface TradeExecution {
    eventId: string;
    token_base: string;
    exchange: string;
    symbol: string;
    side: 'long' | 'short';
    quantity: number;
    price: number;
    notional: number;
    executed_at: string;
    exit_scheduled_at: string;
    status: 'open' | 'closed' | 'cancelled';
    pnl?: number;
    pnl_percentage?: number;
}
export interface ScheduledExit {
    id: string;
    eventId: string;
    exchange: string;
    symbol: string;
    exit_at: string;
    status: 'pending' | 'executed' | 'failed' | 'cancelled';
    created_at: string;
}
export interface HealthMetrics {
    baseline: {
        upbit_krw_tokens: number;
        bithumb_krw_tokens: number;
        kr_union_tokens: number;
        sanity: boolean;
    };
    performance: {
        p95_detected_to_order: number;
        p95_order_to_ack: number;
        total_events: number;
        total_trades: number;
    };
    trading: {
        enabled: boolean;
        consecutive_failures: number;
        circuit_breaker: boolean;
    };
    timestamp: string;
}
