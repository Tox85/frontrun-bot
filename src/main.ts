import { AlternativeListingSource } from "./alternativeListingSource";
import { executeTrade, initializeTrader, checkBalance } from "./trader";
import { TelegramService } from "./telegramService";
import { startHealthCheck } from './healthCheck';
import { HyperliquidWebSocket } from './hyperliquidWebSocket';
import { HyperliquidTrader } from './hyperliquidTrader';
import { validateHyperliquidConfig } from './hyperliquidConfig';
import { BithumbArticleScraper } from './bithumbArticleScraper';
import { TradeRetryManager } from './retryManager';
import { PerformanceMonitor } from './performanceMonitor';
import { RiskManager } from './riskManager';
import { StatusReporter } from './statusReporter';
import { DiagnosticTool } from './diagnostic';
import { ListingQueue } from './listingQueue';

console.log("🚀 Frontrun Bot is running!");

// Démarrer le health check pour Railway
console.log("🏥 Starting health check server...");
try {
  startHealthCheck();
  console.log("✅ Health check server started successfully");
} catch (error) {
  console.error("❌ Failed to start health check server:", error);
}

// Variables globales
let traderInitialized = false;
let listingSource: AlternativeListingSource | null = null;
let hyperliquidWebSocket: HyperliquidWebSocket | null = null;
let hyperliquidTrader: HyperliquidTrader | null = null;
let telegramService: TelegramService | null = null;
let articleScraper: BithumbArticleScraper | null = null;
let retryManager: TradeRetryManager | null = null;
let performanceMonitor: PerformanceMonitor | null = null;
let riskManager: RiskManager | null = null;
let listingQueue: ListingQueue | null = null;

// Système de monitoring des anomalies
let messageCount = 0;
let lastMessageTime = 0;
const MESSAGE_RATE_LIMIT = 10; // Max 10 messages par minute
const MESSAGE_TIME_WINDOW = 60000; // 1 minute

function checkMessageRate(): boolean {
  const now = Date.now();
  if (now - lastMessageTime < MESSAGE_TIME_WINDOW) {
    messageCount++;
    if (messageCount > MESSAGE_RATE_LIMIT) {
      console.warn('🚨 Taux de messages trop élevé - possible spam détecté');
      return false;
    }
  } else {
    messageCount = 1;
    lastMessageTime = now;
  }
  return true;
}

async function startBot() {
  try {
    console.log("🤖 Initialisation du bot...");
    
    // Diagnostic système au démarrage
    console.log("🔍 Exécution du diagnostic système...");
    const diagnosticTool = new DiagnosticTool();
    await diagnosticTool.runDiagnostic();
    
    // Initialiser le rapporteur de statut
    const statusReporter = new StatusReporter();
    statusReporter.startReporting();
    
    // Valider la configuration Hyperliquid
    validateHyperliquidConfig();
    
    // Initialiser le service Telegram
    telegramService = new TelegramService();
    // await telegramService.sendBotStatus("Démarrage", "Initialisation du bot...");

    // Initialiser les nouveaux modules
    console.log("📊 Initialisation des modules avancés...");
    retryManager = new TradeRetryManager(telegramService);
    performanceMonitor = new PerformanceMonitor(telegramService);
    riskManager = new RiskManager(telegramService);
    articleScraper = new BithumbArticleScraper(telegramService);

    // Initialiser la file d'attente pour les listings avec délais
    listingQueue = new ListingQueue(telegramService, undefined, riskManager, performanceMonitor);

    // Connecter le service Telegram au trader
    const { setTelegramService, setRiskManager } = await import('./trader');
    setTelegramService(telegramService);
    if (riskManager) {
      setRiskManager(riskManager);
    }

    // Initialiser le trader Hyperliquid avec retry
    console.log("🔧 Initialisation du trader Hyperliquid...");
    hyperliquidTrader = new HyperliquidTrader();
    
    if (retryManager) {
      traderInitialized = await retryManager.executeWithRetry(
        () => hyperliquidTrader!.initialize(),
        "Initialisation Hyperliquid"
      );
    } else {
      traderInitialized = await hyperliquidTrader.initialize();
    }
    
    if (!traderInitialized) {
      console.warn("⚠️ Hyperliquid non initialisé - Mode surveillance uniquement");
      // await telegramService.sendBotStatus("Mode surveillance", "Hyperliquid non configuré - Surveillance active uniquement");
      // Ne pas arrêter le bot, continuer en mode surveillance
    } else {
      // await telegramService.sendBotStatus("Trader initialisé", "Hyperliquid configuré avec succès");
      
      // Mettre à jour la file d'attente avec le trader
      if (listingQueue) {
        listingQueue = new ListingQueue(telegramService, hyperliquidTrader, riskManager, performanceMonitor);
      }

      // Vérifier la balance avec retry seulement si le trader est initialisé
      try {
        let balance;
        if (retryManager) {
          balance = await retryManager.executeWithRetry(
            () => hyperliquidTrader!.checkBalance(),
            "Vérification balance"
          );
        } else {
          balance = await hyperliquidTrader.checkBalance();
        }
        // await telegramService.sendBalanceUpdate(balance);
      } catch (error) {
        console.warn("⚠️ Impossible de vérifier la balance, mais le bot continue...");
        // await telegramService.sendBotStatus("Balance non disponible", "Mode dégradé - trading désactivé");
      }
    }

    // Initialiser la surveillance des listings
    listingSource = new AlternativeListingSource();
    // await telegramService.sendBotStatus("Surveillance activée", "Détection des nouveaux listings en cours...");

    // Initialiser le WebSocket Hyperliquid seulement si configuré
    if (traderInitialized) {
      // Temporairement désactivé - problème de stabilité WebSocket
      console.log('⚠️ WebSocket Hyperliquid temporairement désactivé (problème de stabilité)');
      // hyperliquidWebSocket = new HyperliquidWebSocket();
      // await hyperliquidWebSocket.startListening(handleNewListing);
    }

    // Démarrer la surveillance des articles Bithumb (désactivé temporairement)
    if (articleScraper) {
      // await articleScraper.startMonitoring();
      console.log("📰 Surveillance articles Bithumb désactivée (Cloudflare protection)");
    }

    // Gestionnaire des nouveaux listings avec monitoring
    async function handleNewListing(symbol: string, metadata?: any) {
      const detectionStart = Date.now();
      
      console.log(`🆕 NOUVEAU LISTING DÉTECTÉ !`);
      console.log(`Symbole : ${symbol}`);
      if (metadata) {
        console.log(`Exchange : ${metadata.exchange}`);
        console.log(`Marché complet : ${metadata.fullSymbol}`);
      }

      // Enregistrer la détection
      if (performanceMonitor) {
        performanceMonitor.recordDetection(symbol, Date.now() - detectionStart);
      }

      // Notification Telegram
      await telegramService?.sendNewListing(symbol, metadata);

      // Déterminer la source du listing
      let source: 'announcement' | 'websocket' | 'api' = 'api';
      if (metadata?.source?.includes('Article') || metadata?.source?.includes('announcement')) {
        source = 'announcement';
      } else if (metadata?.source?.includes('WebSocket')) {
        source = 'websocket';
      }

      // Ajouter à la file d'attente au lieu de vérifier immédiatement
      if (listingQueue && traderInitialized) {
        console.log(`📋 Ajout de ${symbol} à la file d'attente (source: ${source})`);
        listingQueue.addListing(symbol, metadata, source);
        
        // Envoyer notification de file d'attente
        await telegramService?.sendQueuedListing(symbol, metadata, source);
        
        // Vérification immédiate pour les WebSockets (déjà listés)
        if (source === 'websocket') {
          console.log(`🔍 Vérification immédiate pour ${symbol} (WebSocket)`);
          const hasPerp = await hyperliquidTrader?.hasPerp(symbol);
          if (hasPerp) {
            console.log(`✅ ${symbol} immédiatement disponible sur Hyperliquid !`);
            // Le trade sera géré par la file d'attente
          } else {
            console.log(`⏳ ${symbol} pas encore disponible, surveillance en cours...`);
          }
        } else {
          console.log(`⏳ ${symbol} ajouté à la file d'attente pour surveillance continue...`);
        }
      } else {
        console.log(`📊 Listing détecté: ${symbol} (Mode surveillance uniquement - Hyperliquid non configuré)`);
        await telegramService?.sendBotStatus("Listing détecté", `${symbol} - Mode surveillance uniquement`);
      }
    }

    // Démarrer la surveillance
    listingSource.startListening(handleNewListing);

    // Notification de démarrage réussi
    const statusMessage = traderInitialized 
      ? "Bot en marche et prêt à détecter les nouveaux listings"
      : "Bot en marche - Mode surveillance uniquement";
    
    await telegramService.sendBotStatus("Bot opérationnel", statusMessage);
    
    // Envoyer rapport de risque initial
    if (riskManager) {
      // await riskManager.sendDailyRiskReport();
    }

    // Notification de démarrage réussi
    // await telegramService.sendBotStatus("✅ BOT OPÉRATIONNEL", "Bot démarré avec succès - Surveillance active");

    // Rapport périodique de la file d'attente
    setInterval(() => {
      if (listingQueue) {
        const status = listingQueue.getQueueStatus();
        if (status.total > 0) {
          console.log(`📋 File d'attente: ${status.total} tokens (${status.announcements} annonces, ${status.websockets} WebSocket, ${status.apis} API)`);
        }
      }
    }, 300000); // Toutes les 5 minutes

  } catch (error) {
    console.error('❌ Erreur lors du démarrage du bot:', error);
    
    // Envoyer un message d'erreur seulement si le service Telegram est disponible
    if (telegramService) {
      try {
        await telegramService.sendError('Erreur de démarrage', error instanceof Error ? error.message : 'Erreur inconnue');
      } catch (telegramError) {
        console.error('❌ Impossible d\'envoyer l\'erreur via Telegram:', telegramError);
      }
    }
    
    // Attendre plus longtemps avant le redémarrage pour éviter les boucles
    const restartDelay = 60000; // 1 minute au lieu de 30 secondes
    console.log(`🔄 Redémarrage automatique dans ${restartDelay/1000} secondes...`);
    
    // Notification de redémarrage
    if (telegramService) {
      try {
        await telegramService.sendBotStatus("🔄 REDÉMARRAGE", `Bot redémarre automatiquement dans ${restartDelay/1000} secondes`);
      } catch (telegramError) {
        console.error('❌ Impossible d\'envoyer la notification de redémarrage:', telegramError);
      }
    }
    
    setTimeout(() => {
      startBot();
    }, restartDelay);
  }
}

// Gestion des signaux d'arrêt
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Arrêt du bot (${signal})...`);
  try {
    // Notification d'arrêt
    if (telegramService) {
      await telegramService.sendBotStatus("🛑 BOT ARRÊTÉ", `Bot arrêté par signal: ${signal}`);
    }
    
    // Arrêter tous les modules
    if (listingSource) {
      listingSource.stopListening();
    }
    // Temporairement désactivé - WebSocket Hyperliquid désactivé
    // if (hyperliquidWebSocket && typeof hyperliquidWebSocket.stopListening === 'function') {
    //   hyperliquidWebSocket.stopListening();
    // }
    if (articleScraper) {
      await articleScraper.stopMonitoring();
    }
    
    // Arrêter la file d'attente
    if (listingQueue) {
      listingQueue.stopMonitoring();
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
  if (telegramService) {
    await telegramService.sendBotStatus("🚨 ERREUR FATALE", `Bot arrêté par erreur: ${error.message}`);
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  if (telegramService) {
    await telegramService.sendBotStatus("🚨 ERREUR PROMESSE", `Bot arrêté par promesse rejetée: ${String(reason)}`);
  }
  process.exit(1);
});

// Démarrer le bot avec un délai pour laisser le health check se stabiliser
setTimeout(() => {
  startBot();
}, 2000);