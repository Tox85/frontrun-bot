/**
 * Constantes pour la gestion des devises de cotation
 * Basé sur les spécifications du prompt Cursor
 */
export declare const UPBIT_VALID_QUOTES: Set<string>;
export declare const KRW_ONLY: Set<string>;
export declare const STABLES: Set<string>;
export declare const FIAT_CURRENCIES: Set<string>;
export declare const IGNORED_KEYWORDS: Set<string>;
export declare const SANITY_FLOORS: {
    readonly UPBIT_KRW_TOKENS: 200;
    readonly BITHUMB_KRW_TOKENS: 200;
    readonly KR_UNION_TOKENS: 300;
};
export declare const KOREAN_NOTICE_PATTERNS: {
    readonly UPBIT: readonly [RegExp, RegExp, RegExp];
    readonly BITHUMB: readonly [RegExp, RegExp, RegExp];
};
