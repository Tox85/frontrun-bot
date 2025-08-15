import { Database } from 'sqlite3';
export interface Migration {
    id: string;
    name: string;
    sql: string;
}
export declare class MigrationRunner {
    private db;
    private migrationsPath;
    constructor(db: Database, migrationsPath?: string);
    runMigrations(): Promise<void>;
    private createMigrationsTable;
    private getMigrationFiles;
    private getAppliedMigrations;
    private applyMigration;
    getMigrationStatus(): Promise<{
        total: number;
        applied: number;
        pending: number;
        lastApplied?: string;
    }>;
}
