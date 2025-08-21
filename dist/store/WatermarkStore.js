"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatermarkStore = void 0;
class WatermarkStore {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Récupère le watermark pour une source donnée
     */
    async get(source) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT last_published_at, last_notice_uid, updated_at FROM watermarks WHERE source = ?', [source], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row ? row : null);
            });
        });
    }
    /**
     * Vérifie si une notice doit être considérée (plus récente que le watermark)
     */
    async shouldConsider(source, notice) {
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
    async updateFromBatch(source, notices) {
        if (notices.length === 0)
            return;
        // Trouver la notice la plus récente du batch
        let maxPublishedAt = 0;
        let maxUid = '';
        for (const notice of notices) {
            if (notice.published_at > maxPublishedAt) {
                maxPublishedAt = notice.published_at;
                maxUid = notice.uid;
            }
            else if (notice.published_at === maxPublishedAt && notice.uid > maxUid) {
                maxUid = notice.uid;
            }
        }
        // Mettre à jour le watermark
        const now = Date.now();
        await new Promise((resolve, reject) => {
            this.db.run(`INSERT OR REPLACE INTO watermarks (source, last_published_at, last_notice_uid, updated_at)
         VALUES (?, ?, ?, ?)`, [source, maxPublishedAt, maxUid, now], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    /**
     * Initialise le watermark au boot avec la notice la plus récente
     */
    async initializeAtBoot(source) {
        // Anti-replay: initialiser à now - 300s (5 minutes)
        // Évite de re-traiter les notices récentes au redémarrage
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000); // 300 secondes
        await new Promise((resolve, reject) => {
            this.db.run(`INSERT OR REPLACE INTO watermarks (source, last_published_at, last_notice_uid, updated_at)
         VALUES (?, ?, ?, ?)`, [source, fiveMinutesAgo, '', now], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        console.log(`🔒 Watermark ${source} initialisé à ${new Date(fiveMinutesAgo).toISOString()} (anti-replay)`);
    }
}
exports.WatermarkStore = WatermarkStore;
//# sourceMappingURL=WatermarkStore.js.map