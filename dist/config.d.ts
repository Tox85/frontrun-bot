export declare const BYBIT_CONFIG: {
    apiKey: string;
    secret: string;
    isDemo: boolean;
    sandbox: boolean;
    testnet: boolean;
};
export declare const BINANCE_CONFIG: {
    apiKey: string;
    secret: string;
    isDemo: boolean;
    sandbox: boolean;
    testnet: boolean;
};
export declare const TELEGRAM_CONFIG: {
    botToken: string;
    chatId: string;
    enabled: boolean;
};
export declare const TRADING_CONFIG: {
    tradeAmountUsdt: number;
    leverage: number;
    stopLossPercent: number;
    autoCloseMinutes: number;
};
export declare const RISK_CONFIG: {
    riskPerTradeDefault: number;
    riskPctOfBalance: number;
    maxLeverageDefault: number;
    orderTimeoutMs: number;
    perpCheckTimeoutMs: number;
    dryRun: boolean;
    hlEnabled: boolean;
    binanceEnabled: boolean;
    bybitEnabled: boolean;
};
export declare function validateConfig(): void;
