/**
 * Module de statistiques d'exécution du bot
 * Suit les métriques depuis le lancement
 */
export interface RunStats {
    startTime: Date;
    newListingsCount: number;
    totalNoticesProcessed: number;
    totalT0Events: number;
    lastListingTime: Date | null;
    uptimeMs: number;
}
export declare class RunStatsTracker {
    private startTime;
    private newListingsCount;
    private totalNoticesProcessed;
    private totalT0Events;
    private lastListingTime;
    private logInterval;
    private logIntervalMinutes;
    constructor(logIntervalMinutes?: number);
    /**
     * Incrémente le compteur de nouveaux listings
     */
    incrementNewListings(ticker: string): void;
    /**
     * Incrémente le compteur de notices traitées
     */
    incrementNoticesProcessed(): void;
    /**
     * Incrémente le compteur d'événements T0
     */
    incrementT0Events(): void;
    /**
     * Retourne les statistiques actuelles
     */
    getStats(): RunStats;
    /**
     * Retourne les statistiques formatées pour les endpoints
     */
    getFormattedStats(): Record<string, any>;
    /**
     * Démarre le logging périodique des statistiques
     */
    private startPeriodicLogging;
    /**
     * Arrête le tracker et nettoie les ressources
     */
    stop(): void;
    /**
     * Met à jour l'intervalle de logging
     */
    updateLogInterval(minutes: number): void;
}
/**
 * Obtient l'instance singleton du tracker
 */
export declare function getRunStatsTracker(logIntervalMinutes?: number): RunStatsTracker;
/**
 * Arrête le tracker singleton
 */
export declare function stopRunStatsTracker(): void;
