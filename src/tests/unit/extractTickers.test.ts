import { 
  normalizeBrackets, 
  extractTickersFromText, 
  calculateExtractionConfidence,
  extractTickersWithConfidence 
} from '../../utils/extractTickers';

describe('extractTickers', () => {
  describe('normalizeBrackets', () => {
    it('should normalize full-width parentheses to ASCII', () => {
      expect(normalizeBrackets('가상자산（BIO）원화')).toBe('가상자산(BIO)원화');
      expect(normalizeBrackets('토큰（TOWNS）상장')).toBe('토큰(TOWNS)상장');
    });

    it('should normalize full-width quotes', () => {
      expect(normalizeBrackets('"BIO" 「상장」')).toBe('"BIO" "상장"');
    });

    it('should handle mixed brackets', () => {
      expect(normalizeBrackets('［BIO］（상장）')).toBe('BIO (상장)');
    });
  });

  describe('extractTickersFromText', () => {
    it('should extract single ticker from Korean text', () => {
      const result = extractTickersFromText('가상자산(BIO) 원화 마켓 상장');
      expect(result).toEqual(['BIO']);
    });

    it('should extract single ticker from full-width parentheses', () => {
      const result = extractTickersFromText('가상자산（BIO）원화 마켓 상장');
      expect(result).toEqual(['BIO']);
    });

    it('should extract multiple tickers from joint notice', () => {
      const result = extractTickersFromText('LISTA(LISTA) 상장, MERL(MERL) 상장');
      expect(result).toEqual(['LISTA', 'MERL']);
    });

    it('should filter out blacklisted tokens', () => {
      const result = extractTickersFromText('토큰(KRW) 상장, 코인(USDT) 추가');
      expect(result).toEqual([]);
    });

    it('should prioritize shorter tickers first', () => {
      const result = extractTickersFromText('토큰(ABCDEFGHIJ) 상장, 코인(ABC) 추가');
      expect(result).toEqual(['ABC', 'ABCDEFGHIJ']);
    });

    it('should handle mojibake text', () => {
      const result = extractTickersFromText('Ù░öý… (BIO) …');
      expect(result).toEqual(['BIO']);
    });

    it('should return empty array for no tickers', () => {
      const result = extractTickersFromText('가상자산 원화 마켓 상장');
      expect(result).toEqual([]);
    });
  });

  describe('calculateExtractionConfidence', () => {
    it('should calculate high confidence for clean text', () => {
      const confidence = calculateExtractionConfidence(
        'Original text',
        '가상자산(BIO) 원화 마켓 상장',
        ['BIO']
      );
      expect(confidence).toBeGreaterThan(0.8);
    });

    it('should penalize replacement characters', () => {
      const confidence = calculateExtractionConfidence(
        'Original text',
        '가상자산(BIO) 원화 마켓 상장',
        ['BIO']
      );
      expect(confidence).toBeGreaterThan(0.7);
    });

    it('should bonus Hangul detection', () => {
      const confidence = calculateExtractionConfidence(
        'Original text',
        '가상자산(BIO) 원화 마켓 상장',
        ['BIO']
      );
      expect(confidence).toBeGreaterThan(0.8);
    });

    it('should handle short text', () => {
      const confidence = calculateExtractionConfidence(
        'Hi',
        'Hi',
        []
      );
      expect(confidence).toBe(0.8);
    });
  });

  describe('extractTickersWithConfidence', () => {
    it('should return complete extraction result', () => {
      const result = extractTickersWithConfidence(
        'Original text',
        '가상자산(BIO) 원화 마켓 상장'
      );
      
      expect(result.tickers).toEqual(['BIO']);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.hasHangul).toBe(true);
      expect(result.replacementChars).toBeGreaterThanOrEqual(0);
    });

    it('should handle text with replacement characters', () => {
      const result = extractTickersWithConfidence(
        'Original text',
        'Ù░öý… (BIO) …\uFFFD\uFFFD'
      );
      
      expect(result.tickers).toEqual(['BIO']);
      expect(result.replacementChars).toBeGreaterThan(0);
    });
  });
});
