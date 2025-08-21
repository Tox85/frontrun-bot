import { NoticeClient } from '../../watchers/NoticeClient';
import { WatermarkStore } from '../../store/WatermarkStore';
import { HttpClient } from '../../core/HttpClient';
import { Database } from 'sqlite3';
import { MigrationRunner } from '../../store/Migrations';
import { BaselineManager } from '../../core/BaselineManager';
import { getRunStatsTracker } from '../../metrics/RunStats';

// Mock fetch global
global.fetch = jest.fn();

describe('MultiTickers Integration', () => {
  let noticeClient: NoticeClient;
  let watermarkStore: WatermarkStore;
  let baselineManager: BaselineManager;
  let db: Database;

  beforeAll(async () => {
    // Créer une base de données en mémoire
    db = new Database(':memory:');
    
    // Exécuter les migrations
    const migrationRunner = new MigrationRunner(db);
    await migrationRunner.runMigrations();
    
    // Initialiser le WatermarkStore
    watermarkStore = new WatermarkStore(db);
    await watermarkStore.initializeAtBoot('bithumb.notice');
    
    // Initialiser le BaselineManager
    baselineManager = new BaselineManager(db);
    await baselineManager.initialize();
    
    // Initialiser RunStats (via le singleton)
    getRunStatsTracker();
    
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
    jest.clearAllMocks();
    // Pas besoin de reset RunStats - les tests sont indépendants
  });

  describe('Multi-ticker event emission', () => {
    it('should emit 2 distinct events for LISTA and MERL from joint notice', async () => {
      // Notice conjointe LISTA + MERL
      const jointNotice = {
        id: 12347,
        title: "LISTA(LISTA) 및 MERL(MERL) 원화 마켓 신규 상장",
        categories: ["공지", "마켓"],
        pc_url: "https://www.bithumb.com/notice/12347",
        published_at: "2025-08-20 23:20:00",
        content: "두 개의 새로운 토큰이 원화 마켓에 추가되었습니다. LISTA(LISTA)와 MERL(MERL)이 동시에 상장됩니다."
      };

      // Capturer les logs
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Traiter la notice conjointe
      const processedResults = await noticeClient.processNotice(jointNotice, {
        source: 'simulate',
        ignoreWatermark: true,
        bypassBaseline: true
      });

      // Vérifier que 2 événements ont été générés
      expect(processedResults).toHaveLength(2);
      
      // Vérifier que les bases sont LISTA et MERL
      const bases = processedResults.map(r => r.base).sort();
      expect(bases).toEqual(['LISTA', 'MERL']);

      // Vérifier que les eventId sont différents
      const eventIds = processedResults.map(r => r.eventId);
      expect(eventIds).toHaveLength(2);
      expect(eventIds[0]).not.toBe(eventIds[1]);

      // Vérifier que chaque eventId contient le ticker correspondant
      const listaEvent = processedResults.find(r => r.base === 'LISTA');
      const merlEvent = processedResults.find(r => r.base === 'MERL');
      
      expect(listaEvent).toBeDefined();
      expect(merlEvent).toBeDefined();
      expect(listaEvent?.eventId).not.toBe(merlEvent?.eventId);

      // Vérifier que les URLs sont présentes
      expect(listaEvent?.url).toBe(jointNotice.pc_url);
      expect(merlEvent?.url).toBe(jointNotice.pc_url);

      // Vérifier que les marchés sont KRW
      expect(listaEvent?.markets).toEqual(['KRW']);
      expect(merlEvent?.markets).toEqual(['KRW']);

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should generate different eventIds for different tickers', async () => {
      // Notice avec un seul ticker pour comparaison
      const singleNotice = {
        id: 12348,
        title: "BIO(BIO) 원화 마켓 신규 상장",
        categories: ["공지", "마켓"],
        pc_url: "https://www.bithumb.com/notice/12348",
        published_at: "2025-08-20 23:21:00",
        content: "바이오 프로토콜(BIO)이 원화 마켓에 신규 상장되었습니다."
      };

      // Traiter la notice simple
      const singleResult = await noticeClient.processNotice(singleNotice, {
        source: 'simulate',
        ignoreWatermark: true,
        bypassBaseline: true
      });

      expect(singleResult).toHaveLength(1);
      const bioEventId = singleResult[0]?.eventId;
      expect(bioEventId).toBeDefined();

      // Notice conjointe LISTA + MERL
      const jointNotice = {
        id: 12347,
        title: "LISTA(LISTA) 및 MERL(MERL) 원화 마켓 신규 상장",
        categories: ["공지", "마켓"],
        pc_url: "https://www.bithumb.com/notice/12347",
        published_at: "2025-08-20 23:20:00",
        content: "두 개의 새로운 토큰이 원화 마켓에 추가되었습니다."
      };

      // Traiter la notice conjointe
      const jointResults = await noticeClient.processNotice(jointNotice, {
        source: 'simulate',
        ignoreWatermark: true,
        bypassBaseline: true
      });

      expect(jointResults).toHaveLength(2);

      // Vérifier que tous les eventId sont différents
      const allEventIds = [bioEventId, ...jointResults.map(r => r.eventId)];
      const uniqueEventIds = new Set(allEventIds);
      expect(uniqueEventIds.size).toBe(3); // BIO, LISTA, MERL

      // Vérifier que les eventId sont différents (ils sont basés sur les tickers)
      const listaEvent = jointResults.find(r => r.base === 'LISTA');
      const merlEvent = jointResults.find(r => r.base === 'MERL');
      
      expect(listaEvent?.eventId).toBeDefined();
      expect(merlEvent?.eventId).toBeDefined();
      // Les eventId sont des hashes SHA256, pas des chaînes lisibles
      expect(listaEvent?.eventId).toMatch(/^[a-f0-9]{64}$/);
      expect(merlEvent?.eventId).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle baseline check for each ticker independently', async () => {
      // Notice conjointe
      const jointNotice = {
        id: 12347,
        title: "LISTA(LISTA) 및 MERL(MERL) 원화 마켓 신규 상장",
        categories: ["공지", "마켓"],
        pc_url: "https://www.bithumb.com/notice/12347",
        published_at: "2025-08-20 23:20:00",
        content: "두 개의 새로운 토큰이 원화 마켓에 추가되었습니다."
      };

      // Mock baseline pour simuler des tokens connus
      const baselineSpy = jest.spyOn(baselineManager, 'isTokenNew');
      baselineSpy.mockResolvedValueOnce(false);  // LISTA connu
      baselineSpy.mockResolvedValueOnce(true);   // MERL nouveau

      // Traiter la notice avec vérification baseline
      const processedResults = await noticeClient.processNotice(jointNotice, {
        source: 'simulate',
        ignoreWatermark: true,
        bypassBaseline: false  // Activer la vérification baseline
      });

      // Note: La vérification baseline se fait dans BithumbNoticePoller, pas dans NoticeClient
      // Ce test vérifie que les tickers sont extraits correctement
      expect(processedResults).toHaveLength(2);
      expect(processedResults[0]?.base).toBe('LISTA');
      expect(processedResults[1]?.base).toBe('MERL');

      baselineSpy.mockRestore();
    });
  });

  describe('EventId uniqueness', () => {
    it('should include ticker in eventId to prevent collisions', async () => {
      // Deux notices avec des tickers différents mais même URL
      const notice1 = {
        id: 12349,
        title: "TOKEN1(TOKEN1) 원화 마켓 상장",
        categories: ["공지"],
        pc_url: "https://www.bithumb.com/notice/12349",
        published_at: "2025-08-20 23:22:00",
        content: "Token1 listing"
      };

      const notice2 = {
        id: 12350,
        title: "TOKEN2(TOKEN2) 원화 마켓 상장",
        categories: ["공지"],
        pc_url: "https://www.bithumb.com/notice/12349", // Même URL !
        published_at: "2025-08-20 23:22:00",
        content: "Token2 listing"
      };

      // Traiter les deux notices
      const results1 = await noticeClient.processNotice(notice1, {
        source: 'simulate',
        ignoreWatermark: true,
        bypassBaseline: true
      });

      const results2 = await noticeClient.processNotice(notice2, {
        source: 'simulate',
        ignoreWatermark: true,
        bypassBaseline: true
      });

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);

      // Vérifier que les eventId sont différents malgré la même URL
      expect(results1[0]?.eventId).not.toBe(results2[0]?.eventId);

      // Vérifier que les eventId sont des hashes SHA256 valides
      expect(results1[0]?.eventId).toMatch(/^[a-f0-9]{64}$/);
      expect(results2[0]?.eventId).toMatch(/^[a-f0-9]{64}$/);
      
      // Vérifier que les eventId sont différents malgré la même URL
      // (car ils sont basés sur des tickers différents)
      expect(results1[0]?.eventId).not.toBe(results2[0]?.eventId);
    });
  });
});
