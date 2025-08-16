import { Database } from 'sqlite3';

export interface ProcessedEvent {
  eventId: string;
  source: 'bithumb.notice' | 'bithumb.ws';
  base: string;
  url?: string;
  markets?: string[];
  tradeTimeUtc?: string;
  rawTitle?: string;
}

export type MarkProcessedResult = 'INSERTED' | 'DUPLICATE';

export class EventStore {
  constructor(private db: Database) {}

  /**
   * Marque un événement comme traité de manière atomique et idempotente
   * BEGIN IMMEDIATE pour éviter les races multi-threads
   * INSERT OR IGNORE → idempotence garantie
   */
  async tryMarkProcessed(event: ProcessedEvent): Promise<MarkProcessedResult> {
    return new Promise((resolve, reject) => {
      const db = this.db; // Capturer la référence
      
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE', (err) => {
          if (err) {
            reject(err);
            return;
          }

          const stmt = db.prepare(
            `INSERT OR IGNORE INTO processed_events 
             (event_id, source, base, url, markets, trade_time_utc, raw_title)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          );

          stmt.run([
            event.eventId,
            event.source,
            event.base.toUpperCase(),
            event.url || '',
            JSON.stringify((event.markets || []).map(m => m.toUpperCase()).sort()),
            event.tradeTimeUtc || '',
            event.rawTitle || ''
          ], function(err) {
            if (err) {
              db.run('ROLLBACK', () => reject(err));
              return;
            }

            db.run('COMMIT', (err) => {
              if (err) {
                reject(err);
                return;
              }

              const wasInserted = this.changes && this.changes > 0;
              resolve(wasInserted ? 'INSERTED' : 'DUPLICATE');
            });
          });

          stmt.finalize();
        });
      });
    });
  }

  /**
   * Vérifie si un événement a déjà été traité
   */
  async isProcessed(eventId: string): Promise<boolean> {
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

  /**
   * Vérifie si une base a déjà été tradée récemment (cooldown cross-source)
   */
  async isBaseRecentlyTraded(base: string, cooldownHours: number = 24): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const cutoffTime = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
      
      this.db.get(
        `SELECT 1 FROM processed_bases 
         WHERE base = ? AND last_acted_at > ?`,
        [base.toUpperCase(), cutoffTime],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  /**
   * Marque une base comme tradée (pour éviter les doubles trades cross-source)
   */
  async markBaseAsTraded(base: string, eventId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      
      this.db.run(
        `INSERT OR REPLACE INTO processed_bases (base, last_acted_at, last_event_id)
         VALUES (?, ?, ?)`,
        [base.toUpperCase(), now, eventId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Récupère les événements récents pour le monitoring
   */
  async getRecentEvents(limit: number = 50): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT 
           event_id, source, base, url, markets, trade_time_utc, raw_title,
           created_at
         FROM processed_events 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Statistiques de déduplication
   */
  async getDedupStats(): Promise<{
    total: number;
    bySource: { source: string; count: number }[];
    byBase: { base: string; count: number }[];
  }> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        let total = 0;
        let bySource: any[] = [];
        let byBase: any[] = [];

        this.db.get('SELECT COUNT(*) as count FROM processed_events', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          total = row.count;
        });

        this.db.all('SELECT source, COUNT(*) as count FROM processed_events GROUP BY source', (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          bySource = rows || [];
        });

        this.db.all('SELECT base, COUNT(*) as count FROM processed_events GROUP BY base', (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          byBase = rows || [];
        });

        this.db.get('SELECT 1', (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({ total, bySource, byBase });
        });
      });
    });
  }

  /**
   * Nettoyage des anciens événements (maintenance)
   */
  async cleanupOldEvents(olderThanDays: number = 30): Promise<number> {
    return new Promise((resolve, reject) => {
      const cutoff = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);
      
      this.db.run(
        'DELETE FROM processed_events WHERE detected_at_utc < ?',
        [cutoff],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes || 0);
        }
      );
    });
  }
}
