export interface BinanceConfig {
    apiKey: string;
    secretKey: string;
    testnet: boolean;
    baseUrl: string;
    timeoutMs: number;
}
export interface BinanceSymbol {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    status: string;
    minQty: string;
    maxQty: string;
    tickSize: string;
    stepSize: string;
    minNotional: string;
}
export interface BinanceTicker {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    prevClosePrice: string;
    lastPrice: string;
    lastQty: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    count: number;
}
export interface BinanceBalance {
    asset: string;
    free: string;
    locked: string;
}
export declare class BinanceAdapter {
    private config;
    private rateLimiter;
    private symbolMapper;
    private isInitialized;
    constructor(config: BinanceConfig);
    initialize(): Promise<void>;
    private testConnection;
    getSymbols(): Promise<BinanceSymbol[]>;
    getTicker(symbol: string): Promise<BinanceTicker | null>;
    getBalance(asset?: string): Promise<BinanceBalance[]>;
    isSymbolTradable(symbol: string): Promise<boolean>;
    getCurrentPrice(symbol: string): Promise<number | null>;
    searchSymbols(query: string): Promise<BinanceSymbol[]>;
    getSymbolInfo(symbol: string): Promise<BinanceSymbol | null>;
    getPriceChange24h(symbol: string): Promise<{
        change: number;
        changePercent: number;
    } | null>;
    private generateSignature;
    private makeRequest;
    private ensureInitialized;
    healthCheck(): Promise<boolean>;
    stop(): Promise<void>;
    getStatus(): Omit<BinanceConfig, 'secretKey'> & {
        isInitialized: boolean;
        rateLimiterState: any;
    };
}
