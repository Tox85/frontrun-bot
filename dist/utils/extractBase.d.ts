export type ExtractResult = {
    kind: 'LATIN';
    base: string;
    source: 'paren_ko_en' | 'paren_en_ko' | 'pair' | 'krw_phrase' | 'list';
    ctx?: any;
} | {
    kind: 'UNKNOWN';
    baseAliasKorean: string | undefined;
    reason: 'NO_LATIN_TICKER_FOUND' | 'AMBIGUOUS';
};
export declare function normalizeBrackets(s: string): string;
export declare function extractBaseFromNotice(raw: string): ExtractResult;
