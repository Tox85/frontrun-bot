"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerpCatalog = void 0;
class PerpCatalog {
    db;
    refreshIntervalMs = 15 * 60 * 1000; // 15 minutes
    refreshTimer = null;
    isRefreshing = false;
    constructor(db, refreshIntervalMs) {
        this.db = db;
        if (refreshIntervalMs) {
            this.refreshIntervalMs = refreshIntervalMs;
        }
    }
    async initialize() {
        console.log('📚 Initialisation du PerpCatalog...');
        // Vérifier que la table existe
        await this.ensureTableExists();
        // Démarrer le refresh périodique
        this.startPeriodicRefresh();
        console.log('✅ PerpCatalog initialisé');
    }
    async ensureTableExists() {
        const exists = await this.tableExists('perp_catalog');
        if (!exists) {
            throw new Error('Table perp_catalog n\'existe pas - migrations non appliquées');
        }
    }
    async tableExists(tableName) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(!!row);
            });
        });
    }
    // Refresh périodique du catalogue
    startPeriodicRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        this.refreshTimer = setInterval(async () => {
            if (!this.isRefreshing) {
                await this.refreshAllExchanges();
            }
        }, this.refreshIntervalMs);
        console.log(`🔄 Refresh périodique configuré: ${this.refreshIntervalMs / 1000}s`);
    }
    async refreshAllExchanges() {
        if (this.isRefreshing) {
            console.log('⚠️ Refresh déjà en cours, ignoré');
            return;
        }
        this.isRefreshing = true;
        console.log('🔄 Début du refresh du catalogue des perpétuels...');
        try {
            const startTime = Date.now();
            // Refresh en parallèle pour tous les exchanges
            await Promise.all([
                this.refreshBybitCatalog(),
                this.refreshHyperliquidCatalog(),
                this.refreshBinanceCatalog()
            ]);
            const duration = Date.now() - startTime;
            console.log(`✅ Refresh du catalogue terminé en ${duration}ms`);
        }
        catch (error) {
            console.error('❌ Erreur lors du refresh du catalogue:', error);
        }
        finally {
            this.isRefreshing = false;
        }
    }
    // Refresh Bybit
    async refreshBybitCatalog() {
        try {
            console.log('🔄 Refresh du catalogue Bybit...');
            const response = await fetch('https://api.bybit.com/v5/market/instruments-info?category=linear');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.retCode !== 0) {
                throw new Error(`Bybit API error: ${data.retMsg}`);
            }
            const tokens = [];
            for (const instrument of data.result.list) {
                if (instrument.status === 'Trading') {
                    const base = this.extractBaseFromSymbol(instrument.symbol);
                    if (base) {
                        tokens.push({
                            base,
                            symbol: instrument.symbol,
                            leverageMax: parseFloat(instrument.leverageFilter.maxLeverage) || 100
                        });
                    }
                }
            }
            await this.updateCatalog('BYBIT', tokens);
            console.log(`✅ Catalogue Bybit mis à jour: ${tokens.length} tokens`);
        }
        catch (error) {
            console.error('❌ Erreur lors du refresh du catalogue Bybit:', error);
        }
    }
    // Refresh Hyperliquid
    async refreshHyperliquidCatalog() {
        try {
            console.log('🔄 Refresh du catalogue Hyperliquid...');
            // Utiliser l'API correcte pour Hyperliquid
            const response = await fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'universe'
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            const tokens = [];
            if (data.universe && Array.isArray(data.universe)) {
                for (const instrument of data.universe) {
                    const base = this.extractBaseFromSymbol(instrument.name);
                    if (base) {
                        tokens.push({
                            base,
                            symbol: instrument.name,
                            leverageMax: 100 // Hyperliquid a généralement un levier max de 100
                        });
                    }
                }
            }
            if (tokens.length > 0) {
                await this.updateCatalog('HYPERLIQUID', tokens);
                console.log(`✅ Catalogue Hyperliquid mis à jour: ${tokens.length} tokens`);
            }
            else {
                console.log('⚠️ Aucun token Hyperliquid trouvé');
            }
        }
        catch (error) {
            console.error('❌ Erreur lors du refresh du catalogue Hyperliquid:', error);
            // Ne pas faire échouer le refresh global
        }
    }
    // Refresh Binance
    async refreshBinanceCatalog() {
        try {
            console.log('🔄 Refresh du catalogue Binance...');
            const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            const tokens = [];
            for (const symbol of data.symbols) {
                if (symbol.status === 'TRADING' && symbol.contractType === 'PERPETUAL') {
                    const base = this.extractBaseFromSymbol(symbol.symbol);
                    if (base) {
                        tokens.push({
                            base,
                            symbol: symbol.symbol,
                            leverageMax: 125 // Binance a généralement un levier max de 125
                        });
                    }
                }
            }
            await this.updateCatalog('BINANCE', tokens);
            console.log(`✅ Catalogue Binance mis à jour: ${tokens.length} tokens`);
        }
        catch (error) {
            console.error('❌ Erreur lors du refresh du catalogue Binance:', error);
        }
    }
    // Mise à jour du catalogue en base
    async updateCatalog(exchange, tokens) {
        if (tokens.length === 0)
            return;
        const now = new Date().toISOString();
        return new Promise((resolve, reject) => {
            // Vérifier si on est déjà dans une transaction
            this.db.get('PRAGMA transaction_state', (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                const inTransaction = row && row.transaction_state !== 'none';
                if (inTransaction) {
                    // Si on est déjà dans une transaction, faire l'update directement
                    this.updateCatalogInTransaction(exchange, tokens, now, resolve, reject);
                }
                else {
                    // Sinon, démarrer une nouvelle transaction
                    this.db.serialize(() => {
                        this.db.run('BEGIN TRANSACTION');
                        this.updateCatalogInTransaction(exchange, tokens, now, resolve, reject);
                    });
                }
            });
        });
    }
    updateCatalogInTransaction(exchange, tokens, now, resolve, reject) {
        try {
            // Supprimer l'ancien catalogue pour cet exchange
            this.db.run('DELETE FROM perp_catalog WHERE exchange = ?', [exchange], (err) => {
                if (err) {
                    console.error(`❌ Erreur lors de la suppression du catalogue ${exchange}:`, err);
                    this.db.run('ROLLBACK');
                    reject(err);
                    return;
                }
                // Insérer le nouveau catalogue
                const stmt = this.db.prepare('INSERT INTO perp_catalog (exchange, base, symbol, leverage_max, updated_at_utc) VALUES (?, ?, ?, ?, ?)');
                let completed = 0;
                let hasError = false;
                for (const token of tokens) {
                    stmt.run([exchange, token.base, token.symbol, token.leverageMax, now], (err) => {
                        if (err && !hasError) {
                            hasError = true;
                            console.error(`❌ Erreur lors de l'insertion du token ${token.base}:`, err);
                            this.db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                        completed++;
                        if (completed === tokens.length && !hasError) {
                            stmt.finalize((err) => {
                                if (err) {
                                    console.error('❌ Erreur lors de la finalisation du statement:', err);
                                    this.db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }
                                this.db.run('COMMIT', (err) => {
                                    if (err) {
                                        console.error('❌ Erreur lors du commit:', err);
                                        this.db.run('ROLLBACK');
                                        reject(err);
                                        return;
                                    }
                                    console.log(`✅ Catalogue ${exchange} mis à jour: ${tokens.length} tokens`);
                                    resolve();
                                });
                            });
                        }
                    });
                }
            });
        }
        catch (error) {
            console.error(`❌ Erreur lors de la mise à jour du catalogue ${exchange}:`, error);
            this.db.run('ROLLBACK');
            reject(error);
        }
    }
    // Extraction de la base depuis un symbole
    extractBaseFromSymbol(symbol) {
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
    // Lookup on-demand d'un token
    async hasPerp(base) {
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
        }
        catch (error) {
            console.error(`❌ Erreur lors du lookup de ${base}:`, error);
            return { hasPerp: false };
        }
    }
    // Récupération depuis le cache
    async getFromCache(base) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM perp_catalog WHERE base = ? ORDER BY updated_at_utc DESC LIMIT 1', [base], (err, row) => {
                if (err)
                    reject(err);
                else if (row)
                    resolve(row);
                else
                    resolve(null);
            });
        });
    }
    // Lookup direct (1-shot)
    async lookupDirect(base) {
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
            }
            catch (error) {
                console.warn(`⚠️ Erreur lors du check ${exchange.name} pour ${base}:`, error);
                continue;
            }
        }
        return { hasPerp: false };
    }
    // Vérification d'un exchange spécifique
    async checkExchangeForToken(exchange, url, base) {
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
    async cacheResult(base, result) {
        if (!result.hasPerp || !result.symbol || !result.exchange)
            return;
        const now = new Date().toISOString();
        return new Promise((resolve, reject) => {
            this.db.run('INSERT OR REPLACE INTO perp_catalog (exchange, base, symbol, leverage_max, updated_at_utc) VALUES (?, ?, ?, ?, ?)', [result.exchange, base, result.symbol, result.leverageMax || 100, now], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    // Statistiques du catalogue
    async getCatalogStats() {
        const stats = await new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as total, MAX(updated_at_utc) as lastUpdated FROM perp_catalog', (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve({
                        total: row.total || 0,
                        byExchange: [],
                        lastUpdated: row.lastUpdated || ''
                    });
            });
        });
        // Compter par exchange
        const exchangeStats = await new Promise((resolve, reject) => {
            this.db.all('SELECT exchange, COUNT(*) as count FROM perp_catalog GROUP BY exchange', (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
        for (const row of exchangeStats) {
            stats.byExchange.push({ exchange: row.exchange, count: row.count });
        }
        return stats;
    }
    // Nettoyage des anciens tokens
    async cleanupOldTokens(maxAgeHours = 24) {
        const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM perp_catalog WHERE updated_at_utc < ?', [cutoff], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(this.changes);
            });
        });
    }
    // Arrêt du service
    stop() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        console.log('🛑 PerpCatalog arrêté');
    }
    // Getters pour le monitoring
    getStatus() {
        return {
            isRefreshing: this.isRefreshing,
            refreshIntervalMs: this.refreshIntervalMs
        };
    }
}
exports.PerpCatalog = PerpCatalog;
//# sourceMappingURL=PerpCatalog.js.map