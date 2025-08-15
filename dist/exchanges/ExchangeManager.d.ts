import { HyperliquidAdapter, HLConfig } from './HyperliquidAdapter';
import { BybitAdapter, BybitConfig } from './BybitAdapter';
import { BinanceAdapter, BinanceConfig } from './BinanceAdapter';
export interface ExchangeConfigs {
    hyperliquid?: HLConfig;
    bybit?: BybitConfig;
    binance?: BinanceConfig;
}
export interface ExchangeStatus {
    hyperliquid?: any;
    bybit?: any;
    binance?: any;
}
export interface SymbolLookupResult {
    symbol: string;
    base: string;
    exchanges: {
        hyperliquid?: boolean;
        bybit?: boolean;
        binance?: boolean;
    };
    prices: {
        hyperliquid?: number;
        bybit?: number;
        binance?: number;
    };
}
export declare class ExchangeManager {
    private hyperliquid?;
    private bybit?;
    private binance?;
    private symbolMapper;
    private isInitialized;
    constructor(configs: ExchangeConfigs);
    initialize(): Promise<void>;
    lookupSymbol(symbol: string): Promise<SymbolLookupResult>;
    searchSymbols(query: string): Promise<{
        hyperliquid?: any[];
        bybit?: any[];
        binance?: any[];
    }>;
    getBalances(): Promise<{
        hyperliquid?: any[];
        bybit?: any[];
        binance?: any[];
    }>;
    healthCheck(): Promise<{
        hyperliquid?: boolean;
        bybit?: boolean;
        binance?: boolean;
        overall: boolean;
    }>;
    getHyperliquid(): HyperliquidAdapter | undefined;
    getBybit(): BybitAdapter | undefined;
    getBinance(): BinanceAdapter | undefined;
    stop(): Promise<void>;
    private ensureInitialized;
    getStatus(): ExchangeStatus;
    getInitializationStatus(): boolean;
}
