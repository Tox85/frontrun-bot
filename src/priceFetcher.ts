import ccxt from 'ccxt';

export interface TokenPrice {
  symbol: string;
  price: number;
  exchange: string;
  timestamp: number;
  volume24h?: number;
  change24h?: number;
}

export class PriceFetcher {
  private binance: any;
  private binanceCache: Map<string, TokenPrice> = new Map();
  private cacheTimeout: number = 30000; // 30 secondes

  constructor() {
    this.binance = new ccxt.binance({
      enableRateLimit: true,
      timeout: 10000,
    });
  }

  /**
   * Récupérer le prix d'un token sur Binance
   */
  public async getBinancePrice(symbol: string): Promise<TokenPrice | null> {
    try {
      // Vérifier le cache d'abord
      const cached = this.binanceCache.get(symbol.toUpperCase());
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached;
      }

      // Récupérer le prix en direct
      const ticker = await this.binance.fetchTicker(`${symbol.toUpperCase()}/USDT`);
      
      const price: TokenPrice = {
        symbol: symbol.toUpperCase(),
        price: ticker.last,
        exchange: 'Binance',
        timestamp: Date.now(),
        volume24h: ticker.baseVolume,
        change24h: ticker.percentage
      };

      // Mettre en cache
      this.binanceCache.set(symbol.toUpperCase(), price);
      return price;
    } catch (error) {
      console.error(`❌ Erreur récupération prix Binance ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Formater le prix pour l'affichage
   */
  public formatPrice(price: TokenPrice): string {
    const priceStr = price.price >= 1 ? price.price.toFixed(2) : price.price.toFixed(6);
    const volumeStr = price.volume24h ? `Vol: ${(price.volume24h / 1000000).toFixed(2)}M` : '';
    const changeStr = price.change24h ? `(${price.change24h > 0 ? '+' : ''}${price.change24h.toFixed(2)}%)` : '';
    
    return `$${priceStr} ${changeStr} ${volumeStr}`.trim();
  }

  /**
   * Nettoyer le cache
   */
  public cleanCache(): void {
    const now = Date.now();
    for (const [symbol, price] of this.binanceCache.entries()) {
      if (now - price.timestamp > this.cacheTimeout) {
        this.binanceCache.delete(symbol);
      }
    }
  }
}
