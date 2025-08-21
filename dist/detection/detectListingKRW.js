"use strict";
/**
 * Détecteur robuste de listing KRW pour les notices Bithumb
 * Scoring multi-familles avec tolérance aux variations de formulation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectListingKRW = detectListingKRW;
exports.detectListingKRWStrict = detectListingKRWStrict;
exports.detectListingKRWLoose = detectListingKRWLoose;
/**
 * Détecte si une notice correspond à un listing KRW
 */
function detectListingKRW(input) {
    const { title, body = '', tickers } = input;
    // Garde 1: Pas de tickers = pas de listing
    if (tickers.length === 0) {
        return {
            isListing: false,
            score: 0,
            reasons: ['NO_TICKERS'],
            confidence: 0,
            market: 'UNKNOWN'
        };
    }
    const fullText = `${title} ${body}`.toLowerCase();
    let score = 0;
    const reasons = [];
    // Famille 1: Mots-clés coréens (KR) - Score +2
    const koreanPatterns = [
        /원화.*(상장|신규|오픈|추가|출시|등록)/,
        /(상장|신규|오픈|추가|출시|등록).*원화/,
        /krw.*(상장|신규|오픈|추가|출시|등록)/,
        /(상장|신규|오픈|추가|출시|등록).*krw/,
        /원화.*마켓.*(상장|신규|오픈|추가|출시|등록)/,
        /(상장|신규|오픈|추가|출시|등록).*원화.*마켓/
    ];
    for (const pattern of koreanPatterns) {
        if (pattern.test(fullText)) {
            score += 2;
            reasons.push('KR');
            break; // Un seul match suffit pour cette famille
        }
    }
    // Famille 2: Mots-clés anglais/français - Score +1
    const englishPatterns = [
        /krw.*(list|open|add|new|launch|launched)/,
        /(list|open|add|new|launch|launched).*krw/,
        /won.*(list|open|add|new|launch|launched)/,
        /(list|open|add|new|launch|launched).*won/,
        /marché.*(ajout|ouverture|nouveau)/,
        /(ajout|ouverture|nouveau).*marché/,
        /market.*(add|open|new|list)/,
        /(add|open|new|list).*market/
    ];
    for (const pattern of englishPatterns) {
        if (pattern.test(fullText)) {
            score += 1;
            reasons.push('EN/FR');
            break; // Un seul match suffit pour cette famille
        }
    }
    // Famille 3: Pairing KRW-TICKER - Score +1 par ticker
    for (const ticker of tickers) {
        const pairingPatterns = [
            new RegExp(`(?:krw[\\s\\-]*${ticker}|${ticker}[\\s\\-]*krw)`, 'i'),
            new RegExp(`(?:won[\\s\\-]*${ticker}|${ticker}[\\s\\-]*won)`, 'i'),
            new RegExp(`(?:원화[\\s\\-]*${ticker}|${ticker}[\\s\\-]*원화)`, 'i')
        ];
        for (const pattern of pairingPatterns) {
            if (pattern.test(fullText)) {
                score += 1;
                reasons.push(`Pairing_${ticker}`);
                break; // Un seul match par ticker
            }
        }
    }
    // Famille 4: Mots-clés de listing génériques - Score +1
    const genericPatterns = [
        /(상장|listing|list|add|new|launch)/,
        /(마켓|market|trading|pair)/,
        /(거래|trade|exchange)/
    ];
    let genericScore = 0;
    for (const pattern of genericPatterns) {
        if (pattern.test(fullText)) {
            genericScore += 1;
        }
    }
    if (genericScore >= 2) {
        score += 1;
        reasons.push('Generic');
    }
    // Seuil de confirmation: score ≥ 2
    const isListing = score >= 2;
    const confidence = Math.min(1, score / 5); // Normaliser 0-1
    return {
        isListing,
        score,
        reasons,
        confidence,
        market: isListing ? 'KRW' : 'UNKNOWN'
    };
}
/**
 * Détecte les listings avec validation stricte (pour tests)
 */
function detectListingKRWStrict(input) {
    const result = detectListingKRW(input);
    // Validation stricte: au moins un mot-clé coréen OU anglais
    const hasKoreanOrEnglish = result.reasons.some(r => r === 'KR' || r === 'EN/FR');
    if (!hasKoreanOrEnglish) {
        return {
            ...result,
            isListing: false,
            score: 0,
            confidence: 0
        };
    }
    return result;
}
/**
 * Détecte les listings avec validation souple (pour production)
 */
function detectListingKRWLoose(input) {
    const result = detectListingKRW(input);
    // Validation souple: score ≥ 1 avec au moins un ticker
    if (result.score >= 1 && input.tickers.length > 0) {
        return {
            ...result,
            isListing: true,
            confidence: Math.max(result.confidence, 0.3)
        };
    }
    return result;
}
//# sourceMappingURL=detectListingKRW.js.map