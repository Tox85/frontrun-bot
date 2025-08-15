"use strict";
/**
 * Constantes pour la gestion des devises de cotation
 * Basé sur les spécifications du prompt Cursor
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KOREAN_NOTICE_PATTERNS = exports.SANITY_FLOORS = exports.IGNORED_KEYWORDS = exports.FIAT_CURRENCIES = exports.STABLES = exports.KRW_ONLY = exports.UPBIT_VALID_QUOTES = void 0;
// Devises de cotation valides sur Upbit
exports.UPBIT_VALID_QUOTES = new Set(['KRW', 'USDT', 'BTC']);
// Seulement KRW pour la baseline coréenne
exports.KRW_ONLY = new Set(['KRW']);
// Tokens stables à exclure de la baseline KR
exports.STABLES = new Set([
    'USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDP',
    'BUSD', 'GUSD', 'PAX', 'USDK', 'USDN', 'USDJ'
]);
// Devises fiat à ignorer
exports.FIAT_CURRENCIES = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'SGD'
]);
// Mots-clés à ignorer dans les réponses API
exports.IGNORED_KEYWORDS = new Set([
    'date', 'time', 'timestamp', 'status', 'result'
]);
// Planchers de sanity pour la baseline KR
exports.SANITY_FLOORS = {
    UPBIT_KRW_TOKENS: 200,
    BITHUMB_KRW_TOKENS: 200,
    KR_UNION_TOKENS: 300
};
// Patterns de détection des notices coréennes
exports.KOREAN_NOTICE_PATTERNS = {
    UPBIT: [
        /원화마켓\s*신규\s*상장/, // "원화마켓 신규 상장"
        /거래지원\s*안내/, // "거래지원 안내"
        /KRW\s*마켓\s*추가/ // "KRW 마켓 추가"
    ],
    BITHUMB: [
        /원화\s*마켓\s*추가/, // "원화 마켓 추가"
        /신규\s*상장/, // "신규 상장"
        /거래\s*개시/ // "거래 개시"
    ]
};
//# sourceMappingURL=quotes.js.map