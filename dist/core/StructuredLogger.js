"use strict";
// Système de logs structurés avec niveaux et contexte
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class StructuredLogger {
    logLevel;
    enableConsole;
    enableFile;
    logFilePath;
    maxFileSize;
    maxFiles;
    performanceMetrics = new Map();
    constructor(logLevel = LogLevel.INFO, enableConsole = true, enableFile = false, logFilePath = './logs/bot.log', maxFileSize = 10 * 1024 * 1024, // 10MB
    maxFiles = 5) {
        this.logLevel = logLevel;
        this.enableConsole = enableConsole;
        this.enableFile = enableFile;
        this.logFilePath = logFilePath;
        this.maxFileSize = maxFileSize;
        this.maxFiles = maxFiles;
        if (this.enableFile) {
            this.ensureLogDirectory();
        }
    }
    /**
     * Log de niveau DEBUG
     */
    debug(message, context = {}) {
        this.log(LogLevel.DEBUG, message, context);
    }
    /**
     * Log de niveau INFO
     */
    info(message, context = {}) {
        this.log(LogLevel.INFO, message, context);
    }
    /**
     * Log de niveau WARN
     */
    warn(message, context = {}) {
        this.log(LogLevel.WARN, message, context);
    }
    /**
     * Log de niveau ERROR
     */
    error(message, error, context = {}) {
        this.log(LogLevel.ERROR, message, { ...context, error });
    }
    /**
     * Log de niveau FATAL
     */
    fatal(message, error, context = {}) {
        this.log(LogLevel.FATAL, message, { ...context, error });
    }
    /**
     * Démarrer le chronométrage d'une opération
     */
    startTimer(operation) {
        this.performanceMetrics.set(operation, Date.now());
    }
    /**
     * Arrêter le chronométrage et log avec la durée
     */
    endTimer(operation, message, context = {}) {
        const startTime = this.performanceMetrics.get(operation);
        if (startTime) {
            const durationMs = Date.now() - startTime;
            const memoryUsage = process.memoryUsage().heapUsed;
            this.log(LogLevel.INFO, message, {
                ...context,
                performance: { durationMs, memoryUsage }
            });
            this.performanceMetrics.delete(operation);
        }
    }
    /**
     * Log principal avec formatage
     */
    log(level, message, context) {
        if (level < this.logLevel) {
            return;
        }
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: LogLevel[level],
            message,
            context: {
                ...context,
                pid: process.pid,
                memoryUsage: process.memoryUsage().heapUsed
            }
        };
        // Ajouter l'erreur si présente
        if (context.error) {
            logEntry.error = context.error;
        }
        // Ajouter les métriques de performance si présentes
        if (context.performance) {
            logEntry.performance = context.performance;
        }
        const formattedLog = this.formatLog(logEntry);
        // Console
        if (this.enableConsole) {
            this.writeToConsole(level, formattedLog);
        }
        // Fichier
        if (this.enableFile) {
            this.writeToFile(formattedLog);
        }
    }
    /**
     * Formater le log selon le niveau
     */
    formatLog(logEntry) {
        const { timestamp, level, message, context, error, performance } = logEntry;
        let formatted = `[${timestamp}] ${level}: ${message}`;
        if (Object.keys(context).length > 0) {
            formatted += ` | Context: ${JSON.stringify(context)}`;
        }
        if (error) {
            formatted += ` | Error: ${error.message}`;
            if (error.stack) {
                formatted += ` | Stack: ${error.stack}`;
            }
        }
        if (performance) {
            formatted += ` | Duration: ${performance.durationMs}ms | Memory: ${performance.memoryUsage} bytes`;
        }
        return formatted;
    }
    /**
     * Écrire dans la console avec couleurs
     */
    writeToConsole(level, message) {
        const colors = {
            [LogLevel.DEBUG]: '\x1b[36m', // Cyan
            [LogLevel.INFO]: '\x1b[32m', // Green
            [LogLevel.WARN]: '\x1b[33m', // Yellow
            [LogLevel.ERROR]: '\x1b[31m', // Red
            [LogLevel.FATAL]: '\x1b[35m' // Magenta
        };
        const reset = '\x1b[0m';
        const color = colors[level] || '';
        console.log(`${color}${message}${reset}`);
    }
    /**
     * Écrire dans le fichier
     */
    writeToFile(message) {
        // TODO: Implémenter la rotation des logs et l'écriture fichier
        // Pour l'instant, on utilise console.log
        console.log(`[FILE] ${message}`);
    }
    /**
     * S'assurer que le répertoire de logs existe
     */
    ensureLogDirectory() {
        // TODO: Implémenter la création du répertoire de logs
    }
    /**
     * Changer le niveau de log dynamiquement
     */
    setLogLevel(level) {
        this.logLevel = level;
    }
    /**
     * Obtenir les statistiques de performance
     */
    getPerformanceStats() {
        return new Map(this.performanceMetrics);
    }
    /**
     * Nettoyer les métriques de performance
     */
    clearPerformanceMetrics() {
        this.performanceMetrics.clear();
    }
}
exports.StructuredLogger = StructuredLogger;
//# sourceMappingURL=StructuredLogger.js.map