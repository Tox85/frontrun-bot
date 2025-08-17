import { StructuredLogger } from './StructuredLogger';
export interface MetricValue {
    value: number;
    timestamp: number;
    labels: Record<string, string>;
}
export interface MetricDefinition {
    name: string;
    type: 'counter' | 'gauge' | 'histogram' | 'summary';
    description: string;
    unit?: string;
    labels: string[];
    alertThresholds?: {
        warning?: number;
        critical?: number;
    };
}
export interface MetricAggregation {
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
    p50: number;
    p95: number;
    p99: number;
}
export declare class AdvancedMetrics {
    private logger;
    private metrics;
    private values;
    private alertCallbacks;
    private aggregationWindowMs;
    private cleanupIntervalMs;
    constructor(logger: StructuredLogger);
    /**
     * Définir une nouvelle métrique
     */
    defineMetric(definition: MetricDefinition): void;
    /**
     * Enregistrer une valeur de métrique
     */
    recordMetric(name: string, value: number, labels?: Record<string, string>): void;
    /**
     * Incrémenter un compteur
     */
    incrementCounter(name: string, increment?: number, labels?: Record<string, string>): void;
    /**
     * Définir une valeur de gauge
     */
    setGauge(name: string, value: number, labels?: Record<string, string>): void;
    /**
     * Enregistrer une observation d'histogramme
     */
    observeHistogram(name: string, value: number, labels?: Record<string, string>): void;
    /**
     * Obtenir les valeurs d'une métrique
     */
    getMetricValues(name: string, timeWindowMs?: number): MetricValue[];
    /**
     * Obtenir l'agrégation d'une métrique
     */
    getMetricAggregation(name: string, timeWindowMs?: number): MetricAggregation | null;
    /**
     * Obtenir toutes les métriques avec leurs agrégations
     */
    getAllMetrics(): Record<string, {
        definition: MetricDefinition;
        aggregation: MetricAggregation | null;
        lastValue: MetricValue | null;
    }>;
    /**
     * Exporter les métriques au format Prometheus
     */
    exportPrometheus(): string;
    /**
     * Vérifier les seuils d'alerte
     */
    private checkAlertThresholds;
    /**
     * Déclencher une alerte
     */
    private triggerAlert;
    /**
     * Enregistrer un callback d'alerte
     */
    onAlert(metric: string, callback: (metric: string, value: number, threshold: number) => void): void;
    /**
     * Définir la fenêtre d'agrégation
     */
    setAggregationWindow(windowMs: number): void;
    /**
     * Nettoyer les anciennes valeurs
     */
    private cleanupOldValues;
    /**
     * Démarrer le timer de nettoyage
     */
    private startCleanupTimer;
    /**
     * Obtenir les statistiques du système de métriques
     */
    getStats(): {
        totalMetrics: number;
        totalValues: number;
        metricsByType: Record<string, number>;
        oldestValue: number;
        newestValue: number;
    };
    /**
     * Arrêter le système de métriques
     */
    stop(): void;
}
