import { AdvancedMetrics } from '../core/AdvancedMetrics';
import { StructuredLogger } from '../core/StructuredLogger';
export interface DashboardData {
    system: {
        uptime: number;
        memory: NodeJS.MemoryUsage;
        version: string;
    };
    bot: {
        status: string;
        leaderInstanceId: string;
        tradingEnabled: boolean;
    };
    metrics: {
        totalMetrics: number;
        totalValues: number;
    };
    timestamp: number;
}
export declare class DashboardController {
    private metrics;
    private logger;
    private startTime;
    constructor(metrics: AdvancedMetrics, logger: StructuredLogger);
    /**
     * Obtenir les données du dashboard
     */
    getDashboardData(): DashboardData;
    /**
     * Données d'erreur
     */
    private getErrorData;
    /**
     * HTML du dashboard
     */
    getDashboardHTML(): string;
}
