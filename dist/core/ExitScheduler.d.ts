/**
 * Système de sortie programmée pour les positions
 * Basé sur les spécifications du prompt Cursor
 */
import { ScheduledExit, TradeExecution } from '../types/listing';
export declare class ExitScheduler {
    private onExitDue;
    private checkIntervalMs;
    private scheduledExits;
    private workerInterval;
    private isRunning;
    constructor(onExitDue: (exit: ScheduledExit) => Promise<void>, checkIntervalMs?: number);
    /**
     * Démarre le worker de sortie
     */
    start(): void;
    /**
     * Arrête le worker de sortie
     */
    stop(): void;
    /**
     * Programme une sortie pour une position
     */
    scheduleExit(trade: TradeExecution, exitDelayMinutes?: number): string;
    /**
     * Annule une sortie programmée
     */
    cancelExit(exitId: string): boolean;
    /**
     * Vérifie les sorties programmées
     */
    private checkScheduledExits;
    /**
     * Nettoie les anciennes sorties
     */
    private cleanupOldExits;
    /**
     * Obtient le statut du scheduler
     */
    getStatus(): {
        isRunning: boolean;
        totalScheduled: number;
        pendingExits: number;
        nextExitIn: string | null;
    };
    /**
     * Formate le temps restant jusqu'à une sortie
     */
    private formatTimeUntil;
    /**
     * Obtient toutes les sorties programmées
     */
    getAllScheduledExits(): ScheduledExit[];
    /**
     * Force la sortie immédiate d'une position
     */
    forceImmediateExit(eventId: string): boolean;
}
