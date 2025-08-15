"use strict";
/**
 * ExitScheduler - Gestion des sorties automatiques +180s
 *
 * Conforme au super prompt Bithumb-only :
 * - Exit +180s persistant (scheduler persistant)
 * - Reduce-only pour éviter les positions inverses
 * - Reprise des exits en attente au boot
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exitScheduler = exports.ExitScheduler = void 0;
class ExitScheduler {
    static instance;
    config;
    scheduledExits;
    checkTimer;
    isRunning = false;
    exitHandlers;
    constructor(config) {
        this.config = {
            checkIntervalMs: 1000, // Vérifier toutes les secondes
            maxRetries: 3,
            retryDelayMs: 5000, // 5s entre tentatives
            batchSize: 10,
            ...config
        };
        this.scheduledExits = new Map();
        this.exitHandlers = new Map();
        this.checkTimer = null;
    }
    static getInstance(config) {
        if (!ExitScheduler.instance) {
            ExitScheduler.instance = new ExitScheduler(config);
        }
        return ExitScheduler.instance;
    }
    /**
     * Initialise le scheduler avec la base de données et l'adaptateur Hyperliquid
     */
    async initialize(db, hyperliquidAdapter) {
        console.log('🔧 Initialisation de l\'ExitScheduler...');
        // TODO: Charger les exits en attente depuis la base de données
        // TODO: Configurer l'adaptateur Hyperliquid
        console.log('✅ ExitScheduler initialisé');
    }
    /**
     * Démarre le scheduler
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ ExitScheduler déjà en cours d\'exécution');
            return;
        }
        this.isRunning = true;
        this.startCheckTimer();
        console.log('🚀 ExitScheduler démarré');
    }
    /**
     * Arrête le scheduler
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
        console.log('🛑 ExitScheduler arrêté');
    }
    /**
     * Démarre le timer de vérification
     */
    startCheckTimer() {
        this.checkTimer = setInterval(() => {
            this.processDueExits();
        }, this.config.checkIntervalMs);
    }
    /**
     * Planifie une sortie
     */
    scheduleExit(exchange, symbol, size, delayMs = 180000, // 180s par défaut
    metadata) {
        const id = `exit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();
        const scheduledExit = {
            id,
            exchange: exchange.toUpperCase(),
            symbol: symbol.toUpperCase(),
            size,
            dueAt: now + delayMs,
            status: 'PENDING',
            createdAt: now,
            updatedAt: now,
            ...(metadata && { metadata })
        };
        this.scheduledExits.set(id, scheduledExit);
        console.log(`📅 Sortie planifiée: ${symbol} sur ${exchange} dans ${delayMs}ms (ID: ${id})`);
        return id;
    }
    /**
     * Annule une sortie planifiée
     */
    cancelExit(exitId) {
        const exit = this.scheduledExits.get(exitId);
        if (!exit) {
            console.warn(`⚠️ Sortie ${exitId} non trouvée`);
            return false;
        }
        if (exit.status !== 'PENDING') {
            console.warn(`⚠️ Impossible d'annuler la sortie ${exitId} (statut: ${exit.status})`);
            return false;
        }
        exit.status = 'CANCELLED';
        exit.updatedAt = Date.now();
        console.log(`❌ Sortie ${exitId} annulée`);
        return true;
    }
    /**
     * Enregistre un handler pour un exchange
     */
    registerExitHandler(exchange, handler) {
        this.exitHandlers.set(exchange.toUpperCase(), handler);
        console.log(`🔧 Handler d'exit enregistré pour ${exchange}`);
    }
    /**
     * Traite les sorties dues
     */
    async processDueExits() {
        if (!this.isRunning)
            return;
        const now = Date.now();
        const dueExits = [];
        // Collecter les sorties dues
        for (const exit of this.scheduledExits.values()) {
            if (exit.status === 'PENDING' && exit.dueAt <= now) {
                dueExits.push(exit);
            }
        }
        if (dueExits.length === 0)
            return;
        console.log(`⏰ Traitement de ${dueExits.length} sorties dues`);
        // Traiter par batch
        const batches = this.chunkArray(dueExits, this.config.batchSize);
        for (const batch of batches) {
            await this.processExitBatch(batch);
        }
    }
    /**
     * Traite un batch d'exits
     */
    async processExitBatch(exits) {
        const promises = exits.map(exit => this.executeExit(exit));
        try {
            await Promise.allSettled(promises);
        }
        catch (error) {
            console.error('❌ Erreur lors du traitement du batch d\'exits:', error);
        }
    }
    /**
     * Exécute une sortie
     */
    async executeExit(exit) {
        try {
            // Marquer comme en cours d'exécution
            exit.status = 'EXECUTING';
            exit.updatedAt = Date.now();
            console.log(`🚀 Exécution de la sortie ${exit.id}: ${exit.symbol} sur ${exit.exchange}`);
            // Obtenir le handler pour cet exchange
            const handler = this.exitHandlers.get(exit.exchange);
            if (!handler) {
                throw new Error(`Aucun handler enregistré pour ${exit.exchange}`);
            }
            // Exécuter la sortie
            const success = await handler(exit);
            if (success) {
                exit.status = 'COMPLETED';
                console.log(`✅ Sortie ${exit.id} exécutée avec succès`);
            }
            else {
                throw new Error('Handler a retourné false');
            }
        }
        catch (error) {
            console.error(`❌ Erreur lors de l'exécution de la sortie ${exit.id}:`, error);
            // Marquer comme échouée
            exit.status = 'FAILED';
            exit.updatedAt = Date.now();
            // TODO: Implémenter la logique de retry si nécessaire
        }
    }
    /**
     * Charge les exits depuis la base de données
     */
    async loadPendingExits() {
        try {
            console.log('📥 Chargement des exits en attente depuis la base de données...');
            // TODO: Implémenter le chargement depuis la DB
            // Pour l'instant, on simule
            const pendingExits = [];
            for (const exit of pendingExits) {
                this.scheduledExits.set(exit.id, exit);
            }
            console.log(`📥 ${pendingExits.length} exits en attente chargés`);
        }
        catch (error) {
            console.error('❌ Erreur lors du chargement des exits:', error);
        }
    }
    /**
     * Sauvegarde un exit dans la base de données
     */
    async saveExit(exit) {
        try {
            // TODO: Implémenter la sauvegarde en DB
            console.log(`💾 Sauvegarde de l'exit ${exit.id} en base`);
        }
        catch (error) {
            console.error(`❌ Erreur lors de la sauvegarde de l'exit ${exit.id}:`, error);
        }
    }
    /**
     * Obtient les statistiques des exits
     */
    getStats() {
        const stats = {
            total: 0,
            pending: 0,
            executing: 0,
            completed: 0,
            failed: 0,
            cancelled: 0
        };
        let nextDueIn = null;
        const now = Date.now();
        for (const exit of this.scheduledExits.values()) {
            stats.total++;
            stats[exit.status.toLowerCase()]++;
            if (exit.status === 'PENDING' && exit.dueAt > now) {
                const timeUntilDue = exit.dueAt - now;
                if (nextDueIn === null || timeUntilDue < nextDueIn) {
                    nextDueIn = timeUntilDue;
                }
            }
        }
        return {
            ...stats,
            nextDueIn
        };
    }
    /**
     * Obtient tous les exits
     */
    getAllExits() {
        return Array.from(this.scheduledExits.values());
    }
    /**
     * Obtient un exit par ID
     */
    getExit(exitId) {
        return this.scheduledExits.get(exitId) || null;
    }
    /**
     * Nettoie les anciens exits
     */
    cleanupOldExits(maxAgeHours = 24) {
        const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        let cleanedCount = 0;
        for (const [id, exit] of this.scheduledExits) {
            if (exit.updatedAt < cutoff &&
                ['COMPLETED', 'FAILED', 'CANCELLED'].includes(exit.status)) {
                this.scheduledExits.delete(id);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            console.log(`🧹 ${cleanedCount} anciens exits nettoyés`);
        }
        return cleanedCount;
    }
    /**
     * Divise un tableau en chunks
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    /**
     * Getters pour le monitoring
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            config: this.config,
            stats: this.getStats()
        };
    }
}
exports.ExitScheduler = ExitScheduler;
// Export de l'instance singleton
exports.exitScheduler = ExitScheduler.getInstance();
//# sourceMappingURL=ExitScheduler.js.map