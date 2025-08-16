import { Database } from 'sqlite3';

export interface PerpToken {
  exchange: string;
  base: string;
  symbol: string;
  leverageMax: number;
  updatedAtUtc: string;
}

export interface PerpLookupResult {
  hasPerp: boolean;
  symbol?: string;
  exchange?: string;
  leverageMax?: number;
}

// Interfaces pour les réponses API
interface BybitResponse {
  retCode: number;
  retMsg: string;
  result: {
    list: Array<{
      symbol: string;
      status: string;
      leverageFilter: {
        maxLeverage: string;
      };
    }>;
  };
}

interface HyperliquidResponse {
  universe: Array<{
    name: string;
  }>;
}

interface BinanceResponse {
  symbols: Array<{
    symbol: string;
    status: string;
    contractType: string;
  }>;
}

interface PerpCatalogStats {
  total: number;
  lastUpdated: string;
  byExchange: Array<{
    exchange: string;
    count: number;
  }>;
}

/**
 * Guard anti-overlap avec coalescing pour les refresh
 */
class RefreshGuard {
  private state = {
    active: false,
    inFlight: null as Promise<any> | null,
    lastStartedAt: undefined as number | undefined,
    lastFinishedAt: undefined as number | undefined
  };

  private counters = {
    guard_runs: 0,
    guard_coalesced: 0
  };

  async begin<T>(work: () => Promise<T>): Promise<T> {
    if (this.state.active && this.state.inFlight) {
      this.counters.guard_coalesced++;
      console.log('🔄 Refresh coalesced (already in flight)');
      return this.state.inFlight;
    }

    this.state.active = true;
    this.state.lastStartedAt = Date.now();
    this.counters.guard_runs++;

    try {
      this.state.inFlight = work();
      const result = await this.state.inFlight;
      return result;
    } finally {
      this.state.active = false;
      this.state.lastFinishedAt = Date.now();
      this.state.inFlight = null;
    }
  }

  getCounters() {
    return { ...this.counters };
  }
}

export class PerpCatalog {
  private db: Database;
  private refreshIntervalMs: number;
  private refreshTimer: NodeJS.Timeout | null = null;
  private guard: RefreshGuard;

  // Priorité des quotes (modifiable via config)
  private readonly quotePriority = ['USDT', 'USD', 'FDUSD', 'BUSD'];

  constructor(db: Database, refreshIntervalMs: number = 900000) { // 15 min par défaut
    this.db = db;
    this.refreshIntervalMs = refreshIntervalMs;
    this.guard = new RefreshGuard();
    this.startPeriodicRefresh();
  }

  async initialize(): Promise<void> {
    console.log('📚 Initialisation du PerpCatalog...');
    
    // Vérifier que la table existe
    await this.ensureTableExists();
    
    // Démarrer le refresh périodique
    this.startPeriodicRefresh();
    
    console.log('✅ PerpCatalog initialisé');
  }

  private async ensureTableExists(): Promise<void> {
    const exists = await this.tableExists('perp_catalog');
    if (!exists) {
      throw new Error('Table perp_catalog n\'existe pas - migrations non appliquées');
    }
  }

  private async tableExists(tableName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  // Refresh périodique du catalogue avec jitter anti-alignement
  private startPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // Ajouter un jitter de ±10% pour éviter les alignements en multi-déploiement
    const jitterMs = Math.floor(this.refreshIntervalMs * 0.1 * (Math.random() - 0.5));
    const actualIntervalMs = this.refreshIntervalMs + jitterMs;

    this.refreshTimer = setInterval(async () => {
      await this.refreshAllExchanges();
    }, actualIntervalMs);

    console.log(`🔄 Refresh périodique configuré: ${actualIntervalMs / 1000}s (base: ${this.refreshIntervalMs / 1000}s, jitter: ±${Math.abs(jitterMs) / 1000}s)`);
  }

  async refreshAllExchanges(): Promise<void> {
    // Utiliser le guard anti-overlap avec coalescing
    return this.guard.begin(async () => {
      console.log('🔄 Début du refresh du catalogue des perpétuels...');

      try {
        const startTime = Date.now();
        const exchangeResults: Array<{
          exchange: string;
          inserted: number;
          updated: number;
          errors: number;
          ms: number;
        }> = [];
        
        // Refresh en parallèle pour tous les exchanges
        const results = await Promise.allSettled([
          this.refreshBybitCatalog(),
          this.refreshHyperliquidCatalog(),
          this.refreshBinanceCatalog()
        ]);

        // Collecter les résultats avec timing
        const exchanges = ['BYBIT', 'HYPERLIQUID', 'BINANCE'];
        results.forEach((result, index) => {
          const exchange = exchanges[index];
          if (exchange) { // Vérifier que l'index est valide
            if (result.status === 'fulfilled') {
              const stats = (result.value as any) || { inserted: 0, updated: 0, errors: 0 };
              exchangeResults.push({
                exchange,
                inserted: stats.inserted || 0,
                updated: stats.updated || 0,
                errors: stats.errors || 0,
                ms: stats.duration || 0
              });
            } else {
              exchangeResults.push({
                exchange,
                inserted: 0,
                updated: 0,
                errors: 1,
                ms: 0
              });
            }
          }
        });

        const totalDuration = Date.now() - startTime;
        
        // Log de résumé compact par exchange
        const summary = exchangeResults.map(r => 
          `${r.exchange}: {${r.inserted}i, ${r.updated}u, ${r.errors}e, ${r.ms}ms}`
        ).join(' | ');
        
        console.log(`✅ Refresh catalogue terminé en ${totalDuration}ms | ${summary}`);

      } catch (error) {
        console.error('❌ Erreur lors du refresh du catalogue:', error);
        throw error; // Propager l'erreur aux appelants
      }
    });
  }

  // Refresh Bybit
  private async refreshBybitCatalog(): Promise<{ inserted: number; updated: number; errors: number; duration: number }> {
    const startTime = Date.now();
    try {
      console.log('🔄 Refresh du catalogue Bybit...');
      
      const response = await fetch('https://api.bybit.com/v5/market/instruments-info?category=linear');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as BybitResponse;
      if (data.retCode !== 0) {
        throw new Error(`Bybit API error: ${data.retMsg}`);
      }

      const tokens: Array<{ base: string; symbol: string; leverageMax: number; quote?: string }> = [];
      
      for (const instrument of data.result.list) {
        if (instrument.status === 'Trading') {
          const base = this.extractBaseFromSymbol(instrument.symbol);
          if (base) {
            tokens.push({
              base,
              symbol: instrument.symbol,
              leverageMax: parseFloat(instrument.leverageFilter.maxLeverage) || 100,
              quote: this.extractQuoteFromSymbol(instrument.symbol)
            });
          }
        }
      }

      // Déduplication par base avec priorité quote
      const dedupedTokens = this.pickPreferredByBase(tokens);
      console.log(`[CATALOG] Bybit: ${tokens.length} seen, ${tokens.length - dedupedTokens.length} deduped_by_base`);

      const stats = await this.updateCatalog('BYBIT', dedupedTokens);
      const duration = Date.now() - startTime;
      console.log(`✅ Catalogue Bybit mis à jour: ${dedupedTokens.length} tokens`);
      
      return { ...stats, duration };

    } catch (error) {
      console.error('❌ Erreur lors du refresh du catalogue Bybit:', error);
      const duration = Date.now() - startTime;
      return { inserted: 0, updated: 0, errors: 1, duration };
    }
  }

  // Refresh Hyperliquid
  private async refreshHyperliquidCatalog(): Promise<{ inserted: number; updated: number; errors: number; duration: number }> {
    const startTime = Date.now();
    try {
      console.log('🔄 Refresh du catalogue Hyperliquid...');
      
      // Utiliser l'API testnet correcte pour Hyperliquid
      const response = await fetch('https://api.hyperliquid-testnet.xyz/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'meta'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as HyperliquidResponse;
      const tokens: Array<{ base: string; symbol: string; leverageMax: number; quote: string }> = [];
      
      if (data.universe && Array.isArray(data.universe)) {
        for (const instrument of data.universe) {
          const base = this.extractBaseFromSymbol(instrument.name);
          if (base) {
            tokens.push({
              base,
              symbol: instrument.name,
              leverageMax: 100, // Hyperliquid a généralement un levier max de 100
              quote: 'USD' // Hyperliquid utilise USD
            });
          }
        }
      }

      if (tokens.length > 0) {
        // Déduplication par base avec priorité quote
        const dedupedTokens = this.pickPreferredByBase(tokens);
        console.log(`[CATALOG] Hyperliquid: ${tokens.length} seen, ${tokens.length - dedupedTokens.length} deduped_by_base`);

        const stats = await this.updateCatalog('HYPERLIQUID', dedupedTokens);
        const duration = Date.now() - startTime;
        console.log(`✅ Catalogue Hyperliquid mis à jour: ${dedupedTokens.length} tokens`);
        
        return { ...stats, duration };
      } else {
        console.log('⚠️ Aucun token Hyperliquid trouvé');
        const duration = Date.now() - startTime;
        return { inserted: 0, updated: 0, errors: 0, duration };
      }

    } catch (error) {
      console.error('❌ Erreur lors du refresh du catalogue Hyperliquid:', error);
      // Ne pas faire échouer le refresh global - continuer avec les autres exchanges
      const duration = Date.now() - startTime;
      return { inserted: 0, updated: 0, errors: 1, duration };
    }
  }

  // Refresh Binance
  private async refreshBinanceCatalog(): Promise<{ inserted: number; updated: number; errors: number; duration: number }> {
    const startTime = Date.now();
    try {
      console.log('🔄 Refresh du catalogue Binance...');
      
      const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as BinanceResponse;
      const tokens: Array<{ base: string; symbol: string; leverageMax: number; quote: string }> = [];
      
      for (const symbol of data.symbols) {
        if (symbol.status === 'TRADING' && symbol.contractType === 'PERPETUAL') {
          const base = this.extractBaseFromSymbol(symbol.symbol);
          if (base) {
            tokens.push({
              base,
              symbol: symbol.symbol,
              leverageMax: 125, // Binance a généralement un levier max de 125
              quote: this.extractQuoteFromSymbol(symbol.symbol)
            });
          }
        }
      }

      // Déduplication par base avec priorité quote
      const dedupedTokens = this.pickPreferredByBase(tokens);
      console.log(`[CATALOG] Binance: ${tokens.length} seen, ${tokens.length - dedupedTokens.length} deduped_by_base`);

      const stats = await this.updateCatalog('BINANCE', dedupedTokens);
      const duration = Date.now() - startTime;
      console.log(`✅ Catalogue Binance mis à jour: ${dedupedTokens.length} tokens`);
      
      return { ...stats, duration };

    } catch (error) {
      console.error('❌ Erreur lors du refresh du catalogue Binance:', error);
      const duration = Date.now() - startTime;
      return { inserted: 0, updated: 0, errors: 1, duration };
    }
  }

  // Mise à jour du catalogue en base avec UPSERT robuste
  private async updateCatalog(exchange: string, tokens: Array<{ base: string; symbol: string; leverageMax: number; quote: string }>): Promise<{ inserted: number; updated: number; total: number; errors: number }> {
    if (tokens.length === 0) return { inserted: 0, updated: 0, total: 0, errors: 0 };

    const now = new Date().toISOString();
    const stats = { inserted: 0, updated: 0, total: tokens.length, errors: 0 };
    
    return new Promise((resolve, reject) => {
      // Utiliser UPSERT pour éviter les erreurs de contrainte unique
      const stmt = this.db.prepare(
        `INSERT INTO perp_catalog (exchange, base, quote, symbol, leverage_max, last_seen_at, updated_at_utc) 
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
         ON CONFLICT(exchange, base) DO UPDATE SET
           quote = excluded.quote,
           symbol = excluded.symbol,
           leverage_max = excluded.leverage_max,
           last_seen_at = CURRENT_TIMESTAMP,
           updated_at_utc = excluded.updated_at_utc`
      );
      
      let completed = 0;
      let hasError = false;
      
      for (const token of tokens) {
        // Vérifier si le token existe déjà pour déterminer INSERT vs UPDATE
        this.db.get(
          'SELECT 1 FROM perp_catalog WHERE exchange = ? AND base = ?',
          [exchange, token.base],
          (err, row) => {
            if (err && !hasError) {
              hasError = true;
              stats.errors++;
              console.error(`❌ Erreur lors de la vérification du token ${token.base}:`, err);
              reject(err);
              return;
            }
            
            const isUpdate = !!row; // Si la ligne existe, c'est un UPDATE
            
            // Exécuter l'UPSERT
            stmt.run([
              exchange, 
              token.base, 
              token.quote, 
              token.symbol, 
              token.leverageMax, 
              now
            ], function(err) {
              if (err && !hasError) {
                hasError = true;
                stats.errors++;
                console.error(`❌ Erreur lors de l'UPSERT du token ${token.base}:`, err);
                reject(err);
                return;
              }
              
              // Compter selon la vérification préalable
              if (isUpdate) {
                stats.updated++;
              } else {
                stats.inserted++;
              }
              
              completed++;
              if (completed === tokens.length && !hasError) {
                stmt.finalize((err) => {
                  if (err) {
                    console.error('❌ Erreur lors de la finalisation du statement:', err);
                    reject(err);
                    return;
                  }
                  
                  console.log(`[CATALOG] ${exchange}: ${stats.inserted} inserted, ${stats.updated} updated, ${stats.total} total, ${stats.errors} errors`);
                  resolve(stats);
                });
              }
            });
          }
        );
      }
    });
  }

  // Extraction de la base depuis un symbole
  private extractBaseFromSymbol(symbol: string): string | null {
    // Formats courants: BTCUSDT, BTC-PERP, BTCUSD, etc.
    let base = symbol;
    
    // Supprimer les suffixes
    base = base.replace(/USDT$/, '');
    base = base.replace(/USD$/, '');
    base = base.replace(/BTC$/, '');
    base = base.replace(/ETH$/, '');
    base = base.replace(/-PERP$/, '');
    base = base.replace(/-PERPETUAL$/, '');
    
    // Vérifier que la base est valide
    if (!/^[A-Z0-9.]+$/.test(base) || base.length < 2) {
      return null;
    }
    
    // Filtrer les tokens stables
    if (['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'].includes(base)) {
      return null;
    }
    
    return base;
  }

  /**
   * Déduplication par base avec priorité quote
   * Garde un seul marché par base selon la priorité quote
   */
  private pickPreferredByBase(markets: Array<{ base: string; symbol: string; leverageMax: number; quote?: string }>): Array<{ base: string; symbol: string; leverageMax: number; quote: string }> {
    const baseMap = new Map<string, { base: string; symbol: string; leverageMax: number; quote: string }>();
    
    for (const market of markets) {
      const base = market.base;
      const quote = market.quote || this.extractQuoteFromSymbol(market.symbol);
      
      // Garantir que quote est toujours une string
      const finalQuote: string = quote || 'USDT';
      
      if (!baseMap.has(base)) {
        baseMap.set(base, { ...market, quote: finalQuote });
      } else {
        // Comparer les priorités de quote
        const current = baseMap.get(base)!;
        const currentPriority = this.quotePriority.indexOf(current.quote);
        const newPriority = this.quotePriority.indexOf(finalQuote);
        
        if (newPriority < currentPriority) {
          baseMap.set(base, { ...market, quote: finalQuote });
        }
      }
    }
    
    return Array.from(baseMap.values());
  }

  /**
   * Extraction de la quote depuis le symbole
   */
  private extractQuoteFromSymbol(symbol: string): string {
    if (symbol.includes('USDT')) return 'USDT';
    if (symbol.includes('USD')) return 'USD';
    if (symbol.includes('FDUSD')) return 'FDUSD';
    if (symbol.includes('BUSD')) return 'BUSD';
    return 'USDT'; // Par défaut
  }

  // Lookup on-demand d'un token
  async hasPerp(base: string): Promise<PerpLookupResult> {
    try {
      // Essayer d'abord le cache
      const cached = await this.getFromCache(base);
      if (cached) {
        return {
          hasPerp: true,
          symbol: cached.symbol,
          exchange: cached.exchange,
          leverageMax: cached.leverageMax
        };
      }

      // Si pas en cache, faire un lookup direct
      const result = await this.lookupDirect(base);
      if (result.hasPerp) {
        // Mettre en cache le résultat
        await this.cacheResult(base, result);
      }
      
      return result;

    } catch (error) {
      console.error(`❌ Erreur lors du lookup de ${base}:`, error);
      return { hasPerp: false };
    }
  }

  // Récupération depuis le cache
  private async getFromCache(base: string): Promise<PerpToken | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM perp_catalog WHERE base = ? ORDER BY updated_at_utc DESC LIMIT 1',
        [base],
        (err, row: any) => {
          if (err) reject(err);
          else if (row) resolve(row as PerpToken);
          else resolve(null);
        }
      );
    });
  }

  // Lookup direct (1-shot)
  private async lookupDirect(base: string): Promise<PerpLookupResult> {
    // Essayer Bybit → Hyperliquid → Binance dans cet ordre
    const exchanges = [
      { name: 'BYBIT', url: `https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=${base}USDT` },
      { name: 'HYPERLIQUID', url: `https://api.hyperliquid.xyz/info` },
      { name: 'BINANCE', url: `https://fapi.binance.com/fapi/v1/exchangeInfo` }
    ];

    for (const exchange of exchanges) {
      try {
        const hasPerp = await this.checkExchangeForToken(exchange.name, exchange.url, base);
        if (hasPerp.hasPerp) {
          return hasPerp;
        }
      } catch (error) {
        console.warn(`⚠️ Erreur lors du check ${exchange.name} pour ${base}:`, error);
        continue;
      }
    }

    return { hasPerp: false };
  }

  // Vérification d'un exchange spécifique
  private async checkExchangeForToken(exchange: string, url: string, base: string): Promise<PerpLookupResult> {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    switch (exchange) {
      case 'BYBIT':
        if (data.retCode === 0 && data.result.list.length > 0) {
          const instrument = data.result.list[0];
          if (instrument.status === 'Trading') {
            return {
              hasPerp: true,
              symbol: instrument.symbol,
              exchange: 'BYBIT',
              leverageMax: parseFloat(instrument.leverageFilter.maxLeverage) || 100
            };
          }
        }
        break;

      case 'HYPERLIQUID':
        for (const instrument of data.universe) {
          if (instrument.name === `${base}USD`) {
            return {
              hasPerp: true,
              symbol: instrument.name,
              exchange: 'HYPERLIQUID',
              leverageMax: 100
            };
          }
        }
        break;

      case 'BINANCE':
        for (const symbol of data.symbols) {
          if (symbol.symbol === `${base}USDT` && symbol.status === 'TRADING') {
            return {
              hasPerp: true,
              symbol: symbol.symbol,
              exchange: 'BINANCE',
              leverageMax: 125
            };
          }
        }
        break;
    }

    return { hasPerp: false };
  }

  // Mise en cache d'un résultat
  private async cacheResult(base: string, result: PerpLookupResult): Promise<void> {
    if (!result.hasPerp || !result.symbol || !result.exchange) return;

    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO perp_catalog (exchange, base, symbol, leverage_max, updated_at_utc) VALUES (?, ?, ?, ?, ?)',
        [result.exchange, base, result.symbol, result.leverageMax || 100, now],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Statistiques du catalogue
  async getCatalogStats(): Promise<PerpCatalogStats> {
    const stats = await new Promise<PerpCatalogStats>((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as total, MAX(updated_at_utc) as lastUpdated FROM perp_catalog',
        (err, row: any) => {
          if (err) reject(err);
          else resolve({
            total: row.total || 0,
            byExchange: [],
            lastUpdated: row.lastUpdated || ''
          });
        }
      );
    });

    // Compter par exchange
    const exchangeStats = await new Promise<Array<{ exchange: string; count: number }>>((resolve, reject) => {
      this.db.all(
        'SELECT exchange, COUNT(*) as count FROM perp_catalog GROUP BY exchange',
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    for (const row of exchangeStats) {
      stats.byExchange.push({ exchange: row.exchange, count: row.count });
    }

    return stats;
  }

  // Nettoyage des anciens tokens
  async cleanupOldTokens(maxAgeHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM perp_catalog WHERE updated_at_utc < ?',
        [cutoff],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // Arrêt du service
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    console.log('🛑 PerpCatalog arrêté');
  }

  // Getters pour le monitoring
  getStatus(): {
    isRefreshing: boolean;
    refreshIntervalMs: number;
    lastRefreshTime?: number;
  } {
    return {
      isRefreshing: false, // Refresh est géré par le guard
      refreshIntervalMs: this.refreshIntervalMs
    };
  }
}
