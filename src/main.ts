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
  // Réduire la verbosité des logs en production
  process.env.ENABLE_KOREAN_LOGS = 'false';
  process.env.ENABLE_VERBOSE_LOGS = 'false';
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
    
    // Validation de la configuration Railway
    // const railwayConfig = validateRailwayConfig(); // This line is removed
    // const configErrors = getMissingConfigErrors(); // This line is removed
    
    // if (configErrors.length > 0) { // This block is removed
    //   console.error("❌ Erreurs de configuration Railway:"); // This block is removed
    //   configErrors.forEach(error => console.error(`  - ${error}`)); // This block is removed
    //   console.error("⚠️ Le bot continuera en mode surveillance uniquement"); // This block is removed
    // } // This block is removed
    
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
    
    let tradersInitialized = 0;
    
    // Initialiser Hyperliquid (priorité)
    if (process.env.HL_ENABLED === '1') {
      console.log("🔧 Initialisation du trader Hyperliquid...");
      try {
        hyperliquidTrader = new HyperliquidTrader();
        const hlInitialized = await hyperliquidTrader.initialize();
        if (hlInitialized) {
          console.log("✅ Trader Hyperliquid initialisé avec succès");
          traderInitialized = true;
          tradersInitialized++;
          // Synchroniser avec trader.ts
          setHyperliquidTrader(hyperliquidTrader);
        } else {
          console.log("⚠️ Échec initialisation Hyperliquid");
        }
      } catch (error) {
        console.error("❌ Erreur initialisation Hyperliquid:", error);
      }
    } else {
      console.log("⏸️ Hyperliquid désactivé (HL_ENABLED != 1)");
    }

    // Initialiser Binance (si activé)
    let binanceTrader: BinanceTrader | undefined = undefined;
    if (process.env.BINANCE_ENABLED === '1') {
      console.log("🔧 Initialisation du trader Binance...");
      try {
        binanceTrader = new BinanceTrader(telegramService);
        const binanceInitialized = await binanceTrader.initialize();
        if (binanceInitialized) {
          console.log("✅ Trader Binance initialisé avec succès");
          if (!traderInitialized) traderInitialized = true;
          tradersInitialized++;
        } else {
          console.log("⚠️ Échec initialisation Binance");
        }
      } catch (error) {
        console.error("❌ Erreur initialisation Binance:", error);
      }
    } else {
      console.log("⏸️ Binance désactivé (BINANCE_ENABLED != 1)");
    }

    // Initialiser Bybit (si activé)
    let bybitTrader: BybitTrader | undefined = undefined;
    if (process.env.BYBIT_ENABLED === '1') {
      console.log("🔧 Initialisation du trader Bybit...");
      try {
        bybitTrader = new BybitTrader();
        const bybitInitialized = await bybitTrader.initialize();
        if (bybitInitialized) {
          console.log("✅ Trader Bybit initialisé avec succès");
          if (!traderInitialized) traderInitialized = true;
          tradersInitialized++;
        } else {
          console.log("⚠️ Échec initialisation Bybit");
        }
      } catch (error) {
        console.error("❌ Erreur initialisation Bybit:", error);
      }
    } else {
      console.log("⏸️ Bybit désactivé (BYBIT_ENABLED != 1)");
    }
    
    console.log(`📊 Résumé traders: ${tradersInitialized} trader(s) initialisé(s)`);
    
    if (traderInitialized) {
      console.log("✅ Au moins un trader initialisé avec succès");
      
      // Vérifier la balance APRÈS l'initialisation des traders
      console.log("💰 Vérification de la balance...");
      const balance = await checkBalance();
      console.log(`💰 Balance disponible: ${balance.available} USDC`);
      
      // Envoyer le message de démarrage avec la vraie balance
      await telegramService.sendBotReady(balance.available);
      
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
      
      // Envoyer le message de démarrage avec balance 0
      await telegramService.sendBotReady(0);
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
              console.log(`🔍 Vérification immédiate WebSocket pour ${symbol}`);
            }
            // Note: processImmediate n'existe pas, on utilise addListing
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur critique dans startBot:', error);
    
    // Notification d'erreur critique
    if (telegramService) {
      await telegramService.sendBotReady(0); // Fallback simple
    }
  }
}

// Démarrer le bot
startBot().catch(error => {
  console.error('❌ Erreur fatale au démarrage du bot:', error);
  process.exit(1);
});