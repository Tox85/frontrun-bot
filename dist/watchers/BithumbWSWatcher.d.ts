import { TokenRegistry } from '../store/TokenRegistry';
import { EventEmitter } from 'events';
export interface BithumbWSEvent {
    base: string;
    symbol: string;
    price: number;
    volume: number;
    timestamp: number;
    source: 'bithumb.ws';
}
export interface WSConfig {
    wsUrl: string;
    restUrl: string;
    debounceMs: number;
    warmupMs: number;
    maxReconnectAttempts: number;
    reconnectIntervalMs: number;
    heartbeatIntervalMs: number;
    aggressiveMode: boolean;
    connectionTimeoutMs: number;
    messageBufferSize: number;
}
export declare class BithumbWSWatcher extends EventEmitter {
    private config;
    private tokenRegistry;
    private ws;
    private isRunning;
    private isConnected;
    private reconnectAttempts;
    private reconnectTimer;
    private warmupTimer;
    private debounceTimers;
    private doubleCheckTimers;
    private baseMutex;
    private heartbeatInterval;
    private isStopped;
    private messageBuffer;
    private bufferFlushInterval;
    private connectionStartTime;
    private lastMessageTime;
    private performanceMetrics;
    constructor(tokenRegistry: TokenRegistry, config?: Partial<WSConfig>);
    start(): Promise<void>;
    stop(): void;
    private connect;
    private setupWebSocket;
    private subscribeToKRWTickers;
    private processTicker;
    private extractBaseFromSymbol;
    private checkNewToken;
    private handleNewToken;
    private doubleCheckREST;
    private startWarmup;
    private startHeartbeat;
    private stopHeartbeat;
    private handleReconnection;
    private disconnect;
    private cleanupTimers;
    private startMessageBuffer;
    private stopMessageBuffer;
    private processMessageBatch;
    private handleWebSocketMessage;
    private processWebSocketMessage;
    getPerformanceMetrics(): {
        bufferSize: number;
        isConnected: boolean;
        reconnectAttempts: number;
        lastMessageAge: number;
        messagesProcessed: number;
        tokensDetected: number;
        avgProcessingTime: number;
        connectionUptime: number;
    };
    getStatus(): {
        isRunning: boolean;
        isConnected: boolean;
        reconnectAttempts: number;
        config: WSConfig;
    };
    forceReconnect(): Promise<void>;
}
