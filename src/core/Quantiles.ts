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

export class Quantiles {
  private static instance: Quantiles;
  private measurements: Map<string, LatencyMeasurement[]>;
  private maxMeasurements: number;
  private cleanupInterval: NodeJS.Timeout | null;

  private constructor() {
    this.measurements = new Map();
    this.maxMeasurements = 10000; // Garder max 10k mesures par opération
    this.cleanupInterval = null;
    
    // Démarrer le nettoyage automatique
    this.startCleanup();
  }

  static getInstance(): Quantiles {
    if (!Quantiles.instance) {
      Quantiles.instance = new Quantiles();
    }
    return Quantiles.instance;
  }

  /**
   * Enregistre une mesure de latence
   */
  recordLatency(operation: string, value: number, exchange?: string, success: boolean = true): void {
    const key = this.getOperationKey(operation, exchange);
    
    if (!this.measurements.has(key)) {
      this.measurements.set(key, []);
    }

    const measurements = this.measurements.get(key)!;
    
    // Ajouter la nouvelle mesure
    measurements.push({
      timestamp: Date.now(),
      value,
      operation,
      exchange,
      success
    });

    // Limiter le nombre de mesures
    if (measurements.length > this.maxMeasurements) {
      measurements.splice(0, measurements.length - this.maxMeasurements);
    }
  }

  /**
   * Calcule les statistiques pour une opération
   */
  getOperationStats(operation: string, exchange?: string, timeWindowMs?: number): QuantileStats | null {
    const key = this.getOperationKey(operation, exchange);
    const measurements = this.measurements.get(key);
    
    if (!measurements || measurements.length === 0) {
      return null;
    }

    // Filtrer par fenêtre de temps si spécifiée
    let filteredMeasurements = measurements;
    if (timeWindowMs) {
      const cutoff = Date.now() - timeWindowMs;
      filteredMeasurements = measurements.filter(m => m.timestamp >= cutoff);
      
      if (filteredMeasurements.length === 0) {
        return null;
      }
    }

    // Filtrer les succès uniquement pour les statistiques
    const successfulMeasurements = filteredMeasurements.filter(m => m.success);
    
    if (successfulMeasurements.length === 0) {
      return null;
    }

    // Extraire les valeurs
    const values = successfulMeasurements.map(m => m.value).sort((a, b) => a - b);
    
    return this.calculateQuantiles(values);
  }

  /**
   * Calcule les quantiles à partir d'un tableau de valeurs
   */
  private calculateQuantiles(values: number[]): QuantileStats {
    const count = values.length;
    const min = values[0] || 0;
    const max = values[count - 1] || 0;
    
    // Moyenne
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    
    // Médiane (p50)
    const median = this.getPercentile(values, 50);
    
    // Autres percentiles
    const p50 = this.getPercentile(values, 50);
    const p90 = this.getPercentile(values, 90);
    const p95 = this.getPercentile(values, 95);
    const p99 = this.getPercentile(values, 99);
    
    // Écart-type
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
      count,
      min,
      max,
      mean,
      median,
      p50,
      p90,
      p95,
      p99,
      stdDev
    };
  }

  /**
   * Calcule un percentile spécifique
   */
  private getPercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const index = (percentile / 100) * (values.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    
    if (lowerIndex === upperIndex) {
      return values[lowerIndex] || 0;
    }
    
    // Interpolation linéaire
    const lowerValue = values[lowerIndex];
    const upperValue = values[upperIndex];
    
    if (lowerValue === undefined || upperValue === undefined) {
      return 0;
    }
    
    const weight = index - lowerIndex;
    
    return lowerValue + weight * (upperValue - lowerValue);
  }

  /**
   * Obtient la clé d'opération
   */
  private getOperationKey(operation: string, exchange?: string): string {
    return exchange ? `${operation}:${exchange}` : operation;
  }

  /**
   * Mesure le temps d'exécution d'une opération asynchrone
   */
  async measureLatency<T>(
    operation: string,
    fn: () => Promise<T>,
    exchange?: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.recordLatency(operation, duration, exchange, true);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordLatency(operation, duration, exchange, false);
      throw error;
    }
  }

  /**
   * Mesure le temps d'exécution d'une opération synchrone
   */
  measureLatencySync<T>(
    operation: string,
    fn: () => T,
    exchange?: string
  ): T {
    const startTime = Date.now();
    
    try {
      const result = fn();
      const duration = Date.now() - startTime;
      
      this.recordLatency(operation, duration, exchange, true);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordLatency(operation, duration, exchange, false);
      throw error;
    }
  }

  /**
   * Obtient les statistiques de latence pour /health
   */
  getHealthLatencies(): {
    detectedToOrderSent: number;
    orderSentToAck: number;
    totalMeasurements: number;
  } {
    const detectedStats = this.getOperationStats('detected_to_order_sent') || null;
    const ackStats = this.getOperationStats('order_sent_to_ack') || null;
    
    return {
      detectedToOrderSent: detectedStats?.p95 || 0,
      orderSentToAck: ackStats?.p95 || 0,
      totalMeasurements: this.getTotalMeasurements()
    };
  }

  /**
   * Obtient le nombre total de mesures
   */
  private getTotalMeasurements(): number {
    let total = 0;
    for (const measurements of this.measurements.values()) {
      total += measurements.length;
    }
    return total;
  }

  /**
   * Nettoie les anciennes mesures
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMeasurements();
    }, 60000); // Nettoyage toutes les minutes
  }

  /**
   * Supprime les mesures anciennes
   */
  private cleanupOldMeasurements(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 heures
    
    for (const [key, measurements] of this.measurements) {
      const filtered = measurements.filter(m => m.timestamp >= cutoff);
      
      if (filtered.length === 0) {
        this.measurements.delete(key);
      } else if (filtered.length < measurements.length) {
        this.measurements.set(key, filtered);
      }
    }
    
    console.log(`🧹 Nettoyage des mesures de latence terminé`);
  }

  /**
   * Arrête le service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('🛑 Quantiles arrêté');
  }

  /**
   * Statistiques globales
   */
  getGlobalStats(): {
    totalOperations: number;
    totalMeasurements: number;
    operations: string[];
  } {
    const operations = Array.from(this.measurements.keys());
    let totalMeasurements = 0;
    
    for (const measurements of this.measurements.values()) {
      totalMeasurements += measurements.length;
    }

    return {
      totalOperations: operations.length,
      totalMeasurements,
      operations
    };
  }

  /**
   * Réinitialise toutes les mesures
   */
  reset(): void {
    this.measurements.clear();
    console.log('🔄 Toutes les mesures de latence ont été réinitialisées');
  }
}

// Export de l'instance singleton
export const quantiles = Quantiles.getInstance();
