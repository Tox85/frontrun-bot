/**
 * Détecteur robuste de listing KRW pour les notices Bithumb
 * Scoring multi-familles avec tolérance aux variations de formulation
 */
export interface ListingDetectionResult {
    isListing: boolean;
    score: number;
    reasons: string[];
    confidence: number;
    market: 'KRW' | 'UNKNOWN';
}
export interface NoticeInput {
    title: string;
    body?: string;
    tickers: string[];
}
/**
 * Détecte si une notice correspond à un listing KRW
 */
export declare function detectListingKRW(input: NoticeInput): ListingDetectionResult;
/**
 * Détecte les listings avec validation stricte (pour tests)
 */
export declare function detectListingKRWStrict(input: NoticeInput): ListingDetectionResult;
/**
 * Détecte les listings avec validation souple (pour production)
 */
export declare function detectListingKRWLoose(input: NoticeInput): ListingDetectionResult;
