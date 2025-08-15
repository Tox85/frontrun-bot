"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeManager = void 0;
const HyperliquidAdapter_1 = require("./HyperliquidAdapter");
const BybitAdapter_1 = require("./BybitAdapter");
const BinanceAdapter_1 = require("./BinanceAdapter");
const SymbolMapper_1 = require("../core/SymbolMapper");
class ExchangeManager {
    hyperliquid;
    bybit;
    binance;
    symbolMapper;
    isInitialized = false;
    constructor(configs) {
        this.symbolMapper = SymbolMapper_1.SymbolMapper.getInstance();
        if (configs.hyperliquid) {
            this.hyperliquid = new HyperliquidAdapter_1.HyperliquidAdapter(configs.hyperliquid);
        }
        if (configs.bybit) {
            this.bybit = new BybitAdapter_1.BybitAdapter(configs.bybit);
        }
        if (configs.binance) {
            this.binance = new BinanceAdapter_1.BinanceAdapter(configs.binance);
        }
    }
    async initialize() {
        if (this.isInitialized)
            return;
        const initPromises = [];
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
        }
        catch (error) {
            throw new Error(`Échec de l'initialisation des exchanges: ${error}`);
        }
    }
    async lookupSymbol(symbol) {
        await this.ensureInitialized();
        const base = this.symbolMapper.extractBase(symbol, 'BITHUMB');
        const result = {
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
                    if (price)
                        result.prices.hyperliquid = price;
                }
            }
            catch (error) {
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
                    if (price)
                        result.prices.bybit = price;
                }
            }
            catch (error) {
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
                    if (price)
                        result.prices.binance = price;
                }
            }
            catch (error) {
                console.error(`Erreur lors de la vérification Binance pour ${symbol}:`, error);
            }
        }
        return result;
    }
    async searchSymbols(query) {
        await this.ensureInitialized();
        const results = {};
        if (this.hyperliquid) {
            try {
                // Hyperliquid n'a pas de méthode searchSymbols, on retourne un tableau vide
                results.hyperliquid = [];
            }
            catch (error) {
                console.error(`Erreur lors de la recherche Hyperliquid pour "${query}":`, error);
            }
        }
        if (this.bybit) {
            try {
                results.bybit = await this.bybit.searchSymbols(query);
            }
            catch (error) {
                console.error(`Erreur lors de la recherche Bybit pour "${query}":`, error);
            }
        }
        if (this.binance) {
            try {
                results.binance = await this.binance.searchSymbols(query);
            }
            catch (error) {
                console.error(`Erreur lors de la recherche Binance pour "${query}":`, error);
            }
        }
        return results;
    }
    async getBalances() {
        await this.ensureInitialized();
        const results = {};
        if (this.hyperliquid) {
            try {
                results.hyperliquid = await this.hyperliquid.getBalance();
            }
            catch (error) {
                console.error('Erreur lors de la récupération du solde Hyperliquid:', error);
            }
        }
        if (this.bybit) {
            try {
                results.bybit = await this.bybit.getBalance();
            }
            catch (error) {
                console.error('Erreur lors de la récupération du solde Bybit:', error);
            }
        }
        if (this.binance) {
            try {
                results.binance = await this.binance.getBalance();
            }
            catch (error) {
                console.error('Erreur lors de la récupération du solde Binance:', error);
            }
        }
        return results;
    }
    async healthCheck() {
        const results = {
            overall: true
        };
        if (this.hyperliquid) {
            try {
                results.hyperliquid = await this.hyperliquid.healthCheck();
                if (!results.hyperliquid)
                    results.overall = false;
            }
            catch (error) {
                results.hyperliquid = false;
                results.overall = false;
            }
        }
        if (this.bybit) {
            try {
                results.bybit = await this.bybit.healthCheck();
                if (!results.bybit)
                    results.overall = false;
            }
            catch (error) {
                results.bybit = false;
                results.overall = false;
            }
        }
        if (this.binance) {
            try {
                results.binance = await this.binance.healthCheck();
                if (!results.binance)
                    results.overall = false;
            }
            catch (error) {
                results.binance = false;
                results.overall = false;
            }
        }
        return results;
    }
    getHyperliquid() {
        return this.hyperliquid;
    }
    getBybit() {
        return this.bybit;
    }
    getBinance() {
        return this.binance;
    }
    async stop() {
        const stopPromises = [];
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
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }
    getStatus() {
        return {
            hyperliquid: this.hyperliquid?.getStatus(),
            bybit: this.bybit?.getStatus(),
            binance: this.binance?.getStatus()
        };
    }
    getInitializationStatus() {
        return this.isInitialized;
    }
}
exports.ExchangeManager = ExchangeManager;
//# sourceMappingURL=ExchangeManager.js.map