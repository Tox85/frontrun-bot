"use strict";
// Système de métriques avancées avec agrégation et alertes automatiques
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedMetrics = void 0;
class AdvancedMetrics {
    logger;
    metrics = new Map();
    values = new Map();
    alertCallbacks = new Map();
    aggregationWindowMs = 60000; // 1 minute par défaut
    cleanupIntervalMs = 300000; // 5 minutes
    constructor(logger) {
        this.logger = logger;
        this.startCleanupTimer();
    }
    /**
     * Définir une nouvelle métrique
     */
    defineMetric(definition) {
        this.metrics.set(definition.name, definition);
        this.values.set(definition.name, []);
        this.logger.info(`Métrique définie: ${definition.name}`, {
            component: 'AdvancedMetrics',
            type: definition.type,
            labels: definition.labels
        });
    }
    /**
     * Enregistrer une valeur de métrique
     */
    recordMetric(name, value, labels = {}) {
        const definition = this.metrics.get(name);
        if (!definition) {
            this.logger.warn(`Tentative d'enregistrement d'une métrique non définie: ${name}`, {
                component: 'AdvancedMetrics'
            });
            return;
        }
        // Vérifier que tous les labels requis sont présents
        for (const requiredLabel of definition.labels) {
            if (!(requiredLabel in labels)) {
                this.logger.warn(`Label requis manquant pour la métrique ${name}: ${requiredLabel}`, {
                    component: 'AdvancedMetrics',
                    metric: name,
                    requiredLabels: definition.labels,
                    providedLabels: Object.keys(labels)
                });
                return;
            }
        }
        const metricValue = {
            value,
            timestamp: Date.now(),
            labels
        };
        this.values.get(name).push(metricValue);
        // Vérifier les seuils d'alerte
        this.checkAlertThresholds(name, value, definition);
        this.logger.debug(`Métrique enregistrée: ${name} = ${value}`, {
            component: 'AdvancedMetrics',
            metric: name,
            value,
            labels
        });
    }
    /**
     * Incrémenter un compteur
     */
    incrementCounter(name, increment = 1, labels = {}) {
        const currentValues = this.values.get(name) || [];
        const lastValue = currentValues.length > 0 ? currentValues[currentValues.length - 1]?.value || 0 : 0;
        this.recordMetric(name, lastValue + increment, labels);
    }
    /**
     * Définir une valeur de gauge
     */
    setGauge(name, value, labels = {}) {
        this.recordMetric(name, value, labels);
    }
    /**
     * Enregistrer une observation d'histogramme
     */
    observeHistogram(name, value, labels = {}) {
        this.recordMetric(name, value, labels);
    }
    /**
     * Obtenir les valeurs d'une métrique
     */
    getMetricValues(name, timeWindowMs) {
        const values = this.values.get(name) || [];
        if (!timeWindowMs) {
            return [...values];
        }
        const cutoff = Date.now() - timeWindowMs;
        return values.filter(v => v.timestamp >= cutoff);
    }
    /**
     * Obtenir l'agrégation d'une métrique
     */
    getMetricAggregation(name, timeWindowMs = this.aggregationWindowMs) {
        const values = this.getMetricValues(name, timeWindowMs);
        if (values.length === 0) {
            return null;
        }
        const numericValues = values.map(v => v.value).sort((a, b) => a - b);
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const avg = sum / numericValues.length;
        const min = numericValues[0];
        const max = numericValues[numericValues.length - 1];
        const count = numericValues.length;
        // Calcul des percentiles
        const p50Index = Math.floor(count * 0.5);
        const p95Index = Math.floor(count * 0.95);
        const p99Index = Math.floor(count * 0.99);
        return {
            min: min || 0,
            max: max || 0,
            avg,
            sum,
            count,
            p50: numericValues[p50Index] || 0,
            p95: numericValues[p95Index] || 0,
            p99: numericValues[p99Index] || 0
        };
    }
    /**
     * Obtenir toutes les métriques avec leurs agrégations
     */
    getAllMetrics() {
        const result = {};
        for (const [name, definition] of this.metrics.entries()) {
            const values = this.values.get(name) || [];
            const lastValue = values.length > 0 ? values[values.length - 1] : null;
            const aggregation = this.getMetricAggregation(name);
            result[name] = {
                definition,
                aggregation,
                lastValue
            };
        }
        return result;
    }
    /**
     * Exporter les métriques au format Prometheus
     */
    exportPrometheus() {
        let output = '';
        for (const [name, definition] of this.metrics.entries()) {
            const values = this.values.get(name) || [];
            if (values.length === 0)
                continue;
            // Ajouter la description
            output += `# HELP ${name} ${definition.description}\n`;
            if (definition.unit) {
                output += `# UNIT ${name} ${definition.unit}\n`;
            }
            // Grouper par labels
            const groupedByLabels = new Map();
            for (const value of values) {
                const labelString = Object.entries(value.labels)
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(',');
                const key = labelString || 'no_labels';
                if (!groupedByLabels.has(key)) {
                    groupedByLabels.set(key, []);
                }
                groupedByLabels.get(key).push(value);
            }
            // Exporter chaque groupe
            for (const [labelString, groupValues] of groupedByLabels.entries()) {
                const lastValue = groupValues[groupValues.length - 1];
                const labels = labelString !== 'no_labels' ? `{${labelString}}` : '';
                if (lastValue) {
                    output += `${name}${labels} ${lastValue.value} ${lastValue.timestamp}\n`;
                }
            }
        }
        return output;
    }
    /**
     * Vérifier les seuils d'alerte
     */
    checkAlertThresholds(name, value, definition) {
        const thresholds = definition.alertThresholds;
        if (!thresholds)
            return;
        if (thresholds.critical && value >= thresholds.critical) {
            this.triggerAlert(name, value, thresholds.critical, 'CRITICAL');
        }
        else if (thresholds.warning && value >= thresholds.warning) {
            this.triggerAlert(name, value, thresholds.warning, 'WARNING');
        }
    }
    /**
     * Déclencher une alerte
     */
    triggerAlert(metric, value, threshold, level) {
        const callback = this.alertCallbacks.get(metric);
        if (callback) {
            try {
                callback(metric, value, threshold);
            }
            catch (error) {
                this.logger.error('Erreur lors du déclenchement de l\'alerte', error, {
                    component: 'AdvancedMetrics',
                    metric,
                    value,
                    threshold
                });
            }
        }
        this.logger.warn(`Alerte ${level} déclenchée pour ${metric}: ${value} >= ${threshold}`, {
            component: 'AdvancedMetrics',
            metric,
            value,
            threshold,
            level
        });
    }
    /**
     * Enregistrer un callback d'alerte
     */
    onAlert(metric, callback) {
        this.alertCallbacks.set(metric, callback);
    }
    /**
     * Définir la fenêtre d'agrégation
     */
    setAggregationWindow(windowMs) {
        this.aggregationWindowMs = windowMs;
    }
    /**
     * Nettoyer les anciennes valeurs
     */
    cleanupOldValues() {
        const cutoff = Date.now() - (this.aggregationWindowMs * 2); // Garder 2x la fenêtre d'agrégation
        for (const [name, values] of this.values.entries()) {
            const filteredValues = values.filter(v => v.timestamp >= cutoff);
            this.values.set(name, filteredValues);
        }
        this.logger.debug('Nettoyage des anciennes valeurs de métriques terminé', {
            component: 'AdvancedMetrics'
        });
    }
    /**
     * Démarrer le timer de nettoyage
     */
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupOldValues();
        }, this.cleanupIntervalMs);
    }
    /**
     * Obtenir les statistiques du système de métriques
     */
    getStats() {
        let totalValues = 0;
        const metricsByType = {};
        let oldestTimestamp = Date.now();
        let newestTimestamp = 0;
        for (const [name, definition] of this.metrics.entries()) {
            const values = this.values.get(name) || [];
            totalValues += values.length;
            metricsByType[definition.type] = (metricsByType[definition.type] || 0) + 1;
            for (const value of values) {
                if (value.timestamp < oldestTimestamp)
                    oldestTimestamp = value.timestamp;
                if (value.timestamp > newestTimestamp)
                    newestTimestamp = value.timestamp;
            }
        }
        return {
            totalMetrics: this.metrics.size,
            totalValues,
            metricsByType,
            oldestValue: oldestTimestamp,
            newestValue: newestTimestamp
        };
    }
    /**
     * Arrêter le système de métriques
     */
    stop() {
        this.cleanupOldValues();
        this.logger.info('Système de métriques avancées arrêté', {
            component: 'AdvancedMetrics'
        });
    }
}
exports.AdvancedMetrics = AdvancedMetrics;
//# sourceMappingURL=AdvancedMetrics.js.map