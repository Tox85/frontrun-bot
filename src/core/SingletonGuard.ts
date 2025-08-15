import { Database } from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface InstanceLock {
  lockKey: string;
  instanceId: string;
  acquiredAtUtc: string;
}

export class SingletonGuard {
  private db: Database;
  private instanceId: string;
  private lockKey: string = 'leader';
  private isLeader: boolean = false;
  private lockTimeoutMs: number = 30000; // 30 secondes
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(db: Database) {
    this.db = db;
    this.instanceId = uuidv4();
  }

  async tryAcquireLeadership(): Promise<boolean> {
    console.log(`🔒 Tentative d'acquisition du leadership (Instance: ${this.instanceId})`);
    
    try {
      // Utiliser une transaction pour éviter les conditions de course
      return new Promise((resolve, reject) => {
        this.db.serialize(() => {
          this.db.run('BEGIN TRANSACTION');
          
          // Vérifier si un leader existe déjà
          this.db.get(
            'SELECT lock_key, instance_id, acquired_at_utc FROM instance_lock WHERE lock_key = ?',
            [this.lockKey],
            (err, row: any) => {
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
                  this.db.run(
                    'DELETE FROM instance_lock WHERE lock_key = ?',
                    [this.lockKey],
                    (err) => {
                      if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                        return;
                      }
                      
                      // Maintenant insérer notre lock
                      this.insertLockAndCommit(resolve, reject);
                    }
                  );
                } else {
                  console.log(`❌ Leadership déjà acquis par l'instance ${row.instance_id} (il y a ${Math.round(lockAge / 1000)}s)`);
                  this.db.run('ROLLBACK');
                  this.isLeader = false;
                  resolve(false);
                }
              } else {
                // Aucun lock existant, on peut en créer un
                this.insertLockAndCommit(resolve, reject);
              }
            }
          );
        });
      });
      
    } catch (error) {
      console.error('❌ Erreur lors de la tentative d\'acquisition du leadership:', error);
      this.isLeader = false;
      return false;
    }
  }

  private async getExistingLock(): Promise<InstanceLock | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT lock_key, instance_id, acquired_at_utc FROM instance_lock WHERE lock_key = ?',
        [this.lockKey],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  private async insertLock(acquiredAtUtc: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO instance_lock (lock_key, instance_id, acquired_at_utc) VALUES (?, ?, ?)',
        [this.lockKey, this.instanceId, acquiredAtUtc],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  private async releaseLock(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM instance_lock WHERE lock_key = ?',
        [this.lockKey],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  private insertLockAndCommit(resolve: (value: boolean) => void, reject: (reason: any) => void): void {
    const now = new Date().toISOString();
    
    this.db.run(
      'INSERT INTO instance_lock (lock_key, instance_id, acquired_at_utc) VALUES (?, ?, ?)',
      [this.lockKey, this.instanceId, now],
      (err) => {
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
          this.db.get(
            'SELECT lock_key, instance_id, acquired_at_utc FROM instance_lock WHERE lock_key = ?',
            [this.lockKey],
            (err, row: any) => {
              if (err || !row || row.instance_id !== this.instanceId) {
                console.log('❌ Échec de l\'acquisition du leadership');
                this.isLeader = false;
                resolve(false);
              } else {
                this.isLeader = true;
                console.log(`✅ Leadership acquis avec succès (Instance: ${this.instanceId})`);
                
                // Démarrer le heartbeat
                this.startHeartbeat();
                
                resolve(true);
              }
            }
          );
        });
      }
    );
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        if (this.isLeader) {
          const now = new Date().toISOString();
          await this.insertLock(now);
        }
      } catch (error) {
        console.error('❌ Erreur lors du heartbeat:', error);
        // En cas d'erreur, on perd le leadership
        this.isLeader = false;
        this.stopHeartbeat();
      }
    }, this.lockTimeoutMs / 2); // Heartbeat à la moitié du timeout
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async releaseLeadership(): Promise<void> {
    if (this.isLeader) {
      console.log(`🔓 Libération du leadership (Instance: ${this.instanceId})`);
      this.stopHeartbeat();
      await this.releaseLock();
      this.isLeader = false;
    }
  }

  isInstanceLeader(): boolean {
    return this.isLeader;
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  getLeaderInfo(): { isLeader: boolean; instanceId: string } {
    return {
      isLeader: this.isLeader,
      instanceId: this.instanceId
    };
  }

  async getCurrentLeader(): Promise<InstanceLock | null> {
    return this.getExistingLock();
  }

  // Méthode pour vérifier la santé du leadership
  async checkLeadershipHealth(): Promise<{ healthy: boolean; reason?: string }> {
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
      
    } catch (error) {
      return { healthy: false, reason: `Erreur de vérification: ${error}` };
    }
  }
}
