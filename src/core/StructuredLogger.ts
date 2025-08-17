// Système de logs structurés avec niveaux et contexte

export enum LogLevel {
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

export class StructuredLogger {
  private logLevel: LogLevel;
  private enableConsole: boolean;
  private enableFile: boolean;
  private logFilePath: string;
  private maxFileSize: number;
  private maxFiles: number;
  private performanceMetrics: Map<string, number> = new Map();

  constructor(
    logLevel: LogLevel = LogLevel.INFO,
    enableConsole: boolean = true,
    enableFile: boolean = false,
    logFilePath: string = './logs/bot.log',
    maxFileSize: number = 10 * 1024 * 1024, // 10MB
    maxFiles: number = 5
  ) {
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
  debug(message: string, context: LogContext = {}): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log de niveau INFO
   */
  info(message: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log de niveau WARN
   */
  warn(message: string, context: LogContext = {}): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log de niveau ERROR
   */
  error(message: string, error?: Error, context: LogContext = {}): void {
    this.log(LogLevel.ERROR, message, { ...context, error });
  }

  /**
   * Log de niveau FATAL
   */
  fatal(message: string, error?: Error, context: LogContext = {}): void {
    this.log(LogLevel.FATAL, message, { ...context, error });
  }

  /**
   * Démarrer le chronométrage d'une opération
   */
  startTimer(operation: string): void {
    this.performanceMetrics.set(operation, Date.now());
  }

  /**
   * Arrêter le chronométrage et log avec la durée
   */
  endTimer(operation: string, message: string, context: LogContext = {}): void {
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
  private log(level: LogLevel, message: string, context: LogContext): void {
    if (level < this.logLevel) {
      return;
    }

    const logEntry: LogEntry = {
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
  private formatLog(logEntry: LogEntry): string {
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
  private writeToConsole(level: LogLevel, message: string): void {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.FATAL]: '\x1b[35m'  // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[level] || '';
    
    console.log(`${color}${message}${reset}`);
  }

  /**
   * Écrire dans le fichier
   */
  private writeToFile(message: string): void {
    // TODO: Implémenter la rotation des logs et l'écriture fichier
    // Pour l'instant, on utilise console.log
    console.log(`[FILE] ${message}`);
  }

  /**
   * S'assurer que le répertoire de logs existe
   */
  private ensureLogDirectory(): void {
    // TODO: Implémenter la création du répertoire de logs
  }

  /**
   * Changer le niveau de log dynamiquement
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Obtenir les statistiques de performance
   */
  getPerformanceStats(): Map<string, number> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Nettoyer les métriques de performance
   */
  clearPerformanceMetrics(): void {
    this.performanceMetrics.clear();
  }
}
