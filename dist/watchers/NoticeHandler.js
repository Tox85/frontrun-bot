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
            markets: notice.markets || [],
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
            rawTitle: notice.url ?? ''
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
            await this.config.telegramService.sendMessage(`🆕 [${timing.toUpperCase()}] ${notice.base} - ${notice.url} (${eventId})`, 'medium');
            return;
        }
        // Si KRW absente (USDT-only) → notify-only (selon consigne)
        if (!notice.markets?.map(m => m.toUpperCase()).includes('KRW')) {
            await this.config.telegramService.sendMessage(`🆕 [USDT-ONLY] ${notice.base} - ${notice.url} (${eventId})`, 'medium');
            return;
        }
        // Baseline guard: si base déjà en baseline KR (KRW existant) → pas de trade (sauf si bypassBaseline=true)
        if (!notice.bypassBaseline) {
            const isInBaseline = await this.config.baselineManager.isTokenInBaseline(notice.base);
            if (isInBaseline) {
                console.log(`🚫 ${notice.base} déjà en baseline KR — no trade`);
                return;
            }
        }
        else {
            console.log(`🧪 DEBUG: Bypass baseline activé pour ${notice.base}`);
        }
        // Perp lookup
        const hasPerp = await this.config.perpCatalog.hasPerp(notice.base); // utilise cache + on-demand
        if (!hasPerp) {
            await this.config.telegramService.sendMessage(`❌ [NO-PERP] ${notice.base} - Pas de perp disponible (${eventId})`, 'medium');
            return;
        }
        // Trade HL - utiliser executeOpportunity si disponible
        try {
            console.log(`🎯 [TRADE] Ouverture position long HL sur ${notice.base} (eventId=${eventId})`);
            // Créer TradeOpportunity avec les options de bypass
            const tradeOpportunity = {
                token: notice.base,
                source: 'T0_NOTICE',
                timestamp: notice.tradeTimeUtc.toISOString(),
                bypassBaseline: notice.bypassBaseline ?? false,
                bypassCooldown: notice.bypassCooldown ?? false,
                dryRun: notice.dryRun ?? false
            };
            // Exécuter le trade via TradeExecutor
            const tradeResult = await this.config.tradeExecutor.executeOpportunity(tradeOpportunity);
            if (tradeResult?.success) {
                // Marquer la base comme tradée pour éviter les doubles trades cross-source
                await this.config.eventStore.markBaseAsTraded(notice.base, eventId);
                console.log(`✅ Trade exécuté avec succès sur ${notice.base} (eventId=${eventId})`);
            }
            else {
                console.log(`❌ Trade échoué sur ${notice.base} (eventId=${eventId})`);
            }
        }
        catch (e) {
            console.error(`❌ Trade open failed for ${notice.base}`, e);
        }
    }
}
exports.NoticeHandler = NoticeHandler;
//# sourceMappingURL=NoticeHandler.js.map