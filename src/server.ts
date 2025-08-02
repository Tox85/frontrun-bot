import { startHealthCheck } from './healthCheck';
import { AlternativeListingSource } from "./alternativeListingSource";
import { executeTrade, initializeTrader, checkBalance } from "./trader";
import { hasPerpOnBybit, hasPerpOnHyperliquid } from "./exchangeChecker";
import { TelegramService } from "./telegramService";

console.log("🚀 Frontrun Bot Server is starting...");

// Démarrer IMMÉDIATEMENT le health check pour Railway
console.log("🏥 Starting health check server immediately...");
startHealthCheck();
console.log("✅ Health check server started successfully");

// Variables pour le bot
let traderInitialized = false;
let listingSource: AlternativeListingSource | null = null;
let telegramService: TelegramService | null = null;

async function startBot() {
  try {
    console.log("🤖 Initializing bot components...");
    
    // Initialiser le service Telegram
    telegramService = new TelegramService();
    await telegramService.sendBotStatus("Démarrage", "Initialisation du bot...");

    // Connecter le service Telegram au trader
    const { setTelegramService } = await import('./trader');
    setTelegramService(telegramService);

    // Initialiser le trader
    traderInitialized = await initializeTrader();
    
    if (!traderInitialized) {
      await telegramService.sendError("Impossible d'initialiser le trader", "Arrêt du bot");
      console.error("❌ Impossible d'initialiser le trader, arrêt du bot");
      return; // Ne pas arrêter le serveur, juste le bot
    }

    await telegramService.sendBotStatus("Trader initialisé", "Bybit configuré avec succès");

    // Vérifier la balance (optionnel)
    try {
      const balance = await checkBalance();
      await telegramService.sendBalanceUpdate(balance);
    } catch (error) {
      console.warn("⚠️ Impossible de vérifier la balance, mais le bot continue...");
      await telegramService.sendBotStatus("Balance non disponible", "Mode dégradé - trading désactivé");
    }

    // Initialiser la source alternative
    listingSource = new AlternativeListingSource();
    await telegramService.sendBotStatus("Surveillance activée", "Détection des nouveaux listings en cours...");

    async function handleNewListing(symbol: string, metadata?: any) {
      console.log(`🆕 NOUVEAU LISTING DÉTECTÉ !`);
      console.log(`Symbole : ${symbol}`);
      if (metadata) {
        console.log(`Titre   : ${metadata.title}`);
        console.log(`URL     : ${metadata.url}`);
      }

      // Notification Telegram du nouveau listing
      await telegramService?.sendNewListing(symbol, metadata);

      // Vérification Bybit et Hyperliquid en parallèle
      const [hasPerpBybit, hasPerpHyperliquid] = await Promise.all([
        hasPerpOnBybit(symbol),
        hasPerpOnHyperliquid(symbol)
      ]);

      if (hasPerpBybit) {
        console.log(`✅ Perp détecté sur Bybit ! Lancement du trade...`);
        await telegramService?.sendBotStatus("Trade Bybit", `Ouverture position sur ${symbol}`);
        await executeTrade(symbol, 'Bybit');
      } else if (hasPerpHyperliquid) {
        console.log(`✅ Perp détecté sur Hyperliquid ! Lancement du trade...`);
        await telegramService?.sendBotStatus("Trade Hyperliquid", `Ouverture position sur ${symbol}`);
        await executeTrade(symbol, 'Hyperliquid');
      } else {
        console.log(`❌ Aucun perp détecté sur Bybit ni Hyperliquid pour ${symbol}`);
        await telegramService?.sendBotStatus("Aucun perp trouvé", `${symbol} non disponible sur les exchanges`);
      }
    }

    listingSource.startListening(handleNewListing);

    // Notification de démarrage réussi
    await telegramService.sendBotStatus("Bot opérationnel", "Surveillance active - prêt à détecter les nouveaux listings");

  } catch (error) {
    console.error('❌ Erreur lors du démarrage du bot:', error);
    await telegramService?.sendError('Erreur de démarrage', error instanceof Error ? error.message : 'Erreur inconnue');
    // Ne pas arrêter le serveur, juste notifier l'erreur
  }
}

// Démarrer le bot en arrière-plan après un court délai
setTimeout(() => {
  startBot();
}, 1000);

// Gestion des signaux d'arrêt
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Arrêt du serveur (${signal})...`);
  try {
    await telegramService?.sendBotStatus("Arrêt", `Serveur arrêté (${signal})`);
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
  // Ne pas arrêter le serveur pour les erreurs non critiques
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  await telegramService?.sendError('Promesse rejetée', String(reason));
  // Ne pas arrêter le serveur pour les erreurs non critiques
});

console.log("✅ Server startup complete - health check is ready!"); 