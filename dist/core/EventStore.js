"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventStore = void 0;
class EventStore {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Marque un événement comme traité (déduplication cross-sources)
     * INSERT OR IGNORE → idempotence garantie sans transaction explicite
     */
    async tryMarkProcessed(event) {
        return new Promise((resolve, reject) => {
            // Utiliser INSERT OR IGNORE directement sans transaction explicite
            // Cela évite les conflits "cannot start a transaction within a transaction"
            const stmt = this.db.prepare(`INSERT OR IGNORE INTO processed_events 
         (event_id, source, base, url, markets, trade_time_utc, raw_title)
         VALUES (?, ?, ?, ?, ?, ?, ?)`);
            stmt.run([
                event.eventId,
                event.source,
                event.base?.toUpperCase() || '',
                event.url || '',
                JSON.stringify((event.markets || []).map(m => m.toUpperCase()).sort()),
                event.tradeTimeUtc || '',
                event.rawTitle || ''
            ], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                const wasInserted = this.changes && this.changes > 0;
                resolve(wasInserted ? 'INSERTED' : 'DUPLICATE');
            });
            stmt.finalize();
        });
    }
    /**
     * Vérifie si un événement a déjà été traité
     */
    async isProcessed(eventId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT 1 FROM processed_events WHERE event_id = ?', [eventId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(!!row);
            });
        });
    }
    /**
     * Vérifie si une base a déjà été tradée récemment (cooldown cross-source)
     */
    async isBaseRecentlyTraded(base, cooldownHours = 24) {
        return new Promise((resolve, reject) => {
            const cutoffTime = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
            this.db.get(`SELECT 1 FROM processed_bases 
         WHERE base = ? AND last_acted_at > ?`, [base.toUpperCase(), cutoffTime], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(!!row);
            });
        });
    }
    /**
     * Marque une base comme tradée (pour éviter les doubles trades cross-source)
     */
    async markBaseAsTraded(base, eventId) {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            this.db.run(`INSERT OR REPLACE INTO processed_bases (base, last_acted_at, last_event_id)
         VALUES (?, ?, ?)`, [base.toUpperCase(), now, eventId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    /**
     * Récupère les événements récents pour le monitoring
     */
    async getRecentEvents(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT 
           event_id, source, base, url, markets, trade_time_utc, raw_title,
           created_at
         FROM processed_events 
         ORDER BY created_at DESC 
         LIMIT ?`, [limit], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
    }
    /**
     * Statistiques de déduplication
     */
    async getDedupStats() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                let total = 0;
                let bySource = [];
                let byBase = [];
                this.db.get('SELECT COUNT(*) as count FROM processed_events', (err, row) => {
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
    async cleanupOldEvents(olderThanDays = 30) {
        return new Promise((resolve, reject) => {
            const cutoff = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);
            this.db.run('DELETE FROM processed_events WHERE detected_at_utc < ?', [cutoff], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(this.changes || 0);
            });
        });
    }
}
exports.EventStore = EventStore;
//# sourceMappingURL=EventStore.js.map