"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const BaselineManager_1 = require("./core/BaselineManager");
const ExchangeManager_1 = require("./exchanges/ExchangeManager");
const TradeExecutor_1 = require("./trade/TradeExecutor");
const ExitScheduler_1 = require("./trade/ExitScheduler");
const PositionSizer_1 = require("./trade/PositionSizer");
const PerpCatalog_1 = require("./store/PerpCatalog");
const TelegramService_1 = require("./notify/TelegramService");
const HttpServer_1 = require("./api/HttpServer");
const SingletonGuard_1 = require("./core/SingletonGuard");
const NoticeClient_1 = require("./watchers/NoticeClient");
const BithumbWSWatcher_1 = require("./watchers/BithumbWSWatcher");
const HealthMonitor_1 = require("./core/HealthMonitor");
const sqlite3_1 = require("sqlite3");
const Migrations_1 = require("./store/Migrations");
const EventStore_1 = require("./core/EventStore");
const EventId_1 = require("./core/EventId");
// Configuration
const CONFIG = {
    // Telegram
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
    // Exchanges (pour trading uniquement, pas pour détection)
    BYBIT_API_KEY: process.env.BYBIT_API_KEY || '',
    BYBIT_SECRET: process.env.BYBIT_SECRET || '',
    HYPERLIQUID_API_KEY: process.env.HYPERLIQUID_API_KEY || '',
    HYPERLIQUID_SECRET: process.env.HYPERLIQUID_SECRET || '',
    BINANCE_API_KEY: process.env.BINANCE_API_KEY || '',
    BINANCE_SECRET: process.env.BINANCE_SECRET || '',
    // Trading
    TRADING_ENABLED: process.env.TRADING_ENABLED === 'true',
    MAX_POSITION_SIZE_USD: parseFloat(process.env.MAX_POSITION_SIZE_USD || '100'),
    RISK_PERCENT: parseFloat(process.env.RISK_PERCENT || '2'),
    // Polling T0 (≥1100ms comme requis)
    T0_POLL_INTERVAL_MS: Math.max(1100, parseInt(process.env.T0_POLL_INTERVAL_MS || '1100')),
    T0_MAX_NOTICES_PER_POLL: parseInt(process.env.T0_MAX_NOTICES_PER_POLL || '10'),
    // WebSocket T2
    WS_ENABLED: process.env.WS_ENABLED !== 'false',
    WS_DEBOUNCE_MS: parseInt(process.env.WS_DEBOUNCE_MS || '10000'), // 10s comme requis
    WS_WARMUP_MS: parseInt(process.env.WS_WARMUP_MS || '5000'), // 5s comme requis
    // HTTP Server
    HTTP_PORT: parseInt(process.env.HTTP_PORT || '3000'),
    // Database
    DATABASE_PATH: process.env.DATABASE_PATH || './data/bot.db',
    // Hyperliquid
    HYPERLIQUID_WALLET_ADDRESS: process.env.HYPERLIQUID_WALLET_ADDRESS || ''
};
async function main() {
    console.log('🚀 Starting Frontrun Bot - Bithumb-only Production Edition...');
    try {
        // 1. Initialiser la base de données et les migrations
        console.log('🗄️ Initializing database...');
        const db = new sqlite3_1.Database(CONFIG.DATABASE_PATH);
        console.log('🔄 Running database migrations...');
        const migrationRunner = new Migrations_1.MigrationRunner(db);
        await migrationRunner.runMigrations();
        console.log('✅ Database migrations completed');
        // 2. Vérifier le leadership (SingletonGuard)
        console.log('👑 Checking leadership...');
        const singletonGuard = new SingletonGuard_1.SingletonGuard(db);
        const isLeader = await singletonGuard.tryAcquireLeadership();
        if (!isLeader) {
            console.log('👀 Running in OBSERVER_MODE - not the leader instance');
            // En mode observateur, démarrer le serveur HTTP pour le monitoring
            const httpServer = new HttpServer_1.HttpServer(db, null, // baselineManager
            null, // perpCatalog
            singletonGuard, null, // noticeClient
            null, // wsWatcher
            new TelegramService_1.TelegramService({ botToken: '', chatId: '' }), null, // tradeExecutor
            null, // healthMonitor
            new EventStore_1.EventStore(db), // eventStore
            {
                port: CONFIG.HTTP_PORT,
                host: '0.0.0.0',
                enableCors: true,
                enableLogging: true
            });
            await httpServer.start();
            console.log(`🌐 HTTP Server started on port ${CONFIG.HTTP_PORT} (OBSERVER_MODE)`);
            // Garder l'instance en vie pour le monitoring
            process.on('SIGINT', async () => {
                console.log('🛑 Shutting down observer instance...');
                await httpServer.stop();
                db.close();
                process.exit(0);
            });
            return;
        }
        console.log('👑 Running as LEADER instance');
        // 3. Initialiser les composants de base
        console.log('🔧 Initializing core components...');
        const perpCatalog = new PerpCatalog_1.PerpCatalog(db);
        await perpCatalog.initialize();
        const telegramService = new TelegramService_1.TelegramService({
            botToken: CONFIG.TELEGRAM_BOT_TOKEN,
            chatId: CONFIG.TELEGRAM_CHAT_ID
        });
        const baselineManager = new BaselineManager_1.BaselineManager(db);
        await baselineManager.initialize();
        // EventStore centralisé pour la déduplication
        const eventStore = new EventStore_1.EventStore(db);
        console.log('🔒 EventStore initialized for centralized deduplication');
        const exchangeManager = new ExchangeManager_1.ExchangeManager({
            hyperliquid: {
                testnet: true,
                privateKey: CONFIG.HYPERLIQUID_API_KEY,
                walletAddress: CONFIG.HYPERLIQUID_WALLET_ADDRESS,
                baseUrl: 'https://api.hyperliquid-testnet.xyz',
                timeoutMs: 10000
            },
            ...(CONFIG.BYBIT_API_KEY ? {
                bybit: {
                    apiKey: CONFIG.BYBIT_API_KEY,
                    secretKey: CONFIG.BYBIT_SECRET,
                    testnet: false,
                    baseUrl: 'https://api.bybit.com',
                    timeoutMs: 10000
                }
            } : {}),
            ...(CONFIG.BINANCE_API_KEY ? {
                binance: {
                    apiKey: CONFIG.BINANCE_API_KEY,
                    secretKey: CONFIG.BINANCE_SECRET,
                    testnet: false,
                    baseUrl: 'https://api.binance.com',
                    timeoutMs: 10000
                }
            } : {})
        });
        await exchangeManager.initialize();
        const positionSizer = PositionSizer_1.PositionSizer.getInstance();
        const exitScheduler = ExitScheduler_1.ExitScheduler.getInstance();
        // Vérifier que Hyperliquid est disponible
        const hyperliquid = exchangeManager.getHyperliquid();
        if (!hyperliquid) {
            console.log('⚠️ Hyperliquid adapter not available, running in monitoring mode');
            // 4. Initialiser les watchers en mode monitoring
            console.log('👀 Initializing monitoring watchers...');
            // T0: NoticeClient (API publique notices)
            const noticeClient = new NoticeClient_1.NoticeClient();
            console.log('📡 NoticeClient initialized for T0 detection (API publique)');
            // T2: WebSocket Bithumb
            let wsWatcher = null;
            if (CONFIG.WS_ENABLED) {
                wsWatcher = new BithumbWSWatcher_1.BithumbWSWatcher(db, eventStore, {
                    wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
                    debounceMs: CONFIG.WS_DEBOUNCE_MS,
                    warmupMs: CONFIG.WS_WARMUP_MS
                });
                console.log('🔌 WebSocket watcher initialized');
            }
            // HealthMonitor
            const healthMonitor = new HealthMonitor_1.HealthMonitor(db, baselineManager, process.env.INSTANCE_ID || 'monitor-1', wsWatcher || undefined, telegramService || undefined, undefined);
            // 5. Démarrer les composants
            console.log('🚀 Starting monitoring components...');
            // Démarrer le polling T0 (≥1100ms comme requis)
            console.log(`📡 Starting T0 detection (interval: ${CONFIG.T0_POLL_INTERVAL_MS}ms)...`);
            let t0Polls = 0;
            const t0Interval = setInterval(async () => {
                try {
                    t0Polls++;
                    console.log(`📡 T0 Poll #${t0Polls} - Checking for new listings...`);
                    const startTime = Date.now();
                    const listings = await noticeClient.getLatestListings(CONFIG.T0_MAX_NOTICES_PER_POLL);
                    const processingTime = Date.now() - startTime;
                    // Enregistrer la latence de traitement
                    healthMonitor.recordNoticeLatency(processingTime);
                    for (const listing of listings) {
                        console.log(`🔍 Processing listing: ${listing.base} (${listing.eventId.substring(0, 8)}...)`);
                        // PHASE 1: DÉDUPLICATION CENTRALISÉE AVANT TOUT TRAITEMENT
                        const eventId = (0, EventId_1.buildEventId)({
                            source: 'bithumb.notice',
                            base: listing.base,
                            url: listing.url,
                            markets: listing.markets || [],
                            tradeTimeUtc: listing.publishedAtUtc
                        });
                        try {
                            const dedupResult = await eventStore.tryMarkProcessed({
                                eventId,
                                source: 'bithumb.notice',
                                base: listing.base,
                                url: listing.url,
                                markets: listing.markets || [],
                                tradeTimeUtc: listing.publishedAtUtc,
                                rawTitle: listing.title
                            });
                            if (dedupResult === 'DUPLICATE') {
                                console.log(`⏭️ [DEDUP] DUPLICATE ${eventId.substring(0, 8)}... base=${listing.base} — SKIP`);
                                continue; // STOP NET - aucune notif, aucun trade
                            }
                            console.log(`✅ [DEDUP] INSERTED ${eventId.substring(0, 8)}... base=${listing.base}`);
                        }
                        catch (error) {
                            console.error(`❌ [DEDUP] Error in deduplication:`, error);
                            continue; // En cas d'erreur, passer au suivant
                        }
                        // PHASE 2: GATING SYMBOLIQUE (seulement si INSERTED)
                        const isNew = await baselineManager.isTokenNew(listing.base);
                        if (isNew) {
                            console.log(`🎯 NEW LISTING DETECTED: ${listing.base} (${listing.priority} priority)`);
                            // Notification Telegram
                            if (CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_CHAT_ID) {
                                const message = `🚨 **NEW LISTING DETECTED** 🚨\n\n**Token:** \`${listing.base}\`\n**Priority:** ${listing.priority.toUpperCase()}\n**Status:** ${listing.status.toUpperCase()}\n\n**Title:** ${listing.title}\n**Source:** ${listing.source}\n\n⚡ **T0 DETECTION** ⚡\n\n💰 **TRADING DISABLED** - Hyperliquid connection issue`;
                                await telegramService.sendMessage(message);
                            }
                            console.log(`💰 Trade execution disabled (Hyperliquid connection issue)`);
                        }
                        else {
                            console.log(`⏭️ Token already in baseline: ${listing.base}`);
                        }
                    }
                    if (listings.length > 0) {
                        console.log(`✅ T0 Poll #${t0Polls}: Found ${listings.length} listings`);
                    }
                }
                catch (error) {
                    console.error(`❌ T0 Poll #${t0Polls} failed:`, error);
                    // Enregistrer les erreurs 5xx/429
                    if (error instanceof Error) {
                        if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
                            healthMonitor.recordNotice5xx();
                        }
                        else if (error.message.includes('429')) {
                            healthMonitor.recordNotice429();
                        }
                    }
                }
            }, CONFIG.T0_POLL_INTERVAL_MS);
            // Démarrer le WebSocket T2
            if (wsWatcher) {
                await wsWatcher.start();
                console.log('🔌 WebSocket watcher started');
            }
            // 6. Démarrer le serveur HTTP
            console.log('🌐 Starting HTTP server...');
            const httpServer = new HttpServer_1.HttpServer(db, baselineManager, perpCatalog, singletonGuard, noticeClient, wsWatcher, telegramService, null, // tradeExecutor
            healthMonitor || undefined, eventStore, // eventStore
            {
                port: CONFIG.HTTP_PORT,
                host: '0.0.0.0',
                enableCors: true,
                enableLogging: true
            });
            await httpServer.start();
            console.log(`✅ HTTP Server started on port ${CONFIG.HTTP_PORT}`);
            // 7. Log du statut
            console.log('\n🎯 Bot Status:');
            console.log(`   • Leadership: ✅ LEADER`);
            console.log(`   • T0 Detection: ✅ ACTIVE (${CONFIG.T0_POLL_INTERVAL_MS}ms interval)`);
            console.log(`   • T2 Detection: ${wsWatcher ? '✅ ACTIVE' : '❌ DISABLED'}`);
            console.log(`   • Trading: ❌ DISABLED (Hyperliquid connection issue)`);
            console.log(`   • Hyperliquid: ❌ CONNECTION FAILED`);
            console.log(`   • Telegram: ${CONFIG.TELEGRAM_BOT_TOKEN ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
            console.log(`   • HTTP Server: ✅ PORT ${CONFIG.HTTP_PORT}`);
            // 8. Gestion de l'arrêt
            process.on('SIGINT', async () => {
                console.log('\n🛑 Shutting down bot...');
                clearInterval(t0Interval);
                if (wsWatcher) {
                    await wsWatcher.stop();
                }
                await httpServer.stop();
                await singletonGuard.releaseLeadership();
                db.close();
                console.log('✅ Bot shutdown complete');
                process.exit(0);
            });
            console.log('\n🚀 Bot is running in MONITORING MODE! Press Ctrl+C to stop.');
            return;
        }
        console.log('✅ Hyperliquid adapter available - trading mode activated');
        // 4. Initialiser le TradeExecutor
        console.log('💰 Initializing TradeExecutor...');
        const tradeExecutor = new TradeExecutor_1.TradeExecutor(hyperliquid, exitScheduler, positionSizer, baselineManager, perpCatalog, telegramService, {
            riskPct: CONFIG.RISK_PERCENT / 100,
            leverageTarget: 5,
            cooldownHours: 24,
            dryRun: false
        });
        // 5. Initialiser les watchers
        console.log('👀 Initializing watchers...');
        // T0: NoticeClient (API publique notices)
        const noticeClient = new NoticeClient_1.NoticeClient();
        console.log('📡 NoticeClient initialized for T0 detection (API publique)');
        // T2: WebSocket Bithumb
        let wsWatcher = null;
        if (CONFIG.WS_ENABLED) {
            wsWatcher = new BithumbWSWatcher_1.BithumbWSWatcher(db, eventStore, {
                wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
                debounceMs: CONFIG.WS_DEBOUNCE_MS,
                warmupMs: CONFIG.WS_WARMUP_MS
            });
            console.log('🔌 WebSocket watcher initialized');
        }
        // HealthMonitor
        const healthMonitor = new HealthMonitor_1.HealthMonitor(db, baselineManager, process.env.INSTANCE_ID || 'leader-1', wsWatcher || undefined, telegramService, undefined);
        // 6. Démarrer les composants
        console.log('🚀 Starting components...');
        // Démarrer le polling T0 (≥1100ms comme requis)
        console.log(`📡 Starting T0 detection (interval: ${CONFIG.T0_POLL_INTERVAL_MS}ms)...`);
        let t0Polls = 0;
        const t0Interval = setInterval(async () => {
            try {
                t0Polls++;
                console.log(`📡 T0 Poll #${t0Polls} - Checking for new listings...`);
                const startTime = Date.now();
                const listings = await noticeClient.getLatestListings(CONFIG.T0_MAX_NOTICES_PER_POLL);
                const processingTime = Date.now() - startTime;
                // Enregistrer la latence de traitement
                healthMonitor.recordNoticeLatency(processingTime);
                for (const listing of listings) {
                    // PHASE 1: DÉDUPLICATION CENTRALISÉE AVANT TOUT TRAITEMENT
                    const eventId = (0, EventId_1.buildEventId)({
                        source: 'bithumb.notice',
                        base: listing.base,
                        url: listing.url,
                        markets: listing.markets || [],
                        tradeTimeUtc: listing.publishedAtUtc
                    });
                    try {
                        const dedupResult = await eventStore.tryMarkProcessed({
                            eventId,
                            source: 'bithumb.notice',
                            base: listing.base,
                            url: listing.url,
                            markets: listing.markets || [],
                            tradeTimeUtc: listing.publishedAtUtc,
                            rawTitle: listing.title
                        });
                        if (dedupResult === 'DUPLICATE') {
                            console.log(`⏭️ [DEDUP] DUPLICATE ${eventId.substring(0, 8)}... base=${listing.base} — SKIP`);
                            continue; // STOP NET - aucune notif, aucun trade
                        }
                        console.log(`✅ [DEDUP] INSERTED ${eventId.substring(0, 8)}... base=${listing.base}`);
                    }
                    catch (error) {
                        console.error(`❌ [DEDUP] Error in deduplication:`, error);
                        continue; // En cas d'erreur, passer au suivant
                    }
                    // PHASE 2: GATING SYMBOLIQUE (seulement si INSERTED)
                    const isNew = await baselineManager.isTokenNew(listing.base);
                    if (isNew) {
                        console.log(`🎯 NEW LISTING DETECTED: ${listing.base} (${listing.priority} priority)`);
                        // Notification Telegram
                        if (CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_CHAT_ID) {
                            const message = `🚨 **NEW LISTING DETECTED** 🚨\n\n**Token:** \`${listing.base}\`\n**Priority:** ${listing.priority.toUpperCase()}\n**Status:** ${listing.status.toUpperCase()}\n\n**Title:** ${listing.title}\n**Source:** ${listing.source}\n\n⚡ **T0 DETECTION** ⚡`;
                            await telegramService.sendMessage(message);
                        }
                        // Exécuter le trade si activé
                        if (CONFIG.TRADING_ENABLED) {
                            try {
                                console.log(`💰 Executing trade for ${listing.base}...`);
                                const tradeStartTime = Date.now();
                                await tradeExecutor.executeOpportunity({
                                    token: listing.base,
                                    source: 'T0_NOTICE',
                                    timestamp: new Date().toISOString()
                                });
                                const tradeTime = Date.now() - tradeStartTime;
                                healthMonitor.recordDetectionLatency(tradeTime);
                                healthMonitor.recordTradeExecuted();
                                console.log(`✅ Trade executed for ${listing.base}`);
                            }
                            catch (tradeError) {
                                console.error(`❌ Trade execution failed for ${listing.base}:`, tradeError);
                                healthMonitor.recordTradeFailed();
                            }
                        }
                        else {
                            console.log(`💰 Trade execution disabled (TRADING_ENABLED=false)`);
                        }
                    }
                }
                if (listings.length > 0) {
                    console.log(`✅ T0 Poll #${t0Polls}: Found ${listings.length} listings`);
                }
            }
            catch (error) {
                console.error(`❌ T0 Poll #${t0Polls} failed:`, error);
                // Enregistrer les erreurs 5xx/429
                if (error instanceof Error) {
                    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
                        healthMonitor.recordNotice5xx();
                    }
                    else if (error.message.includes('429')) {
                        healthMonitor.recordNotice429();
                    }
                }
            }
        }, CONFIG.T0_POLL_INTERVAL_MS);
        // Démarrer le WebSocket T2
        if (wsWatcher) {
            await wsWatcher.start();
            console.log('🔌 WebSocket watcher started');
        }
        // 7. Démarrer le serveur HTTP
        console.log('🌐 Starting HTTP server...');
        const httpServer = new HttpServer_1.HttpServer(db, baselineManager, perpCatalog, singletonGuard, noticeClient, wsWatcher, telegramService, tradeExecutor, healthMonitor, eventStore, // eventStore
        {
            port: CONFIG.HTTP_PORT,
            host: '0.0.0.0',
            enableCors: true,
            enableLogging: true
        });
        await httpServer.start();
        console.log(`✅ HTTP Server started on port ${CONFIG.HTTP_PORT}`);
        // 8. Log du statut
        console.log('\n🎯 Bot Status:');
        console.log(`   • Leadership: ✅ LEADER`);
        console.log(`   • T0 Detection: ✅ ACTIVE (${CONFIG.T0_POLL_INTERVAL_MS}ms interval)`);
        console.log(`   • T2 Detection: ${wsWatcher ? '✅ ACTIVE' : '❌ DISABLED'}`);
        console.log(`   • Trading: ${CONFIG.TRADING_ENABLED ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`   • Hyperliquid: ✅ CONNECTED (testnet)`);
        console.log(`   • Telegram: ${CONFIG.TELEGRAM_BOT_TOKEN ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
        console.log(`   • HTTP Server: ✅ PORT ${CONFIG.HTTP_PORT}`);
        // 9. Gestion de l'arrêt
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down bot...');
            clearInterval(t0Interval);
            if (wsWatcher) {
                await wsWatcher.stop();
            }
            await httpServer.stop();
            await singletonGuard.releaseLeadership();
            db.close();
            console.log('✅ Bot shutdown complete');
            process.exit(0);
        });
        console.log('\n🚀 Bot is running in FULL TRADING MODE! Press Ctrl+C to stop.');
    }
    catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}
// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
// Démarrer le bot
main().catch((error) => {
    console.error('💥 Main function failed:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map