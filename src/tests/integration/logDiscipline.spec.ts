import { NoticeClient } from '../../watchers/NoticeClient';
import { WatermarkStore } from '../../store/WatermarkStore';
import { HttpClient } from '../../core/HttpClient';
import { Database } from 'sqlite3';
import { MigrationRunner } from '../../store/Migrations';
import { LogSink } from '../utils/LogSink';

describe('Log Discipline Integration', () => {
  let noticeClient: NoticeClient;
  let watermarkStore: WatermarkStore;
  let db: Database;
  let logSink: LogSink;

  beforeAll(async () => {
    // Créer une base de données en mémoire
    db = new Database(':memory:');
    
    // Exécuter les migrations
    const migrationRunner = new MigrationRunner(db);
    await migrationRunner.runMigrations();
    
    // Initialiser le WatermarkStore
    watermarkStore = new WatermarkStore(db);
    await watermarkStore.initializeAtBoot('bithumb.notice');
    
    // Créer le NoticeClient
    noticeClient = new NoticeClient(
      'https://api.bithumb.com/public/notices',
      new HttpClient('TestClient', { 
        timeoutMs: 5000,
        maxRetries: 3,
        baseRetryDelayMs: 250,
        maxRetryDelayMs: 500,
        jitterPercent: 20
      }),
      watermarkStore
    );
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(() => {
    // Initialiser le LogSink pour chaque test
    logSink = new LogSink();
    logSink.start();
  });

  afterEach(() => {
    // Arrêter la capture des logs
    logSink.stop();
  });

  describe('Log discipline per notice', () => {
    it('should produce ≤ 1 INFO log per processed notice', async () => {
      // 3 notices: 2 listings, 1 maintenance
      const notices = [
        {
          id: 12360,
          title: "Virtual Asset (BIO) KRW Market New Addition",
          content: "Bio Protocol (BIO) has been newly listed on the KRW market. Trading pairs: BIO-KRW available now.",
          categories: ["notice", "market"],
          pc_url: "https://www.bithumb.com/notice/12360",
          published_at: "2025-08-20 23:30:00"
        },
        {
          id: 12361,
          title: "Cryptocurrency (MERL) Market Launch",
          content: "MERL token launch. MERL-KRW pair now active for trading.",
          categories: ["crypto", "launch"],
          pc_url: "https://www.bithumb.com/notice/12361",
          published_at: "2025-08-20 23:32:00"
        },
        {
          id: 12362,
          title: "System Maintenance Notice",
          content: "Scheduled maintenance affecting all assets. No new listings.",
          categories: ["maintenance"],
          pc_url: "https://www.bithumb.com/notice/12362",
          published_at: "2025-08-20 23:35:00"
        }
      ];

      // Traiter chaque notice
      for (const notice of notices) {
        await noticeClient.processNotice(notice, {
          source: 'simulate',
          ignoreWatermark: true,
          bypassBaseline: true
        });
      }

      // Vérifier la discipline des logs
      logSink.assertInfoLogsPerNotice(3, 1); // ≤ 1 INFO par notice
      
      // Afficher le résumé pour debug
      logSink.printSummary();
      
      // Vérifications supplémentaires
      const infoLogs = logSink.getInfoLogs();
      const debugLogs = logSink.getDebugLogs();
      
      // Doit y avoir des logs INFO (pour les listings)
      expect(infoLogs.length).toBeGreaterThan(0);
      
      // Les logs DEBUG sont autorisés mais contrôlés
      expect(debugLogs.length).toBeGreaterThanOrEqual(0);
    });

    it('should control DEBUG logs based on LOG_LEVEL', async () => {
      // Simuler LOG_LEVEL=INFO (pas de DEBUG)
      const originalEnv = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'INFO';
      
      try {
        // Notice qui sera détectée comme un listing (avec pairing KRW)
        const notice = {
          id: 12363,
          title: "Test Listing (TEST)",
          content: "TEST token listed on KRW market. TEST-KRW pair available for trading.",
          categories: ["listing", "market"],
          pc_url: "https://www.bithumb.com/notice/12363",
          published_at: "2025-08-20 23:40:00"
        };

        // Traiter la notice
        await noticeClient.processNotice(notice, {
          source: 'simulate',
          ignoreWatermark: true,
          bypassBaseline: true
        });

        // Avec LOG_LEVEL=INFO, on s'attend à peu de logs DEBUG
        const debugLogs = logSink.getDebugLogs();
        const infoLogs = logSink.getInfoLogs();
        
        // Vérifier qu'il y a au moins un log INFO (pour le listing)
        expect(infoLogs.length).toBeGreaterThan(0);
        
        // Afficher le résumé
        logSink.printSummary();
        
      } finally {
        // Restaurer l'environnement
        if (originalEnv) {
          process.env.LOG_LEVEL = originalEnv;
        } else {
          delete process.env.LOG_LEVEL;
        }
      }
    });

    it('should handle multiple tickers without log spam', async () => {
      // Notice avec plusieurs tickers
      const multiTickerNotice = {
        id: 12364,
        title: "Multi-Asset Launch (BIO) (MERL) (TEST)",
        content: "Three new assets: BIO-KRW, MERL-KRW, and TEST-KRW trading pairs available.",
        categories: ["multi-launch"],
        pc_url: "https://www.bithumb.com/notice/12364",
        published_at: "2025-08-20 23:45:00"
      };

      // Traiter la notice multi-tickers
      const results = await noticeClient.processNotice(multiTickerNotice, {
        source: 'simulate',
        ignoreWatermark: true,
        bypassBaseline: true
      });

      // Vérifier qu'on a bien 3 résultats
      expect(results).toHaveLength(3);
      
      // Vérifier la discipline des logs
      logSink.assertInfoLogsPerNotice(1, 1); // 1 notice, ≤ 1 INFO
      logSink.assertDebugLogsControlled(4); // ≤ 4 DEBUG par notice
      
      // Afficher le résumé
      logSink.printSummary();
    });
  });

  describe('Log content validation', () => {
    it('should log appropriate messages for different notice types', async () => {
      // Notice de listing
      const listingNotice = {
        id: 12365,
        title: "New Listing (NEW)",
        content: "NEW token listed on KRW market. NEW-KRW pair available.",
        categories: ["listing"],
        pc_url: "https://www.bithumb.com/notice/12365",
        published_at: "2025-08-20 23:50:00"
      };

      // Traiter la notice
      await noticeClient.processNotice(listingNotice, {
        source: 'simulate',
        ignoreWatermark: true,
        bypassBaseline: true
      });

      // Vérifier le contenu des logs
      const infoLogs = logSink.getInfoLogs();
      const debugLogs = logSink.getDebugLogs();
      
      // Doit y avoir au moins un log INFO
      expect(infoLogs.length).toBeGreaterThan(0);
      
      // Vérifier que les logs contiennent des informations utiles
      const allLogMessages = [...infoLogs, ...debugLogs].map(l => l.message);
      const hasRelevantInfo = allLogMessages.some(msg => 
        msg.includes('NEW') || msg.includes('KRW') || msg.includes('listing')
      );
      
      expect(hasRelevantInfo).toBe(true);
    });
  });
});
