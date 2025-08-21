import { detectListingKRW } from '../../detection/detectListingKRW';
import { extractTickersWithConfidence } from '../../utils/extractTickers';

describe('Pairing-only Detection (sans Hangul)', () => {
  describe('Detection without Hangul words', () => {
    it('should detect listing with ticker pairing only', async () => {
      // Fixture notice sans Hangul mais avec (BIO) et BIO-KRW
      const notice = {
        id: 12350,
        title: "Virtual Asset (BIO) KRW Market New Addition",
        content: "Bio Protocol (BIO) has been newly listed on the KRW market. Trading pairs: BIO-KRW available now.",
        categories: ["notice", "market"],
        pc_url: "https://www.bithumb.com/notice/12350",
        published_at: "2025-08-20 23:30:00"
      };

      const fullText = `${notice.title} ${notice.content}`;

      // Extraire les tickers avec les 2 paramètres requis
      const tickerExtraction = extractTickersWithConfidence(fullText, fullText);

      expect(tickerExtraction.tickers).toContain('BIO');
      expect(tickerExtraction.confidence).toBeGreaterThan(0.5);

      // Détecter le listing KRW avec la structure NoticeInput correcte
      const detection = detectListingKRW({
        title: notice.title,
        body: notice.content,
        tickers: tickerExtraction.tickers
      });

      // Vérifications attendues
      expect(detection.isListing).toBe(true);
      expect(detection.reasons.some(r => r.startsWith('Pairing'))).toBe(true); // Doit contenir "Pairing"
      expect(detection.score).toBeGreaterThanOrEqual(1); // Score ≥ seuil
    });

    it('should detect listing with corrupted English but clear pairing', async () => {
      // Fixture avec anglais corrompu mais pairing clair
      const notice = {
        id: 12351,
        title: "Asset Listing Update - (BIO) Token",
        content: "New cryptocurrency BIO now available. Pairs: BIO-KRW, start trading immediately.",
        categories: ["announcement"],
        pc_url: "https://www.bithumb.com/notice/12351",
        published_at: "2025-08-20 23:32:00"
      };

      const fullText = `${notice.title} ${notice.content}`;

      // Extraire les tickers
      const tickerExtraction = extractTickersWithConfidence(fullText, fullText);

      expect(tickerExtraction.tickers).toContain('BIO');

      // Détecter le listing KRW
      const detection = detectListingKRW({
        title: notice.title,
        body: notice.content,
        tickers: tickerExtraction.tickers
      });

      // Vérifications
      expect(detection.isListing).toBe(true);
      expect(detection.reasons.some(r => r.startsWith('Pairing'))).toBe(true);
      expect(detection.score).toBeGreaterThanOrEqual(1);
    });

    it('should detect listing with KRW BIO format', async () => {
      // Fixture avec format "KRW BIO" au lieu de "BIO-KRW"
      const notice = {
        id: 12352,
        title: "Market Addition Notice (BIO)",
        content: "Bio Protocol token added to exchange. Available markets: KRW BIO trading active.",
        categories: ["market", "notice"],
        pc_url: "https://www.bithumb.com/notice/12352",
        published_at: "2025-08-20 23:35:00"
      };

      const fullText = `${notice.title} ${notice.content}`;

      // Extraire les tickers
      const tickerExtraction = extractTickersWithConfidence(fullText, fullText);

      expect(tickerExtraction.tickers).toContain('BIO');

      // Détecter le listing KRW
      const detection = detectListingKRW({
        title: notice.title,
        body: notice.content,
        tickers: tickerExtraction.tickers
      });

      // Vérifications
      expect(detection.isListing).toBe(true);
      expect(detection.reasons.some(r => r.startsWith('Pairing'))).toBe(true);
      expect(detection.score).toBeGreaterThanOrEqual(1);
    });

    it('should not require Hangul words for detection', async () => {
      // Fixture entièrement en anglais sans mots coréens
      const notice = {
        id: 12353,
        title: "Cryptocurrency (BIO) Market Launch",
        content: "Bio Protocol (BIO) cryptocurrency launch. BIO-KRW pair now active for trading.",
        categories: ["crypto", "launch"],
        pc_url: "https://www.bithumb.com/notice/12353",
        published_at: "2025-08-20 23:40:00"
      };

      const fullText = `${notice.title} ${notice.content}`;

      // Extraire les tickers
      const tickerExtraction = extractTickersWithConfidence(fullText, fullText);

      expect(tickerExtraction.tickers).toContain('BIO');

      // Détecter le listing KRW
      const detection = detectListingKRW({
        title: notice.title,
        body: notice.content,
        tickers: tickerExtraction.tickers
      });

      // Vérifications - pas de mots Hangul nécessaires
      expect(detection.isListing).toBe(true);
      expect(detection.reasons.some(r => r.startsWith('Pairing'))).toBe(true);
      expect(detection.score).toBeGreaterThanOrEqual(1);
      
      // Vérifier qu'aucun mot Hangul n'est requis
      const text = `${notice.title} ${notice.content}`;
      const hasHangul = /[\uAC00-\uD7AF]/.test(text);
      expect(hasHangul).toBe(false); // Pas de Hangul
    });
  });

  describe('Edge cases for pairing-only detection', () => {
    it('should handle multiple tickers with pairing', async () => {
      // Notice avec plusieurs tickers et pairings
      const notice = {
        id: 12354,
        title: "Multi-Asset Launch (BIO) (MERL)",
        content: "Two new assets: BIO-KRW and MERL-KRW trading pairs available.",
        categories: ["multi-launch"],
        pc_url: "https://www.bithumb.com/notice/12354",
        published_at: "2025-08-20 23:45:00"
      };

      const fullText = `${notice.title} ${notice.content}`;

      // Extraire les tickers
      const tickerExtraction = extractTickersWithConfidence(fullText, fullText);

      expect(tickerExtraction.tickers).toContain('BIO');
      expect(tickerExtraction.tickers).toContain('MERL');

      // Détecter le listing KRW
      const detection = detectListingKRW({
        title: notice.title,
        body: notice.content,
        tickers: tickerExtraction.tickers
      });

      // Vérifications
      expect(detection.isListing).toBe(true);
      expect(detection.reasons.some(r => r.startsWith('Pairing'))).toBe(true);
      expect(detection.score).toBeGreaterThanOrEqual(1);
    });

    it('should reject non-listing notices even with ticker mentions', async () => {
      // Notice de maintenance avec mention de ticker mais sans pairing
      const notice = {
        id: 12355,
        title: "System Maintenance Notice (BIO)",
        content: "Scheduled maintenance affecting BIO and other assets. No new listings.",
        categories: ["maintenance"],
        pc_url: "https://www.bithumb.com/notice/12355",
        published_at: "2025-08-20 23:50:00"
      };

      const fullText = `${notice.title} ${notice.content}`;

      // Extraire les tickers
      const tickerExtraction = extractTickersWithConfidence(fullText, fullText);

      expect(tickerExtraction.tickers).toContain('BIO');

      // Détecter le listing KRW
      const detection = detectListingKRW({
        title: notice.title,
        body: notice.content,
        tickers: tickerExtraction.tickers
      });

      // Vérifications - doit rejeter car pas de pairing clair
      expect(detection.isListing).toBe(false);
      expect(detection.score).toBeLessThan(2);
    });
  });
});
