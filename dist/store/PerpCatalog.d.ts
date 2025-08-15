import { Database } from 'sqlite3';
export interface PerpToken {
    exchange: string;
    base: string;
    symbol: string;
    leverageMax: number;
    updatedAtUtc: string;
}
export interface PerpLookupResult {
    hasPerp: boolean;
    symbol?: string;
    exchange?: string;
    leverageMax?: number;
}
interface PerpCatalogStats {
    total: number;
    lastUpdated: string;
    byExchange: Array<{
        exchange: string;
        count: number;
    }>;
}
export declare class PerpCatalog {
    private db;
    private refreshIntervalMs;
    private refreshTimer;
    private isRefreshing;
    constructor(db: Database, refreshIntervalMs?: number);
    initialize(): Promise<void>;
    private ensureTableExists;
    private tableExists;
    private startPeriodicRefresh;
    refreshAllExchanges(): Promise<void>;
    private refreshBybitCatalog;
    private refreshHyperliquidCatalog;
    private refreshBinanceCatalog;
    private updateCatalog;
    private updateCatalogInTransaction;
    private extractBaseFromSymbol;
    hasPerp(base: string): Promise<PerpLookupResult>;
    private getFromCache;
    private lookupDirect;
    private checkExchangeForToken;
    private cacheResult;
    getCatalogStats(): Promise<PerpCatalogStats>;
    cleanupOldTokens(maxAgeHours?: number): Promise<number>;
    stop(): void;
    getStatus(): {
        isRefreshing: boolean;
        refreshIntervalMs: number;
        lastRefreshTime?: number;
    };
}
export {};
