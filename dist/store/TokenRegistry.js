"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenRegistry = void 0;
const crypto_1 = require("crypto");
class TokenRegistry {
    db;
    constructor(db) {
        this.db = db;
    }
    async initialize() {
        console.log('🔒 Initialisation du TokenRegistry...');
        // Vérifier que les tables existent
        await this.ensureTablesExist();
        console.log('✅ TokenRegistry initialisé');
    }
    async ensureTablesExist() {
        // Les tables sont créées par les migrations, on vérifie juste qu'elles existent
        const tables = ['baseline_kr', 'processed_events', 'cooldowns'];
        for (const table of tables) {
            const exists = await this.tableExists(table);
            if (!exists) {
                throw new Error(`Table ${table} n'existe pas - migrations non appliquées`);
            }
        }
    }
    async tableExists(tableName) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(!!row);
            });
        });
    }
    // Baseline KR Management
    async addToBaselineKR(base, source) {
        const now = new Date().toISOString();
        return new Promise((resolve, reject) => {
            this.db.run(`INSERT OR REPLACE INTO baseline_kr (base, sources, first_seen_utc, updated_at_utc) 
         VALUES (?, ?, 
           COALESCE((SELECT first_seen_utc FROM baseline_kr WHERE base = ?), ?), 
           ?)`, [base, JSON.stringify([source]), base, now, now], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async addMultipleToBaselineKR(tokens) {
        if (tokens.length === 0)
            return;
        const now = new Date().toISOString();
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                const stmt = this.db.prepare(`INSERT OR REPLACE INTO baseline_kr (base, sources, first_seen_utc, updated_at_utc) 
           VALUES (?, ?, 
             COALESCE((SELECT first_seen_utc FROM baseline_kr WHERE base = ?), ?), 
             ?)`);
                for (const token of tokens) {
                    stmt.run(token.base, JSON.stringify([token.source]), token.base, now, now);
                }
                stmt.finalize((err) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                    }
                    else {
                        this.db.run('COMMIT', (err) => {
                            if (err)
                                reject(err);
                            else
                                resolve();
                        });
                    }
                });
            });
        });
    }
    async isInBaselineKR(base) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT 1 FROM baseline_kr WHERE base = ?', [base], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(!!row);
            });
        });
    }
    async getBaselineKRStats() {
        const stats = await new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as total, MAX(updated_at_utc) as lastUpdated FROM baseline_kr', (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve({
                        total: row.total || 0,
                        bySource: {},
                        lastUpdated: row.lastUpdated || ''
                    });
            });
        });
        // Compter par source
        const sources = await new Promise((resolve, reject) => {
            this.db.all('SELECT sources FROM baseline_kr', (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
        for (const row of sources) {
            try {
                const sourceList = JSON.parse(row.sources);
                for (const source of sourceList) {
                    stats.bySource[source] = (stats.bySource[source] || 0) + 1;
                }
            }
            catch (error) {
                console.warn('⚠️ Erreur parsing sources JSON:', error);
            }
        }
        return stats;
    }
    // Event Processing
    async addProcessedEvent(event) {
        const now = new Date().toISOString();
        const fullEvent = { ...event, createdAtUtc: now };
        return new Promise((resolve, reject) => {
            this.db.run('INSERT OR IGNORE INTO processed_events (event_id, source, base, url, trade_time_utc, created_at_utc) VALUES (?, ?, ?, ?, ?, ?)', [fullEvent.eventId, fullEvent.source, fullEvent.base, fullEvent.url, fullEvent.tradeTimeUtc, fullEvent.createdAtUtc], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(this.changes > 0); // true si nouvel événement, false si déjà traité
            });
        });
    }
    async isEventProcessed(eventId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT 1 FROM processed_events WHERE event_id = ?', [eventId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(!!row);
            });
        });
    }
    async getProcessedEventsStats() {
        const stats = await new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as total FROM processed_events', (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve({
                        total: row.total || 0,
                        bySource: {},
                        byBase: {}
                    });
            });
        });
        // Compter par source
        const sourceStats = await new Promise((resolve, reject) => {
            this.db.all('SELECT source, COUNT(*) as count FROM processed_events GROUP BY source', (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
        for (const row of sourceStats) {
            stats.bySource[row.source] = row.count;
        }
        // Compter par base
        const baseStats = await new Promise((resolve, reject) => {
            this.db.all('SELECT base, COUNT(*) as count FROM processed_events GROUP BY base', (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
        for (const row of baseStats) {
            stats.byBase[row.base] = row.count;
        }
        return stats;
    }
    // Cooldown Management
    async addCooldown(base, reason, hours = 24) {
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        return new Promise((resolve, reject) => {
            this.db.run('INSERT OR REPLACE INTO cooldowns (base, expires_at_utc, reason) VALUES (?, ?, ?)', [base, expiresAt, reason], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async isInCooldown(base) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT 1 FROM cooldowns WHERE base = ? AND expires_at_utc > ?', [base, new Date().toISOString()], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(!!row);
            });
        });
    }
    async cleanupExpiredCooldowns() {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM cooldowns WHERE expires_at_utc <= ?', [new Date().toISOString()], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(this.changes);
            });
        });
    }
    /**
     * Vérifie si un token est nouveau (pas dans la baseline)
     */
    async isNew(base) {
        return !(await this.isInBaselineKR(base));
    }
    // Utility methods
    static generateEventId(source, base, url = '', markets = [], tradeTime = '') {
        const data = {
            s: source,
            b: base,
            u: url,
            m: markets.sort(),
            t: tradeTime
        };
        return (0, crypto_1.createHash)('sha256').update(JSON.stringify(data)).digest('hex');
    }
    async close() {
        // Le Database sera fermé par l'appelant
    }
}
exports.TokenRegistry = TokenRegistry;
//# sourceMappingURL=TokenRegistry.js.map