interface DedupEntry {
  count: number;
  lastLog: number;
  suppressedCount: number;
  memoryUsage: number;
}

export class LogDeduper {
  private entries: Map<string, DedupEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxPerWindow: number;
  private readonly maxEntries: number;
  private readonly cleanupIntervalMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private totalSuppressed: number = 0;
  private totalProcessed: number = 0;

  constructor(
    windowMs: number = 60000, 
    maxPerWindow: number = 2,
    maxEntries: number = 1000,
    cleanupIntervalMs: number = 300000 // 5 minutes
  ) {
    this.windowMs = windowMs;
    this.maxPerWindow = maxPerWindow;
    this.maxEntries = maxEntries;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.startCleanupTimer();
  }

  /**
   * Note un événement et log seulement si nécessaire
   */
  note(key: string, message: string): void {
    const now = Date.now();
    const entry = this.entries.get(key);

    // Gestion de la mémoire : limiter le nombre d'entrées
    if (this.entries.size >= this.maxEntries) {
      this.cleanupOldEntries();
    }

    if (!entry) {
      // Première occurrence
      const memoryUsage = this.estimateMemoryUsage(key, message);
      this.entries.set(key, {
        count: 1,
        lastLog: now,
        suppressedCount: 0,
        memoryUsage
      });
      console.log(message);
      this.totalProcessed++;
      return;
    }

    // Vérifier si on doit log
    const shouldLog = now - entry.lastLog > this.windowMs || entry.count < this.maxPerWindow;

    if (shouldLog) {
      entry.count = 1;
      entry.lastLog = now;
      entry.suppressedCount = 0;
      console.log(message);
      this.totalProcessed++;
    } else {
      entry.count++;
      entry.suppressedCount++;
      this.totalSuppressed++;
    }
  }

  /**
   * Flush tous les résumés supprimés
   */
  flush(): void {
    const now = Date.now();
    const toRemove: string[] = [];
    let totalSuppressed = 0;

    for (const [key, entry] of this.entries.entries()) {
      if (entry.suppressedCount > 0) {
        console.log(`ℹ️ [DEDUP] ${key}: ${entry.suppressedCount} occurrences supprimées dans la dernière fenêtre`);
        totalSuppressed += entry.suppressedCount;
        entry.suppressedCount = 0;
      }

      // Nettoyer les entrées anciennes
      if (now - entry.lastLog > this.windowMs * 2) {
        toRemove.push(key);
      }
    }

    toRemove.forEach(key => this.entries.delete(key));

    if (totalSuppressed > 0) {
      console.log(`📊 [DEDUP] Résumé: ${totalSuppressed} logs supprimés, ${this.entries.size} entrées actives`);
    }
  }

  /**
   * Nettoyer automatiquement les entrées anciennes
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    const toRemove: string[] = [];
    let totalMemoryFreed = 0;

    // Trier par ancienneté et supprimer les plus anciennes
    const sortedEntries = Array.from(this.entries.entries())
      .sort((a, b) => a[1].lastLog - b[1].lastLog);

    // Supprimer 20% des entrées les plus anciennes
    const entriesToRemove = Math.ceil(this.entries.size * 0.2);
    
          for (let i = 0; i < entriesToRemove; i++) {
        const entry = sortedEntries[i];
        if (entry) {
          const [key, entryData] = entry;
          totalMemoryFreed += entryData.memoryUsage;
          toRemove.push(key);
        }
      }

    toRemove.forEach(key => this.entries.delete(key));

    if (totalMemoryFreed > 0) {
      console.log(`🧹 [DEDUP] Nettoyage mémoire: ${totalMemoryFreed} bytes libérés, ${this.entries.size} entrées restantes`);
    }
  }

  /**
   * Démarrer le timer de nettoyage automatique
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldEntries();
    }, this.cleanupIntervalMs);
  }

  /**
   * Estimer l'usage mémoire d'une entrée
   */
  private estimateMemoryUsage(key: string, message: string): number {
    // Estimation basique : clé + message + structure de données
    return Buffer.byteLength(key, 'utf8') + Buffer.byteLength(message, 'utf8') + 100;
  }

  /**
   * Obtenir les statistiques de performance
   */
  getStats(): {
    totalEntries: number;
    totalProcessed: number;
    totalSuppressed: number;
    memoryUsage: number;
    efficiency: number;
  } {
    let totalMemory = 0;
    for (const entry of this.entries.values()) {
      totalMemory += entry.memoryUsage;
    }

    const efficiency = this.totalProcessed > 0 
      ? ((this.totalSuppressed / (this.totalProcessed + this.totalSuppressed)) * 100)
      : 0;

    return {
      totalEntries: this.entries.size,
      totalProcessed: this.totalProcessed,
      totalSuppressed: this.totalSuppressed,
      memoryUsage: totalMemory,
      efficiency: Math.round(efficiency * 100) / 100
    };
  }

  /**
   * Arrêter proprement le deduper
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.flush();
    this.entries.clear();
    
    const stats = this.getStats();
    console.log(`📊 [DEDUP] Arrêt - Statistiques finales: ${stats.totalProcessed} traités, ${stats.totalSuppressed} supprimés`);
  }
}
