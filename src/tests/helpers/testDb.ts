import { Database } from 'sqlite3';
import { join } from 'path';

/**
 * Crée une base de données SQLite en mémoire pour les tests
 */
export async function createTestDb(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new Database(':memory:', (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Créer le schéma minimal pour perp_catalog
      db.serialize(() => {
        db.run(`
          CREATE TABLE perp_catalog (
            exchange TEXT NOT NULL,
            base TEXT NOT NULL,
            quote TEXT NOT NULL DEFAULT 'USDT',
            symbol TEXT NOT NULL,
            leverage_max REAL DEFAULT 100,
            last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at_utc TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (exchange, base)
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }

          // Créer les index
          db.run('CREATE INDEX idx_perp_catalog_exchange ON perp_catalog(exchange)', (err) => {
            if (err) {
              reject(err);
              return;
            }

            db.run('CREATE INDEX idx_perp_catalog_base ON perp_catalog(base)', (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve(db);
            });
          });
        });
      });
    });
  });
}

/**
 * Ferme proprement la base de données de test
 */
export async function closeTestDb(db: Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
