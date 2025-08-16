"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpServer = void 0;
const express_1 = __importDefault(require("express"));
class HttpServer {
    app;
    server = null;
    config;
    db;
    baselineManager;
    perpCatalog;
    singletonGuard;
    noticeClient;
    wsWatcher;
    telegramService;
    tradeExecutor;
    healthMonitor;
    eventStore;
    // Métriques du système unifié
    unifiedMetrics = {
        t0_live_new: 0,
        t0_future: 0,
        t0_stale: 0,
        t0_dup_skips: 0,
        trades_opened: 0,
        ws_reconnects: 0,
        catalog_refresh_coalesced: 0,
        catalog_refresh_runs: 0
    };
    constructor(db, baselineManager, perpCatalog, singletonGuard, noticeClient = null, wsWatcher = null, telegramService, tradeExecutor = null, healthMonitor = null, eventStore, config = {}) {
        this.db = db;
        this.baselineManager = baselineManager;
        this.perpCatalog = perpCatalog;
        this.singletonGuard = singletonGuard;
        this.noticeClient = noticeClient;
        this.wsWatcher = wsWatcher;
        this.telegramService = telegramService;
        this.tradeExecutor = tradeExecutor;
        this.healthMonitor = healthMonitor;
        this.eventStore = eventStore;
        this.config = {
            port: 3030,
            host: '0.0.0.0',
            enableCors: true,
            enableLogging: true,
            ...config
        };
        this.app = (0, express_1.default)();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        // Parsing du JSON
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        // CORS
        if (this.config.enableCors) {
            this.app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
                if (req.method === 'OPTIONS') {
                    res.sendStatus(200);
                }
                else {
                    next();
                }
            });
        }
        // Logging
        if (this.config.enableLogging) {
            this.app.use((req, res, next) => {
                const start = Date.now();
                res.on('finish', () => {
                    const duration = Date.now() - start;
                    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
                });
                next();
            });
        }
    }
    setupRoutes() {
        // Health check
        this.app.get('/health', async (req, res) => {
            try {
                const health = await this.getHealthStatus();
                res.json(health);
            }
            catch (error) {
                console.error('❌ Health check failed:', error);
                res.status(500).json({ error: 'Health check failed' });
            }
        });
        // Metrics
        this.app.get('/metrics', async (req, res) => {
            try {
                const metrics = await this.getMetrics();
                res.json(metrics);
            }
            catch (error) {
                console.error('❌ Metrics failed:', error);
                res.status(500).json({ error: 'Metrics failed' });
            }
        });
        // Baseline KR
        this.app.get('/baseline', async (req, res) => {
            try {
                if (!this.baselineManager) {
                    return res.status(503).json({ error: 'Baseline manager not available' });
                }
                const stats = await this.baselineManager.getBaselineKRStats();
                res.json(stats);
                return;
            }
            catch (error) {
                console.error('❌ Baseline failed:', error);
                return res.status(500).json({ error: 'Baseline failed' });
            }
        });
        // Status
        this.app.get('/status', async (req, res) => {
            try {
                const status = await this.getStatus();
                res.json(status);
            }
            catch (error) {
                console.error('❌ Status failed:', error);
                res.status(500).json({ error: 'Status failed' });
            }
        });
        // Whoami
        this.app.get('/whoami', async (req, res) => {
            try {
                const whoami = await this.getWhoami();
                res.json(whoami);
            }
            catch (error) {
                console.error('❌ Whoami failed:', error);
                res.status(500).json({ error: 'Whoami failed' });
            }
        });
        // Trading control
        this.app.post('/trading/enable', async (req, res) => {
            try {
                // TODO: Implémenter l'activation du trading
                res.json({ message: 'Trading enabled', timestamp: new Date().toISOString() });
            }
            catch (error) {
                console.error('❌ Enable trading failed:', error);
                res.status(500).json({ error: 'Enable trading failed' });
            }
        });
        this.app.post('/trading/disable', async (req, res) => {
            try {
                // TODO: Implémenter la désactivation du trading
                res.json({ message: 'Trading disabled', timestamp: new Date().toISOString() });
            }
            catch (error) {
                console.error('❌ Disable trading failed:', error);
                res.status(500).json({ error: 'Disable trading failed' });
            }
        });
        // Simulation endpoints
        this.app.post('/simulate/notice', async (req, res) => {
            try {
                const result = await this.simulateNotice(req.body);
                res.json(result);
            }
            catch (error) {
                console.error('❌ Simulate notice failed:', error);
                res.status(500).json({ error: 'Simulate notice failed' });
            }
        });
        this.app.post('/simulate/ws', async (req, res) => {
            try {
                const result = await this.simulateWS(req.body);
                res.json(result);
            }
            catch (error) {
                console.error('❌ Simulate WS failed:', error);
                res.status(500).json({ error: 'Simulate WS failed' });
            }
        });
        // Database schema endpoint
        this.app.get('/db/schema', async (req, res) => {
            try {
                const schema = await this.getDatabaseSchema();
                res.json(schema);
            }
            catch (error) {
                console.error('❌ Database schema failed:', error);
                res.status(500).json({ error: 'Database schema failed' });
            }
        });
        // Recent events endpoint
        this.app.get('/events/recent', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 50;
                const events = await this.eventStore.getRecentEvents(limit);
                res.json(events);
            }
            catch (error) {
                console.error('❌ Recent events failed:', error);
                res.status(500).json({ error: 'Recent events failed' });
            }
        });
        // Dedup stats endpoint
        this.app.get('/events/stats', async (req, res) => {
            try {
                const stats = await this.eventStore.getDedupStats();
                res.json(stats);
            }
            catch (error) {
                console.error('❌ Dedup stats failed:', error);
                res.status(500).json({ error: 'Dedup stats failed' });
            }
        });
        this.app.post('/simulate/notify-burst', async (req, res) => {
            try {
                const result = await this.simulateNotifyBurst(req.body);
                res.json(result);
            }
            catch (error) {
                console.error('❌ Simulate notify burst failed:', error);
                res.status(500).json({ error: 'Simulate notify burst failed' });
            }
        });
        // Catch-all pour les routes non trouvées
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Route not found' });
        });
    }
    async getHealthStatus() {
        if (this.healthMonitor) {
            return await this.healthMonitor.getHealthStatus();
        }
        // Fallback si pas de HealthMonitor
        return {
            status: 'unknown',
            timestamp: new Date().toISOString(),
            message: 'HealthMonitor not available'
        };
    }
    async getMetrics() {
        let baseMetrics = {};
        if (this.healthMonitor) {
            baseMetrics = await this.healthMonitor.getMetrics();
        }
        // Métriques du système unifié
        const unifiedMetrics = {
            ...this.unifiedMetrics,
            ws_reconnects: this.wsWatcher ? this.wsWatcher.getReconnectCount?.() || 0 : 0
        };
        // Métriques du PerpCatalog si disponible
        let perpCatalogMetrics = {
            catalog_refresh_coalesced: 0,
            catalog_refresh_runs: 0
        };
        if (this.perpCatalog) {
            try {
                const guardCounters = this.perpCatalog.guard?.getCounters?.() || {};
                perpCatalogMetrics = {
                    catalog_refresh_coalesced: guardCounters.guard_coalesced || 0,
                    catalog_refresh_runs: guardCounters.guard_runs || 0
                };
                // Mettre à jour les métriques unifiées
                unifiedMetrics.catalog_refresh_coalesced = perpCatalogMetrics.catalog_refresh_coalesced;
                unifiedMetrics.catalog_refresh_runs = perpCatalogMetrics.catalog_refresh_runs;
            }
            catch (error) {
                console.warn('⚠️ Erreur lors de la récupération des métriques PerpCatalog:', error);
            }
        }
        return {
            ...baseMetrics,
            unified: unifiedMetrics,
            perp_catalog: perpCatalogMetrics,
            timestamp: new Date().toISOString()
        };
    }
    // Méthodes pour incrémenter les métriques
    incrementMetric(metric) {
        if (this.unifiedMetrics.hasOwnProperty(metric)) {
            this.unifiedMetrics[metric]++;
        }
    }
    async getStatus() {
        const wsStatus = this.wsWatcher ? this.wsWatcher.getMetrics() : null;
        const telegramStatus = this.telegramService.getStatus();
        return {
            timestamp: new Date().toISOString(),
            websocket: wsStatus || { connected: false },
            telegram: telegramStatus,
            trading: {
                enabled: !!this.tradeExecutor,
                executor_available: !!this.tradeExecutor
            }
        };
    }
    async getWhoami() {
        const instanceId = process.env.INSTANCE_ID || 'unknown';
        const isLeader = this.singletonGuard.isInstanceLeader();
        return {
            instance_id: instanceId,
            is_leader: isLeader,
            observer_mode: !isLeader,
            timestamp: new Date().toISOString()
        };
    }
    async simulateNotice(data) {
        if (!this.noticeClient) {
            throw new Error('NoticeClient not available');
        }
        // Parser tradeTimeUtc selon les formats supportés
        let tradeTimeUtc = null;
        if (data.tradeTimeUtc) {
            if (data.tradeTimeUtc === 'NOW') {
                tradeTimeUtc = new Date();
            }
            else if (data.tradeTimeUtc === 'FUTURE_30M') {
                tradeTimeUtc = new Date(Date.now() + 30 * 60 * 1000);
            }
            else {
                try {
                    tradeTimeUtc = new Date(data.tradeTimeUtc);
                }
                catch (e) {
                    console.warn('Invalid tradeTimeUtc format, using NOW');
                    tradeTimeUtc = new Date();
                }
            }
        }
        // Simuler une notice
        const simulatedNotice = {
            id: Date.now(),
            title: data.title || 'Simulated Notice',
            categories: data.categories || ['공지'],
            pc_url: data.url || 'https://example.com',
            published_at: data.published_at_kst || new Date().toISOString()
        };
        const processed = this.noticeClient.processNotice(simulatedNotice);
        if (processed) {
            // Override tradeTimeUtc si fourni dans la simulation
            if (tradeTimeUtc) {
                processed.tradeTimeUtc = tradeTimeUtc;
            }
            console.log(`🧪 Simulated notice processed: ${processed.base}`);
            // Utiliser le nouveau système unifié via NoticeHandler
            try {
                const { NoticeHandler } = await import('../watchers/NoticeHandler.js');
                const handler = new NoticeHandler({
                    eventStore: this.eventStore,
                    baselineManager: this.baselineManager || {},
                    perpCatalog: this.perpCatalog || {},
                    tradeExecutor: this.tradeExecutor || {},
                    telegramService: this.telegramService
                });
                await handler.handleNotice(processed);
                return {
                    success: true,
                    message: 'Notice simulated and processed with unified system',
                    detected: true,
                    token: processed.base,
                    timing: processed.tradeTimeUtc ? 'custom' : 'default'
                };
            }
            catch (error) {
                console.error('Error in unified notice handling:', error);
                return {
                    success: false,
                    message: 'Notice simulation failed in unified system',
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
        else {
            console.log(`❌ Simulated notice failed: not a listing notice`);
            return {
                success: false,
                message: 'Notice simulation failed - not a listing notice'
            };
        }
    }
    async simulateWS(data) {
        if (!this.wsWatcher) {
            throw new Error('WebSocket watcher not available');
        }
        const symbol = data.symbol || 'ABC_KRW';
        const base = symbol.split('_')[0];
        // Simuler un événement WebSocket
        this.wsWatcher.emit('newToken', {
            base,
            symbol,
            source: 'bithumb.ws',
            eventId: `sim_${Date.now()}`,
            confirmed: true
        });
        return {
            success: true,
            message: 'WebSocket event simulated',
            symbol,
            base
        };
    }
    async simulateNotifyBurst(data) {
        if (!this.telegramService) {
            throw new Error('Telegram service not available');
        }
        const count = Math.min(data.count || 10, 20); // Max 20 messages
        const results = [];
        for (let i = 0; i < count; i++) {
            try {
                const messageId = await this.telegramService.sendMessage(`🧪 **BURST TEST #${i + 1}** 🧪\n\nMessage de test pour validation du burst.`);
                results.push({ success: true, messageId, index: i + 1 });
            }
            catch (error) {
                results.push({ success: false, error: error instanceof Error ? error.message : 'Unknown error', index: i + 1 });
            }
        }
        return {
            success: true,
            message: `Burst test completed: ${count} messages`,
            results,
            summary: {
                total: count,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        };
    }
    async getDatabaseSchema() {
        return new Promise((resolve, reject) => {
            const schema = {
                tables: [],
                indexes: [],
                pragmas: {}
            };
            // Récupérer les tables et indexes
            this.db.all("SELECT name, sql FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (err) {
                    reject(err);
                    return;
                }
                schema.tables = tables;
                // Récupérer les indexes
                this.db.all("SELECT name, sql FROM sqlite_master WHERE type='index'", (err, indexes) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    schema.indexes = indexes;
                    // Récupérer les PRAGMAs utiles
                    this.db.get("PRAGMA journal_mode", (err, journalMode) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        schema.pragmas.journal_mode = journalMode;
                        this.db.get("PRAGMA synchronous", (err, synchronous) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            schema.pragmas.synchronous = synchronous;
                            this.db.get("PRAGMA cache_size", (err, cacheSize) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                schema.pragmas.cache_size = cacheSize;
                                this.db.get("PRAGMA temp_store", (err, tempStore) => {
                                    if (err) {
                                        reject(err);
                                        return;
                                    }
                                    schema.pragmas.temp_store = tempStore;
                                    this.db.get("PRAGMA busy_timeout", (err, busyTimeout) => {
                                        if (err) {
                                            reject(err);
                                            return;
                                        }
                                        schema.pragmas.busy_timeout = busyTimeout;
                                        resolve(schema);
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.config.port, this.config.host, () => {
                    console.log(`🌐 HTTP Server started on ${this.config.host}:${this.config.port}`);
                    resolve();
                });
                this.server.on('error', (error) => {
                    console.error('❌ HTTP Server error:', error);
                    reject(error);
                });
            }
            catch (error) {
                console.error('❌ Failed to start HTTP Server:', error);
                reject(error);
            }
        });
    }
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('🛑 HTTP Server stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
}
exports.HttpServer = HttpServer;
//# sourceMappingURL=HttpServer.js.map