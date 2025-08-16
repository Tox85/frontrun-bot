import { Database } from 'sqlite3';
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
  sanity: boolean;
}

export class BaselineManager {
  private db: Database;
  private rateLimiter: RateLimiter;
  private isInitialized: boolean = false;
  private baselineUrl = 'https://api.bithumb.com/public/ticker/ALL_KRW';
  private readonly stableCoins = ['USDT', 'USDC', 'DAI', 'TUSD', 'BUSD', 'FRAX'];

  constructor(db: Database) {
    this.db = db;
    this.rateLimiter = new RateLimiter();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('🔄 Initialisation de la baseline KR Bithumb (BOOT ONLY)...');
      
      const existingBaseline = await this.getBaselineKRStats();
      
      if (existingBaseline && existingBaseline.total > 0) {
        console.log(`✅ Baseline KR existante trouvée: ${existingBaseline.total} tokens`);
        this.isInitialized = true;
        return;
      }
      
      await this.fetchAndStoreBaseline();
      
      this.isInitialized = true;
      console.log('✅ Baseline KR initialisée avec succès (BOOT ONLY)');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de la baseline KR:', error);
      throw error;
    }
  }

  private async fetchAndStoreBaseline(): Promise<void> {
    try {
      console.log('📡 Récupération de la baseline KR depuis Bithumb (BOOT ONLY)...');
      
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
      
      await this.storeBaselineKR(tokens);
      
      console.log(`📊 Baseline KR stockée: ${tokens.length} tokens (BOOT ONLY)`);
      
    } catch (error) {
      this.rateLimiter.recordFailure('BITHUMB');
      throw error;
    }
  }

  private async storeBaselineKR(tokens: BithumbKRToken[]): Promise<void> {
    const now = new Date().toISOString();
    
    for (const token of tokens) {
      // Exclure les stablecoins comme requis
      if (this.stableCoins.includes(token.base)) {
        continue;
      }
      
      await this.db.run(
        'INSERT OR REPLACE INTO baseline_kr (base, source, listed_at_utc, created_at_utc) VALUES (?, ?, ?, ?)',
        [token.base, 'bithumb.rest', token.listedAt, now]
      );
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
          // Exclure les stablecoins
          if (this.stableCoins.includes(symbol)) {
            continue;
          }
          
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
    
    console.log(`📊 Parsed ${tokens.length} valid tokens from Bithumb API`);
    return tokens;
  }

  async isTokenInBaseline(base: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const result = await this.db.get(
      'SELECT 1 FROM baseline_kr WHERE base = ?',
      [base]
    );
    
    return !!result;
  }

  async isTokenNew(base: string): Promise<boolean> {
    return !(await this.isTokenInBaseline(base));
  }

  async getBaselineKRStats(): Promise<{
    total: number;
    lastUpdated: string;
    sanity: boolean;
  } | null> {
    try {
      const result = await this.db.get(
        'SELECT COUNT(*) as total, MAX(created_at_utc) as lastUpdated FROM baseline_kr'
      );
      
      if (!result) return null;
      
      const sanity = (result as any).total >= 200; // Baseline raisonnable
      
      return {
        total: (result as any).total,
        lastUpdated: (result as any).lastUpdated || new Date().toISOString(),
        sanity
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des stats baseline:', error);
      return null;
    }
  }

  async getBaselineStats(): Promise<BaselineManagerStats | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const stats = await this.getBaselineKRStats();
    if (!stats) return null;
    
    return {
      totalTokens: stats.total,
      activeTokens: stats.total,
      lastUpdated: stats.lastUpdated,
      source: 'bithumb.rest',
      sanity: stats.sanity
    };
  }

  // ⚠️ INTERDIT: refreshBaseline() supprimé - baseline construite au boot uniquement
  // async refreshBaseline(): Promise<void> {
  //   throw new Error('Baseline refresh interdit - construite au boot uniquement');
  // }

  async healthCheck(): Promise<{
    isInitialized: boolean;
    baselineExists: boolean;
    tokenCount: number;
    lastUpdated: string | null;
    sanity: boolean;
  }> {
    try {
      const stats = await this.getBaselineKRStats();
    
      return {
        isInitialized: this.isInitialized,
        baselineExists: stats !== null && stats.total > 0,
        tokenCount: stats?.total || 0,
        lastUpdated: stats?.lastUpdated || null,
        sanity: stats?.sanity || false
      };
    } catch (error) {
      return {
        isInitialized: this.isInitialized,
        baselineExists: false,
        tokenCount: 0,
        lastUpdated: null,
        sanity: false
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
    isBootOnly: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      baselineUrl: this.baselineUrl,
      rateLimiterState: this.rateLimiter.getStateSnapshot('BITHUMB'),
      isBootOnly: true
    };
  }
}
