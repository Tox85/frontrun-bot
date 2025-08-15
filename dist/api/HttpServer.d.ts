import { TokenRegistry } from '../store/TokenRegistry';
import { PerpCatalog } from '../store/PerpCatalog';
import { SingletonGuard } from '../core/SingletonGuard';
import { BithumbNoticePoller } from '../watchers/BithumbNoticePoller';
import { BithumbWSWatcher } from '../watchers/BithumbWSWatcher';
import { TelegramService } from '../notify/TelegramService';
import { TradeExecutor } from '../trade/TradeExecutor';
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
    private tokenRegistry;
    private perpCatalog;
    private singletonGuard;
    private noticePoller;
    private wsWatcher;
    private telegramService;
    private tradeExecutor;
    constructor(tokenRegistry: TokenRegistry, perpCatalog: PerpCatalog, singletonGuard: SingletonGuard, noticePoller: (BithumbNoticePoller | null) | undefined, wsWatcher: (BithumbWSWatcher | null) | undefined, telegramService: TelegramService, tradeExecutor?: TradeExecutor | null, config?: Partial<HttpServerConfig>);
    private setupMiddleware;
    private setupRoutes;
    private getHealthStatus;
    private getMetrics;
    private checkDatabaseHealth;
    private calculateLatencies;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): {
        isRunning: boolean;
        port: number;
        host: string;
        endpoints: string[];
    };
}
