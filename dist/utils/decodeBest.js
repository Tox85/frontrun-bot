"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeBest = decodeBest;
exports.decodeMultiSource = decodeMultiSource;
const iconv = __importStar(require("iconv-lite"));
/**
 * Décode un buffer avec l'encodage spécifié
 */
function decodeBuffer(buffer, encoding) {
    try {
        return iconv.decode(buffer, encoding);
    }
    catch (error) {
        // En cas d'erreur, retourner une chaîne vide
        return '';
    }
}
/**
 * Calcule le score de qualité d'un décodage
 */
function calculateDecodeScore(text, encoding, contentType) {
    let score = 0;
    // Compter les caractères de remplacement ()
    const replacementChars = (text.match(/\uFFFD/g) || []).length;
    score -= replacementChars * 10; // Pénaliser fortement
    // Bonus si Hangul détecté (indique un bon décodage coréen)
    const hasHangul = /\p{Script=Hangul}/u.test(text);
    if (hasHangul) {
        score += 50;
    }
    // Bonus si l'encodage correspond au Content-Type
    if (contentType && contentType.includes(encoding)) {
        score += 30;
    }
    // Bonus pour les encodages préférés
    if (encoding === 'utf8')
        score += 20;
    if (encoding === 'euc-kr')
        score += 15;
    if (encoding === 'cp949')
        score += 10;
    // Pénaliser les encodages moins fiables
    if (encoding === 'latin1')
        score -= 20;
    if (encoding === 'windows-1252')
        score -= 15;
    return score;
}
/**
 * Décode un buffer avec le meilleur encodage possible
 */
function decodeBest(buffer, headers) {
    const encodings = ['utf8', 'euc-kr', 'cp949', 'windows-1252', 'latin1'];
    const contentType = headers?.['content-type'] || headers?.['Content-Type'];
    let bestResult = null;
    let bestScore = -Infinity;
    // Essayer chaque encodage
    for (const encoding of encodings) {
        const text = decodeBuffer(buffer, encoding);
        if (!text)
            continue;
        const score = calculateDecodeScore(text, encoding, contentType);
        if (score > bestScore) {
            bestScore = score;
            bestResult = {
                text,
                encoding,
                replacementChars: (text.match(/\uFFFD/g) || []).length,
                hasHangul: /\p{Script=Hangul}/u.test(text),
                confidence: Math.max(0, Math.min(1, (score + 100) / 200)) // Normaliser 0-1
            };
        }
    }
    if (!bestResult) {
        // Fallback: UTF-8 même si corrompu
        const text = decodeBuffer(buffer, 'utf8');
        bestResult = {
            text,
            encoding: 'utf8',
            replacementChars: (text.match(/\uFFFD/g) || []).length,
            hasHangul: /\p{Script=Hangul}/u.test(text),
            confidence: 0.1
        };
    }
    return bestResult;
}
/**
 * Décode depuis plusieurs sources et concatène les meilleurs résultats
 */
function decodeMultiSource(sources) {
    const results = [];
    // Décoder chaque source
    for (const source of sources) {
        const result = decodeBest(source.buffer, source.headers);
        results.push({
            ...result,
            text: `[${source.type}] ${result.text}`
        });
    }
    // Choisir le meilleur résultat global
    const bestResult = results.reduce((best, current) => current.confidence > best.confidence ? current : best);
    // Concaténer tous les textes pour une analyse complète
    const combinedText = results.map(r => r.text).join('\n');
    return {
        text: combinedText,
        encoding: bestResult.encoding,
        replacementChars: results.reduce((sum, r) => sum + r.replacementChars, 0),
        hasHangul: results.some(r => r.hasHangul),
        confidence: bestResult.confidence
    };
}
//# sourceMappingURL=decodeBest.js.map