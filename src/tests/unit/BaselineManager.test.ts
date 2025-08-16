import { BaselineManager } from '../../core/BaselineManager';
import { Database } from 'sqlite3';

// Mock de la base de données
const mockDb = {
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn(),
  close: jest.fn()
} as any;

// Mock global de fetch
global.fetch = jest.fn();

describe('BaselineManager', () => {
  let baselineManager: BaselineManager;

  beforeEach(() => {
    jest.clearAllMocks();
    baselineManager = new BaselineManager(mockDb as Database);
  });

  describe('initialization', () => {
    it('should skip initialization if baseline already exists', async () => {
      // Mock: baseline existante avec 200+ tokens
      mockDb.get.mockResolvedValue({
        total: 250,
        lastUpdated: '2024-01-01T00:00:00Z'
      });

      await baselineManager.initialize();

      // Ne devrait pas appeler fetchAndStoreBaseline
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('baseline operations', () => {
    it('should get baseline statistics', async () => {
      // Mock: baseline avec 250 tokens
      mockDb.get.mockResolvedValue({
        total: 250,
        lastUpdated: '2024-01-01T00:00:00Z'
      });

      const stats = await baselineManager.getBaselineStats();

      expect(stats).not.toBeNull();
      expect(stats!.totalTokens).toBe(250);
      expect(stats!.sanity).toBe(true); // 250 >= 200
    });

    it('should return sanity false for small baseline', async () => {
      // Mock: baseline trop petite
      mockDb.get.mockResolvedValue({
        total: 150,
        lastUpdated: '2024-01-01T00:00:00Z'
      });

      const stats = await baselineManager.getBaselineStats();

      expect(stats).not.toBeNull();
      expect(stats!.totalTokens).toBe(150);
      expect(stats!.sanity).toBe(false); // 150 < 200
    });
  });

  describe('health check', () => {
    it('should return health status', async () => {
      // Mock: baseline saine
      mockDb.get.mockResolvedValue({
        total: 250,
        lastUpdated: '2024-01-01T00:00:00Z'
      });

      const health = await baselineManager.healthCheck();

      expect(health.tokenCount).toBe(250);
      expect(health.sanity).toBe(true);
      expect(health.lastUpdated).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('status', () => {
    it('should return correct status', () => {
      const status = baselineManager.getStatus();

      expect(status.isBootOnly).toBe(true);
      expect(status.isInitialized).toBe(false);
      expect(status.baselineUrl).toContain('bithumb.com');
    });
  });
});
