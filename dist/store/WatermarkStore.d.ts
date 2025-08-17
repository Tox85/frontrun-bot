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
export declare class WatermarkStore {
    private db;
    constructor(db: Database);
    /**
     * Récupère le watermark pour une source donnée
     */
    get(source: string): Promise<Watermark | null>;
    /**
     * Vérifie si une notice doit être considérée (plus récente que le watermark)
     */
    shouldConsider(source: string, notice: Notice): Promise<boolean>;
    /**
     * Met à jour le watermark avec le batch de notices le plus récent
     */
    updateFromBatch(source: string, notices: Notice[]): Promise<void>;
    /**
     * Initialise le watermark au boot avec la notice la plus récente
     */
    initializeAtBoot(source: string): Promise<void>;
}
