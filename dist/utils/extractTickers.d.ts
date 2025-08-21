/**
 * Module robuste d'extraction de tickers depuis les notices Bithumb
 * Supporte les encodages corrompus, parenthèses full-width et multi-tickers
 */
export interface TickerExtractionResult {
    tickers: string[];
    confidence: number;
    hasHangul: boolean;
    replacementChars: number;
}
/**
 * Normalise les parenthèses et guillemets Unicode vers ASCII
 */
export declare function normalizeBrackets(s: string): string;
/**
 * Extrait tous les tickers depuis un texte
 * Supporte les formats: (TICKER), TICKER(KR), KRW-TICKER, etc.
 */
export declare function extractTickersFromText(text: string): string[];
/**
 * Calcule la confiance d'une extraction basée sur la qualité du texte
 */
export declare function calculateExtractionConfidence(originalText: string, decodedText: string, tickers: string[]): number;
/**
 * Extrait les tickers avec métadonnées de confiance
 */
export declare function extractTickersWithConfidence(originalText: string, decodedText: string): TickerExtractionResult;
