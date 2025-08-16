"use strict";
/**
 * HealthMonitor - Surveillance de la santé du bot
 * Métriques de performance, trading et baseline
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitor = void 0;
const Quantiles_1 = require("./Quantiles");
class HealthMonitor {
    db;
    baselineManager;
    wsWatcher;
    telegramService;
    exitScheduler;
    instanceId;
    startTime;
    quantiles;
    // Métriques de performance
    detectionLatencies = [];
    orderLatencies = [];
    noticeLatencies = [];
    /**
     * Calcule un percentile simple
     */
    calculatePercentile(values, percentile) {
        if (values.length === 0)
            return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = (percentile / 100) * (sorted.length - 1);
        const lowerIndex = Math.floor(index);
        const upperIndex = Math.ceil(index);
        if (lowerIndex === upperIndex) {
            return sorted[lowerIndex] || 0;
        }
        // Interpolation linéaire
        const lowerValue = sorted[lowerIndex];
        const upperValue = sorted[upperIndex];
        const weight = index - lowerIndex;
        return (lowerValue || 0) + weight * ((upperValue || 0) - (lowerValue || 0));
    }
    // Compteurs d'erreurs
    notice5xxCount = 0;
    notice429Count = 0;
    tradesExecuted = 0;
    tradesFailed = 0;
    constructor(db, baselineManager, instanceId, wsWatcher, telegramService, exitScheduler) {
        this.db = db;
        this.baselineManager = baselineManager;
        this.wsWatcher = wsWatcher;
        this.telegramService = telegramService;
        this.exitScheduler = exitScheduler;
        this.instanceId = instanceId;
        this.startTime = Date.now();
        this.quantiles = Quantiles_1.Quantiles.getInstance();
    }
    /**
     * Enregistre une latence de détection → ordre
     */
    recordDetectionLatency(latencyMs) {
        this.detectionLatencies.push(latencyMs);
        // Garder seulement les 1000 dernières mesures
        if (this.detectionLatencies.length > 1000) {
            this.detectionLatencies.shift();
        }
    }
    /**
     * Enregistre une latence d'ordre → ack
     */
    recordOrderLatency(latencyMs) {
        this.orderLatencies.push(latencyMs);
        // Garder seulement les 1000 dernières mesures
        if (this.orderLatencies.length > 1000) {
            this.orderLatencies.shift();
        }
    }
    /**
     * Enregistre une latence de traitement de notice
     */
    recordNoticeLatency(latencyMs) {
        this.noticeLatencies.push(latencyMs);
        // Garder seulement les 1000 dernières mesures
        if (this.noticeLatencies.length > 1000) {
            this.noticeLatencies.shift();
        }
    }
    /**
     * Enregistre une erreur 5xx sur les notices
     */
    recordNotice5xx() {
        this.notice5xxCount++;
    }
    /**
     * Enregistre une erreur 429 sur les notices
     */
    recordNotice429() {
        this.notice429Count++;
    }
    /**
     * Enregistre un trade exécuté
     */
    recordTradeExecuted() {
        this.tradesExecuted++;
    }
    /**
     * Enregistre un trade échoué
     */
    recordTradeFailed() {
        this.tradesFailed++;
    }
    /**
     * Obtient le statut de santé complet
     */
    async getHealthStatus() {
        try {
            const baselineHealth = await this.baselineManager.healthCheck();
            const wsMetrics = this.wsWatcher?.getMetrics() || {};
            const telegramStatus = this.telegramService?.getStatus();
            const exitStats = await this.getExitStats();
            // Calculer les P95 (approximation simple)
            const p95Detection = this.calculatePercentile(this.detectionLatencies, 95);
            const p95Order = this.calculatePercentile(this.orderLatencies, 95);
            const p95Notice = this.calculatePercentile(this.noticeLatencies, 95);
            // Déterminer le statut global
            let status = 'healthy';
            if (!baselineHealth.sanity || wsMetrics.reconnects > 6 || this.notice5xxCount > 5) {
                status = 'degraded';
            }
            if (!baselineHealth.baselineExists || wsMetrics.reconnects > 10) {
                status = 'unhealthy';
            }
            return {
                status,
                timestamp: new Date().toISOString(),
                instance: {
                    id: this.instanceId,
                    isLeader: true, // TODO: récupérer depuis SingletonGuard
                    observerMode: false, // TODO: récupérer depuis SingletonGuard
                    uptime: Date.now() - this.startTime
                },
                baseline: {
                    krw_count: baselineHealth.tokenCount,
                    sanity: baselineHealth.sanity,
                    lastUpdated: baselineHealth.lastUpdated
                },
                detection: {
                    t0_active: true, // TODO: récupérer depuis NoticeClient
                    t2_active: wsMetrics.isConnected || false,
                    last_detection: null // TODO: récupérer depuis la DB
                },
                trading: {
                    enabled: true, // TODO: récupérer depuis la config
                    positions_open: 0, // TODO: récupérer depuis HyperliquidAdapter
                    exits_pending: exitStats.pending
                },
                websocket: {
                    connected: wsMetrics.isConnected || false,
                    reconnects: wsMetrics.reconnects || 0,
                    last_message: wsMetrics.lastMessageTime ? new Date(wsMetrics.lastMessageTime).toISOString() : null
                },
                telegram: {
                    enabled: telegramStatus?.enabled || false,
                    queue_length: telegramStatus?.queueLength || 0,
                    observer_mode: telegramStatus?.observerMode || false
                },
                performance: {
                    p95_detected_to_order: p95Detection || 0,
                    p95_order_to_ack: p95Order || 0,
                    p95_notice_processing: p95Notice || 0
                }
            };
        }
        catch (error) {
            console.error('❌ Erreur lors de la récupération du statut de santé:', error);
            // Retourner un statut d'erreur
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                instance: {
                    id: this.instanceId,
                    isLeader: false,
                    observerMode: true,
                    uptime: Date.now() - this.startTime
                },
                baseline: {
                    krw_count: 0,
                    sanity: false,
                    lastUpdated: null
                },
                detection: {
                    t0_active: false,
                    t2_active: false,
                    last_detection: null
                },
                trading: {
                    enabled: false,
                    positions_open: 0,
                    exits_pending: 0
                },
                websocket: {
                    connected: false,
                    reconnects: 0,
                    last_message: null
                },
                telegram: {
                    enabled: false,
                    queue_length: 0,
                    observer_mode: true
                },
                performance: {
                    p95_detected_to_order: 0,
                    p95_order_to_ack: 0,
                    p95_notice_processing: 0
                }
            };
        }
    }
    /**
     * Obtient toutes les métriques
     */
    async getMetrics() {
        try {
            const wsMetrics = this.wsWatcher?.getMetrics() || {};
            const telegramStatus = this.telegramService?.getStatus();
            const exitStats = await this.getExitStats();
            const perpStats = await this.getPerpStats();
            return {
                // WebSocket
                ws_reconnects: wsMetrics.reconnects || 0,
                ws_connected: wsMetrics.isConnected || false,
                ws_last_message_age: wsMetrics.lastMessageTime ? Date.now() - wsMetrics.lastMessageTime : 0,
                // Exits
                exit_pending: exitStats.pending,
                exit_executed: exitStats.executed,
                exit_failed: exitStats.failed,
                // Telegram
                telegram_queue_len: telegramStatus?.queueLength || 0,
                telegram_messages_sent: 0, // TODO: compteur depuis TelegramService
                telegram_rate_limited: 0, // TODO: compteur depuis TelegramService
                // Perps
                perps_bybit: perpStats.bybit,
                perps_hyperliquid: perpStats.hyperliquid,
                perps_binance: perpStats.binance,
                perps_total: perpStats.total,
                perp_catalog_age: perpStats.age,
                // Notices
                notice_5xx_count: this.notice5xxCount,
                notice_429_count: this.notice429Count,
                notice_processing_time_p95: this.calculatePercentile(this.noticeLatencies, 95),
                // Trading
                trades_executed: this.tradesExecuted,
                trades_failed: this.tradesFailed,
                circuit_breaker_active: false // TODO: récupérer depuis TradeExecutor
            };
        }
        catch (error) {
            console.error('❌ Erreur lors de la récupération des métriques:', error);
            throw error;
        }
    }
    /**
     * Obtient les statistiques des exits
     */
    async getExitStats() {
        try {
            const pending = await this.db.get('SELECT COUNT(*) as count FROM scheduled_exits WHERE status = "PENDING"');
            const executed = await this.db.get('SELECT COUNT(*) as count FROM scheduled_exits WHERE status = "EXECUTED"');
            const failed = await this.db.get('SELECT COUNT(*) as count FROM scheduled_exits WHERE status = "FAILED"');
            return {
                pending: pending?.count || 0,
                executed: executed?.count || 0,
                failed: failed?.count || 0
            };
        }
        catch (error) {
            console.error('❌ Erreur lors de la récupération des stats exits:', error);
            return { pending: 0, executed: 0, failed: 0 };
        }
    }
    /**
     * Obtient les statistiques des perps
     */
    async getPerpStats() {
        try {
            const bybit = await this.db.get('SELECT COUNT(*) as count FROM perp_catalog WHERE exchange = "BYBIT"');
            const hyperliquid = await this.db.get('SELECT COUNT(*) as count FROM perp_catalog WHERE exchange = "HYPERLIQUID"');
            const binance = await this.db.get('SELECT COUNT(*) as count FROM perp_catalog WHERE exchange = "BINANCE"');
            const total = await this.db.get('SELECT COUNT(*) as count FROM perp_catalog');
            const age = await this.db.get('SELECT MAX(updated_at_utc) as max_updated FROM perp_catalog');
            const ageMs = age && age.max_updated ?
                Date.now() - new Date(age.max_updated).getTime() :
                0;
            return {
                bybit: bybit?.count || 0,
                hyperliquid: hyperliquid?.count || 0,
                binance: binance?.count || 0,
                total: total?.count || 0,
                age: ageMs
            };
        }
        catch (error) {
            console.error('❌ Erreur lors de la récupération des stats perps:', error);
            return { bybit: 0, hyperliquid: 0, binance: 0, total: 0, age: 0 };
        }
    }
    /**
     * Vérifie si le système est en bonne santé
     */
    async isHealthy() {
        const health = await this.getHealthStatus();
        return health.status === 'healthy';
    }
    /**
     * Obtient un résumé rapide de la santé
     */
    async getHealthSummary() {
        const health = await this.getHealthStatus();
        const metrics = await this.getMetrics();
        return {
            status: health.status,
            baseline_krw_count: health.baseline.krw_count,
            sanity: health.baseline.sanity,
            ws_reconnects: metrics.ws_reconnects,
            exit_pending: metrics.exit_pending
        };
    }
}
exports.HealthMonitor = HealthMonitor;
//# sourceMappingURL=HealthMonitor.js.map