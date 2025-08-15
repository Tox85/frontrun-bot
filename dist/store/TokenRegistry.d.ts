import { Database } from 'sqlite3';
export interface BaselineKRToken {
    base: string;
    sources: string[];
    firstSeenUtc: string;
    updatedAtUtc: string;
}
export interface ListingEvent {
    eventId: string;
    source: 'bithumb.notice' | 'bithumb.ws';
    base: string;
    url: string | undefined;
    tradeTimeUtc: string | undefined;
    createdAtUtc: string;
}
export interface Cooldown {
    base: string;
    expiresAtUtc: string;
    reason: string;
}
export declare class TokenRegistry {
    private db;
    constructor(db: Database);
    initialize(): Promise<void>;
    private ensureTablesExist;
    private tableExists;
    addToBaselineKR(base: string, source: string): Promise<void>;
    addMultipleToBaselineKR(tokens: Array<{
        base: string;
        source: string;
    }>): Promise<void>;
    isInBaselineKR(base: string): Promise<boolean>;
    getBaselineKRStats(): Promise<{
        total: number;
        bySource: Record<string, number>;
        lastUpdated: string;
    }>;
    addProcessedEvent(event: Omit<ListingEvent, 'createdAtUtc'>): Promise<boolean>;
    isEventProcessed(eventId: string): Promise<boolean>;
    getProcessedEventsStats(): Promise<{
        total: number;
        bySource: Record<string, number>;
        byBase: Record<string, number>;
    }>;
    addCooldown(base: string, reason: string, hours?: number): Promise<void>;
    isInCooldown(base: string): Promise<boolean>;
    cleanupExpiredCooldowns(): Promise<number>;
    /**
     * Vérifie si un token est nouveau (pas dans la baseline)
     */
    isNew(base: string): Promise<boolean>;
    static generateEventId(source: 'bithumb.notice' | 'bithumb.ws', base: string, url?: string, markets?: string[], tradeTime?: string): string;
    close(): Promise<void>;
}
