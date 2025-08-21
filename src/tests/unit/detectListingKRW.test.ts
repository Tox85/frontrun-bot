import { 
  detectListingKRW, 
  detectListingKRWStrict, 
  detectListingKRWLoose 
} from '../../detection/detectListingKRW';

describe('detectListingKRW', () => {
  describe('detectListingKRW', () => {
    it('should reject notice with no tickers', () => {
      const result = detectListingKRW({
        title: 'Maintenance notice',
        body: 'System maintenance',
        tickers: []
      });
      
      expect(result.isListing).toBe(false);
      expect(result.reasons).toContain('NO_TICKERS');
    });

    it('should detect Korean listing with high score', () => {
      const result = detectListingKRW({
        title: '바이오 프로토콜(BIO) 원화 마켓 신규 추가',
        body: '새로운 토큰이 추가되었습니다',
        tickers: ['BIO']
      });
      
      expect(result.isListing).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(2);
      expect(result.reasons).toContain('KR');
      expect(result.market).toBe('KRW');
    });

    it('should detect English listing', () => {
      const result = detectListingKRW({
        title: 'BIO KRW market added',
        body: 'New token listing',
        tickers: ['BIO']
      });
      
      expect(result.isListing).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(2);
      expect(result.reasons).toContain('EN/FR');
      expect(result.market).toBe('KRW');
    });

    it('should detect French listing', () => {
      const result = detectListingKRW({
        title: 'Ajout du marché BIO Won',
        body: 'Nouveau token listé',
        tickers: ['BIO']
      });
      
      expect(result.isListing).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(2);
      expect(result.reasons).toContain('EN/FR');
    });

    it('should score pairing bonus', () => {
      const result = detectListingKRW({
        title: 'BIO-KRW market listing',
        body: 'New trading pair',
        tickers: ['BIO']
      });
      
      expect(result.isListing).toBe(true);
      expect(result.reasons).toContain('Pairing_BIO');
    });

    it('should reject maintenance notice', () => {
      const result = detectListingKRW({
        title: 'Maintenance du wallet (BIO)',
        body: 'Scheduled maintenance',
        tickers: ['BIO']
      });
      
      expect(result.isListing).toBe(false);
      expect(result.score).toBeLessThan(2);
    });

    it('should handle joint listing notice', () => {
      const result = detectListingKRW({
        title: 'LISTA and MERL KRW market listing',
        body: 'Two new tokens added',
        tickers: ['LISTA', 'MERL']
      });
      
      expect(result.isListing).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(2);
    });
  });

  describe('detectListingKRWStrict', () => {
    it('should require Korean or English keywords', () => {
      const result = detectListingKRWStrict({
        title: 'Generic token info',
        body: 'Token information',
        tickers: ['TOKEN']
      });
      
      expect(result.isListing).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should accept Korean listing', () => {
      const result = detectListingKRWStrict({
        title: '바이오 프로토콜(BIO) 원화 마켓 신규 추가',
        body: '새로운 토큰이 추가되었습니다',
        tickers: ['BIO']
      });
      
      expect(result.isListing).toBe(true);
      expect(result.reasons).toContain('KR');
    });
  });

  describe('detectListingKRWLoose', () => {
    it('should accept with score >= 1 and tickers', () => {
      const result = detectListingKRWLoose({
        title: 'TOKEN market listing',
        body: 'New token added to market',
        tickers: ['TOKEN']
      });
      
      expect(result.isListing).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it('should reject with no tickers', () => {
      const result = detectListingKRWLoose({
        title: 'Maintenance notice',
        body: 'System maintenance',
        tickers: []
      });
      
      expect(result.isListing).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle mixed language content', () => {
      const result = detectListingKRW({
        title: 'BIO 원화 마켓 상장 / BIO KRW market listing',
        body: 'New token added',
        tickers: ['BIO']
      });
      
      expect(result.isListing).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('should handle special characters', () => {
      const result = detectListingKRW({
        title: 'BIO-KRW / BIO_KRW market listing',
        body: 'New token added',
        tickers: ['BIO']
      });
      
      expect(result.isListing).toBe(true);
      expect(result.reasons).toContain('Pairing_BIO');
    });
  });
});
