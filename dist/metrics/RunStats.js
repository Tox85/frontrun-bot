"use strict";
/**
 * Module de statistiques d'exécution du bot
 * Suit les métriques depuis le lancement
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunStatsTracker = void 0;
exports.getRunStatsTracker = getRunStatsTracker;
exports.stopRunStatsTracker = stopRunStatsTracker;
class RunStatsTracker {
    startTime;
    newListingsCount = 0;
    totalNoticesProcessed = 0;
    totalT0Events = 0;
    lastListingTime = null;
    logInterval = null;
    logIntervalMinutes;
    constructor(logIntervalMinutes = 5) {
        this.startTime = new Date();
        this.logIntervalMinutes = logIntervalMinutes;
        // Démarrer le logging périodique
        this.startPeriodicLogging();
        console.log(`📊 RunStatsTracker initialisé - logging toutes les ${logIntervalMinutes} minutes`);
    }
    /**
     * Incrémente le compteur de nouveaux listings
     */
    incrementNewListings(ticker) {
        this.newListingsCount++;
        this.lastListingTime = new Date();
        console.log(`🎯 Nouveau listing détecté: ${ticker} (total depuis le lancement: ${this.newListingsCount})`);
    }
    /**
     * Incrémente le compteur de notices traitées
     */
    incrementNoticesProcessed() {
        this.totalNoticesProcessed++;
    }
    /**
     * Incrémente le compteur d'événements T0
     */
    incrementT0Events() {
        this.totalT0Events++;
    }
    /**
     * Retourne les statistiques actuelles
     */
    getStats() {
        const now = Date.now();
        return {
            startTime: this.startTime,
            newListingsCount: this.newListingsCount,
            totalNoticesProcessed: this.totalNoticesProcessed,
            totalT0Events: this.totalT0Events,
            lastListingTime: this.lastListingTime,
            uptimeMs: now - this.startTime.getTime()
        };
    }
    /**
     * Retourne les statistiques formatées pour les endpoints
     */
    getFormattedStats() {
        const stats = this.getStats();
        const uptimeHours = Math.floor(stats.uptimeMs / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((stats.uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        return {
            new_listings_since_start: stats.newListingsCount,
            total_notices_processed: stats.totalNoticesProcessed,
            total_t0_events: stats.totalT0Events,
            uptime: `${uptimeHours}h ${uptimeMinutes}m`,
            start_time: stats.startTime.toISOString(),
            last_listing_time: stats.lastListingTime?.toISOString() || null
        };
    }
    /**
     * Démarre le logging périodique des statistiques
     */
    startPeriodicLogging() {
        this.logInterval = setInterval(() => {
            const stats = this.getStats();
            const uptimeHours = Math.floor(stats.uptimeMs / (1000 * 60 * 60));
            const uptimeMinutes = Math.floor((stats.uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
            console.log(`📊 runstats: uptime=${uptimeHours}h${uptimeMinutes}m, new_listings_since_start=${stats.newListingsCount}, total_notices=${stats.totalNoticesProcessed}, total_t0=${stats.totalT0Events}`);
        }, this.logIntervalMinutes * 60 * 1000);
    }
    /**
     * Arrête le tracker et nettoie les ressources
     */
    stop() {
        if (this.logInterval) {
            clearInterval(this.logInterval);
            this.logInterval = null;
        }
        console.log('🛑 RunStatsTracker arrêté');
    }
    /**
     * Met à jour l'intervalle de logging
     */
    updateLogInterval(minutes) {
        this.logIntervalMinutes = minutes;
        if (this.logInterval) {
            clearInterval(this.logInterval);
        }
        this.startPeriodicLogging();
        console.log(`⚙️ Intervalle de logging mis à jour: ${minutes} minutes`);
    }
}
exports.RunStatsTracker = RunStatsTracker;
// Instance singleton
let runStatsTracker = null;
/**
 * Obtient l'instance singleton du tracker
 */
function getRunStatsTracker(logIntervalMinutes) {
    if (!runStatsTracker) {
        runStatsTracker = new RunStatsTracker(logIntervalMinutes);
    }
    return runStatsTracker;
}
/**
 * Arrête le tracker singleton
 */
function stopRunStatsTracker() {
    if (runStatsTracker) {
        runStatsTracker.stop();
        runStatsTracker = null;
    }
}
//# sourceMappingURL=RunStats.js.map