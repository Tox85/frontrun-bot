"use strict";
// Service Telegram avancé avec alertes automatiques et gestion des priorités
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedTelegramService = exports.AlertType = exports.AlertPriority = void 0;
var AlertPriority;
(function (AlertPriority) {
    AlertPriority["LOW"] = "low";
    AlertPriority["MEDIUM"] = "medium";
    AlertPriority["HIGH"] = "high";
    AlertPriority["CRITICAL"] = "critical";
})(AlertPriority || (exports.AlertPriority = AlertPriority = {}));
var AlertType;
(function (AlertType) {
    AlertType["SYSTEM"] = "system";
    AlertType["PERFORMANCE"] = "performance";
    AlertType["SECURITY"] = "security";
    AlertType["TRADING"] = "trading";
    AlertType["ERROR"] = "error";
    AlertType["WARNING"] = "warning";
})(AlertType || (exports.AlertType = AlertType = {}));
class AdvancedTelegramService {
    telegramService;
    logger;
    alerts = new Map();
    alertRules = new Map();
    alertQueue = [];
    isProcessingQueue = false;
    maxAlertsPerMinute = 10;
    alertsThisMinute = 0;
    lastMinuteReset = Date.now();
    constructor(telegramService, logger) {
        this.telegramService = telegramService;
        this.logger = logger;
        this.setupDefaultAlertRules();
        this.startQueueProcessor();
    }
    /**
     * Configurer les règles d'alerte par défaut
     */
    setupDefaultAlertRules() {
        // Règle pour les erreurs de circuit-breaker
        this.addAlertRule({
            id: 'circuit_breaker_open',
            name: 'Circuit Breaker Ouvert',
            type: AlertType.SYSTEM,
            priority: AlertPriority.HIGH,
            condition: (data) => data.circuitBreakerState === 'OPEN',
            message: '🚨 Circuit-breaker ouvert pour {component} - {errors} erreurs détectées',
            enabled: true,
            cooldownMs: 300000 // 5 minutes
        });
        // Règle pour les erreurs de performance
        this.addAlertRule({
            id: 'high_latency',
            name: 'Latence Élevée',
            type: AlertType.PERFORMANCE,
            priority: AlertPriority.MEDIUM,
            condition: (data) => data.latencyMs > 5000,
            message: '⚠️ Latence élevée détectée: {latencyMs}ms pour {operation}',
            enabled: true,
            cooldownMs: 600000 // 10 minutes
        });
        // Règle pour les erreurs de sécurité
        this.addAlertRule({
            id: 'security_violation',
            name: 'Violation de Sécurité',
            type: AlertType.SECURITY,
            priority: AlertPriority.CRITICAL,
            condition: (data) => data.securityEvent === true,
            message: '🚨 VIOLATION DE SÉCURITÉ: {description}',
            enabled: true,
            cooldownMs: 0 // Pas de cooldown pour la sécurité
        });
        // Règle pour les erreurs de trading
        this.addAlertRule({
            id: 'trading_error',
            name: 'Erreur de Trading',
            type: AlertType.TRADING,
            priority: AlertPriority.HIGH,
            condition: (data) => data.tradingError === true,
            message: '💸 Erreur de trading: {error} pour {symbol}',
            enabled: true,
            cooldownMs: 300000 // 5 minutes
        });
    }
    /**
     * Ajouter une règle d'alerte
     */
    addAlertRule(rule) {
        this.alertRules.set(rule.id, rule);
        this.logger.info(`Règle d'alerte ajoutée: ${rule.name}`, { component: 'AdvancedTelegramService' });
    }
    /**
     * Déclencher une alerte selon les règles
     */
    triggerAlert(ruleId, data) {
        const rule = this.alertRules.get(ruleId);
        if (!rule || !rule.enabled) {
            return;
        }
        // Vérifier le cooldown
        if (rule.cooldownMs > 0 && rule.lastTriggered) {
            const timeSinceLastTrigger = Date.now() - rule.lastTriggered;
            if (timeSinceLastTrigger < rule.cooldownMs) {
                return;
            }
        }
        // Vérifier la condition
        if (!rule.condition(data)) {
            return;
        }
        // Créer l'alerte
        const alert = {
            id: `${ruleId}_${Date.now()}`,
            type: rule.type,
            priority: rule.priority,
            title: rule.name,
            message: this.formatMessage(rule.message, data),
            context: data,
            timestamp: new Date(),
            acknowledged: false
        };
        // Ajouter à la queue
        this.addAlertToQueue(alert);
        // Mettre à jour le timestamp de déclenchement
        rule.lastTriggered = Date.now();
        this.logger.info(`Alerte déclenchée: ${rule.name}`, {
            component: 'AdvancedTelegramService',
            alertId: alert.id,
            priority: alert.priority
        });
    }
    /**
     * Ajouter une alerte à la queue
     */
    addAlertToQueue(alert) {
        // Vérifier la limite par minute
        const now = Date.now();
        if (now - this.lastMinuteReset > 60000) {
            this.alertsThisMinute = 0;
            this.lastMinuteReset = now;
        }
        if (this.alertsThisMinute >= this.maxAlertsPerMinute) {
            this.logger.warn('Limite d\'alertes par minute atteinte', {
                component: 'AdvancedTelegramService',
                alertId: alert.id
            });
            return;
        }
        this.alerts.set(alert.id, alert);
        this.alertQueue.push(alert);
        this.alertsThisMinute++;
        // Traiter la queue si pas déjà en cours
        if (!this.isProcessingQueue) {
            this.processAlertQueue();
        }
    }
    /**
     * Traiter la queue d'alertes
     */
    async processAlertQueue() {
        if (this.isProcessingQueue || this.alertQueue.length === 0) {
            return;
        }
        this.isProcessingQueue = true;
        try {
            while (this.alertQueue.length > 0) {
                const alert = this.alertQueue.shift();
                await this.sendAlert(alert);
                // Attendre entre les envois pour respecter les limites de rate
                await this.sleep(1000);
            }
        }
        catch (error) {
            this.logger.error('Erreur lors du traitement de la queue d\'alertes', error, {
                component: 'AdvancedTelegramService'
            });
        }
        finally {
            this.isProcessingQueue = false;
        }
    }
    /**
     * Envoyer une alerte via Telegram
     */
    async sendAlert(alert) {
        try {
            const message = this.formatAlertMessage(alert);
            // Ajouter des emojis selon la priorité
            const priorityEmoji = {
                [AlertPriority.LOW]: 'ℹ️',
                [AlertPriority.MEDIUM]: '⚠️',
                [AlertPriority.HIGH]: '🚨',
                [AlertPriority.CRITICAL]: '💥'
            };
            const formattedMessage = `${priorityEmoji[alert.priority]} **${alert.title}**\n\n${message}`;
            await this.telegramService.sendMessage(formattedMessage);
            this.logger.info(`Alerte envoyée: ${alert.title}`, {
                component: 'AdvancedTelegramService',
                alertId: alert.id,
                priority: alert.priority
            });
        }
        catch (error) {
            this.logger.error('Erreur lors de l\'envoi de l\'alerte', error, {
                component: 'AdvancedTelegramService',
                alertId: alert.id
            });
        }
    }
    /**
     * Formater le message d'alerte
     */
    formatAlertMessage(alert) {
        let message = alert.message;
        // Ajouter le contexte
        if (Object.keys(alert.context).length > 0) {
            message += '\n\n**Contexte:**\n';
            for (const [key, value] of Object.entries(alert.context)) {
                if (typeof value === 'object') {
                    message += `• ${key}: ${JSON.stringify(value)}\n`;
                }
                else {
                    message += `• ${key}: ${value}\n`;
                }
            }
        }
        // Ajouter le timestamp
        message += `\n**Timestamp:** ${alert.timestamp.toISOString()}`;
        message += `\n**Priorité:** ${alert.priority.toUpperCase()}`;
        return message;
    }
    /**
     * Formater un message avec des variables
     */
    formatMessage(template, data) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? String(data[key]) : match;
        });
    }
    /**
     * Démarrer le processeur de queue
     */
    startQueueProcessor() {
        // Traiter la queue toutes les 30 secondes
        setInterval(() => {
            if (this.alertQueue.length > 0 && !this.isProcessingQueue) {
                this.processAlertQueue();
            }
        }, 30000);
    }
    /**
     * Obtenir les statistiques des alertes
     */
    getAlertStats() {
        const stats = {
            totalAlerts: this.alerts.size,
            alertsByPriority: {},
            alertsByType: {},
            queueLength: this.alertQueue.length,
            alertsThisMinute: this.alertsThisMinute
        };
        // Compter par priorité
        for (const alert of this.alerts.values()) {
            stats.alertsByPriority[alert.priority] = (stats.alertsByPriority[alert.priority] || 0) + 1;
            stats.alertsByType[alert.type] = (stats.alertsByType[alert.type] || 0) + 1;
        }
        return stats;
    }
    /**
     * Acknowledger une alerte
     */
    acknowledgeAlert(alertId, acknowledgedBy) {
        const alert = this.alerts.get(alertId);
        if (!alert) {
            return false;
        }
        alert.acknowledged = true;
        alert.acknowledgedBy = acknowledgedBy;
        alert.acknowledgedAt = new Date();
        this.logger.info(`Alerte acknowledgée: ${alert.title}`, {
            component: 'AdvancedTelegramService',
            alertId,
            acknowledgedBy
        });
        return true;
    }
    /**
     * Nettoyer les anciennes alertes
     */
    cleanupOldAlerts(maxAgeHours = 24) {
        const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        const toRemove = [];
        for (const [id, alert] of this.alerts.entries()) {
            if (alert.timestamp.getTime() < cutoff) {
                toRemove.push(id);
            }
        }
        toRemove.forEach(id => this.alerts.delete(id));
        if (toRemove.length > 0) {
            this.logger.info(`${toRemove.length} anciennes alertes nettoyées`, {
                component: 'AdvancedTelegramService'
            });
        }
    }
    /**
     * Arrêter le service
     */
    stop() {
        this.cleanupOldAlerts();
        this.logger.info('Service Telegram avancé arrêté', {
            component: 'AdvancedTelegramService'
        });
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.AdvancedTelegramService = AdvancedTelegramService;
//# sourceMappingURL=AdvancedTelegramService.js.map