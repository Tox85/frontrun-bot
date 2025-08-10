import { checkBalance, setHyperliquidTrader, setBybitTrader } from "./trader";
import { TelegramService } from "./telegramService";
import { startHealthCheck } from './healthCheck';

import { HyperliquidTrader } from './hyperliquidTrader';
import { BinanceTrader } from './binanceTrader';
import { BybitTrader } from './bybitTrader';
import { validateHyperliquidConfig } from './hyperliquidConfig';
import { TradeRetryManager } from './retryManager';
import { PerformanceMonitor } from './performanceMonitor';
import { RiskManager } from './riskManager';
import { DiagnosticTool } from './diagnostic';
import { ListingQueue } from './listingQueue';
import { GlobalTokenManager } from './globalTokenManager';
import { PositionOrchestrator, ListingEvent } from './execution/positionOrchestrator';
import { ListingSurveillance, KoreanListingEvent } from './listingSurveillance';

console.log("🚀 Frontrun Bot is running!");

// Mode Railway - réduire les logs pour éviter les problèmes de performance
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
if (isRailway) {
  console.log("🚂 Mode Railway détecté - Logs optimisés activés");
}

// Variables globales
let traderInitialized = false;

let hyperliquidTrader: HyperliquidTrader | undefined = undefined;
let telegramService: TelegramService | null = null;
let retryManager: TradeRetryManager | null = null;
let performanceMonitor: PerformanceMonitor | null = null;
let riskManager: RiskManager | null = null;
let listingQueue: ListingQueue | null = null;
let globalTokenManager: GlobalTokenManager | null = null;
let positionOrchestrator: PositionOrchestrator | null = null;
let listingSurveillance: ListingSurveillance | null = null;



async function startBot() {
  try {
    console.log("🤖 Initialisation du bot...");
    
    // Diagnostic système au démarrage
    console.log("🔍 Exécution du diagnostic système...");
    const diagnosticTool = new DiagnosticTool();
    await diagnosticTool.runDiagnostic();
    
    // Initialiser le rapporteur de statut
    // const statusReporter = new StatusReporter();
    // statusReporter.startReporting();
    // DÉSACTIVÉ - Rapport automatique toutes les 2h (source possible de spam)
    
    // Valider la configuration Hyperliquid
    validateHyperliquidConfig();
    
    // Initialiser le service Telegram sécurisé
    telegramService = new TelegramService();
    
    // Vérifier la balance et envoyer le message de démarrage sécurisé
    const balance = await checkBalance();
    await telegramService.sendBotReady(balance.available);

    // Initialiser les nouveaux modules
    console.log("📊 Initialisation des modules avancés...");
    retryManager = new TradeRetryManager(telegramService);
    performanceMonitor = new PerformanceMonitor(telegramService);
    riskManager = new RiskManager(telegramService);
    // Article scraper désactivé (Cloudflare protection)

    // Initialiser le gestionnaire de tokens globaux
    console.log("🌍 Initialisation du gestionnaire de tokens globaux...");
    globalTokenManager = new GlobalTokenManager(telegramService);
    
    // Désactiver la surveillance globale par défaut - Focus sur Corée
    if (process.env.ENABLE_GLOBAL_MONITORING === 'true') {
      globalTokenManager.startGlobalMonitoring();
    } else {
      console.log("⏸️ Surveillance globale désactivée - Focus sur frontrunning coréen");
    }

    // Initialiser la surveillance des listings coréens
    console.log("🇰🇷 Initialisation de la surveillance des listings coréens...");
    listingSurveillance = new ListingSurveillance(handleNewListing);
    await listingSurveillance.start();



    // Initialiser les traders
    console.log("💰 Initialisation des traders...");
    
    // Initialiser Hyperliquid (priorité)
    if (process.env.HL_ENABLED === '1') {
    console.log("🔧 Initialisation du trader Hyperliquid...");
    hyperliquidTrader = new HyperliquidTrader();
      const hlInitialized = await hyperliquidTrader.initialize();
      if (hlInitialized) {
        console.log("✅ Trader Hyperliquid initialisé avec succès");
        traderInitialized = true;
        // Synchroniser avec trader.ts
        setHyperliquidTrader(hyperliquidTrader);
    } else {
        console.log("⚠️ Échec initialisation Hyperliquid");
      }
    }

    // Initialiser Binance (si activé)
    let binanceTrader: BinanceTrader | undefined = undefined;
    if (process.env.BINANCE_ENABLED === '1') {
      console.log("🔧 Initialisation du trader Binance...");
      binanceTrader = new BinanceTrader(telegramService);
      const binanceInitialized = await binanceTrader.initialize();
      if (binanceInitialized) {
        console.log("✅ Trader Binance initialisé avec succès");
        if (!traderInitialized) traderInitialized = true;
    } else {
        console.log("⚠️ Échec initialisation Binance");
      }
    }

    // Initialiser Bybit (si activé)
    let bybitTrader: BybitTrader | undefined = undefined;
    if (process.env.BYBIT_ENABLED === '1') {
      console.log("🔧 Initialisation du trader Bybit...");
      bybitTrader = new BybitTrader();
      const bybitInitialized = await bybitTrader.initialize();
      if (bybitInitialized) {
        console.log("✅ Trader Bybit initialisé avec succès");
        if (!traderInitialized) traderInitialized = true;
        } else {
        console.log("⚠️ Échec initialisation Bybit");
      }
    }
    
    if (traderInitialized) {
      console.log("✅ Au moins un trader initialisé avec succès");
      
      // Initialiser l'orchestrateur de positions
      console.log("🎯 Initialisation de l'orchestrateur de positions...");
      positionOrchestrator = new PositionOrchestrator(
        hyperliquidTrader,
        binanceTrader,
        bybitTrader,
        telegramService,
        riskManager,
        performanceMonitor,
        retryManager
      );
      console.log("✅ Orchestrateur de positions initialisé");
      
      // Vérifier la balance
      const balance = await checkBalance();
      console.log(`💰 Balance disponible: ${balance.available} USDC`);
      
      // Initialiser la file d'attente avec l'orchestrateur
      listingQueue = new ListingQueue(
        telegramService,
        hyperliquidTrader,
        riskManager,
        performanceMonitor
      );
      console.log("✅ File d'attente initialisée");
      
    } else {
      console.log("⚠️ Aucun trader initialisé - Mode surveillance uniquement");
    }



    // Démarrer le health check
    console.log("🏥 Démarrage du health check...");
    startHealthCheck();
    console.log("✅ Health check démarré");



    // Surveillance articles Bithumb désactivée (Cloudflare protection)
      console.log("📰 Surveillance articles Bithumb désactivée (Cloudflare protection)");

    // Gestionnaire des nouveaux listings avec monitoring et analyse globale
    async function handleNewListing(listing: KoreanListingEvent) {
      const detectionStart = Date.now();
      const symbol = listing.symbol;
      const metadata = {
        exchange: listing.exchange,
        source: listing.exchange === 'BITHUMB' ? 'websocket' : 'api',
        price: listing.price,
        volume: listing.volume,
        timestamp: listing.timestamp,
        fullSymbol: listing.fullSymbol
      };
      
      if (isRailway) {
        // Logs compacts pour Railway
        console.log(`🆕 NOUVEAU LISTING: ${symbol} | ${metadata.exchange || metadata.source || 'N/A'} | ${metadata.price || 'N/A'}`);
      } else {
        // Logs détaillés pour développement
      console.log(`🆕 NOUVEAU LISTING DÉTECTÉ !`);
        console.log(`📊 Symbole : ${symbol}`);
      if (metadata) {
          console.log(`🏢 Exchange : ${metadata.exchange || metadata.source || 'N/A'}`);
          console.log(`🔗 Marché complet : ${metadata.fullSymbol || symbol}`);
          console.log(`💰 Prix : ${metadata.price || 'N/A'}`);
          console.log(`📈 Volume : ${metadata.volume || 'N/A'}`);
          console.log(`⏰ Timestamp : ${new Date(metadata.timestamp || Date.now()).toLocaleString()}`);
        }
        console.log(`⚡ Temps de détection : ${Date.now() - detectionStart}ms`);
        console.log(`---`);
      }

      // Enregistrer la détection
      if (performanceMonitor) {
        performanceMonitor.recordDetection(symbol, Date.now() - detectionStart);
      }

      // Notification Telegram sécurisée
      const price = metadata?.price ? metadata.price.toString() : 'N/A';
      const exchange = metadata?.exchange || metadata.source || 'N/A';
      await telegramService?.sendNewListing(symbol, price, exchange);

      // ANALYSE GLOBALE - Vérifier si le token est listé globalement
      if (globalTokenManager) {
        if (!isRailway) {
          console.log(`🌍 Analyse globale pour ${symbol}...`);
        }
        const analysis = await globalTokenManager.analyzeKoreanListing(symbol, metadata);
        
        // Log de l'analyse
        if (isRailway) {
          console.log(`📊 Analyse: ${symbol} | ${analysis.eventType} | ${analysis.priority}`);
        } else {
          console.log(`📊 Résultat analyse: ${analysis.eventType} - Priorité: ${analysis.priority}`);
        }
        
        // Si c'est un trigger bullish coréen avec perp disponible, action immédiate
        if (analysis.eventType === 'bullish_korean_trigger' && analysis.recommendedExchange) {
          console.log(`🔥 TRIGGER BULLISH DÉTECTÉ - Action immédiate recommandée sur ${analysis.recommendedExchange}`);
        }
      }

      // Déterminer la source du listing
      let source: 'announcement' | 'websocket' | 'api' = 'api';
      if (metadata?.source?.includes('Article') || metadata?.source?.includes('announcement')) {
        source = 'announcement';
      } else if (metadata?.source?.includes('WebSocket')) {
        source = 'websocket';
      }

      // NOUVEAU SYSTÈME - Utiliser l'orchestrateur de positions
      if (positionOrchestrator && traderInitialized) {
        const listingEvent: ListingEvent = {
          symbol,
          metadata,
          detectionTime: Date.now(),
          id: `${Date.now()}-${symbol}` // ID unique pour l'idempotency
        };

        console.log(`🎯 Tentative d'ouverture de position pour ${symbol}...`);
        
        try {
          const tradeResult = await positionOrchestrator.openPositionForNewListing(listingEvent);
          
          if (tradeResult.success) {
            console.log(`✅ Position ouverte avec succès: ${symbol} sur ${tradeResult.venue}`);
          } else {
            console.log(`❌ Échec ouverture position: ${symbol} - ${tradeResult.error}`);
            
            // Fallback vers l'ancien système de file d'attente
            if (listingQueue) {
              console.log(`📋 Ajout de ${symbol} à la file d'attente (fallback)`);
              listingQueue.addListing(symbol, metadata, source);
            }
          }
        } catch (error) {
          console.error(`❌ Erreur orchestrateur pour ${symbol}:`, error);
          
          // Fallback vers l'ancien système
          if (listingQueue) {
            console.log(`📋 Ajout de ${symbol} à la file d'attente (erreur)`);
            listingQueue.addListing(symbol, metadata, source);
          }
        }
      } else {
        // Fallback vers l'ancien système si l'orchestrateur n'est pas disponible
      if (listingQueue && traderInitialized) {
          if (!isRailway) {
        console.log(`📋 Ajout de ${symbol} à la file d'attente (source: ${source})`);
          }
        listingQueue.addListing(symbol, metadata, source);
        
        // Vérification immédiate pour les WebSockets (déjà listés)
        if (source === 'websocket') {
            if (!isRailway) {
          console.log(`🔍 Vérification immédiate pour ${symbol} (WebSocket)`);
            }
          const hasPerp = await hyperliquidTrader?.hasPerp(symbol);
          if (hasPerp) {
            console.log(`✅ ${symbol} immédiatement disponible sur Hyperliquid !`);
            // Le trade sera géré par la file d'attente
          } else {
              if (!isRailway) {
            console.log(`⏳ ${symbol} pas encore disponible, surveillance en cours...`);
              }
          }
        } else {
            if (!isRailway) {
          console.log(`⏳ ${symbol} ajouté à la file d'attente pour surveillance continue...`);
            }
        }
      } else {
          if (!isRailway) {
        console.log(`📊 Listing détecté: ${symbol} (Mode surveillance uniquement - Hyperliquid non configuré)`);
      }
    }
      }
    }

    console.log("🎉 Bot initialisé avec succès !");
    console.log("📊 Mode:", process.env.DRY_RUN === '1' ? 'DRY RUN' : 'PRODUCTION');
    console.log("💰 Balance:", await checkBalance());
    console.log("🔍 Surveillance active...");

  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation du bot:", error);
    process.exit(1);
  }
}

// Gestion des signaux d'arrêt
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Arrêt du bot (${signal})...`);
  try {
    // Notification d'arrêt
    console.log(`🛑 Bot arrêté par signal: ${signal}`);
    
    // Arrêter tous les modules
    // if (listingSource) {
    //   listingSource.stopListening();
    // }
    

    

    
    // Arrêter la surveillance des listings coréens
    if (listingSurveillance) {
      listingSurveillance.stop();
      console.log('✅ Surveillance des listings coréens arrêtée');
    }
    
    // Arrêter le monitoring global
    if (globalTokenManager) {
      globalTokenManager.stopGlobalMonitoring();
      console.log('✅ Monitoring global arrêté');
    }
    
    // Arrêter la file d'attente
    if (listingQueue) {
      listingQueue.stopMonitoring();
      console.log('✅ File d\'attente arrêtée');
    }
    
    // Envoyer rapport final
    if (performanceMonitor) {
      await performanceMonitor.sendDailyReport();
    }
    
    console.log('✅ Arrêt propre terminé');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'arrêt:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Gestion des erreurs non capturées
process.on('uncaughtException', async (error) => {
  console.error('❌ Erreur non capturée:', error);
  console.error(`🚨 ERREUR FATALE: Bot arrêté par erreur: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  console.error(`🚨 ERREUR PROMESSE: Bot arrêté par promesse rejetée: ${String(reason)}`);
  process.exit(1);
});

// Démarrer le bot avec un délai pour laisser le health check se stabiliser
setTimeout(() => {
  startBot();
}, 2000);