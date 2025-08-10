import { BinanceChecker, GlobalTokenInfo } from './binanceChecker';
import { TelegramService } from './telegramService';
import { PriceFetcher, TokenPrice } from './priceFetcher';
import ccxt from 'ccxt';

export interface ListingAnalysis {
  symbol: string;
  isListedGlobally: boolean;
  hasPerpOnBinance: boolean;
  hasPerpOnBybit: boolean;
  hasPerpOnHyperliquid: boolean;
  recommendedExchange: string | null;
  eventType: 'bullish_korean_trigger' | 'first_mover_opportunity' | 'unknown';
  priority: 'high' | 'medium' | 'low';
}

export class GlobalTokenManager {
  private binanceChecker: BinanceChecker;
  private priceFetcher: PriceFetcher;
  private telegramService: TelegramService | null = null;
  private globalMonitoringInterval: number = 600000; // 10 minutes au lieu de 5
  private isGlobalMonitoringActive: boolean = false;
  private globalMonitoringTimer: NodeJS.Timeout | null = null;

  constructor(telegramService?: TelegramService) {
    this.binanceChecker = new BinanceChecker();
    this.priceFetcher = new PriceFetcher();
    this.telegramService = telegramService || null;
  }

  public async analyzeKoreanListing(symbol: string, metadata?: any, isTest: boolean = false): Promise<ListingAnalysis> {
    console.log(`🔍 Analyse du listing coréen: ${symbol}${isTest ? ' (TEST)' : ''}`);
    
    const analysis: ListingAnalysis = {
      symbol: symbol.toUpperCase(),
      isListedGlobally: false,
      hasPerpOnBinance: false,
      hasPerpOnBybit: false,
      hasPerpOnHyperliquid: false,
      recommendedExchange: null,
      eventType: 'unknown',
      priority: 'low'
    };

    try {
      // Vérifier si le token est listé globalement
      analysis.isListedGlobally = await this.binanceChecker.checkIfTokenIsListedGlobally(symbol);
      
      // Vérifier les perps disponibles
      analysis.hasPerpOnBinance = await this.binanceChecker.findPerpOnBinance(symbol);
      
      // TODO: Ajouter les vérifications Bybit et Hyperliquid
      // analysis.hasPerpOnBybit = await this.checkBybitPerp(symbol);
      // analysis.hasPerpOnHyperliquid = await this.checkHyperliquidPerp(symbol);
      
      // Déterminer l'exchange recommandé (priorité: Bybit > Hyperliquid > Binance)
      if (analysis.hasPerpOnBybit) {
        analysis.recommendedExchange = 'Bybit';
        analysis.priority = 'high';
      } else if (analysis.hasPerpOnHyperliquid) {
        analysis.recommendedExchange = 'Hyperliquid';
        analysis.priority = 'high';
      } else if (analysis.hasPerpOnBinance) {
        analysis.recommendedExchange = 'Binance';
        analysis.priority = 'medium';
      }

      // Déterminer le type d'événement
      if (analysis.isListedGlobally && analysis.recommendedExchange) {
        analysis.eventType = 'bullish_korean_trigger';
        analysis.priority = 'high';
      } else if (!analysis.isListedGlobally) {
        analysis.eventType = 'first_mover_opportunity';
        analysis.priority = 'medium';
      }

      // Log de l'analyse (sans notification Telegram si c'est un test)
      await this.logAnalysis(analysis, metadata, isTest);
      
      return analysis;
    } catch (error) {
      console.error(`❌ Erreur analyse listing ${symbol}:`, error);
      return analysis;
    }
  }

  private async logAnalysis(analysis: ListingAnalysis, metadata?: any, isTest: boolean = false): Promise<void> {
    const exchange = metadata?.exchange || metadata?.source || 'N/A';
    
    console.log(`\n📊 ANALYSE LISTING CORÉEN:`);
    console.log(`🔍 Symbole: ${analysis.symbol}`);
    console.log(`🏢 Exchange coréen: ${exchange}`);
    console.log(`🌍 Listé globalement: ${analysis.isListedGlobally ? '✅' : '❌'}`);
    console.log(`📈 Perp disponible:`);
    console.log(`  - Binance: ${analysis.hasPerpOnBinance ? '✅' : '❌'}`);
    console.log(`  - Bybit: ${analysis.hasPerpOnBybit ? '✅' : '❌'}`);
    console.log(`  - Hyperliquid: ${analysis.hasPerpOnHyperliquid ? '✅' : '❌'}`);
    console.log(`🎯 Exchange recommandé: ${analysis.recommendedExchange || 'Aucun'}`);
    console.log(`📊 Type d'événement: ${analysis.eventType}`);
    console.log(`⚡ Priorité: ${analysis.priority}`);
    console.log(`⏰ Timestamp: ${new Date().toLocaleString()}`);

    // Récupérer uniquement le prix Binance si un perp est disponible
    let priceInfo = '';
    if (analysis.hasPerpOnBinance) {
      try {
        const binancePrice = await this.priceFetcher.getBinancePrice(analysis.symbol);
        if (binancePrice) {
          const binanceFormatted = this.priceFetcher.formatPrice(binancePrice);
          priceInfo = `\n💰 Prix Perp Binance: ${binanceFormatted}`;
        }
      } catch (error) {
        console.error(`❌ Erreur récupération prix Binance pour ${analysis.symbol}:`, error);
        priceInfo = '\n💰 Prix: Non disponible';
      }
    }

    // Notification Telegram selon le type d'événement (sauf pour les tests)
    if (!isTest) {
      if (analysis.eventType === 'bullish_korean_trigger' && analysis.recommendedExchange) {
        console.log(`🔥 TRIGGER BULLISH CORÉEN DÉTECTÉ !`);
        console.log(`Symbole: ${analysis.symbol}`);
        console.log(`Listé sur: ${exchange}`);
        console.log(`Déjà listé globalement sur Binance ✅`);
        console.log(`Perp disponible sur: ${analysis.recommendedExchange}`);
        console.log(`Action recommandée: Ouverture immédiate`);
        console.log(`Prix: ${priceInfo}`);
        
        // Notification enrichie avec les prix
        await this.telegramService?.sendNewListing(
          analysis.symbol, 
          priceInfo || 'N/A', 
          `${exchange} + ${analysis.recommendedExchange} (TRIGGER BULLISH)`
        );
      } else if (analysis.eventType === 'first_mover_opportunity') {
        console.log(`💣 PREMIER LISTING MONDIAL DÉTECTÉ !`);
        console.log(`Symbole: ${analysis.symbol}`);
        console.log(`Listé sur: ${exchange}`);
        console.log(`Nouveau token global - surveillance active`);
        console.log(`Action: Surveiller l'apparition de perps`);
        console.log(`Prix: ${priceInfo}`);
        
        // Notification enrichie avec les prix
        await this.telegramService?.sendNewListing(
          analysis.symbol, 
          priceInfo || 'N/A', 
          `${exchange} (PREMIER LISTING MONDIAL)`
        );
      }
    } else {
      console.log(`🧪 TEST: Notifications Telegram désactivées`);
    }
  }

  public async checkBybitPerp(symbol: string): Promise<boolean> {
    try {
      const bybit = new ccxt.bybit({
        enableRateLimit: true,
        timeout: 10000,
      });
      
      const markets = await bybit.loadMarkets();
      const perpSymbol = `${symbol.toUpperCase()}/USDT:USDT`;
      
      if (markets[perpSymbol] && markets[perpSymbol].active) {
        console.log(`✅ Perp ${symbol} trouvé sur Bybit: ${perpSymbol}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Erreur vérification Bybit perp ${symbol}:`, error);
      return false;
    }
  }

  public async checkHyperliquidPerp(symbol: string): Promise<boolean> {
    try {
      // Utiliser le trader Hyperliquid existant si disponible
      // Pour l'instant, simulation
      console.log(`🔍 Vérification Hyperliquid perp ${symbol}...`);
      return false;
    } catch (error) {
      console.error(`❌ Erreur vérification Hyperliquid perp ${symbol}:`, error);
      return false;
    }
  }

  public startGlobalMonitoring(): void {
    if (this.isGlobalMonitoringActive) {
      console.log('⚠️ Monitoring global déjà actif');
      return;
    }

    // Vérifier si la surveillance globale est activée
    if (process.env.ENABLE_GLOBAL_MONITORING === 'false') {
      console.log('⏸️ Surveillance globale désactivée - Focus sur frontrunning coréen');
      return;
    }

    console.log('🌍 Démarrage du monitoring global Binance...');
    this.isGlobalMonitoringActive = true;
    
    // Premier check immédiat
    this.checkGlobalTokens();
    
    // Timer récurrent avec intervalle optimisé
    this.globalMonitoringTimer = setInterval(() => {
      this.checkGlobalTokens();
    }, this.globalMonitoringInterval);
    
    console.log(`✅ Monitoring global Binance actif (intervalle: ${this.globalMonitoringInterval / 1000}s)`);
  }

  private async checkGlobalTokens(): Promise<void> {
    try {
      console.log('🔍 Vérification des nouveaux tokens globaux sur Binance...');
      const newTokens = await this.binanceChecker.checkForNewGlobalTokens();
      
      if (newTokens.length > 0) {
        console.log(`🆕 ${newTokens.length} nouveau(x) token(s) global(aux) détecté(s)`);
      } else {
        const knownTokens = this.binanceChecker.getKnownGlobalTokens();
        console.log(`📊 Aucun nouveau token global détecté (${knownTokens.length} tokens surveillés)`);
      }
    } catch (error) {
      console.error('❌ Erreur vérification tokens globaux:', error);
    }
  }

  public stopGlobalMonitoring(): void {
    if (this.globalMonitoringTimer) {
      clearInterval(this.globalMonitoringTimer);
      this.globalMonitoringTimer = null;
      this.isGlobalMonitoringActive = false;
      console.log('🛑 Arrêt du monitoring global Binance.');
    } else {
      console.log('⚠️ Monitoring global déjà inactif.');
    }
  }

  public getGlobalStats() {
    return this.binanceChecker.getStats();
  }

  public getKnownGlobalTokens(): string[] {
    return this.binanceChecker.getKnownGlobalTokens();
  }
}
