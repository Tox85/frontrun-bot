"use strict";
// Contrôleur de dashboard web simple
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
class DashboardController {
    metrics;
    logger;
    startTime;
    constructor(metrics, logger) {
        this.metrics = metrics;
        this.logger = logger;
        this.startTime = Date.now();
    }
    /**
     * Obtenir les données du dashboard
     */
    getDashboardData() {
        try {
            const metricsStats = this.metrics.getStats();
            return {
                system: {
                    uptime: Date.now() - this.startTime,
                    memory: process.memoryUsage(),
                    version: process.version
                },
                bot: {
                    status: 'running',
                    leaderInstanceId: process.env.INSTANCE_ID || 'unknown',
                    tradingEnabled: process.env.TRADING_ENABLED === 'true'
                },
                metrics: {
                    totalMetrics: metricsStats.totalMetrics,
                    totalValues: metricsStats.totalValues
                },
                timestamp: Date.now()
            };
        }
        catch (error) {
            this.logger.error('Erreur dashboard', error, { component: 'DashboardController' });
            return this.getErrorData();
        }
    }
    /**
     * Données d'erreur
     */
    getErrorData() {
        return {
            system: { uptime: 0, memory: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, arrayBuffers: 0 }, version: 'unknown' },
            bot: { status: 'error', leaderInstanceId: 'unknown', tradingEnabled: false },
            metrics: { totalMetrics: 0, totalValues: 0 },
            timestamp: Date.now()
        };
    }
    /**
     * HTML du dashboard
     */
    getDashboardHTML() {
        const data = this.getDashboardData();
        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Bot Frontrun Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f0f0f0; }
        .container { max-width: 800px; margin: 0 auto; }
        .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px; background: #f8f9fa; }
        .status { padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        .status.running { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        .refresh-btn { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Bot Frontrun Dashboard</h1>
        <button class="refresh-btn" onclick="location.reload()">🔄 Actualiser</button>
        
        <div class="card">
            <h3>📊 Système</h3>
            <div class="metric">
                <span>Uptime:</span>
                <span>${Math.floor(data.system.uptime / 1000 / 60)} min</span>
            </div>
            <div class="metric">
                <span>Mémoire:</span>
                <span>${Math.round(data.system.memory.heapUsed / 1024 / 1024)} MB</span>
            </div>
            <div class="metric">
                <span>Version:</span>
                <span>${data.system.version}</span>
            </div>
        </div>
        
        <div class="card">
            <h3>🎯 Bot Status</h3>
            <div class="metric">
                <span>Statut:</span>
                <span class="status ${data.bot.status}">${data.bot.status}</span>
            </div>
            <div class="metric">
                <span>Leader:</span>
                <span>${data.bot.leaderInstanceId}</span>
            </div>
            <div class="metric">
                <span>Trading:</span>
                <span>${data.bot.tradingEnabled ? 'Activé' : 'Désactivé'}</span>
            </div>
        </div>
        
        <div class="card">
            <h3>📈 Métriques</h3>
            <div class="metric">
                <span>Total Métriques:</span>
                <span>${data.metrics.totalMetrics}</span>
            </div>
            <div class="metric">
                <span>Total Valeurs:</span>
                <span>${data.metrics.totalValues}</span>
            </div>
        </div>
        
        <div style="text-align: center; color: #666; margin-top: 20px;">
            Dernière mise à jour: ${new Date(data.timestamp).toLocaleString('fr-FR')}
        </div>
    </div>
    
    <script>
        setInterval(() => location.reload(), 30000);
    </script>
</body>
</html>`;
    }
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=DashboardController.js.map