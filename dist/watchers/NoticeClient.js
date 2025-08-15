"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoticeClient = void 0;
const axios_1 = __importDefault(require("axios"));
const luxon_1 = require("luxon");
const crypto_1 = require("crypto");
class NoticeClient {
    baseUrl = 'https://api.bithumb.com/v1/notices';
    keywords = [
        // Coréen
        '상장', '원화마켓', 'KRW 마켓', '거래지원', '신규', '추가', '원화', '마켓',
        // Anglais
        'listing', 'new market', 'add KRW', 'KRW market', 'trading support', 'new', 'added'
    ];
    rateLimit = {
        requestsPerSecond: 1,
        minInterval: 1100, // 1 rps + marge
        maxRetries: 3
    };
    constructor() {
        // Configuration axios avec timeout et retry
        axios_1.default.defaults.timeout = 5000;
        axios_1.default.defaults.headers.common['User-Agent'] = 'BithumbBot/2.0';
    }
    /**
     * Récupère les dernières notices depuis l'API officielle Bithumb
     */
    async fetchLatestNotices(count = 5) {
        try {
            console.log(`📡 Fetching ${count} latest notices from Bithumb API...`);
            const response = await axios_1.default.get(this.baseUrl, {
                params: { count },
                timeout: 5000
            });
            if (!Array.isArray(response.data)) {
                console.warn('⚠️ API response is not an array:', response.data);
                return [];
            }
            const notices = response.data;
            console.log(`✅ Fetched ${notices.length} notices from API`);
            return notices;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response?.status === 429) {
                    console.warn('⚠️ Rate limit hit (429), will retry with backoff');
                }
                else if (error.response?.status && error.response.status >= 500) {
                    console.error('❌ Server error:', error.response?.status);
                }
                else {
                    console.error('❌ API error:', error.response?.status, error.message);
                }
            }
            else {
                console.error('❌ Unexpected error:', error);
            }
            return [];
        }
    }
    /**
     * Filtre les notices pour détecter les nouveaux listings
     */
    isListingNotice(notice) {
        const searchText = `${notice.title} ${(notice.categories || []).join(' ')}`.toLowerCase();
        const hasKeyword = this.keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
        if (hasKeyword) {
            console.log(`🔍 Listing notice detected: "${notice.title}"`);
        }
        return hasKeyword;
    }
    /**
     * Extrait la base du token depuis le titre
     */
    extractTokenBase(notice) {
        const title = notice.title.toLowerCase();
        // Patterns courants pour les nouveaux listings
        const patterns = [
            /(\w+)\s*원화\s*마켓\s*추가/i, // "ABC 원화 마켓 추가"
            /(\w+)\s*krw\s*마켓\s*추가/i, // "ABC KRW 마켓 추가"
            /(\w+)\s*거래지원\s*시작/i, // "ABC 거래지원 시작"
            /(\w+)\s*상장\s*공지/i, // "ABC 상장 공지"
            /(\w+)\s*listing\s*announcement/i, // "ABC listing announcement"
            /(\w+)\s*new\s*market/i, // "ABC new market"
        ];
        for (const pattern of patterns) {
            const match = title.match(pattern);
            if (match && match[1]) {
                const base = match[1].toUpperCase();
                console.log(`🎯 Token base extracted: ${base} from "${notice.title}"`);
                return base;
            }
        }
        console.log(`❓ Could not extract token base from: "${notice.title}"`);
        return null;
    }
    /**
     * Convertit le timestamp KST en UTC
     */
    parsePublishedUtc(notice) {
        try {
            // Parse KST timezone
            const kst = luxon_1.DateTime.fromFormat(notice.published_at, 'yyyy-MM-dd HH:mm:ss', {
                zone: 'Asia/Seoul'
            });
            if (!kst.isValid) {
                throw new Error(`Invalid KST format: ${notice.published_at}`);
            }
            const utc = kst.toUTC();
            console.log(`🕐 KST ${notice.published_at} → UTC ${utc.toISO()}`);
            return utc.toISO();
        }
        catch (error) {
            console.error('❌ Error parsing KST timestamp:', error);
            // Fallback: utiliser le timestamp actuel
            return new Date().toISOString();
        }
    }
    /**
     * Détecte si c'est un pré-listing (date future)
     */
    isFutureListing(notice) {
        try {
            const publishedAt = luxon_1.DateTime.fromFormat(notice.published_at, 'yyyy-MM-dd HH:mm:ss', {
                zone: 'Asia/Seoul'
            });
            const now = luxon_1.DateTime.now().setZone('Asia/Seoul');
            const isFuture = publishedAt > now;
            if (isFuture) {
                console.log(`⏰ Future listing detected: ${notice.title} (${notice.published_at})`);
            }
            return isFuture;
        }
        catch (error) {
            console.error('❌ Error checking future listing:', error);
            return false;
        }
    }
    /**
     * Calcule la priorité du listing
     */
    calculatePriority(notice) {
        const title = notice.title.toLowerCase();
        const categories = (notice.categories || []).map(c => c.toLowerCase());
        let score = 0;
        // Mots-clés haute priorité
        if (title.includes('원화') || title.includes('krw'))
            score += 3;
        if (title.includes('상장') || title.includes('listing'))
            score += 2;
        if (title.includes('신규') || title.includes('new'))
            score += 2;
        // Catégories importantes
        if (categories.includes('공지') || categories.includes('announcement'))
            score += 1;
        if (categories.includes('마켓') || categories.includes('market'))
            score += 1;
        // Priorité basée sur le score
        if (score >= 5)
            return 'high';
        if (score >= 3)
            return 'medium';
        return 'low';
    }
    /**
     * Génère un EventId unique et déterministe
     */
    generateEventId(notice) {
        const data = `bithumb:notice:${notice.published_at}:${notice.title}:${notice.pc_url}`;
        return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    }
    /**
     * Traite une notice et la convertit en format interne
     */
    processNotice(notice) {
        // Vérifier si c'est un listing
        if (!this.isListingNotice(notice)) {
            return null;
        }
        // Extraire la base du token
        const base = this.extractTokenBase(notice);
        if (!base) {
            return null;
        }
        // Convertir en UTC
        const publishedAtUtc = this.parsePublishedUtc(notice);
        // Vérifier si c'est un pré-listing
        const isFuture = this.isFutureListing(notice);
        // Générer l'EventId
        const eventId = this.generateEventId(notice);
        // Calculer la priorité
        const priority = this.calculatePriority(notice);
        const processedNotice = {
            eventId,
            base,
            title: notice.title,
            url: notice.pc_url,
            publishedAtUtc,
            priority,
            status: isFuture ? 'scheduled' : 'live',
            source: 'bithumb.api'
        };
        console.log(`✅ Notice processed: ${base} (${priority} priority, ${processedNotice.status})`);
        return processedNotice;
    }
    /**
     * Récupère et traite les dernières notices
     */
    async getLatestListings(count = 5) {
        const notices = await this.fetchLatestNotices(count);
        const listings = [];
        for (const notice of notices) {
            const processed = this.processNotice(notice);
            if (processed) {
                listings.push(processed);
            }
        }
        console.log(`🎯 Found ${listings.length} new listings out of ${notices.length} notices`);
        return listings;
    }
}
exports.NoticeClient = NoticeClient;
//# sourceMappingURL=NoticeClient.js.map