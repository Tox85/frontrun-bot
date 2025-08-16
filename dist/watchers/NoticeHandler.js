"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoticeHandler = void 0;
const EventId_1 = require("../core/EventId");
const Timing_1 = require("../core/Timing");
class NoticeHandler {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Traite une notice avec dédup idempotente et gating timing
     */
    async handleNotice(notice) {
        // Construire l'eventId unifié
        const eventId = (0, EventId_1.buildEventId)({
            source: 'bithumb.notice',
            base: notice.base,
            url: notice.url,
            markets: notice.markets,
            tradeTimeUtc: notice.tradeTimeUtc ? notice.tradeTimeUtc.toISOString() : ''
        });
        // Log léger avant insert (debug)
        console.log(`T0 candidate base=${notice.base} eventId=${eventId}`);
        // INSERT OR IGNORE
        const inserted = await this.config.eventStore.tryMarkProcessed({
            eventId,
            source: 'bithumb.notice',
            base: notice.base.toUpperCase(),
            url: notice.url ?? '',
            markets: notice.markets || [],
            tradeTimeUtc: notice.tradeTimeUtc ? notice.tradeTimeUtc.toISOString() : '',
            rawTitle: notice.title ?? ''
        });
        if (inserted === 'DUPLICATE') {
            console.log(`⏭️ [DEDUP] DUPLICATE ${eventId} base=${notice.base} — SKIP`);
            return;
        }
        // Gating timing
        const timing = (0, Timing_1.classifyListingTiming)(notice.tradeTimeUtc);
        console.log(`🆕 [NEW] ${notice.base} (${timing}) — ${eventId}`);
        // Règles:
        // - Si 'future' → notify-only (pas de trade)
        // - Si 'stale'  → log only (pas de trade)
        // - Si 'live'   → route vers Trade pipeline
        if (timing !== 'live') {
            // Stub temporaire pour notifyListing
            await this.config.telegramService.sendMessage(`🆕 [${timing.toUpperCase()}] ${notice.base} - ${notice.title} (${eventId})`, 'medium');
            return;
        }
        // Si KRW absente (USDT-only) → notify-only (selon consigne)
        if (!notice.markets?.map(m => m.toUpperCase()).includes('KRW')) {
            await this.config.telegramService.sendMessage(`🆕 [USDT-ONLY] ${notice.base} - ${notice.title} (${eventId})`, 'medium');
            return;
        }
        // Baseline guard: si base déjà en baseline KR (KRW existant) → pas de trade
        const isInBaseline = await this.config.baselineManager.isTokenInBaseline(notice.base);
        if (isInBaseline) {
            console.log(`🚫 ${notice.base} déjà en baseline KR — no trade`);
            return;
        }
        // Perp lookup
        const hasPerp = await this.config.perpCatalog.hasPerp(notice.base); // utilise cache + on-demand
        if (!hasPerp) {
            await this.config.telegramService.sendMessage(`❌ [NO-PERP] ${notice.base} - Pas de perp disponible (${eventId})`, 'medium');
            return;
        }
        // Trade HL - utiliser executeOpportunity si disponible
        try {
            // Stub temporaire - à remplacer par la vraie méthode
            console.log(`🎯 [TRADE] Ouverture position long HL sur ${notice.base} (eventId=${eventId})`);
            // Marquer la base comme tradée pour éviter les doubles trades cross-source
            await this.config.eventStore.markBaseAsTraded(notice.base, eventId);
            console.log(`✅ Opened long HL on ${notice.base} (eventId=${eventId})`);
        }
        catch (e) {
            console.error(`❌ Trade open failed for ${notice.base}`, e);
        }
    }
}
exports.NoticeHandler = NoticeHandler;
//# sourceMappingURL=NoticeHandler.js.map