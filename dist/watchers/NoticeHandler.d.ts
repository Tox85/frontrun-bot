import { EventStore } from '../core/EventStore';
import { ProcessedNotice } from './NoticeClient';
import { BaselineManager } from '../core/BaselineManager';
import { PerpCatalog } from '../store/PerpCatalog';
import { TradeExecutor } from '../trade/TradeExecutor';
import { TelegramService } from '../notify/TelegramService';
export interface NoticeHandlerConfig {
    eventStore: EventStore;
    baselineManager: BaselineManager;
    perpCatalog: PerpCatalog;
    tradeExecutor: TradeExecutor;
    telegramService: TelegramService;
}
export declare class NoticeHandler {
    private config;
    constructor(config: NoticeHandlerConfig);
    /**
     * Traite une notice avec dédup idempotente et gating timing
     */
    handleNotice(notice: ProcessedNotice): Promise<void>;
}
