import { Database } from 'sqlite3';
import { EventStore } from '../../core/EventStore';

// Mock Database pour les tests
class MockDatabase {
  private data: Map<string, any> = new Map();
  private calls: any[] = [];

  run(sql: string, params: any[], callback?: (err: any, result: any) => void): any {
    this.calls.push({ method: 'run', sql, params });
    
    if (sql.includes('BEGIN IMMEDIATE')) {
      if (callback) callback(null, {});
      return { changes: 0 };
    }
    
    if (sql.includes('COMMIT')) {
      if (callback) callback(null, {});
      return { changes: 0 };
    }
    
    if (sql.includes('ROLLBACK')) {
      if (callback) callback(null, {});
      return { changes: 0 };
    }
    
    if (sql.includes('INSERT OR IGNORE')) {
      const eventId = params[0];
      const base = params[1];
      const source = params[2];
      
      if (this.data.has(eventId)) {
        // Duplicate
        if (callback) callback(null, { changes: 0 });
        return { changes: 0 };
      } else {
        // New event
        this.data.set(eventId, { base, source, timestamp: Date.now() });
        if (callback) callback(null, { changes: 1 });
        return { changes: 1 };
      }
    }
    
    return { changes: 0 };
  }

  get(sql: string, params: any[], callback: (err: any, result: any) => void): void {
    this.calls.push({ method: 'get', sql, params });
    
    if (sql.includes('SELECT 1 FROM processed_events')) {
      const eventId = params[0];
      const exists = this.data.has(eventId);
      callback(null, exists ? { '1': 1 } : null);
    } else {
      callback(null, null);
    }
  }

  all(sql: string, params: any[], callback: (err: any, result: any) => void): void {
    this.calls.push({ method: 'all', sql, params });
    
    if (sql.includes('SELECT source, COUNT(*)')) {
      const sourceCounts = new Map<string, number>();
      for (const event of this.data.values()) {
        sourceCounts.set(event.source, (sourceCounts.get(event.source) || 0) + 1);
      }
      
      const result = Array.from(sourceCounts.entries()).map(([source, count]) => ({
        source,
        count
      }));
      callback(null, result);
    } else if (sql.includes('SELECT base, COUNT(*)')) {
      const baseCounts = new Map<string, number>();
      for (const event of this.data.values()) {
        if (event.base) {
          baseCounts.set(event.base, (baseCounts.get(event.base) || 0) + 1);
        }
      }
      
      const result = Array.from(baseCounts.entries()).map(([base, count]) => ({
        base,
        count
      }));
      callback(null, result);
    } else {
      callback(null, []);
    }
  }

  serialize(callback: () => void): void {
    callback();
  }

  getCalls() {
    return this.calls;
  }

  clearCalls() {
    this.calls = [];
  }
}

describe('EventStore', () => {
  let mockDb: MockDatabase;
  let eventStore: EventStore;

  beforeEach(() => {
    mockDb = new MockDatabase();
    eventStore = new EventStore(mockDb as any);
  });

  afterEach(() => {
    mockDb.clearCalls();
  });

  describe('isProcessed', () => {
    it('should return false for unprocessed events', async () => {
      const isProcessed = await eventStore.isProcessed('non-existent-event');
      expect(isProcessed).toBe(false);
    });
  });

  describe('MockDatabase', () => {
    it('should track calls correctly', () => {
      mockDb.run('TEST SQL', ['param1'], () => {});
      const calls = mockDb.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].sql).toBe('TEST SQL');
    });
  });
});
