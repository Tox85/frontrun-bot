import axios from 'axios';
import { DateTime } from 'luxon';
import { buildEventId } from '../core/EventId';
import { classifyListingTiming } from '../core/Timing';
import { extractBaseFromNotice, ExtractResult } from '../utils/extractBase';

export interface BithumbNotice {
  id: number;
  title: string;
  categories: string[];
  pc_url: string;
  published_at: string; // 'yyyy-MM-dd hh:mm:ss' KST
  content?: string;
}

export interface ProcessedNotice {
  eventId: string;
  base: string;
  title: string;
  url: string;
  publishedAtUtc: string;
  markets: string[];
  priority: 'high' | 'medium' | 'low';
  status: 'scheduled' | 'live' | 'completed';
  source: 'bithumb.notice';
  tradeTimeUtc?: Date | undefined; // Nouveau: pour le gating timing
}

export class NoticeClient {
  private readonly baseUrl = 'https://api.bithumb.com/v1/notices';
  private readonly keywords = [
    // Coréen
    '상장', '원화', 'KRW', '거래지원', '신규', '추가', '원화마켓', 'KRW 마켓',
    // Anglais
    'listing', 'new market', 'add KRW', 'KRW market', 'trading support', 'new', 'added'
  ];
  
  private readonly rateLimit = {
    requestsPerSecond: 1,
    minInterval: 1100, // ≥1100ms comme requis
    maxRetries: 3
  };

  constructor() {
    // Configuration axios avec timeout et retry
    axios.defaults.timeout = 5000;
    axios.defaults.headers.common['User-Agent'] = 'BithumbBot/2.0';
  }

  /**
   * Récupère les dernières notices depuis l'API officielle Bithumb
   * UNIQUEMENT l'API publique - pas de scraping du site web
   */
  async fetchLatestNotices(count: number = 5): Promise<BithumbNotice[]> {
    try {
      console.log(`📡 Fetching ${count} latest notices from Bithumb API (public endpoint)...`);
      
      const response = await axios.get(this.baseUrl, {
        params: { count },
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!Array.isArray(response.data)) {
        console.warn('⚠️ API response is not an array:', response.data);
        return [];
      }

      const notices = response.data as BithumbNotice[];
      console.log(`✅ Fetched ${notices.length} notices from public API`);
      
      return notices;
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.warn('⚠️ Rate limit hit (429), will retry with backoff');
        } else if (error.response?.status && error.response.status >= 500) {
          console.error('❌ Server error:', error.response?.status);
        } else {
          console.error('❌ API error:', error.response?.status, error.message);
        }
      } else {
        console.error('❌ Unexpected error:', error);
      }
      
      return [];
    }
  }

  /**
   * Filtre les notices pour détecter les nouveaux listings
   */
  isListingNotice(notice: BithumbNotice): boolean {
    const searchText = `${notice.title} ${(notice.categories || []).join(' ')}`.toLowerCase();
    
    const hasKeyword = this.keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
    
    if (hasKeyword) {
      console.log(`🔍 Listing notice detected: "${notice.title}"`);
    }
    
    return hasKeyword;
  }

  /**
   * Extrait la base du token depuis le titre
   */
  private extractTokenBase(title: string, body: string): string | null {
    const fullText = `${title} ${body}`;
    const result = extractBaseFromNotice(fullText);
    
    if (result.kind === 'LATIN') {
      console.log(`✅ Base extraite: ${result.base} (source: ${result.source})`);
      return result.base;
    } else {
      console.log(`⚠️ KRW listing détecté mais ticker latin absent (alias: ${result.baseAliasKorean ?? 'n/a'}) — T2 fallback`);
      return null;
    }
  }

  /**
   * Extrait les marchés mentionnés
   */
  extractMarkets(notice: BithumbNotice): string[] {
    const markets: string[] = [];
    const text = `${notice.title} ${(notice.categories || []).join(' ')}`.toLowerCase();
    
    if (text.includes('krw') || text.includes('원화')) {
      markets.push('KRW');
    }
    
    return markets;
  }

  /**
   * Convertit le timestamp KST en UTC
   */
  parsePublishedUtc(notice: BithumbNotice): string {
    try {
      // Parse KST timezone
      const kst = DateTime.fromFormat(notice.published_at, 'yyyy-MM-dd HH:mm:ss', { 
        zone: 'Asia/Seoul' 
      });
      
      if (!kst.isValid) {
        throw new Error(`Invalid KST format: ${notice.published_at}`);
      }
      
      const utc = kst.toUTC();
      console.log(`🕐 KST ${notice.published_at} → UTC ${utc.toISO()}`);
      
      return utc.toISO();
      
    } catch (error) {
      console.error('❌ Error parsing KST timestamp:', error);
      // Fallback: utiliser le timestamp actuel
      return new Date().toISOString();
    }
  }

  /**
   * Détecte si c'est un pré-listing (date future) et retourne la Date
   */
  parseTradeTime(notice: BithumbNotice): Date | null {
    try {
      const publishedAt = DateTime.fromFormat(notice.published_at, 'yyyy-MM-dd HH:mm:ss', { 
        zone: 'Asia/Seoul' 
      });
      
      if (!publishedAt.isValid) {
        return null;
      }
      
      const utc = publishedAt.toUTC();
      return utc.toJSDate();
      
    } catch (error) {
      console.error('❌ Error parsing trade time:', error);
      return null;
    }
  }

  /**
   * Calcule la priorité du listing
   */
  calculatePriority(notice: BithumbNotice): 'high' | 'medium' | 'low' {
    const title = notice.title.toLowerCase();
    const categories = (notice.categories || []).map(c => c.toLowerCase());
    
    let score = 0;
    
    // Mots-clés haute priorité
    if (title.includes('원화') || title.includes('krw')) score += 3;
    if (title.includes('상장') || title.includes('listing')) score += 2;
    if (title.includes('신규') || title.includes('new')) score += 2;
    
    // Catégories importantes
    if (categories.includes('공지') || categories.includes('announcement')) score += 1;
    if (categories.includes('마켓') || categories.includes('market')) score += 1;
    
    // Priorité basée sur le score
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * Traite une notice et la convertit en format interne
   */
  processNotice(notice: BithumbNotice): ProcessedNotice | null {
    // Vérifier si c'est un listing
    if (!this.isListingNotice(notice)) {
      return null;
    }
    
    // Extraire la base du token
    const base = this.extractTokenBase(notice.title, notice.content || '');
    if (!base) {
      return null;
    }
    
    // Extraire les marchés
    const markets = this.extractMarkets(notice);
    
    // Convertir en UTC
    const publishedAtUtc = this.parsePublishedUtc(notice);
    
    // Parser le trade time pour le gating
    const tradeTimeUtc = this.parseTradeTime(notice);
    
    // Calculer la priorité
    const priority = this.calculatePriority(notice);
    
    // Status basé sur le timing (sera recalculé lors du traitement)
    const status = tradeTimeUtc && tradeTimeUtc > new Date() ? 'scheduled' : 'live';
    
    const processedNotice: ProcessedNotice = {
      eventId: '', // Sera généré lors du traitement avec buildEventId
      base,
      title: notice.title,
      url: notice.pc_url,
      publishedAtUtc,
      markets,
      priority,
      status,
      source: 'bithumb.notice',
      tradeTimeUtc: tradeTimeUtc || undefined
    };
    
    console.log(`✅ Notice processed: ${base} (${priority} priority, ${processedNotice.status})`);
    
    return processedNotice;
  }

  /**
   * Récupère et traite les dernières notices
   */
  async getLatestListings(count: number = 5): Promise<ProcessedNotice[]> {
    const notices = await this.fetchLatestNotices(count);
    const listings: ProcessedNotice[] = [];
    
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
