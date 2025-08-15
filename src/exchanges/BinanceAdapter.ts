import { RateLimiter } from '../core/RateLimiter';
import { SymbolMapper } from '../core/SymbolMapper';

export interface BinanceConfig {
  apiKey: string;
  secretKey: string;
  testnet: boolean;
  baseUrl: string;
  timeoutMs: number;
}

export interface BinanceSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  minQty: string;
  maxQty: string;
  tickSize: string;
  stepSize: string;
  minNotional: string;
}

export interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  count: number;
}

export interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

export class BinanceAdapter {
  private config: BinanceConfig;
  private rateLimiter: RateLimiter;
  private symbolMapper: SymbolMapper;
  private isInitialized: boolean = false;

  constructor(config: BinanceConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter();
    this.symbolMapper = SymbolMapper.getInstance();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Test de connexion à l'API
      await this.testConnection();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Échec de l'initialisation Binance: ${error}`);
    }
  }

  private async testConnection(): Promise<void> {
    const response = await this.makeRequest('GET', '/api/v3/ping');
    if (!response) {
      throw new Error('Impossible de se connecter à l\'API Binance');
    }
  }

  async getSymbols(): Promise<BinanceSymbol[]> {
    await this.ensureInitialized();
    
    try {
      const response = await this.makeRequest('GET', '/api/v3/exchangeInfo');
      
      if (response?.symbols) {
        return response.symbols
          .filter((symbol: any) => symbol.status === 'TRADING')
          .map((symbol: any) => {
            const lotSizeFilter = symbol.filters.find((f: any) => f.filterType === 'LOT_SIZE');
            const priceFilter = symbol.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
            const notionalFilter = symbol.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL');
            
            return {
              symbol: symbol.symbol,
              baseAsset: symbol.baseAsset,
              quoteAsset: symbol.quoteAsset,
              status: symbol.status,
              minQty: lotSizeFilter?.minQty || '0',
              maxQty: lotSizeFilter?.maxQty || '0',
              tickSize: priceFilter?.tickSize || '0',
              stepSize: lotSizeFilter?.stepSize || '0',
              minNotional: notionalFilter?.minNotional || '0'
            };
          });
      }
      
      return [];
    } catch (error) {
      console.error('Erreur lors de la récupération des symboles Binance:', error);
      return [];
    }
  }

  async getTicker(symbol: string): Promise<BinanceTicker | null> {
    await this.ensureInitialized();
    
    try {
      const normalizedSymbol = this.symbolMapper.normalizeSymbol(symbol, 'BINANCE');
      if (!normalizedSymbol) return null;
      
      const response = await this.makeRequest('GET', '/api/v3/ticker/24hr', {
        symbol: normalizedSymbol.original
      });
      
      if (response) {
        return {
          symbol: response.symbol,
          priceChange: response.priceChange,
          priceChangePercent: response.priceChangePercent,
          weightedAvgPrice: response.weightedAvgPrice,
          prevClosePrice: response.prevClosePrice,
          lastPrice: response.lastPrice,
          lastQty: response.lastQty,
          bidPrice: response.bidPrice,
          bidQty: response.bidQty,
          askPrice: response.askPrice,
          askQty: response.askQty,
          openPrice: response.openPrice,
          highPrice: response.highPrice,
          lowPrice: response.lowPrice,
          volume: response.volume,
          quoteVolume: response.quoteVolume,
          openTime: response.openTime,
          closeTime: response.closeTime,
          count: response.count
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Erreur lors de la récupération du ticker ${symbol}:`, error);
      return null;
    }
  }

  async getBalance(asset?: string): Promise<BinanceBalance[]> {
    await this.ensureInitialized();
    
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = this.generateSignature(queryString);
      
      const response = await this.makeRequest('GET', '/api/v3/account', {
        timestamp,
        signature
      });
      
      if (response?.balances) {
        let balances = response.balances.map((balance: any) => ({
          asset: balance.asset,
          free: balance.free,
          locked: balance.locked
        }));
        
        if (asset) {
          balances = balances.filter((b: any) => b.asset === asset);
        }
        
        return balances;
      }
      
      return [];
    } catch (error) {
      console.error('Erreur lors de la récupération du solde Binance:', error);
      return [];
    }
  }

  async isSymbolTradable(symbol: string): Promise<boolean> {
    try {
      const symbols = await this.getSymbols();
      const normalizedSymbol = this.symbolMapper.normalizeSymbol(symbol, 'BINANCE');
      if (!normalizedSymbol) return false;
      return symbols.some(s => s.symbol === normalizedSymbol.original && s.status === 'TRADING');
    } catch (error) {
      console.error(`Erreur lors de la vérification de la tradabilité de ${symbol}:`, error);
      return false;
    }
  }

  async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const ticker = await this.getTicker(symbol);
      if (ticker && ticker.lastPrice) {
        return parseFloat(ticker.lastPrice);
      }
      return null;
    } catch (error) {
      console.error(`Erreur lors de la récupération du prix de ${symbol}:`, error);
      return null;
    }
  }

  async searchSymbols(query: string): Promise<BinanceSymbol[]> {
    try {
      const symbols = await this.getSymbols();
      const normalizedQuery = query.toUpperCase();
      
      return symbols.filter(symbol => 
        symbol.symbol.includes(normalizedQuery) ||
        symbol.baseAsset.includes(normalizedQuery)
      );
    } catch (error) {
      console.error(`Erreur lors de la recherche de symboles pour "${query}":`, error);
      return [];
    }
  }

  async getSymbolInfo(symbol: string): Promise<BinanceSymbol | null> {
    try {
      const symbols = await this.getSymbols();
      const normalizedSymbol = this.symbolMapper.normalizeSymbol(symbol, 'BINANCE');
      if (!normalizedSymbol) return null;
      return symbols.find(s => s.symbol === normalizedSymbol.original) || null;
    } catch (error) {
      console.error(`Erreur lors de la récupération des infos du symbole ${symbol}:`, error);
      return null;
    }
  }

  async getPriceChange24h(symbol: string): Promise<{ change: number; changePercent: number } | null> {
    try {
      const ticker = await this.getTicker(symbol);
      if (ticker) {
        return {
          change: parseFloat(ticker.priceChange),
          changePercent: parseFloat(ticker.priceChangePercent)
        };
      }
      return null;
    } catch (error) {
      console.error(`Erreur lors de la récupération du changement de prix 24h pour ${symbol}:`, error);
      return null;
    }
  }

  private generateSignature(queryString: string): string {
    // Note: Cette méthode nécessite une implémentation de HMAC-SHA256
    // Pour l'instant, retournons une chaîne vide
    // TODO: Implémenter la signature HMAC-SHA256
    return '';
  }

  private async makeRequest(method: string, endpoint: string, params?: any): Promise<any> {
    await this.rateLimiter.waitForAvailability('rest');
    
    const url = `${this.config.baseUrl}${endpoint}`;
    const queryString = params ? new URLSearchParams(params).toString() : '';
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    
    try {
      const response = await fetch(fullUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-MBX-APIKEY': this.config.apiKey
        },
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.rateLimiter.recordSuccess('rest');
      
      return data;
    } catch (error) {
      this.rateLimiter.recordFailure('rest');
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.testConnection();
      return true;
    } catch (error) {
      return false;
    }
  }

  async stop(): Promise<void> {
    this.isInitialized = false;
  }

  getStatus(): Omit<BinanceConfig, 'secretKey'> & {
    isInitialized: boolean;
    rateLimiterState: any;
  } {
    return {
      apiKey: this.config.apiKey,
      testnet: this.config.testnet,
      baseUrl: this.config.baseUrl,
      timeoutMs: this.config.timeoutMs,
      isInitialized: this.isInitialized,
      rateLimiterState: this.rateLimiter.getStateSnapshot('BINANCE')
    };
  }
}
