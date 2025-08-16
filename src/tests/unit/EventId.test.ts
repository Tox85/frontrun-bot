import { buildEventId, isValidEventId } from '../../core/EventId';

describe('EventId Builders', () => {
  describe('buildNoticeEventId', () => {
    it('should generate deterministic eventId for notice with base', () => {
      const data = {
        source: 'bithumb.notice' as const,
        base: 'TOWNS',
        url: 'https://www.bithumb.com/notice/123',
        markets: ['KRW'],
        tradeTimeUtc: '2024-01-01T12:00:00Z'
      };

      const eventId1 = buildEventId(data);
      const eventId2 = buildEventId(data);

      expect(eventId1).toBe(eventId2);
      expect(isValidEventId(eventId1)).toBe(true);
      expect(eventId1).toHaveLength(64); // SHA256 hex
    });

    it('should generate deterministic eventId for notice without base', () => {
      const data = {
        source: 'bithumb.notice' as const,
        base: '',
        url: 'https://www.bithumb.com/notice/456',
        markets: ['KRW', 'USDT'],
        tradeTimeUtc: '2024-01-01T13:00:00Z'
      };

      const eventId1 = buildEventId(data);
      const eventId2 = buildEventId(data);

      expect(eventId1).toBe(eventId2);
      expect(isValidEventId(eventId1)).toBe(true);
    });

    it('should handle different markets order consistently', () => {
      const data1 = {
        source: 'bithumb.notice' as const,
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/789',
        markets: ['KRW', 'USDT'],
        tradeTimeUtc: '2024-01-01T14:00:00Z'
      };

      const data2 = {
        source: 'bithumb.notice' as const,
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/789',
        markets: ['USDT', 'KRW'], // Different order
        tradeTimeUtc: '2024-01-01T14:00:00Z'
      };

      const eventId1 = buildEventId(data1);
      const eventId2 = buildEventId(data2);

      expect(eventId1).toBe(eventId2); // Should be same due to sorting
    });

    it('should handle duplicate markets', () => {
      const data = {
        source: 'bithumb.notice' as const,
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/999',
        markets: ['KRW', 'KRW', 'USDT', 'USDT'], // Duplicates
        tradeTimeUtc: '2024-01-01T15:00:00Z'
      };

      const eventId = buildEventId(data);
      expect(isValidEventId(eventId)).toBe(true);
    });

    it('should normalize URL correctly', () => {
      const data1 = {
        source: 'bithumb.notice' as const,
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/123?param1=value1&param2=value2',
        markets: ['KRW'],
        tradeTimeUtc: '2024-01-01T16:00:00Z'
      };

      const data2 = {
        source: 'bithumb.notice' as const,
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/456?param1=value1&param2=value2', // Different notice ID
        markets: ['KRW'],
        tradeTimeUtc: '2024-01-01T16:00:00Z'
      };

      const eventId1 = buildEventId(data1);
      const eventId2 = buildEventId(data2);

      // Should be different because notice IDs are different
      expect(eventId1).not.toBe(eventId2);
    });

    it('should handle missing tradeTimeUtc', () => {
      const data = {
        source: 'bithumb.notice' as const,
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/123',
        markets: ['KRW']
        // tradeTimeUtc missing
      };

      const eventId = buildEventId(data);
      expect(isValidEventId(eventId)).toBe(true);
    });
  });

  describe('buildWsEventId', () => {
    it('should generate deterministic eventId for WebSocket', () => {
      const data = { 
        source: 'bithumb.ws' as const,
        base: 'TOWNS' 
      };

      const eventId1 = buildEventId(data);
      const eventId2 = buildEventId(data);

      expect(eventId1).toBe(eventId2);
      expect(isValidEventId(eventId1)).toBe(true);
      expect(eventId1).toHaveLength(64); // SHA256 hex
    });

    it('should handle different base cases consistently', () => {
      const data1 = { 
        source: 'bithumb.ws' as const,
        base: 'towns' 
      };
      const data2 = { 
        source: 'bithumb.ws' as const,
        base: 'TOWNS' 
      };
      const data3 = { 
        source: 'bithumb.ws' as const,
        base: 'Towns' 
      };

      const eventId1 = buildEventId(data1);
      const eventId2 = buildEventId(data2);
      const eventId3 = buildEventId(data3);

      // All should be the same due to toUpperCase()
      expect(eventId1).toBe(eventId2);
      expect(eventId2).toBe(eventId3);
    });

    it('should generate different eventIds for different bases', () => {
      const data1 = { 
        source: 'bithumb.ws' as const,
        base: 'TOWNS' 
      };
      const data2 = { 
        source: 'bithumb.ws' as const,
        base: 'ETH' 
      };

      const eventId1 = buildEventId(data1);
      const eventId2 = buildEventId(data2);

      expect(eventId1).not.toBe(eventId2);
    });
  });

  describe('isValidEventId', () => {
    it('should validate correct SHA256 hex strings', () => {
      const validEventId = 'a'.repeat(64); // 64 hex chars
      expect(isValidEventId(validEventId)).toBe(true);
    });

    it('should reject invalid eventIds', () => {
      expect(isValidEventId('')).toBe(false);
      expect(isValidEventId('123')).toBe(false);
      expect(isValidEventId('a'.repeat(63))).toBe(false); // Too short
      expect(isValidEventId('a'.repeat(65))).toBe(false); // Too long
      expect(isValidEventId('g'.repeat(64))).toBe(false); // Invalid hex char
      expect(isValidEventId('A'.repeat(64))).toBe(false); // Uppercase not valid for our use case
    });
  });

  describe('Deterministic behavior', () => {
    it('should generate same eventId for identical data across multiple calls', () => {
      const noticeData = {
        source: 'bithumb.notice' as const,
        base: 'DETERMINISTIC',
        url: 'https://www.bithumb.com/notice/deterministic',
        markets: ['KRW'],
        tradeTimeUtc: '2024-01-01T00:00:00Z'
      };

      const wsData = { 
        source: 'bithumb.ws' as const,
        base: 'DETERMINISTIC' 
      };

      const noticeEventIds = Array(10).fill(null).map(() => buildEventId(noticeData));
      const wsEventIds = Array(10).fill(null).map(() => buildEventId(wsData));

      // All should be identical
      expect(new Set(noticeEventIds).size).toBe(1);
      expect(new Set(wsEventIds).size).toBe(1);

      // Should be different between notice and ws
      expect(noticeEventIds[0]).not.toBe(wsEventIds[0]);
    });

    it('should generate different eventIds for different data', () => {
      const data1 = {
        source: 'bithumb.notice' as const,
        base: 'TOKEN1',
        url: 'https://www.bithumb.com/notice/1',
        markets: ['KRW'],
        tradeTimeUtc: '2024-01-01T00:00:00Z'
      };

      const data2 = {
        source: 'bithumb.notice' as const,
        base: 'TOKEN2',
        url: 'https://www.bithumb.com/notice/2',
        markets: ['KRW'],
        tradeTimeUtc: '2024-01-01T00:00:00Z'
      };

      const eventId1 = buildEventId(data1);
      const eventId2 = buildEventId(data2);

      expect(eventId1).not.toBe(eventId2);
    });
  });
});
