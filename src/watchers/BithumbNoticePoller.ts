import { NoticeClient, ProcessedNotice } from './NoticeClient';
import { TokenRegistry } from '../store/TokenRegistry';
import { TelegramService } from '../notify/TelegramService';
import { WatermarkStore } from '../store/WatermarkStore';

export interface NoticePollerConfig {
  pollIntervalMs: number;
  maxNoticesPerPoll: number;
  enableTelegram: boolean;
  enableLogging: boolean;
}

export class BithumbNoticePoller {
  private noticeClient: NoticeClient;
  private tokenRegistry: TokenRegistry;
  private telegramService: TelegramService;
  private watermarkStore: WatermarkStore;
  private config: NoticePollerConfig;
  
  private isRunning: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastPollTime: number = 0;
  private consecutiveErrors: number = 0;
  private maxConsecutiveErrors: number = 5;
  
  // Métriques de performance
  private totalPolls: number = 0;
  private totalNotices: number = 0;
  private totalListings: number = 0;
  private totalNewListings: number = 0;
  private totalSkippedWatermark: number = 0;
  private lastErrorTime: number = 0;
  private averageResponseTime: number = 0;

  constructor(
    tokenRegistry: TokenRegistry,
    telegramService: TelegramService,
    watermarkStore: WatermarkStore,
    config: NoticePollerConfig
  ) {
    this.watermarkStore = watermarkStore;
    this.noticeClient = new NoticeClient(watermarkStore, {
      logDedupWindowMs: 60000, // 1 min par défaut
      logDedupMaxPerWindow: 2, // 2 logs max par fenêtre
      maxNoticeAgeMin: 180 // 3h par défaut
    });
    this.tokenRegistry = tokenRegistry;
    this.telegramService = telegramService;
    this.config = config;
    
    console.log('🚀 BithumbNoticePoller initialized with ultra-competitive T0 detection + watermark');
  }

  /**
   * Démarre le polling ultra-compétitif
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ NoticePoller already running');
      return;
    }

    console.log('🚀 Starting ultra-competitive T0 detection...');
    this.isRunning = true;
    
    // Premier poll immédiat
    await this.pollOnce();
    
    // Démarrer le polling périodique
    this.scheduleNextPoll();
    
    console.log(`✅ NoticePoller started with ${this.config.pollIntervalMs}ms interval`);
  }

  /**
   * Arrête le polling
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping NoticePoller...');
    this.isRunning = false;
    
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    
    console.log('✅ NoticePoller stopped');
  }

  /**
   * Exécute un seul cycle de polling
   */
  private async pollOnce(): Promise<void> {
    if (!this.isRunning) return;

    const startTime = Date.now();
    this.lastPollTime = startTime;
    this.totalPolls++;

    try {
      console.log(`📡 T0 Poll #${this.totalPolls} - Fetching latest notices...`);
      
      // Récupérer les dernières notices via l'API officielle
      const notices = await this.noticeClient.getLatestListings(this.config.maxNoticesPerPoll);
      this.totalNotices += notices.length;
      
      // Traiter chaque notice
      let newListings = 0;
      for (const notice of notices) {
        if (await this.processNotice(notice)) {
          newListings++;
        }
      }
      
      this.totalListings += newListings;
      
      // Réinitialiser les erreurs en cas de succès
      this.consecutiveErrors = 0;
      
      // Calculer le temps de réponse moyen
      const responseTime = Date.now() - startTime;
      this.averageResponseTime = (this.averageResponseTime * (this.totalPolls - 1) + responseTime) / this.totalPolls;
      
      console.log(`✅ T0 Poll #${this.totalPolls} completed: ${newListings} new listings in ${responseTime}ms`);
      
      // Notification Telegram si activée
      if (this.config.enableTelegram && newListings > 0) {
        await this.notifyNewListings(notices.slice(0, newListings));
      }
      
    } catch (error) {
      this.handlePollError(error);
    }
  }

  /**
   * Traite une notice individuelle
   */
  private async processNotice(notice: ProcessedNotice): Promise<boolean> {
    try {
      // Vérifier si c'est un nouveau token
      const isNew = await this.tokenRegistry.isNew(notice.base);
      if (!isNew) {
        if (this.config.enableLogging) {
          console.log(`⏭️ Token ${notice.base} already known, skipping`);
        }
        return false;
      }

      // Enregistrer le nouveau token
      await this.tokenRegistry.addProcessedEvent({
        eventId: notice.eventId,
        base: notice.base,
        url: notice.url,
        tradeTimeUtc: notice.publishedAtUtc,
        source: 'bithumb.notice'
      });

      console.log(`🎯 NEW LISTING DETECTED: ${notice.base} (${notice.priority} priority)`);
      
      // Log détaillé si activé
      if (this.config.enableLogging) {
        console.log(`📋 Details: ${notice.title}`);
        console.log(`🔗 URL: ${notice.url}`);
        console.log(`⏰ Published: ${notice.publishedAtUtc}`);
        console.log(`📊 Status: ${notice.status}`);
      }

      return true;
      
    } catch (error) {
      console.error(`❌ Error processing notice for ${notice.base}:`, error);
      return false;
    }
  }

  /**
   * Gère les erreurs de polling
   */
  private handlePollError(error: any): void {
    this.consecutiveErrors++;
    this.lastErrorTime = Date.now();
    
    console.error(`❌ T0 Poll #${this.totalPolls} failed:`, error);
    
    // Vérifier si on doit arrêter après trop d'erreurs
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      console.error(`🚨 Too many consecutive errors (${this.consecutiveErrors}), stopping poller`);
      this.stop();
      return;
    }
    
    // Log de l'erreur
    if (error.response) {
      console.error(`📡 HTTP ${error.response.status}: ${error.response.statusText}`);
    } else if (error.code) {
      console.error(`🔌 Network error: ${error.code}`);
    }
  }

  /**
   * Planifie le prochain poll
   */
  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(async () => {
      await this.pollOnce();
      this.scheduleNextPoll();
    }, this.config.pollIntervalMs);
  }

  /**
   * Envoie les notifications Telegram pour les nouveaux listings
   */
  private async notifyNewListings(listings: ProcessedNotice[]): Promise<void> {
    try {
      for (const listing of listings) {
        const message = this.formatTelegramMessage(listing);
        await this.telegramService.sendMessage(message);
        
        // Petit délai entre les messages pour éviter le spam
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('❌ Error sending Telegram notifications:', error);
    }
  }

  /**
   * Formate le message Telegram
   */
  private formatTelegramMessage(listing: ProcessedNotice): string {
    const priorityEmoji = {
      high: '🚨',
      medium: '⚠️',
      low: 'ℹ️'
    };
    
    const statusEmoji = {
      scheduled: '⏰',
      live: '🟢',
      completed: '✅'
    };

    return `${priorityEmoji[listing.priority]} **NEW LISTING DETECTED** ${statusEmoji[listing.status]}

**Token:** \`${listing.base}\`
**Priority:** ${listing.priority.toUpperCase()}
**Status:** ${listing.status.toUpperCase()}

**Title:** ${listing.title}
**Published:** ${new Date(listing.publishedAtUtc).toLocaleString()}
**Source:** ${listing.source}

🔗 [View Notice](${listing.url})

⚡ **ULTRA-COMPETITIVE T0 DETECTION** ⚡`;
  }

  /**
   * Retourne le statut du poller
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastPollTime: this.lastPollTime,
      totalPolls: this.totalPolls,
      totalNotices: this.totalNotices,
      totalListings: this.totalListings,
      consecutiveErrors: this.consecutiveErrors,
      averageResponseTime: this.averageResponseTime,
      lastErrorTime: this.lastErrorTime,
      config: this.config
    };
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(newConfig: Partial<NoticePollerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ NoticePoller config updated:', this.config);
  }
}
