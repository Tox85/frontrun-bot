import { AlternativeListingSource } from "./alternativeListingSource";
import { executeTrade, initializeTrader, checkBalance } from "./trader";
import { hasPerpOnBybit } from "./exchangeChecker";
import { TelegramService } from "./telegramService";
import { startHealthCheck } from './healthCheck';

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
let telegramService: TelegramService | null = null;

async function startBot() {
  try {
    console.log("🤖 Initialisation du bot...");
    
    // Initialiser le service Telegram
    telegramService = new TelegramService();
    await telegramService.sendBotStatus("Démarrage", "Initialisation du bot...");

    // Connecter le service Telegram au trader
    const { setTelegramService } = await import('./trader');
    setTelegramService(telegramService);

    // Initialiser le trader Bybit
    traderInitialized = await initializeTrader();
    
    if (!traderInitialized) {
      await telegramService.sendError("Impossible d'initialiser le trader", "Arrêt du bot");
      console.error("❌ Impossible d'initialiser le trader, arrêt du bot");
      process.exit(1);
    }

    await telegramService.sendBotStatus("Trader initialisé", "Bybit configuré avec succès");

    // Vérifier la balance
    try {
      const balance = await checkBalance();
      await telegramService.sendBalanceUpdate(balance);
    } catch (error) {
      console.warn("⚠️ Impossible de vérifier la balance, mais le bot continue...");
      await telegramService.sendBotStatus("Balance non disponible", "Mode dégradé - trading désactivé");
    }

    // Initialiser la surveillance des listings
    listingSource = new AlternativeListingSource();
    await telegramService.sendBotStatus("Surveillance activée", "Détection des nouveaux listings en cours...");

    // Gestionnaire des nouveaux listings
    async function handleNewListing(symbol: string, metadata?: any) {
      console.log(`🆕 NOUVEAU LISTING DÉTECTÉ !`);
      console.log(`Symbole : ${symbol}`);
      if (metadata) {
        console.log(`Titre   : ${metadata.title}`);
        console.log(`URL     : ${metadata.url}`);
      }

      // Notification Telegram
      await telegramService?.sendNewListing(symbol, metadata);

      // Vérifier si le perpétuel existe sur Bybit
      const hasPerpBybit = await hasPerpOnBybit(symbol);

      if (hasPerpBybit) {
        console.log(`✅ Perp détecté sur Bybit ! Lancement du trade...`);
        await telegramService?.sendBotStatus("Trade Bybit", `Ouverture position sur ${symbol}`);
        await executeTrade(symbol, 'Bybit');
      } else {
        console.log(`❌ Perp non disponible sur Bybit pour ${symbol}`);
        await telegramService?.sendBotStatus("Aucun perp trouvé", `${symbol} non disponible sur Bybit`);
      }
    }

    // Démarrer la surveillance
    listingSource.startListening(handleNewListing);

    // Notification de démarrage réussi
    await telegramService.sendBotStatus("Bot opérationnel", "Surveillance active - prêt à détecter les nouveaux listings");

  } catch (error) {
    console.error('❌ Erreur lors du démarrage du bot:', error);
    await telegramService?.sendError('Erreur de démarrage', error instanceof Error ? error.message : 'Erreur inconnue');
    process.exit(1);
  }
}

// Gestion des signaux d'arrêt
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Arrêt du bot (${signal})...`);
  try {
    await telegramService?.sendBotStatus("Arrêt", `Bot arrêté (${signal})`);
    if (listingSource) {
      listingSource.stopListening();
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