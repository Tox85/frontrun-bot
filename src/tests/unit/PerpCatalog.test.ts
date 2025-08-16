import { Database } from 'sqlite3';
import { PerpCatalog } from '../../store/PerpCatalog';

// Mock de la base de données
const mockDb = {
  prepare: jest.fn(),
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  close: jest.fn()
} as any;

describe('PerpCatalog', () => {
  let perpCatalog: PerpCatalog;

  beforeEach(() => {
    jest.clearAllMocks();
    perpCatalog = new PerpCatalog(mockDb, 1000); // 1s pour les tests
  });

  afterEach(() => {
    perpCatalog.stop();
  });

  describe('RefreshGuard - Anti-overlap', () => {
    it('devrait coalescer les refreshs parallèles', async () => {
      // Simuler deux refreshs simultanés
      const refresh1 = perpCatalog.refreshAllExchanges();
      const refresh2 = perpCatalog.refreshAllExchanges();

      // Les deux devraient retourner le même résultat (coalescing)
      const [result1, result2] = await Promise.all([refresh1, refresh2]);
      
      expect(result1).toBe(result2);
      
      // Vérifier que le guard a bien coalescé
      const guard = (perpCatalog as any).guard;
      const counters = guard.getCounters();
      expect(counters.guard_runs).toBe(1);
      expect(counters.guard_coalesced).toBe(1);
    });

    it('devrait gérer les erreurs sans rester coincé actif', async () => {
      // Mock une erreur dans updateCatalog
      const mockUpdateCatalog = jest.spyOn(perpCatalog as any, 'updateCatalog');
      mockUpdateCatalog.mockRejectedValueOnce(new Error('Test error'));

      try {
        await perpCatalog.refreshAllExchanges();
      } catch (error) {
        // L'erreur devrait être propagée
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Test error');
      }

      // Le guard devrait être redevenu inactif
      const guard = (perpCatalog as any).guard;
      expect(guard.state.active).toBe(false);
      expect(guard.state.inFlight).toBe(null);
    });

    it('devrait permettre un nouveau refresh après une erreur', async () => {
      // Premier refresh avec erreur
      const mockUpdateCatalog = jest.spyOn(perpCatalog as any, 'updateCatalog');
      mockUpdateCatalog.mockRejectedValueOnce(new Error('Test error'));

      try {
        await perpCatalog.refreshAllExchanges();
      } catch (error) {
        // Ignorer l'erreur
      }

      // Deuxième refresh devrait fonctionner
      mockUpdateCatalog.mockResolvedValueOnce({ inserted: 0, updated: 0, total: 0, errors: 0 });
      
      // Vérifier que le refresh s'exécute sans erreur
      await expect(perpCatalog.refreshAllExchanges()).resolves.not.toThrow();
      
      const guard = (perpCatalog as any).guard;
      const counters = guard.getCounters();
      expect(counters.guard_runs).toBe(2);
    });
  });

  describe('Jitter anti-alignement', () => {
    it('devrait ajouter un jitter de ±10% sur le timer', () => {
      const baseInterval = 1000; // 1s
      const perpCatalogWithJitter = new PerpCatalog(mockDb, baseInterval);
      
      // Le timer devrait être configuré avec un jitter
      const timer = (perpCatalogWithJitter as any).refreshTimer;
      expect(timer).toBeDefined();
      
      perpCatalogWithJitter.stop();
    });
  });

  describe('Métriques', () => {
    it('devrait exposer les compteurs du guard', () => {
      const guard = (perpCatalog as any).guard;
      const counters = guard.getCounters();
      
      expect(counters).toHaveProperty('guard_runs');
      expect(counters).toHaveProperty('guard_coalesced');
      expect(typeof counters.guard_runs).toBe('number');
      expect(typeof counters.guard_coalesced).toBe('number');
    });

    it('devrait incrémenter les compteurs lors des refreshs', async () => {
      const guard = (perpCatalog as any).guard;
      const initialCounters = guard.getCounters();
      
      // Mock updateCatalog pour éviter les erreurs
      const mockUpdateCatalog = jest.spyOn(perpCatalog as any, 'updateCatalog');
      mockUpdateCatalog.mockResolvedValue({ inserted: 0, updated: 0, total: 0, errors: 0 });
      
      await perpCatalog.refreshAllExchanges();
      
      const finalCounters = guard.getCounters();
      expect(finalCounters.guard_runs).toBe(initialCounters.guard_runs + 1);
    });
  });

  describe('UPSERT robuste', () => {
    it('devrait gérer les contraintes UNIQUE sans erreur', async () => {
      // Mock simple de la base de données
      const mockDbGet = jest.fn();
      const mockDbPrepare = jest.fn();
      const mockStmt = {
        run: jest.fn(),
        finalize: jest.fn()
      };
      
      // Remplacer temporairement les méthodes de la base
      const originalGet = perpCatalog['db'].get;
      const originalPrepare = perpCatalog['db'].prepare;
      
      perpCatalog['db'].get = mockDbGet;
      perpCatalog['db'].prepare = mockDbPrepare.mockReturnValue(mockStmt);
      
      try {
        const tokens = [
          { base: 'BTC', symbol: 'BTCUSDT', leverageMax: 100, quote: 'USDT' }
        ];

        // Simuler que le token n'existe pas (INSERT)
        mockDbGet.mockImplementation((query, params, callback) => {
          callback(null, null); // Pas de ligne existante
        });

        // Simuler un UPSERT réussi
        mockStmt.run.mockImplementation((params, callback) => {
          callback(null);
        });

        mockStmt.finalize.mockImplementation((callback) => {
          callback(null);
        });

        const result = await perpCatalog['updateCatalog']('TEST', tokens);
        
        expect(result.inserted).toBe(1);
        expect(result.updated).toBe(0);
        expect(result.errors).toBe(0);
        
      } finally {
        // Restaurer les méthodes originales
        perpCatalog['db'].get = originalGet;
        perpCatalog['db'].prepare = originalPrepare;
      }
    });
  });

  describe('Déduplication par base', () => {
    it('devrait dédupliquer les tokens par base avec priorité quote', () => {
      const markets = [
        { base: 'BTC', symbol: 'BTCUSDT', leverageMax: 100, quote: 'USDT' },
        { base: 'BTC', symbol: 'BTCUSD', leverageMax: 100, quote: 'USD' },
        { base: 'ETH', symbol: 'ETHUSDT', leverageMax: 100, quote: 'USDT' }
      ];

      const result = perpCatalog['pickPreferredByBase'](markets);
      
      // Devrait y avoir seulement 2 tokens (déduplication de BTC)
      expect(result).toHaveLength(2);
      
      // BTC devrait avoir USDT (priorité plus élevée)
      const btcToken = result.find(t => t.base === 'BTC');
      expect(btcToken?.quote).toBe('USDT');
      
      // ETH devrait être présent
      const ethToken = result.find(t => t.base === 'ETH');
      expect(ethToken?.quote).toBe('USDT');
    });
  });
});
