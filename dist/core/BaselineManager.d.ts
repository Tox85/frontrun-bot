import { Database } from 'sqlite3';
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
    private isInitialized;
    private baselineUrl;
    private readonly stableCoins;
    constructor(db: Database);
    initialize(): Promise<void>;
    private fetchAndStoreBaseline;
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
    }>;
    stop(): Promise<void>;
    getStatus(): {
        isInitialized: boolean;
        baselineUrl: string;
        rateLimiterState: any;
        isBootOnly: boolean;
    };
}
