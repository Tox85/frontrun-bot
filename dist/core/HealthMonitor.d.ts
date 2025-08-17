/**
 * HealthMonitor - Surveillance de la santé du bot
 * Métriques de performance, trading et baseline
 */
import { Database } from 'sqlite3';
import { BaselineManager } from './BaselineManager';
import { BithumbWSWatcher } from '../watchers/BithumbWSWatcher';
import { TelegramService } from '../notify/TelegramService';
import { ExitScheduler } from './ExitScheduler';
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    instance: {
        id: string;
        isLeader: boolean;
        observerMode: boolean;
        uptime: number;
    };
    baseline: {
        krw_count: number;
        sanity: boolean;
        lastUpdated: string | null;
    };
    detection: {
        t0_active: boolean;
        t2_active: boolean;
        last_detection: string | null;
    };
    trading: {
        enabled: boolean;
        positions_open: number;
        exits_pending: number;
    };
    websocket: {
        connected: boolean;
        reconnects: number;
        last_message: string | null;
    };
    telegram: {
        enabled: boolean;
        queue_length: number;
        observer_mode: boolean;
    };
    performance: {
        p95_detected_to_order: number;
        p95_order_to_ack: number;
        p95_notice_processing: number;
    };
    baseline_state?: 'READY' | 'CACHED' | 'DEGRADED';
    baseline_cb_state?: string;
    last_baseline_fetch_ms?: number | null;
    errors_999_last_5m?: number;
    t0_enabled?: boolean;
    t0_cb_state?: string;
    t2_enabled?: boolean;
    ws_connected?: boolean;
    leader_instance_id?: string;
}
export interface MetricsData {
    ws_reconnects: number;
    ws_connected: boolean;
    ws_last_message_age: number;
    exit_pending: number;
    exit_executed: number;
    exit_failed: number;
    telegram_queue_len: number;
    telegram_messages_sent: number;
    telegram_rate_limited: number;
    perps_bybit: number;
    perps_hyperliquid: number;
    perps_binance: number;
    perps_total: number;
    perp_catalog_age: number;
    notice_5xx_count: number;
    notice_429_count: number;
    notice_processing_time_p95: number;
    trades_executed: number;
    trades_failed: number;
    circuit_breaker_active: boolean;
}
export declare class HealthMonitor {
    private db;
    private baselineManager;
    private wsWatcher;
    private telegramService;
    private exitScheduler;
    private instanceId;
    private startTime;
    private quantiles;
    private detectionLatencies;
    private orderLatencies;
    private noticeLatencies;
    /**
     * Calcule un percentile simple
     */
    private calculatePercentile;
    private notice5xxCount;
    private notice429Count;
    private tradesExecuted;
    private tradesFailed;
    constructor(db: Database, baselineManager: BaselineManager, instanceId: string, wsWatcher?: BithumbWSWatcher, telegramService?: TelegramService, exitScheduler?: ExitScheduler);
    /**
     * Enregistre une latence de détection → ordre
     */
    recordDetectionLatency(latencyMs: number): void;
    /**
     * Enregistre une latence d'ordre → ack
     */
    recordOrderLatency(latencyMs: number): void;
    /**
     * Enregistre une latence de traitement de notice
     */
    recordNoticeLatency(latencyMs: number): void;
    /**
     * Enregistre une erreur 5xx sur les notices
     */
    recordNotice5xx(): void;
    /**
     * Enregistre une erreur 429 sur les notices
     */
    recordNotice429(): void;
    /**
     * Enregistre un trade exécuté
     */
    recordTradeExecuted(): void;
    /**
     * Enregistre un trade échoué
     */
    recordTradeFailed(): void;
    /**
     * Obtient le statut de santé complet
     */
    getHealthStatus(): Promise<HealthStatus>;
    /**
     * Obtient toutes les métriques
     */
    getMetrics(): Promise<MetricsData>;
    /**
     * Obtient les statistiques des exits
     */
    private getExitStats;
    /**
     * Obtient les statistiques des perps
     */
    private getPerpStats;
    /**
     * Vérifie si le système est en bonne santé
     */
    isHealthy(): Promise<boolean>;
    /**
     * Obtient un résumé rapide de la santé
     */
    getHealthSummary(): Promise<{
        status: string;
        baseline_krw_count: number;
        sanity: boolean;
        ws_reconnects: number;
        exit_pending: number;
    }>;
}
