/**
 * Module de statistiques d'exécution du bot
 * Suit les métriques depuis le lancement
 */

export interface RunStats {
  startTime: Date;
  newListingsCount: number;
  totalNoticesProcessed: number;
  totalT0Events: number;
  lastListingTime: Date | null;
  uptimeMs: number;
}

export class RunStatsTracker {
  private startTime: Date;
  private newListingsCount: number = 0;
  private totalNoticesProcessed: number = 0;
  private totalT0Events: number = 0;
  private lastListingTime: Date | null = null;
  private logInterval: NodeJS.Timeout | null = null;
  private logIntervalMinutes: number;

  constructor(logIntervalMinutes: number = 5) {
    this.startTime = new Date();
    this.logIntervalMinutes = logIntervalMinutes;
    
    // Démarrer le logging périodique
    this.startPeriodicLogging();
    
    console.log(`📊 RunStatsTracker initialisé - logging toutes les ${logIntervalMinutes} minutes`);
  }

  /**
   * Incrémente le compteur de nouveaux listings
   */
  incrementNewListings(ticker: string): void {
    this.newListingsCount++;
    this.lastListingTime = new Date();
    
    console.log(`🎯 Nouveau listing détecté: ${ticker} (total depuis le lancement: ${this.newListingsCount})`);
  }

  /**
   * Incrémente le compteur de notices traitées
   */
  incrementNoticesProcessed(): void {
    this.totalNoticesProcessed++;
  }

  /**
   * Incrémente le compteur d'événements T0
   */
  incrementT0Events(): void {
    this.totalT0Events++;
  }

  /**
   * Retourne les statistiques actuelles
   */
  getStats(): RunStats {
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
  getFormattedStats(): Record<string, any> {
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
  private startPeriodicLogging(): void {
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
  stop(): void {
    if (this.logInterval) {
      clearInterval(this.logInterval);
      this.logInterval = null;
    }
    
    console.log('🛑 RunStatsTracker arrêté');
  }

  /**
   * Met à jour l'intervalle de logging
   */
  updateLogInterval(minutes: number): void {
    this.logIntervalMinutes = minutes;
    
    if (this.logInterval) {
      clearInterval(this.logInterval);
    }
    
    this.startPeriodicLogging();
    console.log(`⚙️ Intervalle de logging mis à jour: ${minutes} minutes`);
  }
}

// Instance singleton
let runStatsTracker: RunStatsTracker | null = null;

/**
 * Obtient l'instance singleton du tracker
 */
export function getRunStatsTracker(logIntervalMinutes?: number): RunStatsTracker {
  if (!runStatsTracker) {
    runStatsTracker = new RunStatsTracker(logIntervalMinutes);
  }
  return runStatsTracker;
}

/**
 * Arrête le tracker singleton
 */
export function stopRunStatsTracker(): void {
  if (runStatsTracker) {
    runStatsTracker.stop();
    runStatsTracker = null;
  }
}
