import { Database } from 'sqlite3';
export interface ProcessedEvent {
    eventId: string;
    source: 'bithumb.notice' | 'bithumb.ws';
    base: string;
    url?: string;
    markets?: string[];
    tradeTimeUtc?: string;
    rawTitle?: string;
}
export type MarkProcessedResult = 'INSERTED' | 'DUPLICATE';
export declare class EventStore {
    private db;
    constructor(db: Database);
    /**
     * Marque un événement comme traité de manière atomique et idempotente
     * BEGIN IMMEDIATE pour éviter les races multi-threads
     * INSERT OR IGNORE → idempotence garantie
     */
    tryMarkProcessed(event: ProcessedEvent): Promise<MarkProcessedResult>;
    /**
     * Vérifie si un événement a déjà été traité
     */
    isProcessed(eventId: string): Promise<boolean>;
    /**
     * Vérifie si une base a déjà été tradée récemment (cooldown cross-source)
     */
    isBaseRecentlyTraded(base: string, cooldownHours?: number): Promise<boolean>;
    /**
     * Marque une base comme tradée (pour éviter les doubles trades cross-source)
     */
    markBaseAsTraded(base: string, eventId: string): Promise<void>;
    /**
     * Récupère les événements récents pour le monitoring
     */
    getRecentEvents(limit?: number): Promise<any[]>;
    /**
     * Statistiques de déduplication
     */
    getDedupStats(): Promise<{
        total: number;
        bySource: {
            source: string;
            count: number;
        }[];
        byBase: {
            base: string;
            count: number;
        }[];
    }>;
    /**
     * Nettoyage des anciens événements (maintenance)
     */
    cleanupOldEvents(olderThanDays?: number): Promise<number>;
}
