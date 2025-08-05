import { TelegramService } from './telegramService';
import { HyperliquidTrader } from './hyperliquidTrader';
import { RiskManager } from './riskManager';
import { PerformanceMonitor } from './performanceMonitor';
import axios from 'axios'; // Added for Upbit check

interface QueuedListing {
  symbol: string;
  metadata: any;
  detectionTime: number;
  lastCheckTime: number;
  checkCount: number;
  maxChecks: number;
  checkInterval: number; // en millisecondes
  source: 'announcement' | 'websocket' | 'api';
  announcementTime?: number; // heure de l'annonce si applicable
  maxWaitTime: number; // temps maximum d'attente en millisecondes
  firstListingTime?: number; // heure du premier listing sur un exchange
}

export class ListingQueue {
  private queue: Map<string, QueuedListing> = new Map();
  private telegramService: TelegramService;
  private hyperliquidTrader: HyperliquidTrader | null = null;
  private riskManager: RiskManager | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(
    telegramService: TelegramService,
    hyperliquidTrader?: HyperliquidTrader,
    riskManager?: RiskManager,
    performanceMonitor?: PerformanceMonitor
  ) {
    this.telegramService = telegramService;
    this.hyperliquidTrader = hyperliquidTrader || null;
    this.riskManager = riskManager || null;
    this.performanceMonitor = performanceMonitor || null;
  }

  public addListing(symbol: string, metadata: any, source: 'announcement' | 'websocket' | 'api' = 'api'): void {
    const now = Date.now();
    
    // Configuration selon la source
    let checkInterval = 30000; // 30 secondes par défaut
    let maxChecks = 20; // 20 vérifications par défaut
    let maxWaitTime = 30 * 60 * 1000; // 30 minutes par défaut
    
    if (source === 'announcement') {
      // Pour les annonces, vérifier plus fréquemment au début, puis espacer
      checkInterval = 60000; // 1 minute
      maxChecks = 60; // 1 heure de surveillance
      maxWaitTime = 4 * 60 * 60 * 1000; // 4 heures maximum (selon l'annonce)
    } else if (source === 'websocket') {
      // Pour les WebSockets, vérification immédiate puis espacée
      checkInterval = 45000; // 45 secondes
      maxChecks = 40; // 30 minutes de surveillance
      maxWaitTime = 2 * 60 * 60 * 1000; // 2 heures maximum
    }

    const queuedListing: QueuedListing = {
      symbol,
      metadata,
      detectionTime: now,
      lastCheckTime: 0,
      checkCount: 0,
      maxChecks,
      checkInterval,
      source,
      announcementTime: source === 'announcement' ? now : undefined,
      maxWaitTime,
      firstListingTime: source === 'websocket' ? now : undefined // Si WebSocket, c'est déjà listé
    };

    this.queue.set(symbol, queuedListing);
    console.log(`📋 Ajouté à la file d'attente: ${symbol} (source: ${source}, max attente: ${Math.floor(maxWaitTime/60000)}min)`);
    
    // Démarrer la surveillance si pas encore active
    if (!this.isRunning) {
      this.startMonitoring();
    }
  }

  public startMonitoring(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔄 Démarrage surveillance file d\'attente...');
    
    this.checkInterval = setInterval(() => {
      this.processQueue();
    }, 10000); // Vérifier toutes les 10 secondes
  }

  public stopMonitoring(): void {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('🛑 Arrêt surveillance file d\'attente');
  }

  private async processQueue(): Promise<void> {
    const now = Date.now();
    
    for (const [symbol, listing] of this.queue.entries()) {
      // Vérifier si c'est le moment de retenter
      if (now - listing.lastCheckTime >= listing.checkInterval) {
        listing.lastCheckTime = now;
        listing.checkCount++;
        
        console.log(`🔍 Vérification ${listing.checkCount}/${listing.maxChecks}: ${symbol}`);
        
        // Vérifier si on a dépassé le temps maximum d'attente
        const timeSinceDetection = now - listing.detectionTime;
        if (timeSinceDetection > listing.maxWaitTime) {
          console.log(`⏰ ${symbol} retiré de la file (temps d'attente dépassé: ${Math.floor(timeSinceDetection/60000)}min)`);
          await this.telegramService.sendBotStatus(
            "Listing abandonné", 
            `${symbol} non disponible dans les délais (${Math.floor(listing.maxWaitTime/60000)}min max)`
          );
          this.queue.delete(symbol);
          continue;
        }
        
        // Vérifier si le token existe sur Hyperliquid
        const hasPerp = await this.checkHyperliquidListing(symbol);
        
        if (hasPerp) {
          // Vérifier si c'est encore dans les délais pour le frontrunning
          const timeSinceFirstListing = listing.firstListingTime ? now - listing.firstListingTime : timeSinceDetection;
          const maxFrontrunTime = 30 * 60 * 1000; // 30 minutes maximum pour le frontrunning
          
          if (timeSinceFirstListing > maxFrontrunTime) {
            console.log(`⏰ ${symbol} trop tard pour le frontrunning (${Math.floor(timeSinceFirstListing/60000)}min après premier listing)`);
            await this.telegramService.sendBotStatus(
              "Frontrunning abandonné", 
              `${symbol} disponible mais trop tard (${Math.floor(timeSinceFirstListing/60000)}min après premier listing)`
            );
            this.queue.delete(symbol);
            continue;
          }
          
          // Vérifier si le token est déjà listé sur d'autres exchanges
          const otherExchangeCheck = await this.checkOtherExchanges(symbol);
          if (otherExchangeCheck.listed) {
            console.log(`⚠️ ${symbol} déjà listé sur ${otherExchangeCheck.exchange} - risque de retard`);
            const timeSinceOtherListing = otherExchangeCheck.time ? now - otherExchangeCheck.time : 0;
            
            if (timeSinceOtherListing > 15 * 60 * 1000) { // 15 minutes après listing sur autre exchange
              console.log(`⏰ ${symbol} abandonné - déjà listé sur ${otherExchangeCheck.exchange} depuis ${Math.floor(timeSinceOtherListing/60000)}min`);
              await this.telegramService.sendBotStatus(
                "Frontrunning abandonné", 
                `${symbol} déjà listé sur ${otherExchangeCheck.exchange} depuis ${Math.floor(timeSinceOtherListing/60000)}min`
              );
              this.queue.delete(symbol);
              continue;
            }
          }
          
          console.log(`✅ ${symbol} maintenant disponible sur Hyperliquid ! (${Math.floor(timeSinceDetection/60000)}min après détection)`);
          await this.executeTrade(symbol, listing);
          this.queue.delete(symbol); // Retirer de la file
        } else {
          // Vérifier si on a dépassé le nombre max de tentatives
          if (listing.checkCount >= listing.maxChecks) {
            console.log(`⏰ ${symbol} retiré de la file (max tentatives atteint)`);
            await this.telegramService.sendBotStatus(
              "Listing abandonné", 
              `${symbol} non disponible après ${listing.maxChecks} vérifications`
            );
            this.queue.delete(symbol);
          } else {
            // Continuer la surveillance
            const remainingChecks = listing.maxChecks - listing.checkCount;
            const remainingTime = Math.floor((remainingChecks * listing.checkInterval) / 60000);
            console.log(`⏳ ${symbol}: ${remainingChecks} vérifications restantes (~${remainingTime}min)`);
          }
        }
      }
    }
  }

  private async checkOtherExchanges(symbol: string): Promise<{ listed: boolean; exchange?: string; time?: number }> {
    try {
      // Vérifier Upbit
      const upbitResponse = await axios.get(`https://api.upbit.com/v1/ticker?markets=KRW-${symbol}`, {
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (upbitResponse.data && upbitResponse.data[0]) {
        return { listed: true, exchange: 'Upbit', time: Date.now() };
      }
    } catch (error) {
      // Upbit non disponible, continuer
    }
    
    try {
      // Vérifier Bybit (si configuré)
      // TODO: Implémenter vérification Bybit
    } catch (error) {
      // Bybit non disponible, continuer
    }
    
    return { listed: false };
  }

  private async checkHyperliquidListing(symbol: string): Promise<boolean> {
    if (!this.hyperliquidTrader) {
      console.warn('⚠️ HyperliquidTrader non disponible');
      return false;
    }

    try {
      const hasPerp = await this.hyperliquidTrader.hasPerp(symbol);
      return hasPerp === true;
    } catch (error) {
      console.error(`❌ Erreur vérification Hyperliquid ${symbol}:`, error);
      return false;
    }
  }

  private async executeTrade(symbol: string, listing: QueuedListing): Promise<void> {
    const detectionDelay = Date.now() - listing.detectionTime;
    
    console.log(`🚀 Exécution trade pour ${symbol} (délai: ${Math.floor(detectionDelay/1000)}s)`);
    
    // Notification de disponibilité
    await this.telegramService.sendBotStatus(
      "Token disponible", 
      `${symbol} maintenant disponible sur Hyperliquid après ${Math.floor(detectionDelay/60000)}min`
    );

    // Vérification des risques
    if (this.riskManager) {
      const riskCheck = await this.riskManager.canTrade(symbol, 400);
      
      if (!riskCheck.allowed) {
        console.log(`🛡️ Trade bloqué: ${riskCheck.reason}`);
        await this.telegramService.sendBotStatus("Trade bloqué", `${symbol}: ${riskCheck.reason}`);
        return;
      }
    }

    // Exécution du trade
    try {
      const { executeTrade } = await import('./trader');
      await executeTrade(symbol, 'Hyperliquid');
      
      // Enregistrer le succès
      if (this.performanceMonitor) {
        this.performanceMonitor.recordTrade(
          symbol,
          'Hyperliquid',
          detectionDelay,
          0, // trade time
          true
        );
      }
      
      if (this.riskManager) {
        await this.riskManager.recordTrade(symbol, 400);
      }
      
      console.log(`✅ Trade exécuté avec succès: ${symbol}`);
      
    } catch (error) {
      console.error(`❌ Erreur trade ${symbol}:`, error);
      
      if (this.performanceMonitor) {
        this.performanceMonitor.recordTrade(
          symbol,
          'Hyperliquid',
          detectionDelay,
          0,
          false,
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  public getQueueStatus(): { total: number; announcements: number; websockets: number; apis: number } {
    const announcements = Array.from(this.queue.values()).filter(l => l.source === 'announcement').length;
    const websockets = Array.from(this.queue.values()).filter(l => l.source === 'websocket').length;
    const apis = Array.from(this.queue.values()).filter(l => l.source === 'api').length;
    
    return {
      total: this.queue.size,
      announcements,
      websockets,
      apis
    };
  }

  public clearQueue(): void {
    this.queue.clear();
    console.log('🗑️ File d\'attente vidée');
  }
} 