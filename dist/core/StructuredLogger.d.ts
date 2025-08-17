export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4
}
export interface LogContext {
    component?: string;
    operation?: string;
    userId?: string;
    requestId?: string;
    correlationId?: string;
    [key: string]: any;
}
export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context: LogContext;
    error?: Error;
    performance?: {
        durationMs: number;
        memoryUsage: number;
    };
}
export declare class StructuredLogger {
    private logLevel;
    private enableConsole;
    private enableFile;
    private logFilePath;
    private maxFileSize;
    private maxFiles;
    private performanceMetrics;
    constructor(logLevel?: LogLevel, enableConsole?: boolean, enableFile?: boolean, logFilePath?: string, maxFileSize?: number, // 10MB
    maxFiles?: number);
    /**
     * Log de niveau DEBUG
     */
    debug(message: string, context?: LogContext): void;
    /**
     * Log de niveau INFO
     */
    info(message: string, context?: LogContext): void;
    /**
     * Log de niveau WARN
     */
    warn(message: string, context?: LogContext): void;
    /**
     * Log de niveau ERROR
     */
    error(message: string, error?: Error, context?: LogContext): void;
    /**
     * Log de niveau FATAL
     */
    fatal(message: string, error?: Error, context?: LogContext): void;
    /**
     * Démarrer le chronométrage d'une opération
     */
    startTimer(operation: string): void;
    /**
     * Arrêter le chronométrage et log avec la durée
     */
    endTimer(operation: string, message: string, context?: LogContext): void;
    /**
     * Log principal avec formatage
     */
    private log;
    /**
     * Formater le log selon le niveau
     */
    private formatLog;
    /**
     * Écrire dans la console avec couleurs
     */
    private writeToConsole;
    /**
     * Écrire dans le fichier
     */
    private writeToFile;
    /**
     * S'assurer que le répertoire de logs existe
     */
    private ensureLogDirectory;
    /**
     * Changer le niveau de log dynamiquement
     */
    setLogLevel(level: LogLevel): void;
    /**
     * Obtenir les statistiques de performance
     */
    getPerformanceStats(): Map<string, number>;
    /**
     * Nettoyer les métriques de performance
     */
    clearPerformanceMetrics(): void;
}
