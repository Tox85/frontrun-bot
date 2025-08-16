import { buildNoticeEventId, buildWsEventId, isValidEventId } from '../../core/EventId';

describe('EventId Builders', () => {
  describe('buildNoticeEventId', () => {
    it('should generate deterministic eventId for notice with base', () => {
      const data = {
        base: 'TOWNS',
        url: 'https://www.bithumb.com/notice/123',
        markets: ['KRW'],
        tradeTimeIso: '2024-01-01T12:00:00Z'
      };

      const eventId1 = buildNoticeEventId(data);
      const eventId2 = buildNoticeEventId(data);

      expect(eventId1).toBe(eventId2);
      expect(isValidEventId(eventId1)).toBe(true);
      expect(eventId1).toHaveLength(64); // SHA256 hex
    });

    it('should generate deterministic eventId for notice without base', () => {
      const data = {
        base: null,
        url: 'https://www.bithumb.com/notice/456',
        markets: ['KRW', 'USDT'],
        tradeTimeIso: '2024-01-01T13:00:00Z'
      };

      const eventId1 = buildNoticeEventId(data);
      const eventId2 = buildNoticeEventId(data);

      expect(eventId1).toBe(eventId2);
      expect(isValidEventId(eventId1)).toBe(true);
    });

    it('should handle different markets order consistently', () => {
      const data1 = {
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/789',
        markets: ['KRW', 'USDT'],
        tradeTimeIso: '2024-01-01T14:00:00Z'
      };

      const data2 = {
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/789',
        markets: ['USDT', 'KRW'], // Different order
        tradeTimeIso: '2024-01-01T14:00:00Z'
      };

      const eventId1 = buildNoticeEventId(data1);
      const eventId2 = buildNoticeEventId(data2);

      expect(eventId1).toBe(eventId2); // Should be same due to sorting
    });

    it('should handle duplicate markets', () => {
      const data = {
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/999',
        markets: ['KRW', 'KRW', 'USDT', 'USDT'], // Duplicates
        tradeTimeIso: '2024-01-01T15:00:00Z'
      };

      const eventId = buildNoticeEventId(data);
      expect(isValidEventId(eventId)).toBe(true);
    });

    it('should normalize URL correctly', () => {
      const data1 = {
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/123?param1=value1&param2=value2',
        markets: ['KRW'],
        tradeTimeIso: '2024-01-01T16:00:00Z'
      };

      const data2 = {
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/456?param1=value1&param2=value2', // Different notice ID
        markets: ['KRW'],
        tradeTimeIso: '2024-01-01T16:00:00Z'
      };

      const eventId1 = buildNoticeEventId(data1);
      const eventId2 = buildNoticeEventId(data2);

      // Should be different because notice IDs are different
      expect(eventId1).not.toBe(eventId2);
    });

    it('should handle missing tradeTimeIso', () => {
      const data = {
        base: 'TEST',
        url: 'https://www.bithumb.com/notice/123',
        markets: ['KRW']
        // tradeTimeIso missing
      };

      const eventId = buildNoticeEventId(data);
      expect(isValidEventId(eventId)).toBe(true);
    });
  });

  describe('buildWsEventId', () => {
    it('should generate deterministic eventId for WebSocket', () => {
      const data = { base: 'TOWNS' };

      const eventId1 = buildWsEventId(data);
      const eventId2 = buildWsEventId(data);

      expect(eventId1).toBe(eventId2);
      expect(isValidEventId(eventId1)).toBe(true);
      expect(eventId1).toHaveLength(64); // SHA256 hex
    });

    it('should handle different base cases consistently', () => {
      const data1 = { base: 'towns' };
      const data2 = { base: 'TOWNS' };
      const data3 = { base: 'Towns' };

      const eventId1 = buildWsEventId(data1);
      const eventId2 = buildWsEventId(data2);
      const eventId3 = buildWsEventId(data3);

      // All should be the same due to toUpperCase()
      expect(eventId1).toBe(eventId2);
      expect(eventId2).toBe(eventId3);
    });

    it('should generate different eventIds for different bases', () => {
      const data1 = { base: 'TOWNS' };
      const data2 = { base: 'ETH' };

      const eventId1 = buildWsEventId(data1);
      const eventId2 = buildWsEventId(data2);

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
        base: 'DETERMINISTIC',
        url: 'https://www.bithumb.com/notice/deterministic',
        markets: ['KRW'],
        tradeTimeIso: '2024-01-01T00:00:00Z'
      };

      const wsData = { base: 'DETERMINISTIC' };

      const noticeEventIds = Array(10).fill(null).map(() => buildNoticeEventId(noticeData));
      const wsEventIds = Array(10).fill(null).map(() => buildWsEventId(wsData));

      // All should be identical
      expect(new Set(noticeEventIds).size).toBe(1);
      expect(new Set(wsEventIds).size).toBe(1);

      // Should be different between notice and ws
      expect(noticeEventIds[0]).not.toBe(wsEventIds[0]);
    });

    it('should generate different eventIds for different data', () => {
      const data1 = {
        base: 'TOKEN1',
        url: 'https://www.bithumb.com/notice/1',
        markets: ['KRW'],
        tradeTimeIso: '2024-01-01T00:00:00Z'
      };

      const data2 = {
        base: 'TOKEN2',
        url: 'https://www.bithumb.com/notice/2',
        markets: ['KRW'],
        tradeTimeIso: '2024-01-01T00:00:00Z'
      };

      const eventId1 = buildNoticeEventId(data1);
      const eventId2 = buildNoticeEventId(data2);

      expect(eventId1).not.toBe(eventId2);
    });
  });
});
