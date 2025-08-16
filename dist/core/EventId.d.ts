export type EventIdInput = {
    source: 'bithumb.notice' | 'bithumb.ws';
    base: string;
    url?: string | null;
    markets?: string[];
    tradeTimeUtc?: string;
};
export declare function normalizeUrl(u?: string | null): string;
export declare function buildEventId(input: EventIdInput): string;
/**
 * Vérifie si un eventId est valide (format SHA256)
 */
export declare function isValidEventId(eventId: string): boolean;
