import { SymbolMapper } from '../../core/SymbolMapper';

describe('SymbolMapper', () => {
  let symbolMapper: SymbolMapper;

  beforeEach(() => {
    symbolMapper = SymbolMapper.getInstance();
  });

  describe('normalizeSymbol', () => {
    it('should normalize Bybit symbols correctly', () => {
      const result = symbolMapper.normalizeSymbol('BTCUSDT', 'BYBIT');
      expect(result).toEqual({
        base: 'BTC',
        quote: 'USDT',
        exchange: 'BYBIT',
        original: 'BTCUSDT'
      });
    });

    it('should normalize Hyperliquid symbols correctly', () => {
      const result = symbolMapper.normalizeSymbol('BTCUSD', 'HYPERLIQUID');
      expect(result).toEqual({
        base: 'BTC',
        quote: 'USD',
        exchange: 'HYPERLIQUID',
        original: 'BTCUSD'
      });
    });

    it('should normalize Binance symbols correctly', () => {
      const result = symbolMapper.normalizeSymbol('ETHUSDT', 'BINANCE');
      expect(result).toEqual({
        base: 'ETH',
        quote: 'USDT',
        exchange: 'BINANCE',
        original: 'ETHUSDT'
      });
    });

    it('should normalize Bithumb symbols correctly', () => {
      const result = symbolMapper.normalizeSymbol('BTC_KRW', 'BITHUMB');
      expect(result).toEqual({
        base: 'BTC',
        quote: 'KRW',
        exchange: 'BITHUMB',
        original: 'BTC_KRW'
      });
    });

    it('should return null for unsupported exchange', () => {
      const result = symbolMapper.normalizeSymbol('BTCUSDT', 'UNSUPPORTED');
      expect(result).toBeNull();
    });

    it('should return null for invalid symbol format', () => {
      const result = symbolMapper.normalizeSymbol('INVALID', 'BYBIT');
      expect(result).toBeNull();
    });
  });

  describe('extractBase', () => {
    it('should extract base from Bybit symbol', () => {
      const result = symbolMapper.extractBase('BTCUSDT', 'BYBIT');
      expect(result).toBe('BTC');
    });

    it('should extract base from Hyperliquid symbol', () => {
      const result = symbolMapper.extractBase('ETHUSD', 'HYPERLIQUID');
      expect(result).toBe('ETH');
    });

    it('should return null for invalid symbol', () => {
      const result = symbolMapper.extractBase('INVALID', 'BYBIT');
      expect(result).toBeNull();
    });
  });

  describe('generateSymbol', () => {
    it('should generate Bybit symbol', () => {
      const result = symbolMapper.generateSymbol('BTC', 'USDT', 'BYBIT');
      expect(result).toBe('BTCUSDT');
    });

    it('should generate Hyperliquid symbol', () => {
      const result = symbolMapper.generateSymbol('ETH', 'USD', 'HYPERLIQUID');
      expect(result).toBe('ETHUSD');
    });

    it('should generate Bithumb symbol', () => {
      const result = symbolMapper.generateSymbol('BTC', 'KRW', 'BITHUMB');
      expect(result).toBe('BTC_KRW');
    });

    it('should throw error for unsupported exchange', () => {
      expect(() => {
        symbolMapper.generateSymbol('BTC', 'USDT', 'UNSUPPORTED');
      }).toThrow('Exchange non supporté: UNSUPPORTED');
    });
  });

  describe('isValidSymbol', () => {
    it('should validate valid Bybit symbol', () => {
      const result = symbolMapper.isValidSymbol('BTCUSDT', 'BYBIT');
      expect(result).toBe(true);
    });

    it('should validate valid Hyperliquid symbol', () => {
      const result = symbolMapper.isValidSymbol('ETHUSD', 'HYPERLIQUID');
      expect(result).toBe(true);
    });

    it('should reject invalid symbol', () => {
      const result = symbolMapper.isValidSymbol('INVALID', 'BYBIT');
      expect(result).toBe(false);
    });
  });

  describe('getSupportedQuotes', () => {
    it('should return supported quotes for Bybit', () => {
      const result = symbolMapper.getSupportedQuotes('BYBIT');
      expect(result).toContain('USDT');
      expect(result).toContain('BTC');
      expect(result).toContain('ETH');
    });

    it('should return supported quotes for Hyperliquid', () => {
      const result = symbolMapper.getSupportedQuotes('HYPERLIQUID');
      expect(result).toContain('USD');
      expect(result).toContain('USDC');
    });

    it('should return empty array for unsupported exchange', () => {
      const result = symbolMapper.getSupportedQuotes('UNSUPPORTED');
      expect(result).toEqual([]);
    });
  });

  describe('convertSymbol', () => {
    it('should convert Bybit to Hyperliquid symbol', () => {
      const result = symbolMapper.convertSymbol('BTCUSDT', 'BYBIT', 'HYPERLIQUID');
      expect(result).toBe('BTCUSD');
    });

    it('should convert Hyperliquid to Binance symbol', () => {
      const result = symbolMapper.convertSymbol('ETHUSD', 'HYPERLIQUID', 'BINANCE');
      expect(result).toBe('ETHUSDT');
    });

    it('should return null for unsupported conversion', () => {
      const result = symbolMapper.convertSymbol('BTCUSDT', 'BYBIT', 'UNSUPPORTED');
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return mapping statistics', () => {
      const stats = symbolMapper.getStats();
      expect(stats).toHaveProperty('totalExchanges');
      expect(stats).toHaveProperty('supportedQuotes');
      expect(stats).toHaveProperty('totalPatterns');
      expect(stats.supportedQuotes).toHaveProperty('BYBIT');
      expect(stats.supportedQuotes).toHaveProperty('HYPERLIQUID');
      expect(stats.supportedQuotes).toHaveProperty('BINANCE');
      expect(stats.supportedQuotes).toHaveProperty('BITHUMB');
    });
  });
});
