import { Database } from 'sqlite3';
export type BaselineState = 'READY' | 'CACHED' | 'DEGRADED';
export interface BithumbKRToken {
    symbol: string;
    base: string;
    quote: string;
    status: string;
    listedAt: string;
}
export interface BaselineManagerStats {
    totalTokens: number;
    activeTokens: number;
    lastUpdated: string;
    source: string;
    sanity: boolean;
}
export declare class BaselineManager {
    private db;
    private rateLimiter;
    private httpClient;
    private isInitialized;
    private state;
    private baselineUrl;
    private readonly stableCoins;
    private retryTimer;
    private lastBaselineFetchMs;
    private errors999Last5m;
    private errorCounters;
    constructor(db: Database);
    initialize(): Promise<void>;
    private fetchAndStoreBaseline;
    private loadExistingBaseline;
    private scheduleRetry;
    private recordError;
    private storeBaselineKR;
    private parseBaselineResponse;
    isTokenInBaseline(base: string): Promise<boolean>;
    isTokenNew(base: string): Promise<boolean>;
    getBaselineKRStats(): Promise<{
        total: number;
        lastUpdated: string;
        sanity: boolean;
    } | null>;
    getBaselineStats(): Promise<BaselineManagerStats | null>;
    healthCheck(): Promise<{
        isInitialized: boolean;
        baselineExists: boolean;
        tokenCount: number;
        lastUpdated: string | null;
        sanity: boolean;
        state: BaselineState;
        circuitBreakerState: string;
        lastBaselineFetchMs: number | null;
        errors999Last5m: number;
    }>;
    stop(): Promise<void>;
    getStatus(): {
        isInitialized: boolean;
        baselineUrl: string;
        rateLimiterState: any;
        isBootOnly: boolean;
        state: BaselineState;
        circuitBreakerStats: any;
    };
    getState(): BaselineState;
    canActivateT0(): boolean;
}
