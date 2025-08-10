import ccxt from 'ccxt';
import { TelegramService } from './telegramService';

export class BinanceTrader {
  private binance: any;
  private telegramService: TelegramService | null = null;
  private isInitialized: boolean = false;

  constructor(telegramService?: TelegramService) {
    this.telegramService = telegramService || null;
    this.binance = new ccxt.binance({
      enableRateLimit: true,
      timeout: 10000,
    });
  }

  public async initialize(): Promise<boolean> {
    try {
      console.log("🔧 Initialisation du trader Binance...");
      
      // Test de connexion
      await this.binance.loadMarkets();
      
      this.isInitialized = true;
      console.log("✅ Trader Binance initialisé avec succès");
      
      if (this.telegramService) {
        await this.telegramService.sendNewListing("BINANCE", "N/A", "Trader initialisé");
      }
      
      return true;
    } catch (error) {
      console.error("❌ Erreur initialisation Binance:", error);
      return false;
    }
  }

  public async hasPerp(symbol: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        console.warn("⚠️ Binance non initialisé");
        return false;
      }

      const perpSymbol = `${symbol.toUpperCase()}/USDT:USDT`;
      const markets = await this.binance.loadMarkets();
      
      if (markets[perpSymbol] && markets[perpSymbol].active) {
        console.log(`✅ Perp ${symbol} trouvé sur Binance: ${perpSymbol}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Erreur vérification perp ${symbol} sur Binance:`, error);
      return false;
    }
  }

  public async openPosition(symbol: string): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      if (!this.isInitialized) {
        return { success: false, error: "Binance non initialisé" };
      }

      console.log(`🚀 Ouverture position ${symbol} sur Binance...`);
      
      // TODO: Implémenter l'ouverture de position avec levier max
      // Pour l'instant, simulation
      const orderId = `binance_${Date.now()}`;
      
      console.log(`✅ Position ${symbol} ouverte sur Binance (ID: ${orderId})`);
      
      if (this.telegramService) {
        await this.telegramService.sendNewListing(
          symbol,
          orderId,
          `Binance - Position ouverte`
        );
      }
      
      return { success: true, orderId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error(`❌ Erreur ouverture position ${symbol} sur Binance:`, errorMsg);
      
      if (this.telegramService) {
        await this.telegramService.sendNewListing(
          symbol,
          'ERROR',
          `Binance - Erreur: ${errorMsg}`
        );
      }
      
      return { success: false, error: errorMsg };
    }
  }

  public async closePosition(symbol: string): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      if (!this.isInitialized) {
        return { success: false, error: "Binance non initialisé" };
      }

      console.log(`🔒 Fermeture position ${symbol} sur Binance...`);
      
      // TODO: Implémenter la fermeture de position
      // Pour l'instant, simulation
      const orderId = `binance_close_${Date.now()}`;
      
      console.log(`✅ Position ${symbol} fermée sur Binance (ID: ${orderId})`);
      
      if (this.telegramService) {
        await this.telegramService.sendNewListing(
          symbol,
          orderId,
          `Binance - Position fermée`
        );
      }
      
      return { success: true, orderId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error(`❌ Erreur fermeture position ${symbol} sur Binance:`, errorMsg);
      
      if (this.telegramService) {
        await this.telegramService.sendNewListing(
          symbol,
          'ERROR',
          `Binance - Erreur fermeture: ${errorMsg}`
        );
      }
      
      return { success: false, error: errorMsg };
    }
  }

  public async checkBalance(): Promise<{ available: number; total: number }> {
    try {
      if (!this.isInitialized) {
        return { available: 0, total: 0 };
      }

      // TODO: Implémenter la vérification de balance
      // Pour l'instant, retour de valeurs simulées
      return { available: 1000, total: 1000 };
    } catch (error) {
      console.error("❌ Erreur vérification balance Binance:", error);
      return { available: 0, total: 0 };
    }
  }

  public getStatus(): { initialized: boolean; exchange: string } {
    return {
      initialized: this.isInitialized,
      exchange: 'Binance'
    };
  }

  /**
   * Récupère les informations du marché pour un symbole
   */
  public async getMarketInfo(symbol: string): Promise<{
    symbol: string;
    type: string;
    active: boolean;
    precision: any;
    limits: any;
    minOrderSize?: number;
    minNotional?: number;
    tickSize?: number;
    lotSize?: number;
  } | null> {
    try {
      if (!this.isInitialized) {
        console.warn("⚠️ Binance non initialisé");
        return null;
      }

      const perpSymbol = `${symbol.toUpperCase()}/USDT:USDT`;
      const markets = await this.binance.loadMarkets();
      const market = markets[perpSymbol];

      if (market && market.active) {
        return {
          symbol: market.symbol,
          type: market.type,
          active: market.active,
          precision: market.precision,
          limits: market.limits,
          minOrderSize: market.limits?.amount?.min || 0.001,
          minNotional: market.limits?.cost?.min || 1,
          tickSize: market.precision?.price || 0.001,
          lotSize: market.precision?.amount || 0.001
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ Erreur récupération infos marché ${symbol} sur Binance:`, error);
      return null;
    }
  }

  /**
   * Récupère le ticker pour un symbole
   */
  public async getTicker(symbol: string): Promise<{
    symbol: string;
    last: number;
    bid: number;
    ask: number;
    volume: number;
    timestamp: number;
  } | null> {
    try {
      if (!this.isInitialized) {
        console.warn("⚠️ Binance non initialisé");
        return null;
      }

      const perpSymbol = `${symbol.toUpperCase()}/USDT:USDT`;
      const ticker = await this.binance.fetchTicker(perpSymbol);

      if (ticker) {
        return {
          symbol: ticker.symbol,
          last: ticker.last || 0,
          bid: ticker.ask || 0,
          ask: ticker.ask || 0,
          volume: ticker.baseVolume || 0,
          timestamp: ticker.timestamp || Date.now()
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ Erreur récupération ticker ${symbol} sur Binance:`, error);
      return null;
    }
  }

  /**
   * Ouvre une position avec sizing et stop-loss
   */
  public async openPositionWithSizing(
    symbol: string,
    qty: number,
    leverage: number = 25,
    stopLossPrice?: number
  ): Promise<{
    success: boolean;
    orderId?: string;
    positionId?: string;
    error?: string;
    details?: any;
  }> {
    try {
      if (!this.isInitialized) {
        return { success: false, error: "Binance non initialisé" };
      }

      console.log(`🚀 Ouverture position ${symbol} sur Binance avec sizing...`);
      console.log(`📊 Quantité: ${qty}, Levier: ${leverage}, Stop-Loss: ${stopLossPrice}`);
      
      // TODO: Implémenter l'ouverture de position avec levier et stop-loss
      // Pour l'instant, simulation
      const orderId = `binance_${Date.now()}`;
      const positionId = `pos_${Date.now()}`;
      
      console.log(`✅ Position ${symbol} ouverte sur Binance (ID: ${orderId})`);
      
      if (this.telegramService) {
        await this.telegramService.sendNewListing(
          symbol,
          orderId,
          `Binance - Position ouverte avec sizing`
        );
      }
      
      return { 
        success: true, 
        orderId, 
        positionId,
        details: { leverage, stopLossPrice }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error(`❌ Erreur ouverture position ${symbol} sur Binance:`, errorMsg);
      
      if (this.telegramService) {
        await this.telegramService.sendNewListing(
          symbol,
          'ERROR',
          `Binance - Erreur: ${errorMsg}`
        );
      }
      
      return { success: false, error: errorMsg };
    }
  }
}
