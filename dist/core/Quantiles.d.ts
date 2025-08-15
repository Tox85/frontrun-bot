/**
 * Quantiles - Calcul des statistiques de latence
 *
 * Conforme au super prompt Bithumb-only :
 * - Calcul des latences p95 pour /health
 * - Mesure detected→order_sent et order_sent→ack
 * - Gestion des outliers et nettoyage des données
 */
export interface LatencyMeasurement {
    timestamp: number;
    value: number;
    operation: string;
    exchange: string | undefined;
    success: boolean;
}
export interface QuantileStats {
    count: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    stdDev: number;
}
export declare class Quantiles {
    private static instance;
    private measurements;
    private maxMeasurements;
    private cleanupInterval;
    private constructor();
    static getInstance(): Quantiles;
    /**
     * Enregistre une mesure de latence
     */
    recordLatency(operation: string, value: number, exchange?: string, success?: boolean): void;
    /**
     * Calcule les statistiques pour une opération
     */
    getOperationStats(operation: string, exchange?: string, timeWindowMs?: number): QuantileStats | null;
    /**
     * Calcule les quantiles à partir d'un tableau de valeurs
     */
    private calculateQuantiles;
    /**
     * Calcule un percentile spécifique
     */
    private getPercentile;
    /**
     * Obtient la clé d'opération
     */
    private getOperationKey;
    /**
     * Mesure le temps d'exécution d'une opération asynchrone
     */
    measureLatency<T>(operation: string, fn: () => Promise<T>, exchange?: string): Promise<T>;
    /**
     * Mesure le temps d'exécution d'une opération synchrone
     */
    measureLatencySync<T>(operation: string, fn: () => T, exchange?: string): T;
    /**
     * Obtient les statistiques de latence pour /health
     */
    getHealthLatencies(): {
        detectedToOrderSent: number;
        orderSentToAck: number;
        totalMeasurements: number;
    };
    /**
     * Obtient le nombre total de mesures
     */
    private getTotalMeasurements;
    /**
     * Nettoie les anciennes mesures
     */
    private startCleanup;
    /**
     * Supprime les mesures anciennes
     */
    private cleanupOldMeasurements;
    /**
     * Arrête le service
     */
    stop(): void;
    /**
     * Statistiques globales
     */
    getGlobalStats(): {
        totalOperations: number;
        totalMeasurements: number;
        operations: string[];
    };
    /**
     * Réinitialise toutes les mesures
     */
    reset(): void;
}
export declare const quantiles: Quantiles;
