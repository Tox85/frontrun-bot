import { TokenRegistry } from '../store/TokenRegistry';
import { TelegramService } from '../notify/TelegramService';
export interface NoticePollerConfig {
    pollIntervalMs: number;
    maxNoticesPerPoll: number;
    enableTelegram: boolean;
    enableLogging: boolean;
}
export declare class BithumbNoticePoller {
    private noticeClient;
    private tokenRegistry;
    private telegramService;
    private config;
    private isRunning;
    private pollTimer;
    private lastPollTime;
    private consecutiveErrors;
    private maxConsecutiveErrors;
    private totalPolls;
    private totalNotices;
    private totalListings;
    private lastErrorTime;
    private averageResponseTime;
    constructor(tokenRegistry: TokenRegistry, telegramService: TelegramService, config: NoticePollerConfig);
    /**
     * Démarre le polling ultra-compétitif
     */
    start(): Promise<void>;
    /**
     * Arrête le polling
     */
    stop(): void;
    /**
     * Exécute un seul cycle de polling
     */
    private pollOnce;
    /**
     * Traite une notice individuelle
     */
    private processNotice;
    /**
     * Gère les erreurs de polling
     */
    private handlePollError;
    /**
     * Planifie le prochain poll
     */
    private scheduleNextPoll;
    /**
     * Envoie les notifications Telegram pour les nouveaux listings
     */
    private notifyNewListings;
    /**
     * Formate le message Telegram
     */
    private formatTelegramMessage;
    /**
     * Retourne le statut du poller
     */
    getStatus(): {
        isRunning: boolean;
        lastPollTime: number;
        totalPolls: number;
        totalNotices: number;
        totalListings: number;
        consecutiveErrors: number;
        averageResponseTime: number;
        lastErrorTime: number;
        config: NoticePollerConfig;
    };
    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig: Partial<NoticePollerConfig>): void;
}
