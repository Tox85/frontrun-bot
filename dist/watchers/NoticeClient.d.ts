import { HttpClient } from '../core/HttpClient';
import { WatermarkStore } from '../store/WatermarkStore';
export interface BithumbNotice {
    id?: number;
    title: string;
    content?: string;
    categories?: string[];
    pc_url?: string;
    published_at: string;
    base?: string;
    url?: string;
    markets?: string[];
    tradeTimeUtc?: Date;
    source?: string;
}
export interface ProcessedNotice {
    eventId: string;
    base: string;
    url: string;
    tradeTimeUtc: Date;
    source: "bithumb.notice" | "bithumb.ws" | "simulate";
    title: string;
    content: string;
    categories: string[];
    markets?: string[];
    timing?: "live" | "future" | "stale";
    bypassBaseline?: boolean;
    bypassCooldown?: boolean;
    dryRun?: boolean;
}
export declare class NoticeClient {
    private baseUrl;
    private httpClient;
    private watermarkStore;
    private logDedupWindowMs;
    private logDedupMaxPerWindow;
    private _isEnabled;
    private retryTimer;
    private static readonly HTML_LIST_URL;
    private static readonly JSON_URL;
    private circuitBreakers;
    private htmlState;
    private htmlNextRetryAt;
    private static readonly GENERIC_ALIASES;
    constructor(baseUrl: string, httpClient: HttpClient, watermarkStore: WatermarkStore, logDedupWindowMs?: number, logDedupMaxPerWindow?: number);
    /**
     * Active T0
     */
    enable(): void;
    /**
     * Désactive T0 et programme un retry
     */
    disable(reason: string): void;
    private scheduleRetry;
    private noteError;
    private canTry;
    private noteSuccess;
    private fetchJsonNoticeAsText;
    private fetchHtmlNoticeAsText;
    private debugHttpProblem;
    /**
     * PATCH T0 Robust: Génère un eventId unique pour une notice
     */
    private buildNoticeEventId;
    /**
     * PATCH T0 Robust: Choisit la meilleure source entre JSON et HTML
     */
    private chooseBestSource;
    /**
     * PATCH T0 Robust: Extraction des bases avec fusion des détecteurs
     */
    private extractBasesOnce;
    /**
     * PATCH T0 Robust: Scoring intelligent avec override
     */
    private calculateT0Score;
    /**
     * PATCH T0 Robust: Traitement des notices avec préfiltrage watermark
     */
    processNotice(notice: BithumbNotice, opts?: {
        source?: "t0" | "t2" | "simulate";
        ignoreWatermark?: boolean;
        forceTiming?: "live" | "future" | "stale";
        bypassBaseline?: boolean;
        bypassCooldown?: boolean;
        dryRun?: boolean;
    }): Promise<ProcessedNotice[]>;
    /**
     * PATCH T0 Robust: Récupération des notices avec fallback multi-source
     */
    fetchLatestNotices(): Promise<BithumbNotice[]>;
    /**
     * Récupère les dernières notices traitées (alias pour compatibilité)
     */
    getLatestListings(count?: number): Promise<ProcessedNotice[]>;
    /**
     * Récupère le déduplicateur de logs (alias pour compatibilité)
     */
    getLogDeduper(): {
        dedup: (key: string, ttlMs: number) => boolean;
        clear: () => void;
    };
    /**
     * Arrête le polling (alias pour compatibilité)
     */
    stopPolling(): void;
    /**
     * PATCH T0 Robust: Parse les notices depuis le HTML de fallback
     */
    private parseNoticesFromHtml;
    /**
     * Parse le temps de trade depuis le format KST
     */
    private parseTradeTime;
    /**
     * Vérifie si le client est activé
     */
    get isEnabled(): boolean;
    /**
     * Arrête le client
     */
    stop(): void;
}
