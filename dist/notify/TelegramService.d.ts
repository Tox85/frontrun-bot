import { EventEmitter } from 'events';
export interface TelegramMessage {
    id: string;
    text: string;
    priority: 'high' | 'medium' | 'low';
    retryCount: number;
    maxRetries: number;
    nextRetryAt?: number;
    createdAt: number;
}
export interface TelegramConfig {
    enabled: boolean;
    botToken: string;
    chatId: string;
    baseUrl: string;
    queueDelayMs: number;
    maxRetries: number;
    retryBackoffMs: number;
    timeoutMs: number;
}
export declare class TelegramService extends EventEmitter {
    private config;
    private messageQueue;
    private isProcessing;
    private processingTimer;
    private messageIdCounter;
    private isObserverMode;
    constructor(config?: Partial<TelegramConfig>);
    setObserverMode(enabled: boolean): void;
    sendMessage(text: string, priority?: 'high' | 'medium' | 'low'): Promise<string>;
    sendInit(botMode: string, balances: Record<string, number>, configSummary: Record<string, any>): Promise<string>;
    sendListingDetected(event: {
        exchange: string;
        symbol: string;
        title: string;
        url: string;
        tsUTC: string;
    }): Promise<string>;
    sendTradeExecuted(symbol: string, exchange: string, side: 'long' | 'short', qty: number, price: number): Promise<string>;
    sendTradeError(symbol: string, error: string): Promise<string>;
    sendExitScheduled(symbol: string, exchange: string, dueAt: string): Promise<string>;
    sendExitExecuted(symbol: string, exchange: string, pnl: number): Promise<string>;
    private addToQueue;
    private startProcessing;
    private processNextMessage;
    private sendToTelegram;
    stop(): void;
    getStatus(): {
        enabled: boolean;
        observerMode: boolean;
        queueLength: number;
        isProcessing: boolean;
        config: Omit<TelegramConfig, 'botToken'>;
    };
    getQueueStats(): {
        total: number;
        byPriority: Record<string, number>;
        nextRetryCount: number;
    };
    clearQueue(): void;
}
