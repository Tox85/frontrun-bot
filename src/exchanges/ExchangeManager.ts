import { HyperliquidAdapter, HLConfig } from './HyperliquidAdapter';
import { BybitAdapter, BybitConfig } from './BybitAdapter';
import { BinanceAdapter, BinanceConfig } from './BinanceAdapter';
import { SymbolMapper } from '../core/SymbolMapper';

export interface ExchangeConfigs {
  hyperliquid?: HLConfig;
  bybit?: BybitConfig;
  binance?: BinanceConfig;
}

export interface ExchangeStatus {
  hyperliquid?: any;
  bybit?: any;
  binance?: any;
}

export interface SymbolLookupResult {
  symbol: string;
  base: string;
  exchanges: {
    hyperliquid?: boolean;
    bybit?: boolean;
    binance?: boolean;
  };
  prices: {
    hyperliquid?: number;
    bybit?: number;
    binance?: number;
  };
}

export class ExchangeManager {
  private hyperliquid?: HyperliquidAdapter;
  private bybit?: BybitAdapter;
  private binance?: BinanceAdapter;
  private symbolMapper: SymbolMapper;
  private isInitialized: boolean = false;

  constructor(configs: ExchangeConfigs) {
    this.symbolMapper = SymbolMapper.getInstance();
    
    if (configs.hyperliquid) {
      this.hyperliquid = new HyperliquidAdapter(configs.hyperliquid);
    }
    
    if (configs.bybit) {
      this.bybit = new BybitAdapter(configs.bybit);
    }
    
    if (configs.binance) {
      this.binance = new BinanceAdapter(configs.binance);
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    const initPromises: Promise<void>[] = [];
    
    if (this.hyperliquid) {
      initPromises.push(this.hyperliquid.initialize());
    }
    
    if (this.bybit) {
      initPromises.push(this.bybit.initialize());
    }
    
    if (this.binance) {
      initPromises.push(this.binance.initialize());
    }
    
    try {
      await Promise.all(initPromises);
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Échec de l'initialisation des exchanges: ${error}`);
    }
  }

  async lookupSymbol(symbol: string): Promise<SymbolLookupResult> {
    await this.ensureInitialized();
    
    const base = this.symbolMapper.extractBase(symbol, 'BITHUMB');
    const result: SymbolLookupResult = {
      symbol,
      base: base || 'UNKNOWN',
      exchanges: {},
      prices: {}
    };
    
    // Vérification Hyperliquid
    if (this.hyperliquid) {
      try {
        const isTradable = await this.hyperliquid.isSymbolTradable(symbol);
        result.exchanges.hyperliquid = isTradable;
        
        if (isTradable) {
          const price = await this.hyperliquid.getCurrentPrice(symbol);
          if (price) result.prices.hyperliquid = price;
        }
      } catch (error) {
        console.error(`Erreur lors de la vérification Hyperliquid pour ${symbol}:`, error);
      }
    }
    
    // Vérification Bybit
    if (this.bybit) {
      try {
        const isTradable = await this.bybit.isSymbolTradable(symbol);
        result.exchanges.bybit = isTradable;
        
        if (isTradable) {
          const price = await this.bybit.getCurrentPrice(symbol);
          if (price) result.prices.bybit = price;
        }
      } catch (error) {
        console.error(`Erreur lors de la vérification Bybit pour ${symbol}:`, error);
      }
    }
    
    // Vérification Binance
    if (this.binance) {
      try {
        const isTradable = await this.binance.isSymbolTradable(symbol);
        result.exchanges.binance = isTradable;
        
        if (isTradable) {
          const price = await this.binance.getCurrentPrice(symbol);
          if (price) result.prices.binance = price;
        }
      } catch (error) {
        console.error(`Erreur lors de la vérification Binance pour ${symbol}:`, error);
      }
    }
    
    return result;
  }

  async searchSymbols(query: string): Promise<{
    hyperliquid?: any[];
    bybit?: any[];
    binance?: any[];
  }> {
    await this.ensureInitialized();
    
    const results: any = {};
    
          if (this.hyperliquid) {
        try {
          // Hyperliquid n'a pas de méthode searchSymbols, on retourne un tableau vide
          results.hyperliquid = [];
        } catch (error) {
          console.error(`Erreur lors de la recherche Hyperliquid pour "${query}":`, error);
        }
      }
    
    if (this.bybit) {
      try {
        results.bybit = await this.bybit.searchSymbols(query);
      } catch (error) {
        console.error(`Erreur lors de la recherche Bybit pour "${query}":`, error);
      }
    }
    
    if (this.binance) {
      try {
        results.binance = await this.binance.searchSymbols(query);
      } catch (error) {
        console.error(`Erreur lors de la recherche Binance pour "${query}":`, error);
      }
    }
    
    return results;
  }

  async getBalances(): Promise<{
    hyperliquid?: any[];
    bybit?: any[];
    binance?: any[];
  }> {
    await this.ensureInitialized();
    
    const results: any = {};
    
    if (this.hyperliquid) {
      try {
        results.hyperliquid = await this.hyperliquid.getBalance();
      } catch (error) {
        console.error('Erreur lors de la récupération du solde Hyperliquid:', error);
      }
    }
    
    if (this.bybit) {
      try {
        results.bybit = await this.bybit.getBalance();
      } catch (error) {
        console.error('Erreur lors de la récupération du solde Bybit:', error);
      }
    }
    
    if (this.binance) {
      try {
        results.binance = await this.binance.getBalance();
      } catch (error) {
        console.error('Erreur lors de la récupération du solde Binance:', error);
      }
    }
    
    return results;
  }

  async healthCheck(): Promise<{
    hyperliquid?: boolean;
    bybit?: boolean;
    binance?: boolean;
    overall: boolean;
  }> {
    const results: any = {
      overall: true
    };
    
    if (this.hyperliquid) {
      try {
        results.hyperliquid = await this.hyperliquid.healthCheck();
        if (!results.hyperliquid) results.overall = false;
      } catch (error) {
        results.hyperliquid = false;
        results.overall = false;
      }
    }
    
    if (this.bybit) {
      try {
        results.bybit = await this.bybit.healthCheck();
        if (!results.bybit) results.overall = false;
      } catch (error) {
        results.bybit = false;
        results.overall = false;
      }
    }
    
    if (this.binance) {
      try {
        results.binance = await this.binance.healthCheck();
        if (!results.binance) results.overall = false;
      } catch (error) {
        results.binance = false;
        results.overall = false;
      }
    }
    
    return results;
  }

  getHyperliquid(): HyperliquidAdapter | undefined {
    return this.hyperliquid;
  }

  getBybit(): BybitAdapter | undefined {
    return this.bybit;
  }

  getBinance(): BinanceAdapter | undefined {
    return this.binance;
  }

  async stop(): Promise<void> {
    const stopPromises: Promise<void>[] = [];
    
    if (this.hyperliquid) {
      stopPromises.push(this.hyperliquid.stop());
    }
    
    if (this.bybit) {
      stopPromises.push(this.bybit.stop());
    }
    
    if (this.binance) {
      stopPromises.push(this.binance.stop());
    }
    
    await Promise.all(stopPromises);
    this.isInitialized = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  getStatus(): ExchangeStatus {
    return {
      hyperliquid: this.hyperliquid?.getStatus(),
      bybit: this.bybit?.getStatus(),
      binance: this.binance?.getStatus()
    };
  }

  getInitializationStatus(): boolean {
    return this.isInitialized;
  }
}
