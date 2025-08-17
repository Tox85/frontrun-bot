export interface ParsedMetrics {
    [key: string]: number;
}
export declare class MetricsParser {
    /**
     * Parse les métriques Prometheus et extrait les valeurs numériques
     */
    static parse(metricsText: string): ParsedMetrics;
    /**
     * Parse les métriques depuis une réponse JSON (format alternatif)
     */
    static parseFromJSON(metricsData: any): ParsedMetrics;
    /**
     * Vérifie la présence de métriques requises
     */
    static validateRequiredMetrics(metrics: ParsedMetrics, required: string[]): string[];
    /**
     * Obtient la valeur d'une métrique avec fallback
     */
    static getMetric(metrics: ParsedMetrics, name: string, fallback?: number): number;
}
