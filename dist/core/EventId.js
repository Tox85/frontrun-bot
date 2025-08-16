"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeUrl = normalizeUrl;
exports.buildEventId = buildEventId;
exports.isValidEventId = isValidEventId;
const crypto_1 = require("crypto");
// Normalise une URL pour la stabilité du hash: https, sans query volatile
function normalizeUrl(u) {
    if (!u)
        return '';
    try {
        const url = new URL(u);
        url.protocol = 'https:'; // force https
        // option 1: on enlève la query entièrement (le plus simple)
        url.search = '';
        url.hash = '';
        return url.toString();
    }
    catch {
        return '';
    }
}
function buildEventId(input) {
    const base = (input.base || '').toUpperCase();
    const url = normalizeUrl(input.url);
    const markets = [...(input.markets || [])].map(m => m.toUpperCase()).sort();
    const tradeTime = input.tradeTimeUtc || '';
    const payload = `${input.source}|${base}|${url}|${markets.join(',')}|${tradeTime}`;
    return (0, crypto_1.createHash)('sha256').update(payload).digest('hex');
}
/**
 * Vérifie si un eventId est valide (format SHA256)
 */
function isValidEventId(eventId) {
    return /^[a-f0-9]{64}$/.test(eventId);
}
//# sourceMappingURL=EventId.js.map