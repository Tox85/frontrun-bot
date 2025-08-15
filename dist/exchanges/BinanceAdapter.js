"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceAdapter = void 0;
const RateLimiter_1 = require("../core/RateLimiter");
const SymbolMapper_1 = require("../core/SymbolMapper");
class BinanceAdapter {
    config;
    rateLimiter;
    symbolMapper;
    isInitialized = false;
    constructor(config) {
        this.config = config;
        this.rateLimiter = new RateLimiter_1.RateLimiter();
        this.symbolMapper = SymbolMapper_1.SymbolMapper.getInstance();
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            // Test de connexion à l'API
            await this.testConnection();
            this.isInitialized = true;
        }
        catch (error) {
            throw new Error(`Échec de l'initialisation Binance: ${error}`);
        }
    }
    async testConnection() {
        const response = await this.makeRequest('GET', '/api/v3/ping');
        if (!response) {
            throw new Error('Impossible de se connecter à l\'API Binance');
        }
    }
    async getSymbols() {
        await this.ensureInitialized();
        try {
            const response = await this.makeRequest('GET', '/api/v3/exchangeInfo');
            if (response?.symbols) {
                return response.symbols
                    .filter((symbol) => symbol.status === 'TRADING')
                    .map((symbol) => {
                    const lotSizeFilter = symbol.filters.find((f) => f.filterType === 'LOT_SIZE');
                    const priceFilter = symbol.filters.find((f) => f.filterType === 'PRICE_FILTER');
                    const notionalFilter = symbol.filters.find((f) => f.filterType === 'MIN_NOTIONAL');
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
        }
        catch (error) {
            console.error('Erreur lors de la récupération des symboles Binance:', error);
            return [];
        }
    }
    async getTicker(symbol) {
        await this.ensureInitialized();
        try {
            const normalizedSymbol = this.symbolMapper.normalizeSymbol(symbol, 'BINANCE');
            if (!normalizedSymbol)
                return null;
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
        }
        catch (error) {
            console.error(`Erreur lors de la récupération du ticker ${symbol}:`, error);
            return null;
        }
    }
    async getBalance(asset) {
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
                let balances = response.balances.map((balance) => ({
                    asset: balance.asset,
                    free: balance.free,
                    locked: balance.locked
                }));
                if (asset) {
                    balances = balances.filter((b) => b.asset === asset);
                }
                return balances;
            }
            return [];
        }
        catch (error) {
            console.error('Erreur lors de la récupération du solde Binance:', error);
            return [];
        }
    }
    async isSymbolTradable(symbol) {
        try {
            const symbols = await this.getSymbols();
            const normalizedSymbol = this.symbolMapper.normalizeSymbol(symbol, 'BINANCE');
            if (!normalizedSymbol)
                return false;
            return symbols.some(s => s.symbol === normalizedSymbol.original && s.status === 'TRADING');
        }
        catch (error) {
            console.error(`Erreur lors de la vérification de la tradabilité de ${symbol}:`, error);
            return false;
        }
    }
    async getCurrentPrice(symbol) {
        try {
            const ticker = await this.getTicker(symbol);
            if (ticker && ticker.lastPrice) {
                return parseFloat(ticker.lastPrice);
            }
            return null;
        }
        catch (error) {
            console.error(`Erreur lors de la récupération du prix de ${symbol}:`, error);
            return null;
        }
    }
    async searchSymbols(query) {
        try {
            const symbols = await this.getSymbols();
            const normalizedQuery = query.toUpperCase();
            return symbols.filter(symbol => symbol.symbol.includes(normalizedQuery) ||
                symbol.baseAsset.includes(normalizedQuery));
        }
        catch (error) {
            console.error(`Erreur lors de la recherche de symboles pour "${query}":`, error);
            return [];
        }
    }
    async getSymbolInfo(symbol) {
        try {
            const symbols = await this.getSymbols();
            const normalizedSymbol = this.symbolMapper.normalizeSymbol(symbol, 'BINANCE');
            if (!normalizedSymbol)
                return null;
            return symbols.find(s => s.symbol === normalizedSymbol.original) || null;
        }
        catch (error) {
            console.error(`Erreur lors de la récupération des infos du symbole ${symbol}:`, error);
            return null;
        }
    }
    async getPriceChange24h(symbol) {
        try {
            const ticker = await this.getTicker(symbol);
            if (ticker) {
                return {
                    change: parseFloat(ticker.priceChange),
                    changePercent: parseFloat(ticker.priceChangePercent)
                };
            }
            return null;
        }
        catch (error) {
            console.error(`Erreur lors de la récupération du changement de prix 24h pour ${symbol}:`, error);
            return null;
        }
    }
    generateSignature(queryString) {
        // Note: Cette méthode nécessite une implémentation de HMAC-SHA256
        // Pour l'instant, retournons une chaîne vide
        // TODO: Implémenter la signature HMAC-SHA256
        return '';
    }
    async makeRequest(method, endpoint, params) {
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
        }
        catch (error) {
            this.rateLimiter.recordFailure('rest');
            throw error;
        }
    }
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }
    async healthCheck() {
        try {
            await this.testConnection();
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async stop() {
        this.isInitialized = false;
    }
    getStatus() {
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
exports.BinanceAdapter = BinanceAdapter;
//# sourceMappingURL=BinanceAdapter.js.map