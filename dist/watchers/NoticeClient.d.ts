import { WatermarkStore } from '../store/WatermarkStore';
import { LogDeduper } from '../core/LogDeduper';
export interface BithumbNotice {
    id?: number;
    title: string;
    categories: string[];
    pc_url: string;
    published_at: string;
    content?: string;
}
export interface ProcessedNotice {
    eventId: string;
    base: string;
    title: string;
    url: string;
    publishedAtUtc: string;
    markets: string[];
    priority: 'high' | 'medium' | 'low';
    status: 'scheduled' | 'live' | 'completed';
    source: 'bithumb.notice';
    tradeTimeUtc?: Date | undefined;
}
export declare class NoticeClient {
    private readonly baseUrl;
    private readonly keywords;
    private readonly rateLimit;
    private watermarkStore;
    private logDeduper;
    private httpClient;
    private pollCount;
    private _isEnabled;
    private pollTimer;
    private retryTimer;
    /**
     * Méthode publique pour accéder au logDeduper (pour flush lors de l'arrêt)
     */
    getLogDeduper(): LogDeduper;
    constructor(watermarkStore: WatermarkStore, config?: {
        logDedupWindowMs?: number;
        logDedupMaxPerWindow?: number;
        maxNoticeAgeMin?: number;
    });
    /**
     * Active T0 seulement si la baseline est prête
     */
    enable(): void;
    /**
     * Désactive T0 et programme un retry
     */
    disable(reason: string): void;
    private scheduleRetry;
    /**
     * Filtre les notices pour détecter les nouveaux listings
     */
    isListingNotice(notice: BithumbNotice): boolean;
    /**
     * Extrait la base du token depuis le titre
     */
    private extractTokenBase;
    /**
     * Extrait les marchés mentionnés
     */
    extractMarkets(notice: BithumbNotice): string[];
    /**
     * Convertit le timestamp KST en UTC
     */
    parsePublishedUtc(notice: BithumbNotice): string;
    /**
     * Détecte si c'est un pré-listing (date future) et retourne la Date
     */
    parseTradeTime(notice: BithumbNotice): Date | null;
    /**
     * Calcule la priorité du listing
     */
    calculatePriority(notice: BithumbNotice): 'high' | 'medium' | 'low';
    /**
     * Traite une notice et la convertit en format interne
     * NE LOG PLUS "Notice processed" ici - sera fait après déduplication
     */
    processNotice(notice: BithumbNotice): ProcessedNotice | null;
    /**
     * Récupère les dernières notices depuis l'API officielle Bithumb
     * UNIQUEMENT l'API publique - pas de scraping du site web
     */
    fetchLatestNotices(count?: number): Promise<BithumbNotice[]>;
    /**
     * Démarrer le polling avec jitter
     */
    startPolling(callback: (listings: ProcessedNotice[]) => void): void;
    private scheduleNextPoll;
    private pollWithCallback;
    private getPollStats;
    /**
     * Arrêter le polling
     */
    stopPolling(): void;
    /**
     * Récupère et traite les dernières notices avec watermark et déduplication
     */
    getLatestListings(count?: number): Promise<ProcessedNotice[]>;
    getCircuitBreakerStats(): import("../core/CircuitBreaker").CircuitBreakerStats;
    isEnabled(): boolean;
}
