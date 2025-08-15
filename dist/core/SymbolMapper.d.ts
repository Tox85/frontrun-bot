/**
 * SymbolMapper - Normalisation des symboles d'exchanges
 *
 * Conforme au super prompt Bithumb-only :
 * - Normalisation des symboles Bybit, Hyperliquid, Binance
 * - Extraction des bases (BTC, ETH, etc.)
 * - Support des formats KRW, USDT, USD
 */
export interface NormalizedSymbol {
    base: string;
    quote: string;
    exchange: string;
    original: string;
}
export declare class SymbolMapper {
    private static instance;
    private exchangePatterns;
    private constructor();
    static getInstance(): SymbolMapper;
    /**
     * Normalise un symbole d'exchange en base/quote
     */
    normalizeSymbol(symbol: string, exchange: string): NormalizedSymbol | null;
    /**
     * Extrait la base d'un symbole normalisé
     */
    extractBase(symbol: string, exchange: string): string | null;
    /**
     * Génère un symbole normalisé pour un exchange
     */
    generateSymbol(base: string, quote: string, exchange: string): string;
    /**
     * Vérifie si un symbole est valide pour un exchange
     */
    isValidSymbol(symbol: string, exchange: string): boolean;
    /**
     * Liste tous les symboles supportés pour un exchange
     */
    getSupportedQuotes(exchange: string): string[];
    /**
     * Convertit un symbole d'un exchange vers un autre
     */
    convertSymbol(symbol: string, fromExchange: string, toExchange: string): string | null;
    /**
     * Trouve une quote de fallback pour un exchange
     */
    private getFallbackQuote;
    /**
     * Nettoie et valide une base de token
     */
    normalizeBaseSymbol(base: string): string | null;
    /**
     * Statistiques des patterns supportés
     */
    getStats(): {
        totalExchanges: number;
        supportedQuotes: Record<string, string[]>;
        totalPatterns: number;
    };
}
export declare const symbolMapper: SymbolMapper;
