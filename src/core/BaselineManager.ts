import { TokenRegistry } from '../store/TokenRegistry';
import { RateLimiter } from './RateLimiter';

export interface BithumbKRToken {
  symbol: string;
  base: string;
  quote: string;
  status: string;
  listedAt: string;
}

export interface BaselineManagerStats {
  totalTokens: number;
  activeTokens: number;
  lastUpdated: string;
  source: string;
}

export class BaselineManager {
  private tokenRegistry: TokenRegistry;
  private rateLimiter: RateLimiter;
  private isInitialized: boolean = false;
  private baselineUrl = 'https://api.bithumb.com/public/ticker/ALL_KRW';

  constructor(tokenRegistry: TokenRegistry) {
    this.tokenRegistry = tokenRegistry;
    this.rateLimiter = new RateLimiter();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('🔄 Initialisation de la baseline KR Bithumb...');
      
      const existingBaseline = await this.tokenRegistry.getBaselineKRStats();
      
      if (existingBaseline && existingBaseline.total > 0) {
        console.log(`✅ Baseline KR existante trouvée: ${existingBaseline.total} tokens`);
        this.isInitialized = true;
        return;
      }
      
      await this.fetchAndStoreBaseline();
      
      this.isInitialized = true;
      console.log('✅ Baseline KR initialisée avec succès');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de la baseline KR:', error);
      throw error;
    }
  }

  private async fetchAndStoreBaseline(): Promise<void> {
    try {
      console.log('📡 Récupération de la baseline KR depuis Bithumb...');
      
      await this.rateLimiter.waitForAvailability('BITHUMB');
      
      const response = await fetch(this.baselineUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.rateLimiter.recordSuccess('BITHUMB');
      
      if (data.status !== '0000') {
        throw new Error(`Erreur API Bithumb: ${data.status}`);
      }
      
      const tokens = this.parseBaselineResponse(data.data);
      
      if (tokens.length === 0) {
        throw new Error('Aucun token trouvé dans la réponse Bithumb');
      }
      
      await this.tokenRegistry.addMultipleToBaselineKR(
        tokens.map(t => ({ base: t.base, source: 'BITHUMB_REST' }))
      );
      
      console.log(`📊 Baseline KR stockée: ${tokens.length} tokens`);
      
    } catch (error) {
      this.rateLimiter.recordFailure('BITHUMB');
      throw error;
    }
  }

  private parseBaselineResponse(data: any): BithumbKRToken[] {
    const tokens: BithumbKRToken[] = [];
    const now = new Date().toISOString();
    
    for (const [symbol, info] of Object.entries(data)) {
      if (typeof info === 'object' && info !== null) {
        const tokenInfo = info as any;
        
        // L'API retourne des tokens comme BTC, ETH, etc. (pas BTC_KRW)
        // Vérifier que le token a des données de prix valides
        if (tokenInfo.opening_price && tokenInfo.closing_price) {
          tokens.push({
            symbol: `${symbol}_KRW`, // Construire le symbole complet
            base: symbol,
            quote: 'KRW',
            status: 'ACTIVE',
            listedAt: now
          });
        }
      }
    }
    
    return tokens;
  }

  async isTokenInBaseline(base: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return await this.tokenRegistry.isInBaselineKR(base);
  }

  async isTokenNew(base: string): Promise<boolean> {
    return !(await this.isTokenInBaseline(base));
  }

  async getBaselineStats(): Promise<BaselineManagerStats | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const stats = await this.tokenRegistry.getBaselineKRStats();
    if (!stats) return null;
    
    return {
      totalTokens: stats.total,
      activeTokens: stats.total,
      lastUpdated: stats.lastUpdated,
      source: 'BITHUMB_REST'
    };
  }

  async refreshBaseline(): Promise<void> {
    console.log('🔄 Rafraîchissement de la baseline KR...');
    
    try {
      await this.fetchAndStoreBaseline();
      console.log('✅ Baseline KR rafraîchie avec succès');
    } catch (error) {
      console.error('❌ Erreur lors du rafraîchissement de la baseline:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    isInitialized: boolean;
    baselineExists: boolean;
    tokenCount: number;
    lastUpdated: string | null;
  }> {
    try {
          const stats = await this.getBaselineStats();
    
    return {
      isInitialized: this.isInitialized,
      baselineExists: stats !== null && stats.totalTokens > 0,
      tokenCount: stats?.totalTokens || 0,
      lastUpdated: stats?.lastUpdated || null
    };
    } catch (error) {
      return {
        isInitialized: this.isInitialized,
        baselineExists: false,
        tokenCount: 0,
        lastUpdated: null
      };
    }
  }

  async stop(): Promise<void> {
    this.isInitialized = false;
  }

  getStatus(): {
    isInitialized: boolean;
    baselineUrl: string;
    rateLimiterState: any;
  } {
    return {
      isInitialized: this.isInitialized,
      baselineUrl: this.baselineUrl,
      rateLimiterState: this.rateLimiter.getStateSnapshot('BITHUMB')
    };
  }
}
