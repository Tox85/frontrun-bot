import 'dotenv/config';
import { BaselineManager } from './core/BaselineManager';
import { ExchangeManager } from './exchanges/ExchangeManager';
import { TradeExecutor } from './trade/TradeExecutor';
import { ExitScheduler } from './trade/ExitScheduler';
import { PositionSizer } from './trade/PositionSizer';
import { PerpCatalog } from './store/PerpCatalog';
import { TelegramService } from './notify/TelegramService';
import { HttpServer } from './api/HttpServer';
import { SingletonGuard } from './core/SingletonGuard';
import { NoticeClient } from './watchers/NoticeClient';
import { BithumbWSWatcher } from './watchers/BithumbWSWatcher';
import { HealthMonitor } from './core/HealthMonitor';
import { Database } from 'sqlite3';
import { MigrationRunner } from './store/Migrations';
import { EventStore } from './core/EventStore';
import { WatermarkStore } from './store/WatermarkStore';
import { buildEventId } from './core/EventId';
import { CONFIG } from './config/env';

// Configuration
const BOT_CONFIG = {
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
  WS_WARMUP_MS: parseInt(process.env.WS_WARMUP_MS || '5000'),     // 5s comme requis
  
  // HTTP Server
  HTTP_PORT: parseInt(process.env.HTTP_PORT || '3000'),
  
  // Database
  DATABASE_PATH: process.env.DATABASE_PATH || './data/bot.db',

  // Hyperliquid
  HYPERLIQUID_WALLET_ADDRESS: process.env.HYPERLIQUID_WALLET_ADDRESS || '',
  
  // Watermark & Log Dedup
  MAX_NOTICE_AGE_MIN: parseInt(process.env.MAX_NOTICE_AGE_MIN || '180'), // 3h par défaut
  LOG_DEDUP_WINDOW_MS: parseInt(process.env.LOG_DEDUP_WINDOW_MS || '60000'), // 1 min par défaut
  LOG_DEDUP_MAX_PER_WINDOW: parseInt(process.env.LOG_DEDUP_MAX_PER_WINDOW || '2') // 2 logs max par fenêtre
};

// Variables globales pour la gestion d'arrêt
let isShuttingDown = false;
let t0Interval: NodeJS.Timeout | null = null;
let wsWatcher: BithumbWSWatcher | null = null;
let noticeClient: NoticeClient | null = null;
let httpServer: HttpServer | null = null;
let db: Database | null = null;
let singletonGuard: SingletonGuard | null = null;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`[${signal}] Shutdown already in progress, ignoring...`);
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    // 1. Arrêter le polling T0
    if (t0Interval) {
      clearInterval(t0Interval);
      t0Interval = null;
      console.log('✅ T0 polling stopped');
    }
    
    // 2. Arrêter le WebSocket watcher
    if (wsWatcher) {
      await wsWatcher.stop();
      console.log('✅ WebSocket watcher stopped');
    }
    
    // 3. Flush le LogDeduper
    if (noticeClient) {
      const logDeduper = noticeClient.getLogDeduper();
      if (logDeduper) {
        logDeduper.flush();
        console.log('✅ LogDeduper flushed');
      }
      noticeClient.stopPolling();
      console.log('✅ NoticeClient stopped');
    }
    
    // 4. Arrêter le serveur HTTP
    if (httpServer) {
      await httpServer.stop();
      console.log('✅ HTTP server stopped');
    }
    
    // 5. Libérer le leadership
    if (singletonGuard) {
      await singletonGuard.releaseLeadership();
      console.log('✅ Leadership released');
    }
    
    // 6. Fermer la base de données
    if (db) {
      db.close();
      console.log('✅ Database closed');
    }
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Starting Frontrun Bot - Bithumb-only Production Edition...');
  
  try {
    // 1. Initialiser la base de données et les migrations
    console.log('🗄️ Initializing database...');
    db = new Database(BOT_CONFIG.DATABASE_PATH);
    
    console.log('🔄 Running database migrations...');
    const migrationRunner = new MigrationRunner(db);
    await migrationRunner.runMigrations();
    console.log('✅ Database migrations completed');
    
    // 2. Vérifier le leadership (SingletonGuard)
    console.log('👑 Checking leadership...');
    singletonGuard = new SingletonGuard(db);
    const isLeader = await singletonGuard.tryAcquireLeadership();
    
    if (!isLeader) {
      console.log('👀 Running in OBSERVER_MODE - not the leader instance');
      
      // En mode observateur, démarrer le serveur HTTP pour le monitoring
      httpServer = new HttpServer(
        db,
        null, // baselineManager
        null, // perpCatalog
        singletonGuard,
        null, // noticeClient
        null, // wsWatcher
        new TelegramService({ botToken: '', chatId: '' }),
        null, // tradeExecutor
        null, // healthMonitor
        new EventStore(db), // eventStore
        {
          port: BOT_CONFIG.HTTP_PORT,
          host: '0.0.0.0',
          enableCors: true,
          enableLogging: true
        }
      );
      await httpServer.start();
      console.log(`🌐 HTTP Server started on port ${BOT_CONFIG.HTTP_PORT} (OBSERVER_MODE)`);
      
      // Garder l'instance en vie pour le monitoring
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      
      return;
    }
    
    console.log('👑 Running as LEADER instance');
    
    // 3. Initialiser les composants de base
    console.log('🔧 Initializing core components...');
    
    const perpCatalog = new PerpCatalog(db);
    await perpCatalog.initialize();
    
    const telegramService = new TelegramService({
      botToken: BOT_CONFIG.TELEGRAM_BOT_TOKEN,
      chatId: BOT_CONFIG.TELEGRAM_CHAT_ID
    });
    
    const baselineManager = new BaselineManager(db);
    await baselineManager.initialize();
    
    // EventStore centralisé pour la déduplication
    const eventStore = new EventStore(db);
    console.log('🔒 EventStore initialized for centralized deduplication');
    
    // WatermarkStore pour éviter la boucle infinie T0
    const watermarkStore = new WatermarkStore(db);
    await watermarkStore.initializeAtBoot('bithumb.notice');
    console.log('🔒 WatermarkStore initialized to prevent T0 infinite loop');
    
    const exchangeManager = new ExchangeManager({
      hyperliquid: {
        testnet: true,
        privateKey: BOT_CONFIG.HYPERLIQUID_API_KEY,
        walletAddress: BOT_CONFIG.HYPERLIQUID_WALLET_ADDRESS,
        baseUrl: 'https://api.hyperliquid-testnet.xyz',
        timeoutMs: 10000
      },
      ...(BOT_CONFIG.BYBIT_API_KEY ? {
        bybit: {
          apiKey: BOT_CONFIG.BYBIT_API_KEY,
          secretKey: BOT_CONFIG.BYBIT_SECRET,
          testnet: false,
          baseUrl: 'https://api.bybit.com',
          timeoutMs: 10000
        }
      } : {}),
      ...(BOT_CONFIG.BINANCE_API_KEY ? {
        binance: {
          apiKey: BOT_CONFIG.BINANCE_API_KEY,
          secretKey: BOT_CONFIG.BINANCE_SECRET,
          testnet: false,
          baseUrl: 'https://api.binance.com',
          timeoutMs: 10000
        }
      } : {})
    });
    await exchangeManager.initialize();
    
    const positionSizer = PositionSizer.getInstance();
    const exitScheduler = ExitScheduler.getInstance();
    
    // Vérifier que Hyperliquid est disponible
    const hyperliquid = exchangeManager.getHyperliquid();
    if (!hyperliquid) {
      console.log('⚠️ Hyperliquid adapter not available, running in monitoring mode');
      
      // 4. Initialiser les watchers en mode monitoring
      console.log('👀 Initializing monitoring watchers...');
      
      // T0: NoticeClient (API publique notices) avec watermark
      noticeClient = new NoticeClient(watermarkStore, {
        logDedupWindowMs: BOT_CONFIG.LOG_DEDUP_WINDOW_MS,
        logDedupMaxPerWindow: BOT_CONFIG.LOG_DEDUP_MAX_PER_WINDOW,
        maxNoticeAgeMin: BOT_CONFIG.MAX_NOTICE_AGE_MIN
      });
      console.log('📡 NoticeClient initialized for T0 detection (API publique) + watermark protection');
      
      // T2: WebSocket Bithumb
      if (BOT_CONFIG.WS_ENABLED) {
        wsWatcher = new BithumbWSWatcher(db, eventStore, {
          wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
          debounceMs: BOT_CONFIG.WS_DEBOUNCE_MS,
          warmupMs: BOT_CONFIG.WS_WARMUP_MS
        });
        console.log('🔌 WebSocket watcher initialized');
      }
      
      // HealthMonitor
      const healthMonitor = new HealthMonitor(
        db,
        baselineManager,
        process.env.INSTANCE_ID || 'monitor-1',
        wsWatcher || undefined,
        telegramService || undefined,
        undefined
      );
      
      // 5. Démarrer les composants
      console.log('🚀 Starting monitoring components...');
      
      // Démarrer le polling T0 seulement si la baseline est prête
      if (baselineManager.canActivateT0()) {
        console.log(`📡 Starting T0 detection (interval: ${BOT_CONFIG.T0_POLL_INTERVAL_MS}ms)...`);
        noticeClient.enable();
        
        let t0Polls = 0;
        t0Interval = setInterval(async () => {
          try {
            t0Polls++;
            console.log(`📡 T0 Poll #${t0Polls} - Checking for new listings...`);
            
            const startTime = Date.now();
            const listings = await noticeClient!.getLatestListings(BOT_CONFIG.T0_MAX_NOTICES_PER_POLL);
            const processingTime = Date.now() - startTime;
            
            // Enregistrer la latence de traitement
            healthMonitor.recordNoticeLatency(processingTime);
            
            for (const listing of listings) {
              console.log(`🔍 Processing listing: ${listing.base} (${listing.eventId.substring(0, 8)}...)`);
              
              // PHASE 1: DÉDUPLICATION CENTRALISÉE AVANT TOUT TRAITEMENT
              const eventId = buildEventId({
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
              } catch (error) {
                console.error(`❌ [DEDUP] Error in deduplication:`, error);
                continue; // En cas d'erreur, passer au suivant
              }
              
              // PHASE 2: GATING SYMBOLIQUE (seulement si INSERTED)
              const isNew = await baselineManager.isTokenNew(listing.base);
              if (isNew) {
                console.log(`🎯 NEW LISTING DETECTED: ${listing.base} (${listing.priority} priority)`);
                
                // Notification Telegram
                if (BOT_CONFIG.TELEGRAM_BOT_TOKEN && BOT_CONFIG.TELEGRAM_CHAT_ID) {
                  const message = `🚨 **NEW LISTING DETECTED** 🚨\n\n**Token:** \`${listing.base}\`\n**Priority:** ${listing.priority.toUpperCase()}\n**Status:** ${listing.status.toUpperCase()}\n\n**Title:** ${listing.title}\n**Source:** ${listing.source}\n\n⚡ **T0 DETECTION** ⚡\n\n💰 **TRADING DISABLED** - Hyperliquid connection issue`;
                  await telegramService.sendMessage(message);
                }
                
                console.log(`💰 Trade execution disabled (Hyperliquid connection issue)`);
              } else {
                console.log(`⏭️ Token already in baseline: ${listing.base}`);
              }
            }
            
            if (listings.length > 0) {
              console.log(`✅ T0 Poll #${t0Polls}: Found ${listings.length} listings`);
            }
            
          } catch (error) {
            console.error(`❌ T0 Poll #${t0Polls} failed:`, error);
            
            // Enregistrer les erreurs 5xx/429
            if (error instanceof Error) {
              if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
                healthMonitor.recordNotice5xx();
              } else if (error.message.includes('429')) {
                healthMonitor.recordNotice429();
              }
            }
          }
        }, BOT_CONFIG.T0_POLL_INTERVAL_MS);
      } else {
        console.log('⚠️ T0 detection disabled - baseline not ready (state: ' + baselineManager.getState() + ')');
      }
      
      // Démarrer le WebSocket T2
      if (wsWatcher) {
        await wsWatcher.start();
        console.log('🔌 WebSocket watcher started');
      }
      
      // 6. Démarrer le serveur HTTP
      console.log('🌐 Starting HTTP server...');
      httpServer = new HttpServer(
        db,
        baselineManager,
        perpCatalog,
        singletonGuard,
        noticeClient,
        wsWatcher,
        telegramService,
        null, // tradeExecutor
        healthMonitor || undefined,
        eventStore, // eventStore
        {
          port: BOT_CONFIG.HTTP_PORT,
          host: '0.0.0.0',
          enableCors: true,
          enableLogging: true
        }
      );
      await httpServer.start();
      console.log(`✅ HTTP Server started on port ${BOT_CONFIG.HTTP_PORT}`);
      
      // 7. Log du statut
      console.log('\n🎯 Bot Status:');
      console.log(`   • Leadership: ✅ LEADER`);
      console.log(`   • Baseline State: ${baselineManager.getState()}`);
      console.log(`   • T0 Detection: ${baselineManager.canActivateT0() ? '✅ ACTIVE' : '❌ DISABLED'} (${BOT_CONFIG.T0_POLL_INTERVAL_MS}ms interval)`);
      console.log(`   • T2 Detection: ${wsWatcher ? '✅ ACTIVE' : '❌ DISABLED'}`);
      console.log(`   • Trading: ❌ DISABLED (Hyperliquid connection issue)`);
      console.log(`   • Hyperliquid: ❌ CONNECTION FAILED`);
      console.log(`   • Telegram: ${BOT_CONFIG.TELEGRAM_BOT_TOKEN ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
      console.log(`   • HTTP Server: ✅ PORT ${BOT_CONFIG.HTTP_PORT}`);
      
      // 8. Gestion de l'arrêt
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      
      console.log('\n🚀 Bot is running in MONITORING MODE! Press Ctrl+C to stop.');
      return;
    }

    console.log('✅ Hyperliquid adapter available - trading mode activated');

    // 4. Initialiser le TradeExecutor
    console.log('💰 Initializing TradeExecutor...');
    const tradeExecutor = new TradeExecutor(
      hyperliquid,
      exitScheduler,
      positionSizer,
      baselineManager,
      perpCatalog,
      telegramService,
      {
        riskPct: BOT_CONFIG.RISK_PERCENT / 100,
        leverageTarget: 5,
        cooldownHours: 24,
        dryRun: false
      }
    );

    // 5. Initialiser les watchers
    console.log('👀 Initializing watchers...');
    
    // T0: NoticeClient (API publique notices) avec watermark
    noticeClient = new NoticeClient(watermarkStore, {
      logDedupWindowMs: BOT_CONFIG.LOG_DEDUP_WINDOW_MS,
      logDedupMaxPerWindow: BOT_CONFIG.LOG_DEDUP_MAX_PER_WINDOW,
      maxNoticeAgeMin: BOT_CONFIG.MAX_NOTICE_AGE_MIN
    });
    console.log('📡 NoticeClient initialized for T0 detection (API publique) + watermark protection');
    
    // T2: WebSocket Bithumb
    if (BOT_CONFIG.WS_ENABLED) {
      wsWatcher = new BithumbWSWatcher(db, eventStore, {
        wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
        debounceMs: BOT_CONFIG.WS_DEBOUNCE_MS,
        warmupMs: BOT_CONFIG.WS_WARMUP_MS
      });
      console.log('🔌 WebSocket watcher initialized');
    }
    
    // HealthMonitor
    const healthMonitor = new HealthMonitor(
      db,
      baselineManager,
      process.env.INSTANCE_ID || 'leader-1',
      wsWatcher || undefined,
      telegramService,
      undefined
    );
    
    // 6. Démarrer les composants
    console.log('🚀 Starting components...');
    
    // Démarrer le polling T0 seulement si la baseline est prête
    if (baselineManager.canActivateT0()) {
      console.log(`📡 Starting T0 detection (interval: ${BOT_CONFIG.T0_POLL_INTERVAL_MS}ms)...`);
      noticeClient.enable();
      
      let t0Polls = 0;
      t0Interval = setInterval(async () => {
        try {
          t0Polls++;
          console.log(`📡 T0 Poll #${t0Polls} - Checking for new listings...`);
          
          const startTime = Date.now();
          const listings = await noticeClient!.getLatestListings(BOT_CONFIG.T0_MAX_NOTICES_PER_POLL);
          const processingTime = Date.now() - startTime;
          
          // Enregistrer la latence de traitement
          healthMonitor.recordNoticeLatency(processingTime);
          
          for (const listing of listings) {
            // PHASE 1: DÉDUPLICATION CENTRALISÉE AVANT TOUT TRAITEMENT
            const eventId = buildEventId({
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
            } catch (error) {
              console.error(`❌ [DEDUP] Error in deduplication:`, error);
              continue; // En cas d'erreur, passer au suivant
            }
            
            // PHASE 2: GATING SYMBOLIQUE (seulement si INSERTED)
            const isNew = await baselineManager.isTokenNew(listing.base);
            if (isNew) {
              console.log(`🎯 NEW LISTING DETECTED: ${listing.base} (${listing.priority} priority)`);
              
              // Notification Telegram
              if (BOT_CONFIG.TELEGRAM_BOT_TOKEN && BOT_CONFIG.TELEGRAM_CHAT_ID) {
                const message = `🚨 **NEW LISTING DETECTED** 🚨\n\n**Token:** \`${listing.base}\`\n**Priority:** ${listing.priority.toUpperCase()}\n**Status:** ${listing.status.toUpperCase()}\n\n**Title:** ${listing.title}\n**Source:** ${listing.source}\n\n⚡ **T0 DETECTION** ⚡`;
                await telegramService.sendMessage(message);
              }
              
              // Exécuter le trade si activé
              if (BOT_CONFIG.TRADING_ENABLED) {
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
                } catch (tradeError) {
                  console.error(`❌ Trade execution failed for ${listing.base}:`, tradeError);
                  healthMonitor.recordTradeFailed();
                }
              } else {
                console.log(`💰 Trade execution disabled (TRADING_ENABLED=false)`);
              }
            }
          }
          
          if (listings.length > 0) {
            console.log(`✅ T0 Poll #${t0Polls}: Found ${listings.length} listings`);
          }
          
        } catch (error) {
          console.error(`❌ T0 Poll #${t0Polls} failed:`, error);
          
          // Enregistrer les erreurs 5xx/429
          if (error instanceof Error) {
            if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
              healthMonitor.recordNotice5xx();
            } else if (error.message.includes('429')) {
              healthMonitor.recordNotice429();
            }
          }
        }
      }, BOT_CONFIG.T0_POLL_INTERVAL_MS);
    } else {
      console.log('⚠️ T0 detection disabled - baseline not ready (state: ' + baselineManager.getState() + ')');
    }
    
    // Démarrer le WebSocket T2
    if (wsWatcher) {
      await wsWatcher.start();
      console.log('🔌 WebSocket watcher started');
    }
    
    // 7. Démarrer le serveur HTTP
    console.log('🌐 Starting HTTP server...');
    httpServer = new HttpServer(
      db,
      baselineManager,
      perpCatalog,
      singletonGuard,
      noticeClient,
      wsWatcher,
      telegramService,
      tradeExecutor,
      healthMonitor,
      eventStore, // eventStore
      {
        port: BOT_CONFIG.HTTP_PORT,
        host: '0.0.0.0',
        enableCors: true,
        enableLogging: true
      }
    );
    await httpServer.start();
    console.log(`✅ HTTP Server started on port ${BOT_CONFIG.HTTP_PORT}`);
    
    // 8. Log du statut
    console.log('\n🎯 Bot Status:');
    console.log(`   • Leadership: ✅ LEADER`);
    console.log(`   • Baseline State: ${baselineManager.getState()}`);
    console.log(`   • T0 Detection: ${baselineManager.canActivateT0() ? '✅ ACTIVE' : '❌ DISABLED'} (${BOT_CONFIG.T0_POLL_INTERVAL_MS}ms interval)`);
    console.log(`   • T2 Detection: ${wsWatcher ? '✅ ACTIVE' : '❌ DISABLED'}`);
    console.log(`   • Trading: ${BOT_CONFIG.TRADING_ENABLED ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`   • Hyperliquid: ✅ CONNECTED (testnet)`);
    console.log(`   • Telegram: ${BOT_CONFIG.TELEGRAM_BOT_TOKEN ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
    console.log(`   • HTTP Server: ✅ PORT ${BOT_CONFIG.HTTP_PORT}`);
    
    // 9. Gestion de l'arrêt
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    console.log('\n🚀 Bot is running in FULL TRADING MODE! Press Ctrl+C to stop.');
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Démarrer le bot
main().catch((error) => {
  console.error('💥 Main function failed:', error);
  process.exit(1);
});
