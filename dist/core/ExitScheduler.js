"use strict";
/**
 * Système de sortie programmée pour les positions
 * Basé sur les spécifications du prompt Cursor
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExitScheduler = void 0;
class ExitScheduler {
    onExitDue;
    checkIntervalMs;
    scheduledExits = new Map();
    workerInterval = null;
    isRunning = false;
    constructor(onExitDue, checkIntervalMs = 1000 // Vérifier toutes les secondes
    ) {
        this.onExitDue = onExitDue;
        this.checkIntervalMs = checkIntervalMs;
        console.log('⏰ ExitScheduler initialisé');
    }
    /**
     * Démarre le worker de sortie
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ ExitScheduler déjà en cours d\'exécution');
            return;
        }
        this.isRunning = true;
        this.workerInterval = setInterval(() => {
            this.checkScheduledExits();
        }, this.checkIntervalMs);
        console.log('✅ ExitScheduler démarré');
    }
    /**
     * Arrête le worker de sortie
     */
    stop() {
        if (this.workerInterval) {
            clearInterval(this.workerInterval);
            this.workerInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 ExitScheduler arrêté');
    }
    /**
     * Programme une sortie pour une position
     */
    scheduleExit(trade, exitDelayMinutes = 3) {
        const exitId = `exit_${trade.eventId}_${Date.now()}`;
        const exitAt = new Date(Date.now() + exitDelayMinutes * 60 * 1000);
        const scheduledExit = {
            id: exitId,
            eventId: trade.eventId,
            exchange: trade.exchange,
            symbol: trade.symbol,
            exit_at: exitAt.toISOString(),
            status: 'pending',
            created_at: new Date().toISOString()
        };
        this.scheduledExits.set(exitId, scheduledExit);
        console.log(`⏰ Sortie programmée pour ${trade.symbol}: ${exitAt.toLocaleTimeString()} (dans ${exitDelayMinutes} min)`);
        return exitId;
    }
    /**
     * Annule une sortie programmée
     */
    cancelExit(exitId) {
        const exit = this.scheduledExits.get(exitId);
        if (exit && exit.status === 'pending') {
            exit.status = 'cancelled';
            console.log(`❌ Sortie annulée: ${exit.symbol}`);
            return true;
        }
        return false;
    }
    /**
     * Vérifie les sorties programmées
     */
    async checkScheduledExits() {
        const now = new Date();
        const dueExits = [];
        // Identifier les sorties dues
        for (const exit of this.scheduledExits.values()) {
            if (exit.status === 'pending' && new Date(exit.exit_at) <= now) {
                dueExits.push(exit);
            }
        }
        // Traiter les sorties dues
        for (const exit of dueExits) {
            try {
                console.log(`🚨 Sortie due pour ${exit.symbol} sur ${exit.exchange}`);
                // Marquer comme en cours d'exécution
                exit.status = 'executed';
                // Appeler le callback de sortie
                await this.onExitDue(exit);
                console.log(`✅ Sortie exécutée pour ${exit.symbol}`);
            }
            catch (error) {
                console.error(`❌ Erreur lors de la sortie de ${exit.symbol}:`, error);
                exit.status = 'failed';
            }
        }
        // Nettoyer les anciennes sorties (plus de 24h)
        this.cleanupOldExits();
    }
    /**
     * Nettoie les anciennes sorties
     */
    cleanupOldExits() {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h
        let cleanedCount = 0;
        for (const [exitId, exit] of this.scheduledExits.entries()) {
            if (new Date(exit.created_at) < cutoff) {
                this.scheduledExits.delete(exitId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            console.log(`🧹 ${cleanedCount} anciennes sorties nettoyées`);
        }
    }
    /**
     * Obtient le statut du scheduler
     */
    getStatus() {
        const pendingExits = Array.from(this.scheduledExits.values()).filter(e => e.status === 'pending');
        const nextExit = pendingExits.sort((a, b) => new Date(a.exit_at).getTime() - new Date(b.exit_at).getTime())[0];
        return {
            isRunning: this.isRunning,
            totalScheduled: this.scheduledExits.size,
            pendingExits: pendingExits.length,
            nextExitIn: nextExit ? this.formatTimeUntil(new Date(nextExit.exit_at)) : null
        };
    }
    /**
     * Formate le temps restant jusqu'à une sortie
     */
    formatTimeUntil(exitTime) {
        const now = new Date();
        const diff = exitTime.getTime() - now.getTime();
        if (diff <= 0)
            return 'Maintenant';
        const minutes = Math.floor(diff / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    /**
     * Obtient toutes les sorties programmées
     */
    getAllScheduledExits() {
        return Array.from(this.scheduledExits.values());
    }
    /**
     * Force la sortie immédiate d'une position
     */
    forceImmediateExit(eventId) {
        const exits = Array.from(this.scheduledExits.values()).filter(e => e.eventId === eventId);
        for (const exit of exits) {
            if (exit.status === 'pending') {
                exit.exit_at = new Date().toISOString();
                console.log(`🔧 Sortie forcée pour ${exit.symbol}`);
                return true;
            }
        }
        return false;
    }
}
exports.ExitScheduler = ExitScheduler;
//# sourceMappingURL=ExitScheduler.js.map