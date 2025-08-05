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

async function startBot() {
  try {
    console.log("🤖 Initialisation du bot...");
    
    // Initialiser le rapporteur de statut
    const statusReporter = new StatusReporter();
    statusReporter.startReporting();
    
    // Valider la configuration Hyperliquid
    validateHyperliquidConfig();
    
    // Initialiser le service Telegram
    telegramService = new TelegramService();
    await telegramService.sendBotStatus("Démarrage", "Initialisation du bot...");

    // Initialiser les nouveaux modules
    console.log("📊 Initialisation des modules avancés...");
    retryManager = new TradeRetryManager(telegramService);
    performanceMonitor = new PerformanceMonitor(telegramService);
    riskManager = new RiskManager(telegramService);
    articleScraper = new BithumbArticleScraper(telegramService);

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
      await telegramService.sendBotStatus("Mode surveillance", "Hyperliquid non configuré - Surveillance active uniquement");
      // Ne pas arrêter le bot, continuer en mode surveillance
    } else {
      await telegramService.sendBotStatus("Trader initialisé", "Hyperliquid configuré avec succès");

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
        await telegramService.sendBalanceUpdate(balance);
      } catch (error) {
        console.warn("⚠️ Impossible de vérifier la balance, mais le bot continue...");
        await telegramService.sendBotStatus("Balance non disponible", "Mode dégradé - trading désactivé");
      }
    }

    // Initialiser la surveillance des listings
    listingSource = new AlternativeListingSource();
    await telegramService.sendBotStatus("Surveillance activée", "Détection des nouveaux listings en cours...");

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

      // Vérifier si le perpétuel existe sur Hyperliquid avec retry seulement si le trader est initialisé
      if (traderInitialized && hyperliquidTrader) {
        let hasPerpHyperliquid = false;
        try {
          if (retryManager) {
            hasPerpHyperliquid = await retryManager.executeWithRetry(
              () => hyperliquidTrader!.hasPerp(symbol),
              `Vérification perp ${symbol}`
            );
          } else {
            const result = await hyperliquidTrader?.hasPerp(symbol);
            hasPerpHyperliquid = result === true;
          }
        } catch (error) {
          console.error(`❌ Erreur vérification perp ${symbol}:`, error);
        }

        if (hasPerpHyperliquid) {
          console.log(`✅ Perp détecté sur Hyperliquid ! Vérification des risques...`);
          
          // Vérification des risques avant le trade
          if (riskManager) {
            const riskCheck = await riskManager.canTrade(symbol, 400); // Montant par défaut
            
            if (!riskCheck.allowed) {
              console.log(`🛡️ Trade bloqué: ${riskCheck.reason}`);
              await telegramService?.sendBotStatus("Trade bloqué", `${symbol}: ${riskCheck.reason}`);
              return; // Arrêter ici
            }
            
            console.log(`🛡️ Vérification risque: AUTORISÉ`);
          }
          
          await telegramService?.sendBotStatus("Trade Hyperliquid", `Ouverture position sur ${symbol}`);
          
          const tradeStart = Date.now();
          try {
            if (retryManager) {
              await retryManager.executeTradeWithRetry(
                () => executeTrade(symbol, 'Hyperliquid'),
                symbol,
                'Hyperliquid'
              );
            
              // Enregistrer le trade réussi
              if (performanceMonitor) {
                performanceMonitor.recordTrade(
                  symbol,
                  'Hyperliquid',
                  Date.now() - detectionStart,
                  Date.now() - tradeStart,
                  true
                );
              }
              
              // Enregistrer dans le risk manager
              if (riskManager) {
                await riskManager.recordTrade(symbol, 400);
              }
            } else {
              await executeTrade(symbol, 'Hyperliquid');
            }
          } catch (error) {
            console.error(`❌ Erreur trade ${symbol}:`, error);
            
            // Enregistrer le trade échoué
            if (performanceMonitor) {
              performanceMonitor.recordTrade(
                symbol,
                'Hyperliquid',
                Date.now() - detectionStart,
                Date.now() - tradeStart,
                false,
                undefined,
                error instanceof Error ? error.message : String(error)
              );
            }
          }
        } else {
          console.log(`❌ Perp non disponible sur Hyperliquid pour ${symbol}`);
          await telegramService?.sendBotStatus("Aucun perp trouvé", `${symbol} non disponible sur Hyperliquid`);
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
      ? "Bot opérationnel - Surveillance active - prêt à détecter les nouveaux listings"
      : "Bot opérationnel - Mode surveillance uniquement (Hyperliquid non configuré)";
    
    await telegramService.sendBotStatus("Bot opérationnel", statusMessage);
    
    // Envoyer rapport de risque initial
    if (riskManager) {
      await riskManager.sendDailyRiskReport();
    }

  } catch (error) {
    console.error('❌ Erreur lors du démarrage du bot:', error);
    await telegramService?.sendError('Erreur de démarrage', error instanceof Error ? error.message : 'Erreur inconnue');
    // Ne pas arrêter le processus, laisser le health check continuer
    console.log('🔄 Redémarrage automatique dans 30 secondes...');
    setTimeout(() => {
      startBot();
    }, 30000);
  }
}

// Gestion des signaux d'arrêt
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Arrêt du bot (${signal})...`);
  try {
    await telegramService?.sendBotStatus("Arrêt", `Bot arrêté (${signal})`);
    
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
  await telegramService?.sendError('Erreur fatale', error.message);
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  await telegramService?.sendError('Promesse rejetée', String(reason));
  process.exit(1);
});

// Démarrer le bot avec un délai pour laisser le health check se stabiliser
setTimeout(() => {
  startBot();
}, 2000);