"use strict";
/**
 * SymbolMapper - Normalisation des symboles d'exchanges
 *
 * Conforme au super prompt Bithumb-only :
 * - Normalisation des symboles Bybit, Hyperliquid, Binance
 * - Extraction des bases (BTC, ETH, etc.)
 * - Support des formats KRW, USDT, USD
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.symbolMapper = exports.SymbolMapper = void 0;
class SymbolMapper {
    static instance;
    exchangePatterns;
    constructor() {
        this.exchangePatterns = new Map([
            // Bybit: BTCUSDT, ETHUSDT
            ['BYBIT', /^([A-Z0-9.]+)(USDT|BTC|ETH|BUSD)$/],
            // Hyperliquid: BTCUSD, ETHUSD
            ['HYPERLIQUID', /^([A-Z0-9.]+)(USD|USDC)$/],
            // Binance: BTCUSDT, ETHUSDT
            ['BINANCE', /^([A-Z0-9.]+)(USDT|BUSD|BTC|ETH)$/],
            // Bithumb: BTC_KRW, ETH_KRW
            ['BITHUMB', /^([A-Z0-9.]+)_(KRW|USDT|BTC|ETH)$/]
        ]);
    }
    static getInstance() {
        if (!SymbolMapper.instance) {
            SymbolMapper.instance = new SymbolMapper();
        }
        return SymbolMapper.instance;
    }
    /**
     * Normalise un symbole d'exchange en base/quote
     */
    normalizeSymbol(symbol, exchange) {
        const pattern = this.exchangePatterns.get(exchange.toUpperCase());
        if (!pattern) {
            console.warn(`⚠️ Pattern non supporté pour l'exchange: ${exchange}`);
            return null;
        }
        const match = symbol.match(pattern);
        if (!match) {
            return null;
        }
        const [, base, quote] = match;
        if (!base || !quote) {
            return null;
        }
        return {
            base: base.toUpperCase(),
            quote: quote.toUpperCase(),
            exchange: exchange.toUpperCase(),
            original: symbol
        };
    }
    /**
     * Extrait la base d'un symbole normalisé
     */
    extractBase(symbol, exchange) {
        const normalized = this.normalizeSymbol(symbol, exchange);
        return normalized?.base || null;
    }
    /**
     * Génère un symbole normalisé pour un exchange
     */
    generateSymbol(base, quote, exchange) {
        const upperBase = base.toUpperCase();
        const upperQuote = quote.toUpperCase();
        switch (exchange.toUpperCase()) {
            case 'BYBIT':
            case 'BINANCE':
                return `${upperBase}${upperQuote}`;
            case 'HYPERLIQUID':
                return `${upperBase}${upperQuote}`;
            case 'BITHUMB':
                return `${upperBase}_${upperQuote}`;
            default:
                throw new Error(`Exchange non supporté: ${exchange}`);
        }
    }
    /**
     * Vérifie si un symbole est valide pour un exchange
     */
    isValidSymbol(symbol, exchange) {
        const pattern = this.exchangePatterns.get(exchange.toUpperCase());
        if (!pattern)
            return false;
        return pattern.test(symbol);
    }
    /**
     * Liste tous les symboles supportés pour un exchange
     */
    getSupportedQuotes(exchange) {
        switch (exchange.toUpperCase()) {
            case 'BYBIT':
            case 'BINANCE':
                return ['USDT', 'BUSD', 'BTC', 'ETH'];
            case 'HYPERLIQUID':
                return ['USD', 'USDC'];
            case 'BITHUMB':
                return ['KRW', 'USDT', 'BTC', 'ETH'];
            default:
                return [];
        }
    }
    /**
     * Convertit un symbole d'un exchange vers un autre
     */
    convertSymbol(symbol, fromExchange, toExchange) {
        const normalized = this.normalizeSymbol(symbol, fromExchange);
        if (!normalized)
            return null;
        // Vérifier que la quote est supportée par l'exchange de destination
        const supportedQuotes = this.getSupportedQuotes(toExchange);
        if (!supportedQuotes.includes(normalized.quote)) {
            // Essayer de convertir vers une quote supportée
            const fallbackQuote = this.getFallbackQuote(normalized.quote, toExchange);
            if (!fallbackQuote)
                return null;
            return this.generateSymbol(normalized.base, fallbackQuote, toExchange);
        }
        return this.generateSymbol(normalized.base, normalized.quote, toExchange);
    }
    /**
     * Trouve une quote de fallback pour un exchange
     */
    getFallbackQuote(originalQuote, targetExchange) {
        const supportedQuotes = this.getSupportedQuotes(targetExchange);
        // Priorité des quotes par exchange
        const priorities = {
            'BYBIT': ['USDT', 'BUSD', 'BTC', 'ETH'],
            'BINANCE': ['USDT', 'BUSD', 'BTC', 'ETH'],
            'HYPERLIQUID': ['USD', 'USDC'],
            'BITHUMB': ['KRW', 'USDT', 'BTC', 'ETH']
        };
        const priority = priorities[targetExchange.toUpperCase()];
        if (!priority)
            return null;
        // Trouver la première quote supportée dans l'ordre de priorité
        for (const quote of priority) {
            if (supportedQuotes.includes(quote)) {
                return quote;
            }
        }
        return null;
    }
    /**
     * Nettoie et valide une base de token
     */
    normalizeBaseSymbol(base) {
        if (!base || typeof base !== 'string')
            return null;
        const cleanBase = base.trim().toUpperCase();
        // Vérifier que c'est un token valide
        if (!/^[A-Z0-9.]+$/.test(cleanBase))
            return null;
        // Filtrer les tokens stables
        if (['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'KRW'].includes(cleanBase)) {
            return null;
        }
        return cleanBase;
    }
    /**
     * Statistiques des patterns supportés
     */
    getStats() {
        const supportedQuotes = {};
        for (const [exchange] of this.exchangePatterns) {
            supportedQuotes[exchange] = this.getSupportedQuotes(exchange);
        }
        return {
            totalExchanges: this.exchangePatterns.size,
            supportedQuotes,
            totalPatterns: this.exchangePatterns.size
        };
    }
}
exports.SymbolMapper = SymbolMapper;
// Export de l'instance singleton
exports.symbolMapper = SymbolMapper.getInstance();
//# sourceMappingURL=SymbolMapper.js.map