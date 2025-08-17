// Parser de métriques Prometheus

export interface ParsedMetrics {
  [key: string]: number;
}

export class MetricsParser {
  /**
   * Parse les métriques Prometheus et extrait les valeurs numériques
   */
  static parse(metricsText: string): ParsedMetrics {
    const result: ParsedMetrics = {};
    
    const lines = metricsText.split('\n');
    
    for (const line of lines) {
      // Ignorer les commentaires et lignes vides
      if (line.startsWith('#') || line.trim() === '') {
        continue;
      }
      
      // Parser les lignes de métriques
      // Format: metric_name{label="value"} value
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{[^}]*\})?\s+([0-9.]+)$/);
      
      if (match && match[1] && match[2]) {
        const metricName = match[1];
        const valueStr = match[2];
        const value = parseFloat(valueStr);
        
        if (!isNaN(value)) {
          result[metricName] = value;
        }
      }
    }
    
    return result;
  }

  /**
   * Parse les métriques depuis une réponse JSON (format alternatif)
   */
  static parseFromJSON(metricsData: any): ParsedMetrics {
    const result: ParsedMetrics = {};
    
    // Extraire les métriques de différents formats possibles
    if (metricsData.unified) {
      Object.entries(metricsData.unified).forEach(([key, value]) => {
        if (typeof value === 'number') {
          result[key] = value;
        }
      });
    }
    
    if (metricsData.baseline) {
      Object.entries(metricsData.baseline).forEach(([key, value]) => {
        if (typeof value === 'number') {
          result[`baseline_${key}`] = value;
        }
      });
    }
    
    if (metricsData.t0) {
      Object.entries(metricsData.t0).forEach(([key, value]) => {
        if (typeof value === 'number') {
          result[`t0_${key}`] = value;
        }
      });
    }
    
    if (metricsData.t2) {
      Object.entries(metricsData.t2).forEach(([key, value]) => {
        if (typeof value === 'number') {
          result[`t2_${key}`] = value;
        }
      });
    }
    
    return result;
  }

  /**
   * Vérifie la présence de métriques requises
   */
  static validateRequiredMetrics(metrics: ParsedMetrics, required: string[]): string[] {
    const missing: string[] = [];
    
    for (const metric of required) {
      if (metrics[metric] === undefined) {
        missing.push(metric);
      }
    }
    
    return missing;
  }

  /**
   * Obtient la valeur d'une métrique avec fallback
   */
  static getMetric(metrics: ParsedMetrics, name: string, fallback: number = 0): number {
    return metrics[name] ?? fallback;
  }
}
