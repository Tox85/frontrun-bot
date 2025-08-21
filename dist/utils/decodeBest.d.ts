/**
 * Module de décodage robuste pour les notices Bithumb
 * Essaie plusieurs encodages et choisit le meilleur
 */
export interface DecodeResult {
    text: string;
    encoding: string;
    replacementChars: number;
    hasHangul: boolean;
    confidence: number;
}
/**
 * Décode un buffer avec le meilleur encodage possible
 */
export declare function decodeBest(buffer: Buffer, headers?: Record<string, string>): DecodeResult;
/**
 * Décode depuis plusieurs sources et concatène les meilleurs résultats
 */
export declare function decodeMultiSource(sources: Array<{
    buffer: Buffer;
    headers?: Record<string, string>;
    type: string;
}>): DecodeResult;
