"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BithumbNoticePoller = void 0;
const NoticeClient_1 = require("./NoticeClient");
const HttpClient_1 = require("../core/HttpClient");
const RunStats_1 = require("../metrics/RunStats");
class BithumbNoticePoller {
    noticeClient;
    tokenRegistry;
    telegramService;
    watermarkStore;
    config;
    isRunning = false;
    pollTimer = null;
    lastPollTime = 0;
    consecutiveErrors = 0;
    maxConsecutiveErrors = 5;
    // Métriques de performance
    totalPolls = 0;
    totalNotices = 0;
    totalListings = 0;
    totalNewListings = 0;
    totalSkippedWatermark = 0;
    lastErrorTime = 0;
    averageResponseTime = 0;
    constructor(tokenRegistry, telegramService, watermarkStore, config) {
        this.watermarkStore = watermarkStore;
        this.noticeClient = new NoticeClient_1.NoticeClient('https://api.bithumb.com/v1/notices', new HttpClient_1.HttpClient('NoticeClient', {
            timeoutMs: 5000,
            maxRetries: 3,
            baseRetryDelayMs: 250,
            maxRetryDelayMs: 500,
            jitterPercent: 20
        }), watermarkStore, 60000, // logDedupWindowMs
        2 // logDedupMaxPerWindow
        );
        this.tokenRegistry = tokenRegistry;
        this.telegramService = telegramService;
        this.config = config;
        console.log('🚀 BithumbNoticePoller initialized with ultra-competitive T0 detection + watermark');
    }
    /**
     * Démarre le polling ultra-compétitif
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ NoticePoller already running');
            return;
        }
        console.log('🚀 Starting ultra-competitive T0 detection...');
        this.isRunning = true;
        // Premier poll immédiat
        await this.pollOnce();
        // Démarrer le polling périodique
        this.scheduleNextPoll();
        console.log(`✅ NoticePoller started with ${this.config.pollIntervalMs}ms interval`);
    }
    /**
     * Arrête le polling
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        console.log('🛑 Stopping NoticePoller...');
        this.isRunning = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        console.log('✅ NoticePoller stopped');
    }
    /**
     * Exécute un seul cycle de polling
     */
    async pollOnce() {
        if (!this.isRunning)
            return;
        const startTime = Date.now();
        this.lastPollTime = startTime;
        this.totalPolls++;
        try {
            console.log(`📡 T0 Poll #${this.totalPolls} - Fetching latest notices...`);
            // Récupérer les dernières notices via l'API officielle
            const notices = await this.noticeClient.getLatestListings(this.config.maxNoticesPerPoll);
            this.totalNotices += notices.length;
            // Traiter chaque notice
            let newListings = 0;
            for (const notice of notices) {
                if (await this.processNotice(notice)) {
                    newListings++;
                }
            }
            this.totalListings += newListings;
            // Réinitialiser les erreurs en cas de succès
            this.consecutiveErrors = 0;
            // Calculer le temps de réponse moyen
            const responseTime = Date.now() - startTime;
            this.averageResponseTime = (this.averageResponseTime * (this.totalPolls - 1) + responseTime) / this.totalPolls;
            console.log(`✅ T0 Poll #${this.totalPolls} completed: ${newListings} new listings in ${responseTime}ms`);
            // Notification Telegram si activée
            if (this.config.enableTelegram && newListings > 0) {
                await this.notifyNewListings(notices.slice(0, newListings));
            }
        }
        catch (error) {
            this.handlePollError(error);
        }
    }
    /**
     * Traite une notice individuelle déjà traitée par NoticeClient
     * Les ProcessedNotice contiennent déjà les tickers extraits
     */
    async processNotice(notice) {
        try {
            // La notice est déjà traitée, utiliser directement le base
            const ticker = notice.base;
            if (!ticker) {
                console.debug(`⚠️ No ticker found in processed notice`);
                return false;
            }
            const runStats = (0, RunStats_1.getRunStatsTracker)();
            try {
                // Vérifier si c'est un nouveau token
                const isNew = await this.tokenRegistry.isNew(ticker);
                if (!isNew) {
                    if (this.config.enableLogging) {
                        console.debug(`⏭️ Token ${ticker} already known, skipping`);
                    }
                    return false;
                }
                // Enregistrer le nouveau token
                await this.tokenRegistry.addProcessedEvent({
                    eventId: notice.eventId,
                    base: ticker,
                    url: notice.url,
                    tradeTimeUtc: notice.tradeTimeUtc.toISOString(),
                    source: notice.source === 'simulate' ? 'bithumb.notice' : notice.source
                });
                // Incrémenter les statistiques
                runStats.incrementNewListings(ticker);
                runStats.incrementT0Events();
                console.log(`🎯 NEW LISTING DETECTED: ${ticker}`);
                console.log(`📋 Details: ${notice.url}`);
                console.log(`⏰ Published: ${notice.tradeTimeUtc.toISOString()}`);
                console.log(`📊 Source: ${notice.source}`);
                // Incrémenter le compteur de notices traitées
                runStats.incrementNoticesProcessed();
                return true;
            }
            catch (error) {
                console.error(`❌ Error processing ticker ${ticker}:`, error);
                return false;
            }
        }
        catch (error) {
            console.error(`❌ Error processing notice for ${notice.base}:`, error);
            return false;
        }
    }
    /**
     * Gère les erreurs de polling
     */
    handlePollError(error) {
        this.consecutiveErrors++;
        this.lastErrorTime = Date.now();
        console.error(`❌ T0 Poll #${this.totalPolls} failed:`, error);
        // Vérifier si on doit arrêter après trop d'erreurs
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            console.error(`🚨 Too many consecutive errors (${this.consecutiveErrors}), stopping poller`);
            this.stop();
            return;
        }
        // Log de l'erreur
        if (error.response) {
            console.error(`📡 HTTP ${error.response.status}: ${error.response.statusText}`);
        }
        else if (error.code) {
            console.error(`🔌 Network error: ${error.code}`);
        }
    }
    /**
     * Planifie le prochain poll
     */
    scheduleNextPoll() {
        if (!this.isRunning)
            return;
        this.pollTimer = setTimeout(async () => {
            await this.pollOnce();
            this.scheduleNextPoll();
        }, this.config.pollIntervalMs);
    }
    /**
     * Envoie les notifications Telegram pour les nouveaux listings
     */
    async notifyNewListings(listings) {
        try {
            for (const listing of listings) {
                const message = this.formatTelegramMessage(listing);
                await this.telegramService.sendMessage(message);
                // Petit délai entre les messages pour éviter le spam
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        catch (error) {
            console.error('❌ Error sending Telegram notifications:', error);
        }
    }
    /**
     * Formate le message Telegram
     */
    formatTelegramMessage(listing) {
        return `🚨 **NEW LISTING DETECTED** 🚨\n\n**Token:** \`${listing.base}\`\n**Source:** ${listing.source}\n**URL:** ${listing.url}\n**Published:** ${listing.tradeTimeUtc.toLocaleString()}`;
    }
    /**
     * Retourne le statut du poller
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastPollTime: this.lastPollTime,
            totalPolls: this.totalPolls,
            totalNotices: this.totalNotices,
            totalListings: this.totalListings,
            consecutiveErrors: this.consecutiveErrors,
            averageResponseTime: this.averageResponseTime,
            lastErrorTime: this.lastErrorTime,
            config: this.config
        };
    }
    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ NoticePoller config updated:', this.config);
    }
}
exports.BithumbNoticePoller = BithumbNoticePoller;
//# sourceMappingURL=BithumbNoticePoller.js.map