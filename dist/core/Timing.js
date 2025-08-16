"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyListingTiming = classifyListingTiming;
function classifyListingTiming(tradeTimeUtc, nowUtc = new Date(), liveWindowMs = Number(process.env.LIVE_WINDOW_MS ?? 120_000)) {
    if (!tradeTimeUtc)
        return 'live'; // fallback conservateur (si l'avis dit trading "now")
    const delta = tradeTimeUtc.getTime() - nowUtc.getTime();
    if (delta > 0)
        return 'future';
    if (Math.abs(delta) <= liveWindowMs)
        return 'live';
    return 'stale';
}
//# sourceMappingURL=Timing.js.map