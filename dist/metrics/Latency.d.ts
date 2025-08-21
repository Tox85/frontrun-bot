/**
 * Latency - Métriques de latence haute précision (ms)
 * Utilise process.hrtime.bigint() pour une précision nanoseconde
 * Estimateur P² pour p95/p99 sans stockage de toutes les valeurs
 */
export type LatencyLabel = 't0_fetch_done' | 't0_detected' | 'dedup_inserted' | 'order_sent' | 'order_ack';
export interface LatencyFlow {
    flowId: string;
    startTime: bigint;
    marks: Map<LatencyLabel, bigint>;
}
export interface LatencyMetrics {
    t0_fetch_p95_ms: number;
    t0_detect_to_insert_p95_ms: number;
    t0_insert_to_order_p95_ms: number;
    t0_order_to_ack_p95_ms: number;
    t0_new_total: number;
    t0_dup_total: number;
    t0_future_total: number;
    t0_stale_total: number;
    t0_slow_warnings_total: number;
}
export declare class Latency {
    private flows;
    private quantiles;
    private counters;
    private readonly thresholds;
    constructor();
    /**
     * Commence un nouveau flow de latence (idempotent)
     */
    begin(flowId: string): void;
    /**
     * Commence un flow seulement s'il n'existe pas (idempotent)
     */
    beginIfAbsent(flowId: string): void;
    /**
     * Marque un point dans le flow de latence
     */
    mark(flowId: string, label: LatencyLabel): void;
    /**
     * Calcule les deltas de latence et nourrit les estimateurs
     */
    private calculateDeltas;
    /**
     * Calcule la différence entre deux timestamps en millisecondes
     */
    private calculateDelta;
    /**
     * Incrémente un compteur
     */
    incrementCounter(counter: keyof typeof this.counters): void;
    /**
     * Getters pour les métriques
     */
    getT0FetchP95Ms(): number;
    getT0DetectToInsertP95Ms(): number;
    getT0InsertToOrderP95Ms(): number;
    getT0OrderToAckP95Ms(): number;
    getT0NewTotal(): number;
    getT0DupTotal(): number;
    getT0FutureTotal(): number;
    getT0StaleTotal(): number;
    getT0SlowWarningsTotal(): number;
    /**
     * Récupère toutes les métriques
     */
    getMetrics(): LatencyMetrics;
    /**
     * Nettoie les flows terminés
     */
    cleanupFlow(flowId: string): void;
    /**
     * Nettoie tous les flows (pour éviter la fuite mémoire)
     */
    cleanupAllFlows(): void;
    /**
     * Reset des compteurs (pour les tests)
     */
    resetCounters(): void;
}
export declare const latency: Latency;
