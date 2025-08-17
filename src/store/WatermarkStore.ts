import { Database } from 'sqlite3';

export interface Watermark {
  last_published_at: number;
  last_notice_uid: string;
  updated_at: number;
}

export interface Notice {
  uid: string;
  published_at: number;
  title: string;
}

export class WatermarkStore {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Récupère le watermark pour une source donnée
   */
  async get(source: string): Promise<Watermark | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT last_published_at, last_notice_uid, updated_at FROM watermarks WHERE source = ?',
        [source],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? row as Watermark : null);
        }
      );
    });
  }

  /**
   * Vérifie si une notice doit être considérée (plus récente que le watermark)
   */
  async shouldConsider(source: string, notice: Notice): Promise<boolean> {
    const watermark = await this.get(source);
    if (!watermark) {
      return true; // Pas de watermark = traiter toutes les notices
    }

    // Si la notice est plus récente, la traiter
    if (notice.published_at > watermark.last_published_at) {
      return true;
    }

    // Si même timestamp, comparer les UIDs lexicographiquement
    if (notice.published_at === watermark.last_published_at) {
      return notice.uid > watermark.last_notice_uid;
    }

    return false; // Notice plus ancienne, ignorer
  }

  /**
   * Met à jour le watermark avec le batch de notices le plus récent
   */
  async updateFromBatch(source: string, notices: Notice[]): Promise<void> {
    if (notices.length === 0) return;

    // Trouver la notice la plus récente du batch
    let maxPublishedAt = 0;
    let maxUid = '';

    for (const notice of notices) {
      if (notice.published_at > maxPublishedAt) {
        maxPublishedAt = notice.published_at;
        maxUid = notice.uid;
      } else if (notice.published_at === maxPublishedAt && notice.uid > maxUid) {
        maxUid = notice.uid;
      }
    }

    // Mettre à jour le watermark
    const now = Date.now();
    await new Promise<void>((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO watermarks (source, last_published_at, last_notice_uid, updated_at)
         VALUES (?, ?, ?, ?)`,
        [source, maxPublishedAt, maxUid, now],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Initialise le watermark au boot avec la notice la plus récente
   */
  async initializeAtBoot(source: string): Promise<void> {
    // Au boot, on ne peut pas initialiser avec des notices futures
    // On utilise un timestamp très ancien pour traiter toutes les notices
    const now = Date.now();
    await new Promise<void>((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO watermarks (source, last_published_at, last_notice_uid, updated_at)
         VALUES (?, ?, ?, ?)`,
        [source, 0, '', now],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}
