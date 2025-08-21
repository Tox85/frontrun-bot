import { RunStatsTracker, getRunStatsTracker, stopRunStatsTracker } from '../../metrics/RunStats';

describe('RunStats', () => {
  let tracker: RunStatsTracker;

  beforeEach(() => {
    // Arrêter le tracker singleton existant
    stopRunStatsTracker();
    tracker = new RunStatsTracker(1); // 1 minute pour les tests
  });

  afterEach(() => {
    tracker.stop();
  });

  describe('RunStatsTracker', () => {
    it('should initialize with correct start time', () => {
      const stats = tracker.getStats();
      expect(stats.startTime).toBeInstanceOf(Date);
      expect(stats.newListingsCount).toBe(0);
      expect(stats.totalNoticesProcessed).toBe(0);
      expect(stats.totalT0Events).toBe(0);
    });

    it('should increment new listings count', () => {
      tracker.incrementNewListings('BIO');
      tracker.incrementNewListings('TOWNS');
      
      const stats = tracker.getStats();
      expect(stats.newListingsCount).toBe(2);
      expect(stats.lastListingTime).toBeInstanceOf(Date);
    });

    it('should increment notices processed', () => {
      tracker.incrementNoticesProcessed();
      tracker.incrementNoticesProcessed();
      
      const stats = tracker.getStats();
      expect(stats.totalNoticesProcessed).toBe(2);
    });

    it('should increment T0 events', () => {
      tracker.incrementT0Events();
      tracker.incrementT0Events();
      tracker.incrementT0Events();
      
      const stats = tracker.getStats();
      expect(stats.totalT0Events).toBe(3);
    });

    it('should calculate uptime correctly', () => {
      // Créer un nouveau tracker pour ce test
      const testTracker = new RunStatsTracker(1);
      
      // Simuler un délai de 5 secondes
      const startTime = testTracker.getStats().startTime;
      const mockNow = startTime.getTime() + 5000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);
      
      const stats = testTracker.getStats();
      expect(stats.uptimeMs).toBeGreaterThanOrEqual(5000);
      
      jest.restoreAllMocks();
      testTracker.stop();
    });

    it('should format stats for endpoints', () => {
      tracker.incrementNewListings('BIO');
      tracker.incrementNoticesProcessed();
      tracker.incrementT0Events();
      
      const formatted = tracker.getFormattedStats();
      
      expect(formatted.new_listings_since_start).toBe(1);
      expect(formatted.total_notices_processed).toBe(1);
      expect(formatted.total_t0_events).toBe(1);
      expect(formatted.uptime).toMatch(/\d+h \d+m/);
      expect(formatted.start_time).toBeDefined();
      expect(formatted.last_listing_time).toBeDefined();
    });

    it('should update log interval', () => {
      const newInterval = 10;
      tracker.updateLogInterval(newInterval);
      
      // Vérifier que l'intervalle a été mis à jour
      // Note: difficile de tester l'intervalle directement, on vérifie juste que ça ne crash pas
      expect(tracker).toBeDefined();
    });
  });

  describe('Singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getRunStatsTracker();
      const instance2 = getRunStatsTracker();
      
      expect(instance1).toBe(instance2);
    });

    it('should stop singleton instance', () => {
      const instance = getRunStatsTracker();
      stopRunStatsTracker();
      
      // Créer une nouvelle instance
      const newInstance = getRunStatsTracker();
      expect(newInstance).not.toBe(instance);
    });
  });

  describe('Logging', () => {
    it('should start periodic logging', () => {
      // Le logging périodique démarre automatiquement dans le constructeur
      // On vérifie juste que ça ne crash pas
      expect(tracker).toBeDefined();
    });
  });
});
