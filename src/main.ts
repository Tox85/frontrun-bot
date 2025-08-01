import { AlternativeListingSource } from "./alternativeListingSource";
import { executeTrade, initializeTrader, checkBalance } from "./trader";
import { hasPerpOnBybit, hasPerpOnHyperliquid } from "./exchangeChecker";
import { TelegramService } from "./telegramService";
import { startHealthCheck } from './healthCheck';

console.log("🚀 Frontrun Bot is running!");

// Démarrer le health check pour Railway
console.log("🏥 Starting health check server...");
startHealthCheck();
console.log("✅ Health check server started successfully");

// Initialisation du trader
let traderInitialized = false;
let listingSource: AlternativeListingSource | null = null;
let telegramService: TelegramService | null = null;

async function startBot() {
  try {
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
      process.exit(1);
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

    process.on('SIGINT', async () => {
      console.log('\n🛑 Arrêt du bot...');
      await telegramService?.sendBotStatus("Arrêt", "Bot arrêté manuellement");
      if (listingSource) {
        listingSource.stopListening();
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Erreur lors du démarrage du bot:', error);
    await telegramService?.sendError('Erreur de démarrage', error instanceof Error ? error.message : 'Erreur inconnue');
    process.exit(1);
  }
}

startBot();
