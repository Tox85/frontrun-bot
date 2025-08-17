import { TelegramService } from './TelegramService';
import { StructuredLogger } from '../core/StructuredLogger';
export declare enum AlertPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum AlertType {
    SYSTEM = "system",
    PERFORMANCE = "performance",
    SECURITY = "security",
    TRADING = "trading",
    ERROR = "error",
    WARNING = "warning"
}
export interface Alert {
    id: string;
    type: AlertType;
    priority: AlertPriority;
    title: string;
    message: string;
    context: Record<string, any>;
    timestamp: Date;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
}
export interface AlertRule {
    id: string;
    name: string;
    type: AlertType;
    priority: AlertPriority;
    condition: (data: any) => boolean;
    message: string;
    enabled: boolean;
    cooldownMs: number;
    lastTriggered?: number;
}
export declare class AdvancedTelegramService {
    private telegramService;
    private logger;
    private alerts;
    private alertRules;
    private alertQueue;
    private isProcessingQueue;
    private maxAlertsPerMinute;
    private alertsThisMinute;
    private lastMinuteReset;
    constructor(telegramService: TelegramService, logger: StructuredLogger);
    /**
     * Configurer les règles d'alerte par défaut
     */
    private setupDefaultAlertRules;
    /**
     * Ajouter une règle d'alerte
     */
    addAlertRule(rule: AlertRule): void;
    /**
     * Déclencher une alerte selon les règles
     */
    triggerAlert(ruleId: string, data: any): void;
    /**
     * Ajouter une alerte à la queue
     */
    private addAlertToQueue;
    /**
     * Traiter la queue d'alertes
     */
    private processAlertQueue;
    /**
     * Envoyer une alerte via Telegram
     */
    private sendAlert;
    /**
     * Formater le message d'alerte
     */
    private formatAlertMessage;
    /**
     * Formater un message avec des variables
     */
    private formatMessage;
    /**
     * Démarrer le processeur de queue
     */
    private startQueueProcessor;
    /**
     * Obtenir les statistiques des alertes
     */
    getAlertStats(): {
        totalAlerts: number;
        alertsByPriority: Record<AlertPriority, number>;
        alertsByType: Record<AlertType, number>;
        queueLength: number;
        alertsThisMinute: number;
    };
    /**
     * Acknowledger une alerte
     */
    acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean;
    /**
     * Nettoyer les anciennes alertes
     */
    cleanupOldAlerts(maxAgeHours?: number): void;
    /**
     * Arrêter le service
     */
    stop(): void;
    private sleep;
}
