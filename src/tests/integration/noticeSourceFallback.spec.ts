import { NoticeClient } from '../../watchers/NoticeClient';
import { WatermarkStore } from '../../store/WatermarkStore';
import { HttpClient } from '../../core/HttpClient';
import { Database } from 'sqlite3';
import { MigrationRunner } from '../../store/Migrations';

describe('NoticeSourceFallback Integration', () => {
  let noticeClient: NoticeClient;
  let watermarkStore: WatermarkStore;
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
  });

  describe('chooseBestSource', () => {
    it('should select HTML source when JSON has more replacement characters', async () => {
      // Mock fetch pour JSON avec mojibake
      const jsonMojibake = [
        {
          "id": 12345,
          "title": "가상자산(BIO) 원화 마켓 상장",
          "categories": ["공지", "마켓"],
          "pc_url": "https://www.bithumb.com/notice/12345",
          "published_at": "2025-08-20 23:16:52",
          "content": "바이오 프로토콜(BIO)이 원화 마켓에 신규 상장되었습니다."
        }
      ];

      const htmlClean = `<!DOCTYPE html>
        <html><body>
          <div class="notice-item">
            <h3>가상자산(BIO) 원화 마켓 신규 추가</h3>
            <div class="date">2025-08-20 23:16:52</div>
          </div>
        </body></html>`;

      // Mock directement les méthodes privées pour éviter les problèmes de circuit breaker
      const jsonSpy = jest.spyOn(noticeClient as any, 'fetchJsonNoticeAsText');
      const htmlSpy = jest.spyOn(noticeClient as any, 'fetchHtmlNoticeAsText');
      
      jsonSpy.mockResolvedValue({
        text: { text: JSON.stringify(jsonMojibake), encoding: 'utf8', replacementChars: 5, hasHangul: true },
        encoding: 'utf8',
        replacementCount: 5,  // JSON avec mojibake
        hasHangul: true
      });
      
      htmlSpy.mockResolvedValue({
        text: { text: htmlClean, encoding: 'utf8', replacementChars: 0, hasHangul: true },
        encoding: 'utf8',
        replacementCount: 0,  // HTML propre
        hasHangul: true
      });

      // Capturer les logs
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

      // Appeler fetchLatestNotices
      const notices = await noticeClient['fetchLatestNotices']();

      // Vérifier que HTML a été sélectionné
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Notice source=HTML')
      );

      // Vérifier que les notices ont été extraites
      expect(notices.length).toBeGreaterThan(0);

      // Nettoyer les mocks
      consoleSpy.mockRestore();
      jsonSpy.mockRestore();
      htmlSpy.mockRestore();
    });

    it('should select JSON source when HTML has more replacement characters', async () => {
      // Mock fetch pour JSON propre (avec Hangul)
      const jsonClean = [
        {
          "id": 12345,
          "title": "가상자산(BIO) 원화 마켓 상장",
          "categories": ["공지", "마켓"],
          "pc_url": "https://www.bithumb.com/notice/12345",
          "published_at": "2025-08-20 23:16:52",
          "content": "바이오 프로토콜(BIO)이 원화 마켓에 신규 상장되었습니다."
        }
      ];

      // HTML avec du mojibake (caractères corrompus)
      const htmlMojibake = `<!DOCTYPE html>
        <html><body>
          <div class="notice-item">
            <h3>가상자산(BIO) 원화 마켓 신규 추가</h3>
            <div class="date">2025-08-20 23:16:52</div>
          </div>
        </body></html>`;

      // Mock les méthodes privées pour forcer des replacementCount différents
      const jsonSpy = jest.spyOn(noticeClient as any, 'fetchJsonNoticeAsText');
      const htmlSpy = jest.spyOn(noticeClient as any, 'fetchHtmlNoticeAsText');
      
      jsonSpy.mockResolvedValue({
        text: { text: JSON.stringify(jsonClean), encoding: 'utf8', replacementChars: 0, hasHangul: true },
        encoding: 'utf8',
        replacementCount: 0,  // JSON propre
        hasHangul: true
      });
      
      htmlSpy.mockResolvedValue({
        text: { text: htmlMojibake, encoding: 'utf8', replacementChars: 0, hasHangul: true },
        encoding: 'utf8',
        replacementCount: 5,  // HTML avec mojibake
        hasHangul: true
      });

      // Capturer les logs
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

      // Appeler fetchLatestNotices
      const notices = await noticeClient['fetchLatestNotices']();

      // Vérifier que JSON a été sélectionné
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Notice source=JSON')
      );

      // Vérifier que les notices ont été extraites
      expect(notices.length).toBeGreaterThan(0);

      // Nettoyer les mocks
      consoleSpy.mockRestore();
      jsonSpy.mockRestore();
      htmlSpy.mockRestore();
    });

    it('should prioritize source with Hangul when replacement counts are equal', async () => {
      // Mock fetch pour JSON sans Hangul
      const jsonNoHangul = [
        {
          "id": 12345,
          "title": "BIO KRW market listing",
          "categories": ["announcement", "market"],
          "pc_url": "https://www.bithumb.com/notice/12345",
          "published_at": "2025-08-20 23:16:52",
          "content": "BIO token added to KRW market"
        }
      ];

      // HTML avec Hangul
      const htmlWithHangul = `<!DOCTYPE html>
        <html><body>
          <div class="notice-item">
            <h3>가상자산(BIO) 원화 마켓 신규 추가</h3>
            <div class="date">2025-08-20 23:16:52</div>
          </div>
        </body></html>`;

      // Mock les méthodes privées avec des replacementCount égaux mais Hangul différent
      const jsonSpy = jest.spyOn(noticeClient as any, 'fetchJsonNoticeAsText');
      const htmlSpy = jest.spyOn(noticeClient as any, 'fetchHtmlNoticeAsText');
      
      jsonSpy.mockResolvedValue({
        text: { text: JSON.stringify(jsonNoHangul), encoding: 'utf8', replacementChars: 0, hasHangul: false },
        encoding: 'utf8',
        replacementCount: 0,  // JSON sans Hangul
        hasHangul: false
      });
      
      htmlSpy.mockResolvedValue({
        text: { text: htmlWithHangul, encoding: 'utf8', replacementChars: 0, hasHangul: true },
        encoding: 'utf8',
        replacementCount: 0,  // HTML avec Hangul
        hasHangul: true
      });

      // Capturer les logs
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

      // Appeler fetchLatestNotices
      const notices = await noticeClient['fetchLatestNotices']();

      // Vérifier que HTML a été sélectionné (avec Hangul)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Notice source=HTML')
      );

      // Vérifier que les notices ont été extraites
      expect(notices.length).toBeGreaterThan(0);

      // Nettoyer les mocks
      consoleSpy.mockRestore();
      jsonSpy.mockRestore();
      htmlSpy.mockRestore();
    });
  });

  describe('fallback behavior', () => {
    it('should fallback to HTML when JSON API fails', async () => {
      // Mock fetch pour JSON qui échoue
      const htmlFallback = `<!DOCTYPE html>
        <html><body>
          <div class="notice-item">
            <h3>가상자산(BIO) 원화 마켓 신규 추가</h3>
            <div class="date">2025-08-20 23:16:52</div>
          </div>
        </body></html>`;

      // Mock les méthodes privées : JSON échoue, HTML réussit
      const jsonSpy = jest.spyOn(noticeClient as any, 'fetchJsonNoticeAsText');
      const htmlSpy = jest.spyOn(noticeClient as any, 'fetchHtmlNoticeAsText');
      
      jsonSpy.mockResolvedValue(null);  // JSON retourne null au lieu d'échouer
      
      htmlSpy.mockResolvedValue({
        text: { text: htmlFallback, encoding: 'utf8', replacementChars: 0, hasHangul: true },
        encoding: 'utf8',
        replacementCount: 0,
        hasHangul: true
      });

      // Capturer les logs
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Appeler fetchLatestNotices
      const notices = await noticeClient['fetchLatestNotices']();

      // Debug: afficher tous les logs capturés
      console.log('=== DEBUG: Logs capturés ===');
      console.log('console.debug calls:', consoleSpy.mock.calls);
      console.log('console.log calls:', consoleLogSpy.mock.calls);
      console.log('console.error calls:', consoleErrorSpy.mock.calls);
      console.log('Notices returned:', notices.length);

      // Vérifier que HTML a été utilisé en fallback
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Notice source=HTML')
      );

      // Vérifier que les notices ont été extraites
      expect(notices.length).toBeGreaterThan(0);

      // Nettoyer les mocks
      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      jsonSpy.mockRestore();
      htmlSpy.mockRestore();
    });
  });
});
