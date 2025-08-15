export interface BybitConfig {
    apiKey: string;
    secretKey: string;
    testnet: boolean;
    baseUrl: string;
    timeoutMs: number;
}
export interface BybitSymbol {
    symbol: string;
    baseCoin: string;
    quoteCoin: string;
    status: string;
    minOrderQty: string;
    maxOrderQty: string;
    tickSize: string;
    stepSize: string;
}
export interface BybitTicker {
    symbol: string;
    lastPrice: string;
    bid1Price: string;
    ask1Price: string;
    volume24h: string;
    turnover24h: string;
    price24hPcnt: string;
    usdIndexPrice: string;
}
export interface BybitBalance {
    coin: string;
    walletBalance: string;
    availableBalance: string;
    lockedBalance: string;
}
export declare class BybitAdapter {
    private config;
    private rateLimiter;
    private symbolMapper;
    private isInitialized;
    constructor(config: BybitConfig);
    initialize(): Promise<void>;
    private testConnection;
    getSymbols(): Promise<BybitSymbol[]>;
    getTicker(symbol: string): Promise<BybitTicker | null>;
    getBalance(coin?: string): Promise<BybitBalance[]>;
    isSymbolTradable(symbol: string): Promise<boolean>;
    getCurrentPrice(symbol: string): Promise<number | null>;
    searchSymbols(query: string): Promise<BybitSymbol[]>;
    getSymbolInfo(symbol: string): Promise<BybitSymbol | null>;
    private makeRequest;
    private ensureInitialized;
    healthCheck(): Promise<boolean>;
    stop(): Promise<void>;
    getStatus(): Omit<BybitConfig, 'secretKey'> & {
        isInitialized: boolean;
        rateLimiterState: any;
    };
}
