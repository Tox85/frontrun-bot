import { TokenRegistry } from '../store/TokenRegistry';
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
}
export declare class BaselineManager {
    private tokenRegistry;
    private rateLimiter;
    private isInitialized;
    private baselineUrl;
    constructor(tokenRegistry: TokenRegistry);
    initialize(): Promise<void>;
    private fetchAndStoreBaseline;
    private parseBaselineResponse;
    isTokenInBaseline(base: string): Promise<boolean>;
    isTokenNew(base: string): Promise<boolean>;
    getBaselineStats(): Promise<BaselineManagerStats | null>;
    refreshBaseline(): Promise<void>;
    healthCheck(): Promise<{
        isInitialized: boolean;
        baselineExists: boolean;
        tokenCount: number;
        lastUpdated: string | null;
    }>;
    stop(): Promise<void>;
    getStatus(): {
        isInitialized: boolean;
        baselineUrl: string;
        rateLimiterState: any;
    };
}
