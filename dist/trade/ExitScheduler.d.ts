/**
 * ExitScheduler - Gestion des sorties automatiques +180s
 *
 * Conforme au super prompt Bithumb-only :
 * - Exit +180s persistant (scheduler persistant)
 * - Reduce-only pour éviter les positions inverses
 * - Reprise des exits en attente au boot
 */
export interface ScheduledExit {
    id: string;
    exchange: string;
    symbol: string;
    size: number;
    dueAt: number;
    status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    createdAt: number;
    updatedAt: number;
    metadata?: {
        entryPrice?: number;
        entryTime?: number;
        originalOrderId?: string;
        reason?: string;
    };
}
export interface ExitSchedulerConfig {
    checkIntervalMs: number;
    maxRetries: number;
    retryDelayMs: number;
    batchSize: number;
}
export declare class ExitScheduler {
    private static instance;
    private config;
    private scheduledExits;
    private checkTimer;
    private isRunning;
    private exitHandlers;
    private constructor();
    static getInstance(config?: Partial<ExitSchedulerConfig>): ExitScheduler;
    /**
     * Initialise le scheduler avec la base de données et l'adaptateur Hyperliquid
     */
    initialize(db: any, hyperliquidAdapter: any): Promise<void>;
    /**
     * Démarre le scheduler
     */
    start(): void;
    /**
     * Arrête le scheduler
     */
    stop(): void;
    /**
     * Démarre le timer de vérification
     */
    private startCheckTimer;
    /**
     * Planifie une sortie
     */
    scheduleExit(exchange: string, symbol: string, size: number, delayMs?: number, // 180s par défaut
    metadata?: ScheduledExit['metadata']): string;
    /**
     * Annule une sortie planifiée
     */
    cancelExit(exitId: string): boolean;
    /**
     * Enregistre un handler pour un exchange
     */
    registerExitHandler(exchange: string, handler: (exit: ScheduledExit) => Promise<boolean>): void;
    /**
     * Traite les sorties dues
     */
    private processDueExits;
    /**
     * Traite un batch d'exits
     */
    private processExitBatch;
    /**
     * Exécute une sortie
     */
    private executeExit;
    /**
     * Charge les exits depuis la base de données
     */
    loadPendingExits(): Promise<void>;
    /**
     * Sauvegarde un exit dans la base de données
     */
    saveExit(exit: ScheduledExit): Promise<void>;
    /**
     * Obtient les statistiques des exits
     */
    getStats(): {
        total: number;
        pending: number;
        executing: number;
        completed: number;
        failed: number;
        cancelled: number;
        nextDueIn: number | null;
    };
    /**
     * Obtient tous les exits
     */
    getAllExits(): ScheduledExit[];
    /**
     * Obtient un exit par ID
     */
    getExit(exitId: string): ScheduledExit | null;
    /**
     * Nettoie les anciens exits
     */
    cleanupOldExits(maxAgeHours?: number): number;
    /**
     * Divise un tableau en chunks
     */
    private chunkArray;
    /**
     * Getters pour le monitoring
     */
    getStatus(): {
        isRunning: boolean;
        config: ExitSchedulerConfig;
        stats: ReturnType<typeof ExitScheduler.prototype.getStats>;
    };
}
export declare const exitScheduler: ExitScheduler;
