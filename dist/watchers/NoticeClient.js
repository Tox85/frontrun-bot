"use strict";
// Version corrigée du NoticeClient avec patch T0 Robust complet
// Corrections apportées :
// 1. ENDPOINTS CORRIGÉS : feed.bithumb.com/notice (HTML) + désactivation JSON invalide
// 2. CIRCUIT BREAKERS SÉPARÉS : JSON et HTML indépendants
// 3. FALLBACK SIMPLIFIÉ : HTML comme source principale
// 4. DÉCODAGE CORRIGÉ : Plus de double décodage
// 5. GESTION D'ERREURS AMÉLIORÉE : Logs clairs et cooldowns
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoticeClient = void 0;
const luxon_1 = require("luxon");
const extractTickers_1 = require("../utils/extractTickers");
const detectListingKRW_1 = require("../detection/detectListingKRW");
const crypto_1 = require("crypto");
class NoticeClient {
    baseUrl;
    httpClient;
    watermarkStore;
    logDedupWindowMs;
    logDedupMaxPerWindow;
    _isEnabled = false;
    retryTimer = null;
    // CORRECTION 1: URLs CORRECTES
    static HTML_LIST_URL = 'https://feed.bithumb.com/notice';
    static JSON_URL = null; // Désactivé - pas d'endpoint JSON valide
    // CORRECTION 2: CIRCUIT BREAKERS SÉPARÉS
    circuitBreakers = {
        json: { errors: 0, openUntil: 0 },
        html: { errors: 0, openUntil: 0 }
    };
    // PATCH T0 Robust: État de la source HTML pour éviter le spam 403
    htmlState = 'OK';
    htmlNextRetryAt = 0;
    // PATCH T0 Robust: Stoplist pour les alias génériques
    static GENERIC_ALIASES = new Set([
        '가상자산', '원화', '마켓', '추가', '공지', '안내', '신규', '상장'
    ]);
    constructor(baseUrl, httpClient, watermarkStore, logDedupWindowMs = 60000, logDedupMaxPerWindow = 2) {
        this.baseUrl = baseUrl;
        this.httpClient = httpClient;
        this.watermarkStore = watermarkStore;
        this.logDedupWindowMs = logDedupWindowMs;
        this.logDedupMaxPerWindow = logDedupMaxPerWindow;
    }
    /**
     * Active T0
     */
    enable() {
        this._isEnabled = true;
        console.log('[T0] NoticeClient enabled');
    }
    /**
     * Désactive T0 et programme un retry
     */
    disable(reason) {
        this._isEnabled = false;
        console.warn(`[T0] NoticeClient disabled: ${reason}`);
        this.scheduleRetry();
    }
    scheduleRetry() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
        }
        const delay = Math.min(5 * 60 * 1000, Math.random() * 2 * 60 * 1000); // 0-2min + 5min max
        this.retryTimer = setTimeout(() => {
            this.enable();
        }, delay);
    }
    // CORRECTION 3: CIRCUIT BREAKER MANAGEMENT
    noteError(which) {
        const cb = this.circuitBreakers[which];
        cb.errors++;
        if (cb.errors >= 3) {
            const backoffMs = Math.min(15 * 60_000, 60_000 * Math.pow(2, cb.errors - 3)); // 1m, 2m, 4m... max 15m
            cb.openUntil = Date.now() + backoffMs;
            if (process.env.LOG_LEVEL !== 'debug') {
                console.info(`[CircuitBreaker] OPEN ${which.toUpperCase()} until ${new Date(cb.openUntil).toISOString()}`);
            }
        }
    }
    canTry(which) {
        const cb = this.circuitBreakers[which];
        return Date.now() >= cb.openUntil;
    }
    noteSuccess(which) {
        this.circuitBreakers[which] = { errors: 0, openUntil: 0 };
    }
    // CORRECTION 4: FETCH JSON (désactivé mais gardé pour compatibilité)
    async fetchJsonNoticeAsText() {
        // JSON désactivé - pas d'endpoint valide
        if (!NoticeClient.JSON_URL) {
            return null;
        }
        if (!this.canTry('json')) {
            return null;
        }
        try {
            const response = await fetch(NoticeClient.JSON_URL, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const contentType = response.headers.get('content-type') || '';
            const raw = await response.text();
            if (!response.ok || !contentType.includes('application/json')) {
                this.debugHttpProblem('JSON', NoticeClient.JSON_URL, response.status, contentType, raw.slice(0, 300));
                this.noteError('json');
                return null;
            }
            // JSON valide
            this.noteSuccess('json');
            return {
                text: raw,
                encoding: 'utf-8',
                replacementCount: 0,
                hasHangul: raw.includes('가') || raw.includes('나') || raw.includes('다')
            };
        }
        catch (error) {
            console.debug(`⚠️ JSON fetch failed: ${error}`);
            this.noteError('json');
            return null;
        }
    }
    // CORRECTION 5: FETCH HTML (source principale)
    async fetchHtmlNoticeAsText() {
        if (!this.canTry('html')) {
            return null;
        }
        const now = Date.now();
        // Si HTML est dégradé, attendre le backoff
        if (this.htmlState === 'DEGRADED' && now < this.htmlNextRetryAt) {
            return null;
        }
        try {
            const response = await fetch(NoticeClient.HTML_LIST_URL, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.bithumb.com/',
                    'Cache-Control': 'no-cache'
                }
            });
            const contentType = response.headers.get('content-type') || '';
            const raw = await response.text();
            if (response.status === 403) {
                // 403 → passer en mode DEGRADED avec backoff exponentiel
                this.htmlState = 'DEGRADED';
                const backoffMs = Math.min(15 * 60_000, (this.htmlNextRetryAt ? 2 : 1) * 60_000);
                this.htmlNextRetryAt = now + backoffMs;
                if (process.env.LOG_LEVEL !== 'debug') {
                    console.info(`HTML source degraded: 403 Forbidden. Retry in ~${Math.round(backoffMs / 1000)}s`);
                }
                this.noteError('html');
                return null;
            }
            if (!response.ok || !contentType.includes('text/html')) {
                this.debugHttpProblem('HTML', NoticeClient.HTML_LIST_URL, response.status, contentType, raw.slice(0, 300));
                this.noteError('html');
                return null;
            }
            // HTML fonctionne, remettre en état OK
            this.htmlState = 'OK';
            this.noteSuccess('html');
            return {
                text: raw,
                encoding: 'utf-8',
                replacementCount: 0,
                hasHangul: raw.includes('가') || raw.includes('나') || raw.includes('다')
            };
        }
        catch (error) {
            console.debug(`⚠️ HTML fetch failed: ${error}`);
            this.noteError('html');
            return null;
        }
    }
    // CORRECTION 6: DEBUG HTTP PROBLEMS
    debugHttpProblem(kind, url, status, contentType, sample) {
        if (process.env.LOG_LEVEL === 'debug') {
            console.debug(`[${kind}] bad response url=${url} status=${status} ct=${contentType} sample=${JSON.stringify(sample)}`);
        }
        else {
            console.info(`[${kind}] request failed status=${status} ct=${contentType}`);
        }
    }
    /**
     * PATCH T0 Robust: Génère un eventId unique pour une notice
     */
    buildNoticeEventId(data) {
        const content = `${data.id}-${data.base}-${data.url}-${data.tradeTimeUtc.toISOString()}-${data.source}`;
        return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
    }
    /**
     * PATCH T0 Robust: Choisit la meilleure source entre JSON et HTML
     */
    chooseBestSource(jsonResult, htmlResult) {
        // Si JSON est indisponible, forcer HTML
        if (!jsonResult) {
            if (htmlResult) {
                return { source: 'HTML', text: htmlResult };
            }
            return null; // Aucune source disponible
        }
        // Si HTML est indisponible, forcer JSON
        if (!htmlResult) {
            return { source: 'JSON', text: jsonResult };
        }
        // Priorité 1: Moins de caractères de remplacement
        if (jsonResult.replacementCount < htmlResult.replacementCount) {
            return { source: 'JSON', text: jsonResult };
        }
        if (htmlResult.replacementCount < jsonResult.replacementCount) {
            return { source: 'HTML', text: htmlResult };
        }
        // Priorité 2: Si même nombre de remplacements, privilégier celle avec Hangul
        if (jsonResult.hasHangul && !htmlResult.hasHangul) {
            return { source: 'JSON', text: jsonResult };
        }
        if (htmlResult.hasHangul && !jsonResult.hasHangul) {
            return { source: 'HTML', text: htmlResult };
        }
        // Priorité 3: Par défaut, HTML (plus fiable)
        return { source: 'HTML', text: htmlResult };
    }
    /**
     * PATCH T0 Robust: Extraction des bases avec fusion des détecteurs
     */
    extractBasesOnce(notice) {
        const bases = new Set();
        const detail = new Map();
        const fullText = `${notice.title} ${notice.content || ''}`;
        // Extraction avec tous les détecteurs
        const tickerExtraction = (0, extractTickers_1.extractTickersWithConfidence)(fullText, fullText);
        // Fusion des résultats et élimination des doublons
        for (const ticker of tickerExtraction.tickers) {
            if (!ticker)
                continue;
            // PATCH T0 Robust: Stoplist pour les alias génériques
            if (NoticeClient.GENERIC_ALIASES.has(ticker)) {
                continue;
            }
            // Validation du format de base
            if (!/^[A-Z0-9]{2,15}$/.test(ticker)) {
                continue;
            }
            const key = ticker;
            if (!detail.has(key)) {
                detail.set(key, { base: key, reasons: [] });
            }
            // Ajouter les raisons de détection
            if (tickerExtraction.confidence > 0.8) {
                detail.get(key).reasons.push('high_confidence');
            }
            if (fullText.includes(`${ticker}-KRW`)) {
                detail.get(key).reasons.push('pairing_KRW');
            }
            if (fullText.includes(`(${ticker})`)) {
                detail.get(key).reasons.push('paren_format');
            }
            bases.add(key);
        }
        return { bases, detail };
    }
    /**
     * PATCH T0 Robust: Scoring intelligent avec override
     */
    calculateT0Score(notice, detail) {
        let score = 0;
        const fullText = `${notice.title} ${notice.content || ''}`.toLowerCase();
        // Règles de scoring
        if (fullText.includes('krw') || fullText.includes('원화'))
            score += 1;
        if (fullText.includes('market') || fullText.includes('마켓'))
            score += 1;
        if (fullText.includes('new') || fullText.includes('신규') || fullText.includes('추가'))
            score += 1;
        if (fullText.includes('listing') || fullText.includes('상장'))
            score += 1;
        // Bonus pour les bases avec raisons multiples
        for (const [base, baseDetail] of detail) {
            if (baseDetail.reasons.length > 1)
                score += 1;
            if (baseDetail.reasons.includes('pairing_KRW'))
                score += 1;
            if (baseDetail.reasons.includes('high_confidence'))
                score += 1;
        }
        return score;
    }
    /**
     * PATCH T0 Robust: Traitement des notices avec préfiltrage watermark
     */
    async processNotice(notice, opts) {
        // Log unique au niveau DEBUG
        console.debug(`🔍 Processing notice: "${notice.title}"`);
        // PATCH T0 Robust: Extraction des bases avec fusion des détecteurs
        const { bases, detail } = this.extractBasesOnce(notice);
        if (bases.size === 0) {
            return [];
        }
        // PATCH T0 Robust: Scoring intelligent
        const t0Score = this.calculateT0Score(notice, detail);
        // Log des bases extraites avec raisons fusionnées
        for (const [base, baseDetail] of detail) {
            console.debug(`🔍 Base extraite: ${base} (source: ${baseDetail.reasons.join(', ')})`);
        }
        // Détection de listing KRW
        const detection = (0, detectListingKRW_1.detectListingKRW)({
            title: notice.title,
            body: notice.content || '',
            tickers: Array.from(bases)
        });
        if (detection.isListing && t0Score >= 2) {
            // T0 confirmé
            console.log(`INFO T0 candidate: tickers=${Array.from(bases).join(',')} score=${t0Score} reasons=[${Array.from(detail.values()).flatMap(d => d.reasons).join(', ')}]`);
            // Créer un ProcessedNotice par base
            const results = [];
            for (const base of bases) {
                const eventId = this.buildNoticeEventId({
                    id: notice.id?.toString() || 'unknown',
                    base,
                    url: notice.pc_url || '',
                    tradeTimeUtc: this.parseTradeTime(notice),
                    source: opts?.source === 't0' ? 'bithumb.notice' : opts?.source === 't2' ? 'bithumb.ws' : 'simulate'
                });
                results.push({
                    eventId,
                    base,
                    url: notice.pc_url || '',
                    tradeTimeUtc: this.parseTradeTime(notice),
                    source: opts?.source === 't0' ? 'bithumb.notice' : opts?.source === 't2' ? 'bithumb.ws' : 'simulate',
                    title: notice.title,
                    content: notice.content || '',
                    categories: notice.categories || [],
                    // Propriétés supplémentaires pour compatibilité
                    markets: ['KRW'],
                    timing: 'live',
                    bypassBaseline: opts?.bypassBaseline || false,
                    bypassCooldown: opts?.bypassCooldown || false,
                    dryRun: opts?.dryRun || false
                });
            }
            return results;
        }
        else if (detection.isListing && t0Score < 2) {
            // Listing détecté mais score insuffisant → T2 fallback
            console.warn(`⚠️ KRW listing détecté mais score insuffisant (${t0Score}/2) — T2 fallback`);
            return [];
        }
        else {
            // Pas de listing
            return [];
        }
    }
    /**
     * PATCH T0 Robust: Récupération des notices avec fallback multi-source
     */
    async fetchLatestNotices() {
        try {
            // Récupération depuis les deux sources
            const jsonResult = await this.fetchJsonNoticeAsText();
            const htmlResult = await this.fetchHtmlNoticeAsText();
            // Choix de la meilleure source
            const bestSource = this.chooseBestSource(jsonResult, htmlResult);
            if (!bestSource) {
                console.warn('⚠️ Aucune source de notices disponible');
                return [];
            }
            console.debug(`🔍 Notice source=${bestSource.source} encoding=${bestSource.text.encoding} replacement=${bestSource.text.replacementCount} hasHangul=${bestSource.text.hasHangul ? 1 : 0}`);
            let notices = [];
            if (bestSource.source === 'JSON') {
                try {
                    const jsonData = JSON.parse(bestSource.text.text);
                    notices = Array.isArray(jsonData) ? jsonData : [];
                }
                catch (parseError) {
                    console.warn('⚠️ Failed to parse JSON notices, falling back to empty array');
                    notices = [];
                }
            }
            else if (bestSource.source === 'HTML') {
                notices = this.parseNoticesFromHtml(bestSource.text.text);
            }
            console.log(`✅ Fetched ${notices.length} notices from ${bestSource.source} source (encoding: ${bestSource.text.encoding})`);
            return notices;
        }
        catch (error) {
            console.error('❌ Error fetching notices:', error);
            return [];
        }
    }
    /**
     * Récupère les dernières notices traitées (alias pour compatibilité)
     */
    async getLatestListings(count) {
        const notices = await this.fetchLatestNotices();
        const results = [];
        for (const notice of notices) {
            const processed = await this.processNotice(notice);
            results.push(...processed);
        }
        return results;
    }
    /**
     * Récupère le déduplicateur de logs (alias pour compatibilité)
     */
    getLogDeduper() {
        return {
            dedup: (key, ttlMs) => true, // Simplifié pour compatibilité
            clear: () => {
                console.log('🧹 Log deduper cleared');
            }
        };
    }
    /**
     * Arrête le polling (alias pour compatibilité)
     */
    stopPolling() {
        console.log('🛑 NoticeClient polling stopped');
    }
    /**
     * PATCH T0 Robust: Parse les notices depuis le HTML de fallback
     */
    parseNoticesFromHtml(htmlText) {
        // Extraction basique des notices depuis le HTML
        // Ceci est un fallback simplifié - l'API JSON reste la source principale
        const notices = [];
        try {
            // Regex pour extraire les informations de base des notices
            const noticePattern = /<div[^>]*class="[^"]*notice[^"]*"[^>]*>.*?<h[1-6][^>]*>(.*?)<\/h[1-6]>.*?<div[^>]*class="[^"]*date[^"]*"[^>]*>(.*?)<\/div>/gs;
            let match;
            while ((match = noticePattern.exec(htmlText)) !== null) {
                if (match[1] && match[2]) {
                    notices.push({
                        id: Date.now() + Math.random(), // ID temporaire
                        title: match[1].trim(),
                        content: '',
                        categories: ['notice'],
                        pc_url: '',
                        published_at: match[2].trim()
                    });
                }
            }
        }
        catch (error) {
            console.warn('⚠️ HTML parsing failed:', error);
        }
        return notices;
    }
    /**
     * Parse le temps de trade depuis le format KST
     */
    parseTradeTime(notice) {
        if (!notice.published_at) {
            throw new Error('published_at is required');
        }
        const kst = luxon_1.DateTime.fromFormat(notice.published_at, 'yyyy-MM-dd HH:mm:ss', {
            zone: 'Asia/Seoul'
        });
        if (!kst.isValid) {
            throw new Error(`Invalid KST format: ${notice.published_at}`);
        }
        return kst.toJSDate();
    }
    /**
     * Vérifie si le client est activé
     */
    get isEnabled() {
        return this._isEnabled;
    }
    /**
     * Arrête le client
     */
    stop() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        this._isEnabled = false;
    }
}
exports.NoticeClient = NoticeClient;
//# sourceMappingURL=NoticeClient.js.map