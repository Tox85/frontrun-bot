/**
 * LogSink pour capturer et analyser les logs dans les tests
 * Permet de vérifier la discipline des logs (≤ 1 INFO/notice, DEBUG contrôlé)
 */

export interface LogEntry {
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
  timestamp: Date;
}

export class LogSink {
  private logs: LogEntry[] = [];
  private originalConsole: {
    log: typeof console.log;
    debug: typeof console.debug;
    warn: typeof console.warn;
    error: typeof console.error;
  };

  constructor() {
    this.originalConsole = {
      log: console.log,
      debug: console.debug,
      warn: console.warn,
      error: console.error
    };
  }

  /**
   * Active la capture des logs
   */
  start(): void {
    // Capturer console.log comme INFO
    console.log = (...args: any[]) => {
      this.logs.push({
        level: 'INFO',
        message: args.join(' '),
        timestamp: new Date()
      });
      this.originalConsole.log(...args);
    };

    // Capturer console.debug
    console.debug = (...args: any[]) => {
      this.logs.push({
        level: 'DEBUG',
        message: args.join(' '),
        timestamp: new Date()
      });
      this.originalConsole.debug(...args);
    };

    // Capturer console.warn
    console.warn = (...args: any[]) => {
      this.logs.push({
        level: 'WARN',
        message: args.join(' '),
        timestamp: new Date()
      });
      this.originalConsole.warn(...args);
    };

    // Capturer console.error
    console.error = (...args: any[]) => {
      this.logs.push({
        level: 'ERROR',
        message: args.join(' '),
        timestamp: new Date()
      });
      this.originalConsole.error(...args);
    };
  }

  /**
   * Arrête la capture des logs
   */
  stop(): void {
    console.log = this.originalConsole.log;
    console.debug = this.originalConsole.debug;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }

  /**
   * Récupère tous les logs capturés
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Récupère les logs d'un niveau spécifique
   */
  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Récupère les logs INFO
   */
  getInfoLogs(): LogEntry[] {
    return this.getLogsByLevel('INFO');
  }

  /**
   * Récupère les logs DEBUG
   */
  getDebugLogs(): LogEntry[] {
    return this.getLogsByLevel('DEBUG');
  }

  /**
   * Compte les logs par niveau
   */
  getLogCounts(): Record<LogEntry['level'], number> {
    const counts: Record<LogEntry['level'], number> = {
      INFO: 0,
      DEBUG: 0,
      WARN: 0,
      ERROR: 0
    };

    for (const log of this.logs) {
      counts[log.level]++;
    }

    return counts;
  }

  /**
   * Vérifie qu'il y a ≤ 1 INFO par notice traitée
   */
  assertInfoLogsPerNotice(noticeCount: number, maxInfoPerNotice: number = 1): void {
    const infoCount = this.getInfoLogs().length;
    const maxAllowed = noticeCount * maxInfoPerNotice;
    
    if (infoCount > maxAllowed) {
      throw new Error(
        `Trop de logs INFO: ${infoCount} (max: ${maxAllowed}). ` +
        `Logs INFO: ${this.getInfoLogs().map(l => l.message).join(', ')}`
      );
    }
  }

  /**
   * Vérifie que les logs DEBUG sont contrôlés
   */
  assertDebugLogsControlled(maxDebugPerNotice: number = 4): void {
    const debugCount = this.getDebugLogs().length;
    const noticeCount = this.getInfoLogs().length;
    const maxAllowed = noticeCount * maxDebugPerNotice;
    
    if (debugCount > maxAllowed) {
      throw new Error(
        `Trop de logs DEBUG: ${debugCount} (max: ${maxAllowed}). ` +
        `Logs DEBUG: ${this.getDebugLogs().map(l => l.message).join(', ')}`
      );
    }
  }

  /**
   * Nettoie les logs capturés
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Affiche un résumé des logs capturés
   */
  printSummary(): void {
    const counts = this.getLogCounts();
    console.log('📊 LogSink Summary:');
    console.log(`  INFO: ${counts.INFO}`);
    console.log(`  DEBUG: ${counts.DEBUG}`);
    console.log(`  WARN: ${counts.WARN}`);
    console.log(`  ERROR: ${counts.ERROR}`);
    console.log(`  Total: ${this.logs.length}`);
  }
}
