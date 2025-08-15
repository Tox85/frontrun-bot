"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingletonGuard = void 0;
const uuid_1 = require("uuid");
class SingletonGuard {
    db;
    instanceId;
    lockKey = 'leader';
    isLeader = false;
    lockTimeoutMs = 30000; // 30 secondes
    heartbeatInterval = null;
    constructor(db) {
        this.db = db;
        this.instanceId = (0, uuid_1.v4)();
    }
    async tryAcquireLeadership() {
        console.log(`🔒 Tentative d'acquisition du leadership (Instance: ${this.instanceId})`);
        try {
            // Utiliser une transaction pour éviter les conditions de course
            return new Promise((resolve, reject) => {
                this.db.serialize(() => {
                    this.db.run('BEGIN TRANSACTION');
                    // Vérifier si un leader existe déjà
                    this.db.get('SELECT lock_key, instance_id, acquired_at_utc FROM instance_lock WHERE lock_key = ?', [this.lockKey], (err, row) => {
                        if (err) {
                            this.db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                        if (row) {
                            const lockAge = Date.now() - new Date(row.acquired_at_utc).getTime();
                            // Si le lock est trop ancien (> 5 minutes), on peut le récupérer
                            if (lockAge > 5 * 60 * 1000) {
                                console.log(`⚠️ Lock existant expiré (${Math.round(lockAge / 1000)}s), tentative de récupération`);
                                // Supprimer l'ancien lock
                                this.db.run('DELETE FROM instance_lock WHERE lock_key = ?', [this.lockKey], (err) => {
                                    if (err) {
                                        this.db.run('ROLLBACK');
                                        reject(err);
                                        return;
                                    }
                                    // Maintenant insérer notre lock
                                    this.insertLockAndCommit(resolve, reject);
                                });
                            }
                            else {
                                console.log(`❌ Leadership déjà acquis par l'instance ${row.instance_id} (il y a ${Math.round(lockAge / 1000)}s)`);
                                this.db.run('ROLLBACK');
                                this.isLeader = false;
                                resolve(false);
                            }
                        }
                        else {
                            // Aucun lock existant, on peut en créer un
                            this.insertLockAndCommit(resolve, reject);
                        }
                    });
                });
            });
        }
        catch (error) {
            console.error('❌ Erreur lors de la tentative d\'acquisition du leadership:', error);
            this.isLeader = false;
            return false;
        }
    }
    async getExistingLock() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT lock_key, instance_id, acquired_at_utc FROM instance_lock WHERE lock_key = ?', [this.lockKey], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row || null);
            });
        });
    }
    async insertLock(acquiredAtUtc) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT OR REPLACE INTO instance_lock (lock_key, instance_id, acquired_at_utc) VALUES (?, ?, ?)', [this.lockKey, this.instanceId, acquiredAtUtc], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async releaseLock() {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM instance_lock WHERE lock_key = ?', [this.lockKey], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    insertLockAndCommit(resolve, reject) {
        const now = new Date().toISOString();
        this.db.run('INSERT INTO instance_lock (lock_key, instance_id, acquired_at_utc) VALUES (?, ?, ?)', [this.lockKey, this.instanceId, now], (err) => {
            if (err) {
                this.db.run('ROLLBACK');
                reject(err);
                return;
            }
            // Valider la transaction
            this.db.run('COMMIT', (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                // Vérifier que nous avons bien acquis le lock
                this.db.get('SELECT lock_key, instance_id, acquired_at_utc FROM instance_lock WHERE lock_key = ?', [this.lockKey], (err, row) => {
                    if (err || !row || row.instance_id !== this.instanceId) {
                        console.log('❌ Échec de l\'acquisition du leadership');
                        this.isLeader = false;
                        resolve(false);
                    }
                    else {
                        this.isLeader = true;
                        console.log(`✅ Leadership acquis avec succès (Instance: ${this.instanceId})`);
                        // Démarrer le heartbeat
                        this.startHeartbeat();
                        resolve(true);
                    }
                });
            });
        });
    }
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.heartbeatInterval = setInterval(async () => {
            try {
                if (this.isLeader) {
                    const now = new Date().toISOString();
                    await this.insertLock(now);
                }
            }
            catch (error) {
                console.error('❌ Erreur lors du heartbeat:', error);
                // En cas d'erreur, on perd le leadership
                this.isLeader = false;
                this.stopHeartbeat();
            }
        }, this.lockTimeoutMs / 2); // Heartbeat à la moitié du timeout
    }
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    async releaseLeadership() {
        if (this.isLeader) {
            console.log(`🔓 Libération du leadership (Instance: ${this.instanceId})`);
            this.stopHeartbeat();
            await this.releaseLock();
            this.isLeader = false;
        }
    }
    isInstanceLeader() {
        return this.isLeader;
    }
    getInstanceId() {
        return this.instanceId;
    }
    getLeaderInfo() {
        return {
            isLeader: this.isLeader,
            instanceId: this.instanceId
        };
    }
    async getCurrentLeader() {
        return this.getExistingLock();
    }
    // Méthode pour vérifier la santé du leadership
    async checkLeadershipHealth() {
        try {
            const lock = await this.getExistingLock();
            if (!lock) {
                return { healthy: false, reason: 'Aucun lock trouvé' };
            }
            if (lock.instanceId !== this.instanceId) {
                return { healthy: false, reason: `Lock détenu par une autre instance: ${lock.instanceId}` };
            }
            const lockAge = Date.now() - new Date(lock.acquiredAtUtc).getTime();
            if (lockAge > this.lockTimeoutMs) {
                return { healthy: false, reason: `Lock trop ancien: ${Math.round(lockAge / 1000)}s` };
            }
            return { healthy: true };
        }
        catch (error) {
            return { healthy: false, reason: `Erreur de vérification: ${error}` };
        }
    }
}
exports.SingletonGuard = SingletonGuard;
//# sourceMappingURL=SingletonGuard.js.map