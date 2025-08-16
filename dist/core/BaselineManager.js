"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaselineManager = void 0;
const RateLimiter_1 = require("./RateLimiter");
class BaselineManager {
    db;
    rateLimiter;
    isInitialized = false;
    baselineUrl = 'https://api.bithumb.com/public/ticker/ALL_KRW';
    stableCoins = ['USDT', 'USDC', 'DAI', 'TUSD', 'BUSD', 'FRAX'];
    constructor(db) {
        this.db = db;
        this.rateLimiter = new RateLimiter_1.RateLimiter();
    }
    async initialize() {
        if (this.isInitialized)
            return;
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
        }
        catch (error) {
            console.error('❌ Erreur lors de l\'initialisation de la baseline KR:', error);
            throw error;
        }
    }
    async fetchAndStoreBaseline() {
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
        }
        catch (error) {
            this.rateLimiter.recordFailure('BITHUMB');
            throw error;
        }
    }
    async storeBaselineKR(tokens) {
        const now = new Date().toISOString();
        for (const token of tokens) {
            // Exclure les stablecoins comme requis
            if (this.stableCoins.includes(token.base)) {
                continue;
            }
            await this.db.run('INSERT OR REPLACE INTO baseline_kr (base, source, listed_at_utc, created_at_utc) VALUES (?, ?, ?, ?)', [token.base, 'bithumb.rest', token.listedAt, now]);
        }
    }
    parseBaselineResponse(data) {
        const tokens = [];
        const now = new Date().toISOString();
        for (const [symbol, info] of Object.entries(data)) {
            if (typeof info === 'object' && info !== null) {
                const tokenInfo = info;
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
    async isTokenInBaseline(base) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const result = await this.db.get('SELECT 1 FROM baseline_kr WHERE base = ?', [base]);
        return !!result;
    }
    async isTokenNew(base) {
        return !(await this.isTokenInBaseline(base));
    }
    async getBaselineKRStats() {
        try {
            const result = await this.db.get('SELECT COUNT(*) as total, MAX(created_at_utc) as lastUpdated FROM baseline_kr');
            if (!result)
                return null;
            const sanity = result.total >= 200; // Baseline raisonnable
            return {
                total: result.total,
                lastUpdated: result.lastUpdated || new Date().toISOString(),
                sanity
            };
        }
        catch (error) {
            console.error('❌ Erreur lors de la récupération des stats baseline:', error);
            return null;
        }
    }
    async getBaselineStats() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const stats = await this.getBaselineKRStats();
        if (!stats)
            return null;
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
    async healthCheck() {
        try {
            const stats = await this.getBaselineKRStats();
            return {
                isInitialized: this.isInitialized,
                baselineExists: stats !== null && stats.total > 0,
                tokenCount: stats?.total || 0,
                lastUpdated: stats?.lastUpdated || null,
                sanity: stats?.sanity || false
            };
        }
        catch (error) {
            return {
                isInitialized: this.isInitialized,
                baselineExists: false,
                tokenCount: 0,
                lastUpdated: null,
                sanity: false
            };
        }
    }
    async stop() {
        this.isInitialized = false;
    }
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            baselineUrl: this.baselineUrl,
            rateLimiterState: this.rateLimiter.getStateSnapshot('BITHUMB'),
            isBootOnly: true
        };
    }
}
exports.BaselineManager = BaselineManager;
//# sourceMappingURL=BaselineManager.js.map