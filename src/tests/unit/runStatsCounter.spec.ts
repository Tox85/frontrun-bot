import { getRunStatsTracker, stopRunStatsTracker } from '../../metrics/RunStats';
import { detectListingKRW } from '../../detection/detectListingKRW';
import { extractTickersWithConfidence } from '../../utils/extractTickers';

describe('RunStats Counter - new_listings_since_start', () => {
  let runStats: any;

  beforeEach(() => {
    // Arrêter et nettoyer le singleton précédent
    stopRunStatsTracker();
    
    // Initialiser un nouveau tracker pour chaque test
    runStats = getRunStatsTracker();
  });

  afterEach(() => {
    // Nettoyer après chaque test
    stopRunStatsTracker();
  });

  describe('new_listings_since_start counter', () => {
    it('should increment counter only for confirmed listings', async () => {
      // 3 notices: 2 confirmed listings, 1 non-listing
      const notices = [
        {
          id: 12370,
          title: "Virtual Asset (BIO) KRW Market New Addition",
          content: "Bio Protocol (BIO) has been newly listed on the KRW market. Trading pairs: BIO-KRW available now.",
          categories: ["notice", "market"],
          pc_url: "https://www.bithumb.com/notice/12370",
          published_at: "2025-08-20 23:30:00"
        },
        {
          id: 12371,
          title: "Cryptocurrency (MERL) Market Launch",
          content: "MERL token launch. MERL-KRW pair now active for trading.",
          categories: ["crypto", "launch"],
          pc_url: "https://www.bithumb.com/notice/12371",
          published_at: "2025-08-20 23:32:00"
        },
        {
          id: 12372,
          title: "System Maintenance Notice",
          content: "Scheduled maintenance affecting all assets. No new listings.",
          categories: ["maintenance"],
          pc_url: "https://www.bithumb.com/notice/12372",
          published_at: "2025-08-20 23:35:00"
        }
      ];

      // Traiter chaque notice et simuler l'incrémentation du compteur
      for (const notice of notices) {
        const fullText = `${notice.title} ${notice.content}`;
        
        // Extraire les tickers
        const tickerExtraction = extractTickersWithConfidence(fullText, fullText);
        
        // Détecter si c'est un listing
        const detection = detectListingKRW({
          title: notice.title,
          body: notice.content,
          tickers: tickerExtraction.tickers
        });

        // Si c'est un listing confirmé, incrémenter le compteur
        if (detection.isListing && detection.score >= 2) {
          runStats.incrementNewListings(tickerExtraction.tickers[0] || 'UNKNOWN');
        }
      }

      // Vérifier que le compteur final = 2 (2 confirmed listings)
      const stats = runStats.getStats();
      expect(stats.newListingsCount).toBe(2);
      
      // Vérifier que les autres compteurs sont cohérents
      expect(stats.totalNoticesProcessed).toBe(0); // Pas encore traité via le pipeline complet
      expect(stats.totalT0Events).toBe(0);
    });

    it('should handle multiple tickers per notice correctly', async () => {
      // Notice avec plusieurs tickers
      const multiTickerNotice = {
        id: 12373,
        title: "Multi-Asset Launch (BIO) (MERL)",
        content: "Two new assets: BIO-KRW and MERL-KRW trading pairs available.",
        categories: ["multi-launch"],
        pc_url: "https://www.bithumb.com/notice/12373",
        published_at: "2025-08-20 23:40:00"
      };

      const fullText = `${multiTickerNotice.title} ${multiTickerNotice.content}`;
      const tickerExtraction = extractTickersWithConfidence(fullText, fullText);
      
      // Vérifier qu'on a bien 2 tickers
      expect(tickerExtraction.tickers).toContain('BIO');
      expect(tickerExtraction.tickers).toContain('MERL');
      expect(tickerExtraction.tickers).toHaveLength(2);

      // Détecter le listing
      const detection = detectListingKRW({
        title: multiTickerNotice.title,
        body: multiTickerNotice.content,
        tickers: tickerExtraction.tickers
      });

      // Doit être détecté comme un listing
      expect(detection.isListing).toBe(true);
      expect(detection.score).toBeGreaterThanOrEqual(2);

      // Incrémenter pour chaque ticker
      for (const ticker of tickerExtraction.tickers) {
        runStats.incrementNewListings(ticker);
      }

      // Vérifier que le compteur = 2
      const stats = runStats.getStats();
      expect(stats.newListingsCount).toBe(2);
    });

    it('should expose counter via getStats() method', async () => {
      // Incrémenter quelques fois
      runStats.incrementNewListings('TEST1');
      runStats.incrementNewListings('TEST2');
      runStats.incrementNewListings('TEST3');

      // Récupérer les stats
      const stats = runStats.getStats();
      
      // Vérifier que le compteur est exposé
      expect(stats.newListingsCount).toBe(3);
      expect(typeof stats.newListingsCount).toBe('number');
      
      // Vérifier que c'est un compteur positif
      expect(stats.newListingsCount).toBeGreaterThan(0);
    });

    it('should maintain counter across multiple operations', async () => {
      // Séquence d'opérations
      runStats.incrementNewListings('OP1');
      
      const stats1 = runStats.getStats();
      expect(stats1.newListingsCount).toBe(1);
      
      runStats.incrementNewListings('OP2');
      
      const stats2 = runStats.getStats();
      expect(stats2.newListingsCount).toBe(2);
      
      // Vérifier que le compteur persiste
      expect(stats2.newListingsCount).toBeGreaterThan(stats1.newListingsCount);
    });

    it('should handle edge cases gracefully', async () => {
      // Test avec ticker vide
      runStats.incrementNewListings('');
      runStats.incrementNewListings('VALID');
      
      const stats = runStats.getStats();
      expect(stats.newListingsCount).toBe(2); // Les deux sont comptés
      
      // Test avec ticker undefined
      runStats.incrementNewListings(undefined as any);
      
      const stats2 = runStats.getStats();
      expect(stats2.newListingsCount).toBe(3); // Même undefined est compté
    });
  });

  describe('Counter integration with other metrics', () => {
    it('should correlate with other run statistics', async () => {
      // Simuler un pipeline complet
      runStats.incrementNoticesProcessed();
      runStats.incrementNewListings('INTEGRATION_TEST');
      runStats.incrementT0Events();
      
      const stats = runStats.getStats();
      
      // Vérifier la cohérence des métriques
      expect(stats.totalNoticesProcessed).toBe(1);
      expect(stats.newListingsCount).toBe(1);
      expect(stats.totalT0Events).toBe(1);
      
      // Le ratio devrait être logique
      expect(stats.newListingsCount).toBeLessThanOrEqual(stats.totalNoticesProcessed);
    });

    it('should provide accurate uptime calculation', async () => {
      // Attendre un peu pour tester l'uptime
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats = runStats.getStats();
      
      // Vérifier que l'uptime est calculé correctement
      expect(stats.uptimeMs).toBeGreaterThan(0);
      expect(typeof stats.uptimeMs).toBe('number');
      
      // L'uptime doit être cohérent avec le timestamp de démarrage
      const now = Date.now();
      expect(stats.uptimeMs).toBeLessThanOrEqual(now - stats.startTime.getTime());
    });
  });
});
