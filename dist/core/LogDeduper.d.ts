export declare class LogDeduper {
    private entries;
    private readonly windowMs;
    private readonly maxPerWindow;
    private readonly maxEntries;
    private readonly cleanupIntervalMs;
    private cleanupTimer;
    private totalSuppressed;
    private totalProcessed;
    constructor(windowMs?: number, maxPerWindow?: number, maxEntries?: number, cleanupIntervalMs?: number);
    /**
     * Note un événement et log seulement si nécessaire
     */
    note(key: string, message: string): void;
    /**
     * Flush tous les résumés supprimés
     */
    flush(): void;
    /**
     * Nettoyer automatiquement les entrées anciennes
     */
    private cleanupOldEntries;
    /**
     * Démarrer le timer de nettoyage automatique
     */
    private startCleanupTimer;
    /**
     * Estimer l'usage mémoire d'une entrée
     */
    private estimateMemoryUsage;
    /**
     * Obtenir les statistiques de performance
     */
    getStats(): {
        totalEntries: number;
        totalProcessed: number;
        totalSuppressed: number;
        memoryUsage: number;
        efficiency: number;
    };
    /**
     * Arrêter proprement le deduper
     */
    stop(): void;
}
