import { Database } from 'sqlite3';
import { BaselineManager } from '../core/BaselineManager';
import { PerpCatalog } from '../store/PerpCatalog';
import { SingletonGuard } from '../core/SingletonGuard';
import { NoticeClient } from '../watchers/NoticeClient';
import { BithumbWSWatcher } from '../watchers/BithumbWSWatcher';
import { TelegramService } from '../notify/TelegramService';
import { TradeExecutor } from '../trade/TradeExecutor';
import { HealthMonitor } from '../core/HealthMonitor';
import { EventStore } from '../core/EventStore';
export interface HttpServerConfig {
    port: number;
    host: string;
    enableCors: boolean;
    enableLogging: boolean;
}
export declare class HttpServer {
    private app;
    private server;
    private config;
    private db;
    private baselineManager;
    private perpCatalog;
    private singletonGuard;
    private noticeClient;
    private wsWatcher;
    private telegramService;
    private tradeExecutor;
    private healthMonitor;
    private eventStore;
    private dashboardController;
    private unifiedMetrics;
    constructor(db: Database, baselineManager: BaselineManager | null, perpCatalog: PerpCatalog | null, singletonGuard: SingletonGuard, noticeClient: (NoticeClient | null) | undefined, wsWatcher: (BithumbWSWatcher | null) | undefined, telegramService: TelegramService, tradeExecutor: (TradeExecutor | null) | undefined, healthMonitor: (HealthMonitor | null) | undefined, eventStore: EventStore, config?: Partial<HttpServerConfig>);
    private setupMiddleware;
    private setupRoutes;
    private getHealthStatus;
    private getMetrics;
    incrementMetric(metric: keyof typeof this.unifiedMetrics): void;
    private getStatus;
    private getWhoami;
    private simulateNotice;
    private simulateWS;
    private simulateNotifyBurst;
    private getDatabaseSchema;
    start(): Promise<void>;
    stop(): Promise<void>;
}
