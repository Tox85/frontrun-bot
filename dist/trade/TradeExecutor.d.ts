import { HyperliquidAdapter } from '../exchanges/HyperliquidAdapter';
import { ExitScheduler } from './ExitScheduler';
import { PositionSizer } from './PositionSizer';
import { TokenRegistry } from '../store/TokenRegistry';
import { PerpCatalog } from '../store/PerpCatalog';
import { TelegramService } from '../notify/TelegramService';
export interface TradeConfig {
    riskPct: number;
    leverageTarget: number;
    cooldownHours: number;
    dryRun: boolean;
}
export interface TradeResult {
    success: boolean;
    token: string;
    action: 'BUY' | 'SELL';
    amount: number;
    price: number;
    leverage: number;
    positionId?: string;
    error?: string;
    timestamp: string;
}
export interface TradeOpportunity {
    token: string;
    source: 'T0_NOTICE' | 'T2_WEBSOCKET';
    timestamp: string;
    price?: number;
    volume?: number;
}
export declare class TradeExecutor {
    private hyperliquid;
    private exitScheduler;
    private positionSizer;
    private tokenRegistry;
    private perpCatalog;
    private telegramService;
    private config;
    private activeTrades;
    private cooldowns;
    constructor(hyperliquid: HyperliquidAdapter, exitScheduler: ExitScheduler, positionSizer: PositionSizer, tokenRegistry: TokenRegistry, perpCatalog: PerpCatalog, telegramService: TelegramService, config: TradeConfig);
    /**
     * Exécute un trade d'opportunité (T0 ou T2)
     */
    executeOpportunity(opportunity: TradeOpportunity): Promise<TradeResult | null>;
    /**
     * Exécute une position longue sur Hyperliquid
     */
    private executeLongPosition;
    /**
     * Programme la sortie de position
     */
    private scheduleExit;
    /**
     * Vérifie si un token est en cooldown
     */
    private isInCooldown;
    /**
     * Définit le cooldown pour un token
     */
    private setCooldown;
    /**
     * Notifie le succès d'un trade
     */
    private notifyTradeSuccess;
    /**
     * Notifie l'erreur d'un trade
     */
    private notifyTradeError;
    /**
     * Obtient le statut des trades actifs
     */
    getActiveTrades(): Map<string, TradeResult>;
    /**
     * Obtient le statut des cooldowns
     */
    getCooldownStatus(): {
        token: string;
        cooldownUntil: string;
        remainingMs: number;
    }[];
    /**
     * Arrête l'exécuteur de trades
     */
    stop(): Promise<void>;
}
