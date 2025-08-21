import { Database } from 'sqlite3';
import { RateLimiter } from './RateLimiter';
import { HttpClient } from './HttpClient';
import { CONFIG } from '../config/env';

export type BaselineState = 'READY' | 'CACHED' | 'DEGRADED';

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
  baselineBuiltAt: string | null;
  graceMinutes: number;
}

export class BaselineManager {
  private db: Database;
  private rateLimiter: RateLimiter;
  private httpClient: HttpClient;
  private isInitialized: boolean = false;
  private state: BaselineState = 'DEGRADED';
  private baselineUrl = 'https://api.bithumb.com/public/ticker/ALL_KRW';
  private readonly stableCoins = ['USDT', 'USDC', 'DAI', 'TUSD', 'BUSD', 'FRAX'];
  private retryTimer: NodeJS.Timeout | null = null;
  private lastBaselineFetchMs: number | null = null;
  private errors999Last5m: number = 0;
  private errorCounters: Map<number, number> = new Map();
  private baselineBuiltAt: Date | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private graceMinutes: number = 10; // Fenêtre de grâce par défaut

  constructor(db: Database) {
    this.db = db;
    this.rateLimiter = new RateLimiter();
    
    // Configuration du circuit-breaker pour la baseline
    this.httpClient = new HttpClient('BaselineManager', {
      timeoutMs: CONFIG.BL_HTTP_TIMEOUT_MS,
      maxRetries: CONFIG.BL_HTTP_RETRIES,
      baseRetryDelayMs: 250,
      maxRetryDelayMs: 500,
      jitterPercent: 20
    });

    // Nettoyer les compteurs d'erreurs toutes les 5 minutes
    setInterval(() => {
      this.errors999Last5m = 0;
      this.errorCounters.clear();
    }, 5 * 60 * 1000);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('🔄 Initialisation de la baseline KR Bithumb (BOOT ONLY)...');
      
      // Essayer d'abord de charger depuis l'API REST
      try {
        await this.fetchAndStoreBaseline();
        this.state = 'READY';
        console.log('✅ Baseline KR initialisée avec succès depuis l\'API REST (BOOT ONLY)');
      } catch (error) {
        console.warn('[BASELINE] REST failed -> try local cache');
        
        // Fallback au cache local
        const ok = await this.loadExistingBaseline();
        if (!ok) {
          console.error('[BASELINE] No local baseline -> degrade to WS-only (T2), schedule retry');
          this.state = 'DEGRADED';
          this.scheduleRetry();
        } else {
          this.state = 'CACHED';
          console.log('✅ Baseline KR chargée depuis le cache local');
          // Continuer boot normal (T2 active, T0 sera activé quand REST redevient OK)
        }
      }
      
      // Démarrer le refresh périodique
      this.startPeriodicRefresh();
      
      this.isInitialized = true;
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de la baseline KR:', error);
      this.state = 'DEGRADED';
      this.scheduleRetry();
      this.isInitialized = true; // Ne pas bloquer le boot
    }
  }

  private async fetchAndStoreBaseline(): Promise<void> {
    try {
      console.log('📡 Récupération de la baseline KR depuis Bithumb (BOOT ONLY)...');
      
      await this.rateLimiter.waitForAvailability('BITHUMB');
      
      const startTime = Date.now();
      const response = await this.httpClient.get(this.baselineUrl);
      this.lastBaselineFetchMs = Date.now() - startTime;
      
      this.rateLimiter.recordSuccess('BITHUMB');
      
      const responseData = response.data as any;
      if (responseData.status !== '0000') {
        this.recordError(999); // Code d'erreur Bithumb
        throw new Error(`Erreur API Bithumb: ${responseData.status}`);
      }
      
      const tokens = this.parseBaselineResponse(responseData.data);
      
      if (tokens.length === 0) {
        throw new Error('Aucun token trouvé dans la réponse Bithumb');
      }
      
      await this.storeBaselineKR(tokens);
      
      // Enregistrer le timestamp de construction
      this.baselineBuiltAt = new Date();
      
      console.log(`📊 Baseline KR stockée: ${tokens.length} tokens (BOOT ONLY) à ${this.baselineBuiltAt.toISOString()}`);
      
      // Si on était en mode dégradé, passer à READY et réactiver T0
      if (this.state === 'DEGRADED' || this.state === 'CACHED') {
        this.state = 'READY';
        console.log('[BASELINE] State changed to READY - T0 can be activated');
      }
      
    } catch (error) {
      this.rateLimiter.recordFailure('BITHUMB');
      
      // Enregistrer l'erreur pour les métriques
      if (error instanceof Error && error.message.includes('999')) {
        this.recordError(999);
      } else if (error instanceof Error && error.message.includes('timeout')) {
        this.recordError(408);
      } else {
        this.recordError(500);
      }
      
      throw error;
    }
  }

  private async loadExistingBaseline(): Promise<boolean> {
    try {
      const stats = await this.getBaselineKRStats();
      return stats !== null && stats.total > 0;
    } catch (error) {
      console.error('[BASELINE] Error loading existing baseline:', error);
      return false;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    const delays = [30000, 60000, 120000, 300000, 600000]; // 30s, 1m, 2m, 5m, 10m
    const delay = delays[Math.min(this.errorCounters.get(999) || 0, delays.length - 1)];
    
    console.log(`[BASELINE] Scheduling retry in ${delay}ms`);
    
    this.retryTimer = setTimeout(async () => {
      try {
        await this.fetchAndStoreBaseline();
      } catch (error) {
        console.warn('[BASELINE] Retry failed, will retry again');
        this.scheduleRetry();
      }
    }, delay);
  }

  private recordError(code: number): void {
    const current = this.errorCounters.get(code) || 0;
    this.errorCounters.set(code, current + 1);
    
    if (code === 999) {
      this.errors999Last5m++;
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

  /**
   * Vérifie si un token est dans la baseline avec support de la fenêtre de grâce
   */
  async isTokenInBaselineWithGrace(base: string, noticeTime?: Date): Promise<{
    inBaseline: boolean;
    withinGrace: boolean;
    reason: string;
  }> {
    const inBaseline = await this.isTokenInBaseline(base);
    
    if (!inBaseline) {
      return {
        inBaseline: false,
        withinGrace: false,
        reason: 'baseline=unknown → new listing'
      };
    }
    
    // Vérifier la fenêtre de grâce
    if (this.baselineBuiltAt && noticeTime) {
      const graceWindowMs = this.graceMinutes * 60 * 1000;
      const timeDiff = noticeTime.getTime() - this.baselineBuiltAt.getTime();
      
      if (timeDiff <= graceWindowMs) {
        return {
          inBaseline: true,
          withinGrace: true,
          reason: 'baseline=known but within grace → allow'
        };
      }
    }
    
    return {
      inBaseline: true,
      withinGrace: false,
      reason: 'baseline=known and outside grace → block'
    };
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
      sanity: stats.sanity,
      baselineBuiltAt: this.baselineBuiltAt?.toISOString() || null,
      graceMinutes: this.graceMinutes
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
    state: BaselineState;
    circuitBreakerState: string;
    lastBaselineFetchMs: number | null;
    errors999Last5m: number;
  }> {
    try {
      const stats = await this.getBaselineKRStats();
      const cbStats = this.httpClient.getCircuitBreakerStats();
    
      return {
        isInitialized: this.isInitialized,
        baselineExists: stats !== null && stats.total > 0,
        tokenCount: stats?.total || 0,
        lastUpdated: stats?.lastUpdated || null,
        sanity: stats?.sanity || false,
        state: this.state,
        circuitBreakerState: cbStats.state,
        lastBaselineFetchMs: this.lastBaselineFetchMs,
        errors999Last5m: this.errors999Last5m
      };
    } catch (error) {
      return {
        isInitialized: this.isInitialized,
        baselineExists: false,
        tokenCount: 0,
        lastUpdated: null,
        sanity: false,
        state: this.state,
        circuitBreakerState: 'UNKNOWN',
        lastBaselineFetchMs: this.lastBaselineFetchMs,
        errors999Last5m: this.errors999Last5m
      };
    }
  }

  async stop(): Promise<void> {
    this.isInitialized = false;
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Démarre le refresh périodique de la baseline
   */
  private startPeriodicRefresh(): void {
    const refreshMinutes = 5; // Configurable via env
    
    this.refreshInterval = setInterval(async () => {
      try {
        console.log(`🔄 Refresh périodique de la baseline KR (${refreshMinutes} minutes)...`);
        await this.fetchAndStoreBaseline();
        console.log('✅ Baseline KR rafraîchie avec succès');
      } catch (error) {
        console.warn('⚠️ Échec du refresh périodique de la baseline:', error);
      }
    }, refreshMinutes * 60 * 1000);
    
    console.log(`🔄 Refresh périodique de la baseline activé (${refreshMinutes} minutes)`);
  }

  /**
   * Met à jour l'intervalle de refresh
   */
  updateRefreshInterval(minutes: number): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    this.startPeriodicRefresh();
    console.log(`⚙️ Intervalle de refresh mis à jour: ${minutes} minutes`);
  }

  /**
   * Met à jour la fenêtre de grâce
   */
  updateGraceWindow(minutes: number): void {
    this.graceMinutes = minutes;
    console.log(`⚙️ Fenêtre de grâce mise à jour: ${minutes} minutes`);
  }

  getStatus(): {
    isInitialized: boolean;
    baselineUrl: string;
    rateLimiterState: any;
    isBootOnly: boolean;
    state: BaselineState;
    circuitBreakerStats: any;
  } {
    return {
      isInitialized: this.isInitialized,
      baselineUrl: this.baselineUrl,
      rateLimiterState: this.rateLimiter.getStateSnapshot('BITHUMB'),
      isBootOnly: true,
      state: this.state,
      circuitBreakerStats: this.httpClient.getCircuitBreakerStats()
    };
  }

  getState(): BaselineState {
    return this.state;
  }

  canActivateT0(): boolean {
    return this.state === 'READY' || this.state === 'CACHED';
  }
}
