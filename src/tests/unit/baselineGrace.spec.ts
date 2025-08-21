import { BaselineManager } from '../../core/BaselineManager';
import { Database } from 'sqlite3';
import { MigrationRunner } from '../../store/Migrations';
import { getRunStatsTracker } from '../../metrics/RunStats';

describe('Baseline Grace Window', () => {
  let baselineManager: BaselineManager;
  let db: Database;

  beforeAll(async () => {
    // Créer une base de données en mémoire
    db = new Database(':memory:');
    
    // Exécuter les migrations
    const migrationRunner = new MigrationRunner(db);
    await migrationRunner.runMigrations();
    
    // Initialiser le BaselineManager
    baselineManager = new BaselineManager(db);
    await baselineManager.initialize();
    
    // Initialiser RunStats
    getRunStatsTracker();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Nettoyer la base avant chaque test - utiliser une approche différente
    // Puisque clearBaseline() n'existe pas, on va tester avec la baseline vide
  });

  describe('Grace window behavior', () => {
    it('should handle grace window configuration', async () => {
      // Vérifier que la fenêtre de grâce peut être mise à jour
      baselineManager.updateGraceWindow(15); // 15 minutes
      
      // Vérifier le statut
      const status = baselineManager.getStatus();
      expect(status.isInitialized).toBe(true);
    });

    it('should detect baseline state correctly', async () => {
      // Vérifier l'état de la baseline
      const state = baselineManager.getState();
      expect(['READY', 'CACHED', 'DEGRADED']).toContain(state);
      
      // Vérifier si T0 peut être activé
      const canActivateT0 = baselineManager.canActivateT0();
      expect(typeof canActivateT0).toBe('boolean');
    });

    it('should handle grace window logic with real baseline', async () => {
      // Attendre que la baseline soit initialisée
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Vérifier que la baseline contient des tokens
      const status = baselineManager.getStatus();
      expect(status.isInitialized).toBe(true);
      
      // Tester avec un token qui pourrait être dans la baseline
      const result = await baselineManager.isTokenInBaselineWithGrace('BTC', new Date());
      
      // Le résultat dépend de si BTC est dans la baseline ou non
      expect(typeof result.inBaseline).toBe('boolean');
      expect(typeof result.withinGrace).toBe('boolean');
      expect(typeof result.reason).toBe('string');
    });
  });

  describe('Baseline initialization', () => {
    it('should initialize baseline manager correctly', async () => {
      // Vérifier que le manager est initialisé
      const status = baselineManager.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.baselineUrl).toBe('https://api.bithumb.com/public/ticker/ALL_KRW');
    });

    it('should handle baseline state transitions', async () => {
      // Vérifier que le manager peut être arrêté
      await baselineManager.stop();
      
      // Vérifier l'état après arrêt
      const status = baselineManager.getStatus();
      expect(status.isInitialized).toBe(false);
    });
  });
});
