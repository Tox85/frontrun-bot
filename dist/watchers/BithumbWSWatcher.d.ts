import { Database } from 'sqlite3';
import { EventEmitter } from 'events';
import { EventStore } from '../core/EventStore';
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
    connectionTimeoutMs: number;
}
export declare class BithumbWSWatcher extends EventEmitter {
    private config;
    private db;
    private eventStore;
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
    private connectionStartTime;
    private lastMessageTime;
    private performanceMetrics;
    constructor(db: Database, eventStore: EventStore, config?: Partial<WSConfig>);
    start(): Promise<void>;
    stop(): void;
    private connect;
    private setupWebSocket;
    private subscribeToKRWTickers;
    private processTicker;
    private extractBaseFromSymbol;
    private checkNewToken;
    private handleNewToken;
    private performDoubleCheckREST;
    private doubleCheckREST;
    private generateEventId;
    private isInBaselineKR;
    private isInCooldown;
    private isEventProcessed;
    private addProcessedEvent;
    private addCooldown;
    private startWarmup;
    private startHeartbeat;
    private stopHeartbeat;
    private handleReconnection;
    private disconnect;
    private cleanupTimers;
    private handleWebSocketMessage;
    getMetrics(): any;
}
