import { Database } from 'sqlite3';
import { createHash } from 'crypto';

export interface BaselineKRToken {
  base: string;
  sources: string[];
  firstSeenUtc: string;
  updatedAtUtc: string;
}

export interface ListingEvent {
  eventId: string;
  source: 'bithumb.notice' | 'bithumb.ws';
  base: string;
  url: string | undefined;
  tradeTimeUtc: string | undefined;
  createdAtUtc: string;
}

export interface Cooldown {
  base: string;
  expiresAtUtc: string;
  reason: string;
}

export class TokenRegistry {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    console.log('🔒 Initialisation du TokenRegistry...');
    
    // Vérifier que les tables existent
    await this.ensureTablesExist();
    
    console.log('✅ TokenRegistry initialisé');
  }

  private async ensureTablesExist(): Promise<void> {
    // Les tables sont créées par les migrations, on vérifie juste qu'elles existent
    const tables = ['baseline_kr', 'processed_events', 'cooldowns'];
    
    for (const table of tables) {
      const exists = await this.tableExists(table);
      if (!exists) {
        throw new Error(`Table ${table} n'existe pas - migrations non appliquées`);
      }
    }
  }

  private async tableExists(tableName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  // Baseline KR Management
  async addToBaselineKR(base: string, source: string): Promise<void> {
    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO baseline_kr (base, sources, first_seen_utc, updated_at_utc) 
         VALUES (?, ?, 
           COALESCE((SELECT first_seen_utc FROM baseline_kr WHERE base = ?), ?), 
           ?)`,
        [base, JSON.stringify([source]), base, now, now],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async addMultipleToBaselineKR(tokens: Array<{ base: string; source: string }>): Promise<void> {
    if (tokens.length === 0) return;
    
    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        const stmt = this.db.prepare(
          `INSERT OR REPLACE INTO baseline_kr (base, sources, first_seen_utc, updated_at_utc) 
           VALUES (?, ?, 
             COALESCE((SELECT first_seen_utc FROM baseline_kr WHERE base = ?), ?), 
             ?)`
        );
        
        for (const token of tokens) {
          stmt.run(token.base, JSON.stringify([token.source]), token.base, now, now);
        }
        
        stmt.finalize((err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
          } else {
            this.db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve();
            });
          }
        });
      });
    });
  }

  async isInBaselineKR(base: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT 1 FROM baseline_kr WHERE base = ?',
        [base],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  async getBaselineKRStats(): Promise<{
    total: number;
    bySource: Record<string, number>;
    lastUpdated: string;
  }> {
    const stats = await new Promise<{
      total: number;
      bySource: Record<string, number>;
      lastUpdated: string;
    }>((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as total, MAX(updated_at_utc) as lastUpdated FROM baseline_kr',
        (err, row: any) => {
          if (err) reject(err);
          else resolve({
            total: row.total || 0,
            bySource: {},
            lastUpdated: row.lastUpdated || ''
          });
        }
      );
    });

    // Compter par source
    const sources = await new Promise<Array<{ sources: string }>>((resolve, reject) => {
      this.db.all('SELECT sources FROM baseline_kr', (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    for (const row of sources) {
      try {
        const sourceList = JSON.parse(row.sources);
        for (const source of sourceList) {
          stats.bySource[source] = (stats.bySource[source] || 0) + 1;
        }
      } catch (error) {
        console.warn('⚠️ Erreur parsing sources JSON:', error);
      }
    }

    return stats;
  }

  // Event Processing
  async addProcessedEvent(event: Omit<ListingEvent, 'createdAtUtc'>): Promise<boolean> {
    const now = new Date().toISOString();
    const fullEvent: ListingEvent = { ...event, createdAtUtc: now };
    
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO processed_events (event_id, source, base, url, trade_time_utc, created_at_utc) VALUES (?, ?, ?, ?, ?, ?)',
        [fullEvent.eventId, fullEvent.source, fullEvent.base, fullEvent.url, fullEvent.tradeTimeUtc, fullEvent.createdAtUtc],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0); // true si nouvel événement, false si déjà traité
        }
      );
    });
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT 1 FROM processed_events WHERE event_id = ?',
        [eventId],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  async getProcessedEventsStats(): Promise<{
    total: number;
    bySource: Record<string, number>;
    byBase: Record<string, number>;
  }> {
    const stats = await new Promise<{
      total: number;
      bySource: Record<string, number>;
      byBase: Record<string, number>;
    }>((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as total FROM processed_events',
        (err, row: any) => {
          if (err) reject(err);
          else resolve({
            total: row.total || 0,
            bySource: {},
            byBase: {}
          });
        }
      );
    });

    // Compter par source
    const sourceStats = await new Promise<Array<{ source: string; count: number }>>((resolve, reject) => {
      this.db.all(
        'SELECT source, COUNT(*) as count FROM processed_events GROUP BY source',
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    for (const row of sourceStats) {
      stats.bySource[row.source] = row.count;
    }

    // Compter par base
    const baseStats = await new Promise<Array<{ base: string; count: number }>>((resolve, reject) => {
      this.db.all(
        'SELECT base, COUNT(*) as count FROM processed_events GROUP BY base',
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    for (const row of baseStats) {
      stats.byBase[row.base] = row.count;
    }

    return stats;
  }

  // Cooldown Management
  async addCooldown(base: string, reason: string, hours: number = 24): Promise<void> {
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO cooldowns (base, expires_at_utc, reason) VALUES (?, ?, ?)',
        [base, expiresAt, reason],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async isInCooldown(base: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT 1 FROM cooldowns WHERE base = ? AND expires_at_utc > ?',
        [base, new Date().toISOString()],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  async cleanupExpiredCooldowns(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM cooldowns WHERE expires_at_utc <= ?',
        [new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  /**
   * Vérifie si un token est nouveau (pas dans la baseline)
   */
  async isNew(base: string): Promise<boolean> {
    return !(await this.isInBaselineKR(base));
  }

  // Utility methods
  static generateEventId(source: 'bithumb.notice' | 'bithumb.ws', base: string, url: string = '', markets: string[] = [], tradeTime: string = ''): string {
    const data = {
      s: source,
      b: base,
      u: url,
      m: markets.sort(),
      t: tradeTime
    };
    
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  async close(): Promise<void> {
    // Le Database sera fermé par l'appelant
  }
}
