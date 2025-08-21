import { Database } from 'sqlite3';
export interface InstanceLock {
    lockKey: string;
    instanceId: string;
    acquiredAtUtc: string;
}
export declare class SingletonGuard {
    private db;
    private instanceId;
    private lockKey;
    private isLeader;
    private lockTimeoutMs;
    private heartbeatInterval;
    constructor(db: Database);
    tryAcquireLeadership(): Promise<boolean>;
    private getExistingLock;
    private insertLock;
    private releaseLock;
    private insertLockAndCommit;
    private startHeartbeat;
    private stopHeartbeat;
    releaseLeadership(): Promise<void>;
    /**
     * Force le leadership (pour les tests T0 Ready)
     */
    forceLeadership(): void;
    /**
     * Vérifie si cette instance est le leader
     */
    isInstanceLeader(): boolean;
    getInstanceId(): string;
    getLeaderInfo(): {
        isLeader: boolean;
        instanceId: string;
    };
    getCurrentLeader(): Promise<InstanceLock | null>;
    checkLeadershipHealth(): Promise<{
        healthy: boolean;
        reason?: string;
    }>;
}
