"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BybitAdapter = void 0;
const RateLimiter_1 = require("../core/RateLimiter");
const SymbolMapper_1 = require("../core/SymbolMapper");
class BybitAdapter {
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
            throw new Error(`Échec de l'initialisation Bybit: ${error}`);
        }
    }
    async testConnection() {
        const response = await this.makeRequest('GET', '/v5/market/time');
        if (!response || response.retCode !== 0) {
            throw new Error('Impossible de se connecter à l\'API Bybit');
        }
    }
    async getSymbols() {
        await this.ensureInitialized();
        try {
            const response = await this.makeRequest('GET', '/v5/market/instruments-info', {
                category: 'spot'
            });
            if (response?.retCode === 0 && response.result?.list) {
                return response.result.list.map((item) => ({
                    symbol: item.symbol,
                    baseCoin: item.baseCoin,
                    quoteCoin: item.quoteCoin,
                    status: item.status,
                    minOrderQty: item.lotSizeFilter?.minOrderQty || '0',
                    maxOrderQty: item.lotSizeFilter?.maxOrderQty || '0',
                    tickSize: item.priceFilter?.tickSize || '0',
                    stepSize: item.lotSizeFilter?.stepSize || '0'
                }));
            }
            return [];
        }
        catch (error) {
            console.error('Erreur lors de la récupération des symboles Bybit:', error);
            return [];
        }
    }
    async getTicker(symbol) {
        await this.ensureInitialized();
        try {
            const normalizedSymbol = this.symbolMapper.normalizeSymbol(symbol, 'BYBIT');
            if (!normalizedSymbol)
                return null;
            const response = await this.makeRequest('GET', '/v5/market/tickers', {
                category: 'spot',
                symbol: normalizedSymbol.original
            });
            if (response?.retCode === 0 && response.result?.list?.[0]) {
                const ticker = response.result.list[0];
                return {
                    symbol: ticker.symbol,
                    lastPrice: ticker.lastPrice,
                    bid1Price: ticker.bid1Price,
                    ask1Price: ticker.ask1Price,
                    volume24h: ticker.volume24h,
                    turnover24h: ticker.turnover24h,
                    price24hPcnt: ticker.price24hPcnt,
                    usdIndexPrice: ticker.usdIndexPrice
                };
            }
            return null;
        }
        catch (error) {
            console.error(`Erreur lors de la récupération du ticker ${symbol}:`, error);
            return null;
        }
    }
    async getBalance(coin) {
        await this.ensureInitialized();
        try {
            const params = { accountType: 'UNIFIED' };
            if (coin) {
                params.coin = coin;
            }
            const response = await this.makeRequest('GET', '/v5/account/wallet-balance', params);
            if (response?.retCode === 0 && response.result?.list?.[0]?.coin) {
                return response.result.list[0].coin.map((item) => ({
                    coin: item.coin,
                    walletBalance: item.walletBalance,
                    availableBalance: item.availableBalance,
                    lockedBalance: item.lockedBalance
                }));
            }
            return [];
        }
        catch (error) {
            console.error('Erreur lors de la récupération du solde Bybit:', error);
            return [];
        }
    }
    async isSymbolTradable(symbol) {
        try {
            const symbols = await this.getSymbols();
            const normalizedSymbol = this.symbolMapper.normalizeSymbol(symbol, 'BYBIT');
            if (!normalizedSymbol)
                return false;
            return symbols.some(s => s.symbol === normalizedSymbol.original && s.status === 'Trading');
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
                symbol.baseCoin.includes(normalizedQuery));
        }
        catch (error) {
            console.error(`Erreur lors de la recherche de symboles pour "${query}":`, error);
            return [];
        }
    }
    async getSymbolInfo(symbol) {
        try {
            const symbols = await this.getSymbols();
            const normalizedSymbol = this.symbolMapper.normalizeSymbol(symbol, 'BYBIT');
            if (!normalizedSymbol)
                return null;
            return symbols.find(s => s.symbol === normalizedSymbol.original) || null;
        }
        catch (error) {
            console.error(`Erreur lors de la récupération des infos du symbole ${symbol}:`, error);
            return null;
        }
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
                    'X-BAPI-API-KEY': this.config.apiKey,
                    'X-BAPI-TIMESTAMP': Date.now().toString(),
                    'X-BAPI-RECV-WINDOW': '5000'
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
            rateLimiterState: this.rateLimiter.getStateSnapshot('BYBIT')
        };
    }
}
exports.BybitAdapter = BybitAdapter;
//# sourceMappingURL=BybitAdapter.js.map