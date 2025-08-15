import { BaselineManager } from '../../core/BaselineManager';
import { TokenRegistry } from '../../store/TokenRegistry';

// Mock TokenRegistry
jest.mock('../../store/TokenRegistry');
const MockTokenRegistry = TokenRegistry as jest.MockedClass<typeof TokenRegistry>;

describe('BaselineManager', () => {
  let baselineManager: BaselineManager;
  let mockTokenRegistry: jest.Mocked<TokenRegistry>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instance
    mockTokenRegistry = {
      getBaselineKRStats: jest.fn(),
      addMultipleToBaselineKR: jest.fn(),
      isInBaselineKR: jest.fn()
    } as any;

    baselineManager = new BaselineManager(mockTokenRegistry);
  });

  describe('constructor', () => {
    it('should initialize with TokenRegistry', () => {
      expect(baselineManager).toBeInstanceOf(BaselineManager);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully when baseline exists', async () => {
      mockTokenRegistry.getBaselineKRStats.mockResolvedValue({
        total: 150,
        bySource: { 'BITHUMB_REST': 150 },
        lastUpdated: '2024-01-01T00:00:00Z'
      });

      await baselineManager.initialize();

      expect(mockTokenRegistry.getBaselineKRStats).toHaveBeenCalled();
    });

    it('should fetch and store baseline when none exists', async () => {
      // Mock fetch pour retourner une réponse valide
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          status: '0000',
          data: {
            'BTC': {
              opening_price: '50000000',
              closing_price: '51000000',
              status: '0000'
            },
            'ETH': {
              opening_price: '3000000',
              closing_price: '3100000',
              status: '0000'
            }
          }
        })
      } as any);

      await baselineManager.initialize();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.bithumb.com/public/ticker/ALL_KRW',
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      mockTokenRegistry.getBaselineKRStats.mockResolvedValue({
        total: 0,
        bySource: {},
        lastUpdated: ''
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(baselineManager.initialize()).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should handle Bithumb API errors', async () => {
      mockTokenRegistry.getBaselineKRStats.mockResolvedValue({
        total: 0,
        bySource: {},
        lastUpdated: ''
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: '9999',
          message: 'API Error'
        })
      });

      await expect(baselineManager.initialize()).rejects.toThrow('Erreur API Bithumb: 9999');
    });
  });

  describe('parseBaselineResponse', () => {
    it('should parse valid Bithumb response correctly', () => {
      const mockResponse = {
        'BTC': {
          opening_price: '50000000',
          closing_price: '51000000',
          status: '0000'
        },
        'ETH': {
          opening_price: '3000000',
          closing_price: '3100000',
          status: '0000'
        },
        'USDT': {
          opening_price: '1300',
          closing_price: '1300',
          status: '0000'
        }
      };

      // Access private method through reflection
      const parseMethod = (baselineManager as any).parseBaselineResponse;
      const tokens = parseMethod(mockResponse);
      
      expect(tokens).toHaveLength(3); // BTC, ETH, and USDT
      expect(tokens[0]).toMatchObject({
        symbol: 'BTC_KRW',
        base: 'BTC',
        quote: 'KRW',
        status: 'ACTIVE'
      });
      expect(tokens[1]).toMatchObject({
        symbol: 'ETH_KRW',
        base: 'ETH',
        quote: 'KRW',
        status: 'ACTIVE'
      });
      expect(tokens[2]).toMatchObject({
        symbol: 'USDT_KRW',
        base: 'USDT',
        quote: 'KRW',
        status: 'ACTIVE'
      });
    });

    it('should filter out tokens without price data', () => {
      const mockResponse = {
        'BTC': {
          opening_price: '50000000',
          closing_price: '51000000',
          status: '0000'
        },
        'INVALID': {
          status: '0000'
          // Pas de prix
        },
        'ETH': {
          opening_price: '3000000',
          closing_price: '3100000',
          status: '0000'
        }
      };

      // Access private method through reflection
      const parseMethod = (baselineManager as any).parseBaselineResponse;
      const tokens = parseMethod(mockResponse);
      
      expect(tokens).toHaveLength(2); // BTC and ETH only (INVALID filtered out)
      expect(tokens.map((t: any) => t.base)).toEqual(['BTC', 'ETH']);
    });

    it('should handle empty response', () => {
      const mockResponse = {};
      
      // Access private method through reflection
      const parseMethod = (baselineManager as any).parseBaselineResponse;
      const tokens = parseMethod(mockResponse);
      expect(tokens).toHaveLength(0);
    });
  });

  describe('isTokenInBaseline', () => {
    it('should check if token exists in baseline', async () => {
      // Mock que la baseline existe déjà
      mockTokenRegistry.getBaselineKRStats.mockResolvedValue({
        total: 100,
        bySource: { 'BITHUMB_REST': 100 },
        lastUpdated: '2024-01-01T00:00:00Z'
      });
      
      mockTokenRegistry.isInBaselineKR.mockResolvedValue(true);

      const result = await baselineManager.isTokenInBaseline('BTC');

      expect(mockTokenRegistry.isInBaselineKR).toHaveBeenCalledWith('BTC');
      expect(result).toBe(true);
    });

    it('should initialize if not already initialized', async () => {
      mockTokenRegistry.isInBaselineKR.mockResolvedValue(false);
      mockTokenRegistry.getBaselineKRStats.mockResolvedValue({
        total: 100,
        bySource: { 'BITHUMB_REST': 100 },
        lastUpdated: '2024-01-01T00:00:00Z'
      });

      const result = await baselineManager.isTokenInBaseline('BTC');

      expect(result).toBe(false);
    });
  });

  describe('isTokenNew', () => {
    it('should return true for new tokens', async () => {
      // Mock que la baseline existe déjà
      mockTokenRegistry.getBaselineKRStats.mockResolvedValue({
        total: 100,
        bySource: { 'BITHUMB_REST': 100 },
        lastUpdated: '2024-01-01T00:00:00Z'
      });
      
      mockTokenRegistry.isInBaselineKR.mockResolvedValue(false);

      const result = await baselineManager.isTokenNew('NEW_TOKEN');

      expect(result).toBe(true);
    });

    it('should return false for existing tokens', async () => {
      // Mock que la baseline existe déjà
      mockTokenRegistry.getBaselineKRStats.mockResolvedValue({
        total: 100,
        bySource: { 'BITHUMB_REST': 100 },
        lastUpdated: '2024-01-01T00:00:00Z'
      });
      
      mockTokenRegistry.isInBaselineKR.mockResolvedValue(true);

      const result = await baselineManager.isTokenNew('EXISTING_TOKEN');

      expect(result).toBe(false);
    });
  });

  describe('getBaselineStats', () => {
    it('should return baseline statistics', async () => {
      mockTokenRegistry.getBaselineKRStats.mockResolvedValue({
        total: 150,
        bySource: { 'BITHUMB_REST': 150 },
        lastUpdated: '2024-01-01T00:00:00Z'
      });

      const stats = await baselineManager.getBaselineStats();

      expect(stats).toMatchObject({
        totalTokens: 150,
        activeTokens: 150,
        lastUpdated: '2024-01-01T00:00:00Z',
        source: 'BITHUMB_REST'
      });
    });

    it('should initialize if not already initialized', async () => {
      mockTokenRegistry.getBaselineKRStats.mockResolvedValue({
        total: 100,
        bySource: { 'BITHUMB_REST': 100 },
        lastUpdated: '2024-01-01T00:00:00Z'
      });

      const stats = await baselineManager.getBaselineStats();

      expect(stats).toBeDefined();
    });
  });

  describe('refreshBaseline', () => {
    it('should refresh baseline from Bithumb', async () => {
      // Mock fetch pour retourner une réponse valide
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          status: '0000',
          data: {
            'BTC': {
              opening_price: '50000000',
              closing_price: '51000000',
              status: '0000'
            },
            'ETH': {
              opening_price: '3000000',
              closing_price: '3100000',
              status: '0000'
            }
          }
        })
      } as any);

      await baselineManager.refreshBaseline();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.bithumb.com/public/ticker/ALL_KRW',
        expect.any(Object)
      );
    });
  });

  describe('healthCheck', () => {
    it('should return health status when healthy', async () => {
      mockTokenRegistry.getBaselineKRStats.mockResolvedValue({
        total: 150,
        bySource: { 'BITHUMB_REST': 150 },
        lastUpdated: '2024-01-01T00:00:00Z'
      });

      const health = await baselineManager.healthCheck();

      expect(health).toMatchObject({
        isInitialized: true,
        baselineExists: true,
        tokenCount: 150,
        lastUpdated: '2024-01-01T00:00:00Z'
      });
    });

    it('should return health status when unhealthy', async () => {
      mockTokenRegistry.getBaselineKRStats.mockRejectedValue(new Error('Database error'));

      const health = await baselineManager.healthCheck();

      expect(health).toMatchObject({
        isInitialized: false,
        baselineExists: false,
        tokenCount: 0,
        lastUpdated: null
      });
    });
  });

  describe('stop', () => {
    it('should stop the manager', async () => {
      await baselineManager.stop();

      // Check that isInitialized is set to false
      const status = baselineManager.getStatus();
      expect(status.isInitialized).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return manager status', () => {
      const status = baselineManager.getStatus();

      expect(status).toMatchObject({
        isInitialized: false,
        baselineUrl: 'https://api.bithumb.com/public/ticker/ALL_KRW'
      });
    });
  });
});
