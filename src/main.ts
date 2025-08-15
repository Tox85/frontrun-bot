import 'dotenv/config';
import { BaselineManager } from './core/BaselineManager';
import { ExchangeManager } from './exchanges/ExchangeManager';
import { TradeExecutor } from './trade/TradeExecutor';
import { ExitScheduler } from './trade/ExitScheduler';
import { PositionSizer } from './trade/PositionSizer';
import { PerpCatalog } from './store/PerpCatalog';
import { TokenRegistry } from './store/TokenRegistry';
import { TelegramService } from './notify/TelegramService';
import { HttpServer } from './api/HttpServer';
import { SingletonGuard } from './core/SingletonGuard';
import { NoticeClient } from './watchers/NoticeClient';
import { BithumbWSWatcher } from './watchers/BithumbWSWatcher';
import { Database } from 'sqlite3';
import { MigrationRunner } from './store/Migrations';

// Configuration
const CONFIG = {
  // Bithumb
  BITHUMB_API_KEY: process.env.BITHUMB_API_KEY || '',
  BITHUMB_SECRET: process.env.BITHUMB_SECRET || '',
  
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  
  // Exchanges
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
  
  // Polling
  T0_POLL_INTERVAL_MS: parseInt(process.env.T0_POLL_INTERVAL_MS || '5000'),
  T0_MAX_NOTICES_PER_POLL: parseInt(process.env.T0_MAX_NOTICES_PER_POLL || '10'),
  
  // WebSocket
  WS_ENABLED: process.env.WS_ENABLED !== 'false',
  WS_DEBOUNCE_MS: parseInt(process.env.WS_DEBOUNCE_MS || '100'),
  WS_WARMUP_MS: parseInt(process.env.WS_WARMUP_MS || '5000'),
  
  // HTTP Server
  HTTP_PORT: parseInt(process.env.HTTP_PORT || '3000'),
  
  // Database
  DATABASE_PATH: process.env.DATABASE_PATH || './data/bot.db',

  // Hyperliquid
  HYPERLIQUID_WALLET_ADDRESS: process.env.HYPERLIQUID_WALLET_ADDRESS || ''
};

async function main() {
  console.log('🚀 Starting Frontrun Bot - Ultra-Competitive Edition...');
  
  try {
    // 1. Initialiser la base de données et les migrations
    console.log('🗄️ Initializing database...');
    const db = new Database(CONFIG.DATABASE_PATH);
    
    console.log('🔄 Running database migrations...');
    const migrationRunner = new MigrationRunner(db);
    await migrationRunner.runMigrations();
    console.log('✅ Database migrations completed');
    
    // 2. Vérifier le leadership (SingletonGuard)
    console.log('👑 Checking leadership...');
    const singletonGuard = new SingletonGuard(db);
    const isLeader = await singletonGuard.tryAcquireLeadership();
    
    if (!isLeader) {
      console.log('👀 Running in OBSERVER_MODE - not the leader instance');
      // En mode observateur, on peut toujours démarrer le serveur HTTP pour le monitoring
      const httpServer = new HttpServer(
        new TokenRegistry(db),
        new PerpCatalog(db),
        singletonGuard,
        null,
        null,
        new TelegramService({ botToken: '', chatId: '' }),
        null
      );
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
    
    // Debug: Afficher la configuration Hyperliquid
    console.log('🔧 Hyperliquid Config Debug:');
    console.log(`   • API Key: ${CONFIG.HYPERLIQUID_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   • Wallet Address: ${CONFIG.HYPERLIQUID_WALLET_ADDRESS ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   • Wallet Value: ${CONFIG.HYPERLIQUID_WALLET_ADDRESS || 'EMPTY'}`);
    
    // Debug: Afficher la configuration WebSocket
    console.log('🔧 WebSocket Config Debug:');
    console.log(`   • WS_ENABLED: ${CONFIG.WS_ENABLED ? '✅ TRUE' : '❌ FALSE'}`);
    console.log(`   • WS_DEBOUNCE_MS: ${CONFIG.WS_DEBOUNCE_MS}ms`);
    console.log(`   • WS_WARMUP_MS: ${CONFIG.WS_WARMUP_MS}ms`);
    
    // 3. Initialiser les composants de base
    console.log('🔧 Initializing core components...');
    
    const tokenRegistry = new TokenRegistry(db);
    await tokenRegistry.initialize();
    
    const perpCatalog = new PerpCatalog(db);
    await perpCatalog.initialize();
    
    const telegramService = new TelegramService({
      botToken: CONFIG.TELEGRAM_BOT_TOKEN,
      chatId: CONFIG.TELEGRAM_CHAT_ID
    });
    
    const baselineManager = new BaselineManager(tokenRegistry);
    await baselineManager.initialize();
    
    const exchangeManager = new ExchangeManager({
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
    
    const positionSizer = PositionSizer.getInstance();
    const exitScheduler = ExitScheduler.getInstance();
    
    // Vérifier que Hyperliquid est disponible
    const hyperliquid = exchangeManager.getHyperliquid();
    if (!hyperliquid) {
      console.log('⚠️ Hyperliquid adapter not available, running in advanced monitoring mode');
      
      // 4. Initialiser les watchers en mode monitoring avancé
      console.log('👀 Initializing advanced monitoring watchers...');
      
      // T0: NoticeClient ultra-compétitif
      const noticeClient = new NoticeClient();
      console.log('📡 NoticeClient initialized for ultra-competitive T0 detection');
      
      // T2: WebSocket Bithumb
      let wsWatcher: BithumbWSWatcher | null = null;
      if (CONFIG.WS_ENABLED) {
        wsWatcher = new BithumbWSWatcher(
          tokenRegistry,
          {
            wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
            debounceMs: CONFIG.WS_DEBOUNCE_MS,
            warmupMs: CONFIG.WS_WARMUP_MS
          }
        );
        console.log('🔌 WebSocket watcher initialized');
      }
      
      // 5. Démarrer les composants
      console.log('🚀 Starting advanced monitoring components...');
      
      // Démarrer le polling T0 ultra-compétitif
      console.log('📡 Starting T0 detection...');
      let t0Polls = 0;
      const t0Interval = setInterval(async () => {
        try {
          t0Polls++;
          console.log(`📡 T0 Poll #${t0Polls} - Checking for new listings...`);
          
          const listings = await noticeClient.getLatestListings(CONFIG.T0_MAX_NOTICES_PER_POLL);
          
          for (const listing of listings) {
            // Vérifier si c'est un nouveau token
            const isNew = await tokenRegistry.isNew(listing.base);
            if (isNew) {
              console.log(`🎯 NEW LISTING DETECTED: ${listing.base} (${listing.priority} priority)`);
              
              // Enregistrer le nouveau token
              await tokenRegistry.addProcessedEvent({
                eventId: listing.eventId,
                base: listing.base,
                url: listing.url,
                tradeTimeUtc: listing.publishedAtUtc,
                source: 'bithumb.notice'
              });
              
              // Notification Telegram
              if (CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_CHAT_ID) {
                const message = `🚨 **NEW LISTING DETECTED** 🚨\n\n**Token:** \`${listing.base}\`\n**Priority:** ${listing.priority.toUpperCase()}\n**Status:** ${listing.status.toUpperCase()}\n\n**Title:** ${listing.title}\n**Source:** ${listing.source}\n\n⚡ **ULTRA-COMPETITIVE T0 DETECTION** ⚡\n\n💰 **TRADING DISABLED** - Hyperliquid connection issue`;
                await telegramService.sendMessage(message);
              }
              
              console.log(`💰 Trade execution disabled (Hyperliquid connection issue)`);
            }
          }
          
          if (listings.length > 0) {
            console.log(`✅ T0 Poll #${t0Polls}: Found ${listings.length} listings`);
          }
          
        } catch (error) {
          console.error(`❌ T0 Poll #${t0Polls} failed:`, error);
        }
      }, CONFIG.T0_POLL_INTERVAL_MS);
      
      // Démarrer le WebSocket T2
      if (wsWatcher) {
        await wsWatcher.start();
        console.log('🔌 WebSocket watcher started');
      }
      
      // 6. Démarrer le serveur HTTP
      console.log('🌐 Starting HTTP server...');
      const httpServer = new HttpServer(
        tokenRegistry,
        perpCatalog,
        singletonGuard,
        null, // noticePoller
        wsWatcher,
        telegramService,
        null // tradeExecutor
      );
      await httpServer.start();
      console.log(`✅ HTTP Server started on port ${CONFIG.HTTP_PORT}`);
      
      // 7. Log du statut
      console.log('\n🎯 Bot Status:');
      console.log(`   • Leadership: ✅ LEADER`);
      console.log(`   • T0 Detection: ✅ ACTIVE (${CONFIG.T0_POLL_INTERVAL_MS}ms interval)`);
      console.log(`   • T2 Detection: ${wsWatcher ? '✅ ACTIVE' : '❌ DISABLED'}`);
      console.log(`   • Trading: ❌ DISABLED (Hyperliquid connection issue)`);
      console.log(`   • Hyperliquid: ❌ CONNECTION FAILED (HTTP 405)`);
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
      
      console.log('\n🚀 Bot is running in ADVANCED MONITORING MODE! Press Ctrl+C to stop.');
      console.log('🔧 Hyperliquid issue: HTTP 405 on /info endpoint - check API documentation');
      return;
    }

    console.log('✅ Hyperliquid adapter available - trading mode activated');

    // 4. Initialiser le TradeExecutor
    console.log('💰 Initializing TradeExecutor...');
    const tradeExecutor = new TradeExecutor(
      hyperliquid,
      exitScheduler,
      positionSizer,
      tokenRegistry,
      perpCatalog,
      telegramService,
      {
        riskPct: CONFIG.RISK_PERCENT / 100,
        leverageTarget: 5,
        cooldownHours: 24,
        dryRun: false
      }
    );

    // 5. Initialiser les watchers
    console.log('👀 Initializing watchers...');
    
    // T0: NoticeClient ultra-compétitif
    const noticeClient = new NoticeClient();
    console.log('📡 NoticeClient initialized for ultra-competitive T0 detection');
    
    // T2: WebSocket Bithumb
    let wsWatcher: BithumbWSWatcher | null = null;
    if (CONFIG.WS_ENABLED) {
      wsWatcher = new BithumbWSWatcher(
        tokenRegistry,
        {
          wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
          debounceMs: CONFIG.WS_DEBOUNCE_MS,
          warmupMs: CONFIG.WS_WARMUP_MS
        }
      );
      console.log('🔌 WebSocket watcher initialized');
    }
    
    // 6. Démarrer les composants
    console.log('🚀 Starting components...');
    
    // Démarrer le polling T0 ultra-compétitif
    console.log('📡 Starting T0 detection...');
    let t0Polls = 0;
    const t0Interval = setInterval(async () => {
      try {
        t0Polls++;
        console.log(`📡 T0 Poll #${t0Polls} - Checking for new listings...`);
        
        const listings = await noticeClient.getLatestListings(CONFIG.T0_MAX_NOTICES_PER_POLL);
        
        for (const listing of listings) {
          // Vérifier si c'est un nouveau token
          const isNew = await tokenRegistry.isNew(listing.base);
          if (isNew) {
            console.log(`🎯 NEW LISTING DETECTED: ${listing.base} (${listing.priority} priority)`);
            
            // Enregistrer le nouveau token
            await tokenRegistry.addProcessedEvent({
              eventId: listing.eventId,
              base: listing.base,
              url: listing.url,
              tradeTimeUtc: listing.publishedAtUtc,
              source: 'bithumb.notice'
            });
            
            // Notification Telegram
            if (CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_CHAT_ID) {
              const message = `🚨 **NEW LISTING DETECTED** 🚨\n\n**Token:** \`${listing.base}\`\n**Priority:** ${listing.priority.toUpperCase()}\n**Status:** ${listing.status.toUpperCase()}\n\n**Title:** ${listing.title}\n**Source:** ${listing.source}\n\n⚡ **ULTRA-COMPETITIVE T0 DETECTION** ⚡`;
              await telegramService.sendMessage(message);
            }
            
            // Exécuter le trade si activé
            if (CONFIG.TRADING_ENABLED) {
              try {
                console.log(`💰 Executing trade for ${listing.base}...`);
                await tradeExecutor.executeOpportunity({
                  token: listing.base,
                  source: 'T0_NOTICE',
                  timestamp: new Date().toISOString()
                });
                console.log(`✅ Trade executed for ${listing.base}`);
              } catch (tradeError) {
                console.error(`❌ Trade execution failed for ${listing.base}:`, tradeError);
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
      }
    }, CONFIG.T0_POLL_INTERVAL_MS);
    
    // Démarrer le WebSocket T2
    if (wsWatcher) {
      await wsWatcher.start();
      console.log('🔌 WebSocket watcher started');
    }
    
    // 7. Démarrer le serveur HTTP
    console.log('🌐 Starting HTTP server...');
    const httpServer = new HttpServer(
      tokenRegistry,
      perpCatalog,
      singletonGuard,
      null, // noticePoller
      wsWatcher,
      telegramService,
      tradeExecutor,
      {
        port: CONFIG.HTTP_PORT,
        host: '0.0.0.0',
        enableCors: true,
        enableLogging: true
      }
    );
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
    
  } catch (error) {
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
