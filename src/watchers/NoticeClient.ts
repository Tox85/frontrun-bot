import axios from 'axios';
import { DateTime } from 'luxon';
import { buildEventId } from '../core/EventId';
import { classifyListingTiming } from '../core/Timing';
import { extractBaseFromNotice, ExtractResult } from '../utils/extractBase';
import { WatermarkStore } from '../store/WatermarkStore';
import { LogDeduper } from '../core/LogDeduper';
import { HttpClient } from '../core/HttpClient';
import { CONFIG } from '../config/env';

export interface BithumbNotice {
  id?: number; // Optionnel car l'API peut ne pas le retourner
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

  private watermarkStore: WatermarkStore;
  private logDeduper: LogDeduper;
  private httpClient: HttpClient;
  private pollCount = 0;
  private _isEnabled = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;

  /**
   * Méthode publique pour accéder au logDeduper (pour flush lors de l'arrêt)
   */
  getLogDeduper(): LogDeduper {
    return this.logDeduper;
  }

  constructor(watermarkStore: WatermarkStore, config?: { 
    logDedupWindowMs?: number; 
    logDedupMaxPerWindow?: number;
    maxNoticeAgeMin?: number;
  }) {
    this.watermarkStore = watermarkStore;
    this.logDeduper = new LogDeduper(
      config?.logDedupWindowMs || CONFIG.LOG_DEDUP_WINDOW_MS, 
      config?.logDedupMaxPerWindow || CONFIG.LOG_DEDUP_MAX_PER_WINDOW
    );

    // Configuration du circuit-breaker pour T0
    this.httpClient = new HttpClient('NoticeClient', {
      timeoutMs: CONFIG.T0_HTTP_TIMEOUT_MS,
      maxRetries: CONFIG.T0_HTTP_RETRIES,
      baseRetryDelayMs: 250,
      maxRetryDelayMs: 500,
      jitterPercent: 20
    });
  }

  /**
   * Active T0 seulement si la baseline est prête
   */
  enable(): void {
    this._isEnabled = true;
    console.log('[T0] NoticeClient enabled');
  }

  /**
   * Désactive T0 et programme un retry
   */
  disable(reason: string): void {
    this._isEnabled = false;
    console.warn(`[T0] NoticeClient disabled: ${reason}`);
    
    // Programmer un retry avec backoff
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    const delays = [30000, 60000, 120000, 300000, 600000]; // 30s, 1m, 2m, 5m, 10m
    const cbStats = this.httpClient.getCircuitBreakerStats();
    const delay = delays[Math.min(cbStats.openCount, delays.length - 1)];
    
    console.log(`[T0] Scheduling retry in ${delay}ms`);
    
    this.retryTimer = setTimeout(() => {
      if (this.httpClient.isCircuitBreakerOpen()) {
        console.log('[T0] Circuit breaker still open, will retry again');
        this.scheduleRetry();
      } else {
        console.log('[T0] Circuit breaker closed, re-enabling');
        this.enable();
      }
    }, delay);
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
   * NE LOG PLUS "Notice processed" ici - sera fait après déduplication
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
    
    // NE PAS LOGGER ici - sera fait après déduplication
    return processedNotice;
  }

  /**
   * Récupère les dernières notices depuis l'API officielle Bithumb
   * UNIQUEMENT l'API publique - pas de scraping du site web
   */
  async fetchLatestNotices(count: number = 5): Promise<BithumbNotice[]> {
    if (!this._isEnabled) {
      console.log('[T0] NoticeClient disabled, skipping fetch');
      return [];
    }

    try {
      console.log(`📡 Fetching ${count} latest notices from Bithumb API (public endpoint)...`);
      
      const response = await this.httpClient.get(this.baseUrl, {
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
      if (error instanceof Error) {
        if (error.message.includes('999')) {
          console.error('❌ Bithumb API error 999 - disabling T0');
          this.disable('API error 999');
        } else if (error.message.includes('timeout')) {
          console.warn('⚠️ Request timeout - will retry');
        } else {
          console.error('❌ API error:', error.message);
        }
      } else {
        console.error('❌ Unexpected error:', error);
      }
      
      return [];
    }
  }

  /**
   * Démarrer le polling avec jitter
   */
  startPolling(callback: (listings: ProcessedNotice[]) => void): void {
    if (!this._isEnabled) {
      console.log('[T0] NoticeClient disabled, not starting polling');
      return;
    }

    const poll = async () => {
      if (!this._isEnabled) return;

      try {
        const listings = await this.getLatestListings(5);
        if (listings.length > 0) {
          callback(listings);
        }
      } catch (error) {
        console.error('[T0] Error during polling:', error);
      }

      // Programmer le prochain poll avec jitter
      this.scheduleNextPoll(callback);
    };

    // Premier poll immédiat
    poll();
  }

  private scheduleNextPoll(callback: (listings: ProcessedNotice[]) => void): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }

    // Jitter autour de l'intervalle 1100ms
    const baseInterval = 1100;
    const jitterRange = baseInterval * CONFIG.POLL_JITTER_PCT;
    const jitter = (Math.random() - 0.5) * jitterRange;
    const interval = Math.max(baseInterval + jitter, 1000); // Minimum 1000ms

    this.pollTimer = setTimeout(() => {
      if (this._isEnabled) {
        this.pollCount++;
        this.pollWithCallback(callback);
      }
    }, interval);
  }

  private async pollWithCallback(callback: (listings: ProcessedNotice[]) => void): Promise<void> {
    try {
      const listings = await this.getLatestListings(5);
      
      // Log compact de synthèse
      const stats = this.getPollStats();
      console.log(`[T0] Poll #${this.pollCount}: NEW=${stats.new}, DUP=${stats.dup}, FUTURE=${stats.future}, STALE=${stats.stale}, SKIP_WM=${stats.skipWm} (ms=${stats.duration})`);
      
      if (listings.length > 0) {
        callback(listings);
      }
    } catch (error) {
      console.error('[T0] Error during polling:', error);
    }

    // Programmer le prochain poll
    this.scheduleNextPoll(callback);
  }

  private getPollStats(): {
    new: number;
    dup: number;
    future: number;
    stale: number;
    skipWm: number;
    duration: number;
  } {
    // Cette méthode sera implémentée pour collecter les statistiques de poll
    // Pour l'instant, retourner des valeurs par défaut
    return {
      new: 0,
      dup: 0,
      future: 0,
      stale: 0,
      skipWm: 0,
      duration: 0
    };
  }

  /**
   * Arrêter le polling
   */
  stopPolling(): void {
    this._isEnabled = false;
    
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Récupère et traite les dernières notices avec watermark et déduplication
   */
  async getLatestListings(count: number = 5): Promise<ProcessedNotice[]> {
    const notices = await this.fetchLatestNotices(count);
    const listings: ProcessedNotice[] = [];
    
    // Convertir les notices en format compatible avec le watermark
    const watermarkNotices = notices.map(notice => ({
      uid: notice.id?.toString() || `${notice.title}_${notice.published_at}`,
      published_at: new Date(notice.published_at).getTime(),
      title: notice.title
    }));
    
    // Mettre à jour le watermark avec ce batch
    await this.watermarkStore.updateFromBatch('bithumb.notice', watermarkNotices);
    
    for (const notice of notices) {
      // Vérifier le watermark AVANT traitement
      const shouldConsider = await this.watermarkStore.shouldConsider('bithumb.notice', {
        uid: notice.id?.toString() || `${notice.title}_${notice.published_at}`,
        published_at: new Date(notice.published_at).getTime(),
        title: notice.title
      });
      
      if (!shouldConsider) {
        // Notice trop ancienne, ignorer silencieusement
        continue;
      }
      
      const processed = this.processNotice(notice);
      if (processed) {
        listings.push(processed);
      }
    }
    
    console.log(`🎯 Found ${listings.length} new listings out of ${notices.length} notices`);
    return listings;
  }

  getCircuitBreakerStats() {
    return this.httpClient.getCircuitBreakerStats();
  }

  isEnabled(): boolean {
    return this._isEnabled;
  }
}
