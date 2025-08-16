import { HyperliquidAdapter } from '../exchanges/HyperliquidAdapter';
import { ExitScheduler } from './ExitScheduler';
import { PositionSizer } from './PositionSizer';
import { BaselineManager } from '../core/BaselineManager';
import { PerpCatalog } from '../store/PerpCatalog';
import { TelegramService } from '../notify/TelegramService';

export interface TradeConfig {
  riskPct: number;           // Pourcentage du solde à risquer (ex: 0.10 = 10%)
  leverageTarget: number;     // Levier cible (ex: 5)
  cooldownHours: number;     // Cooldown entre trades sur le même token
  dryRun: boolean;           // Mode simulation
}

export interface TradeResult {
  success: boolean;
  token: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
  leverage: number;
  positionId?: string;
  error?: string;
  timestamp: string;
}

export interface TradeOpportunity {
  token: string;
  source: 'T0_NOTICE' | 'T2_WEBSOCKET';
  timestamp: string;
  price?: number;
  volume?: number;
}

export class TradeExecutor {
  private hyperliquid: HyperliquidAdapter;
  private exitScheduler: ExitScheduler;
  private positionSizer: PositionSizer;
  private baselineManager: BaselineManager;
  private perpCatalog: PerpCatalog;
  private telegramService: TelegramService;
  private config: TradeConfig;
  
  private activeTrades = new Map<string, TradeResult>();
  private cooldowns = new Map<string, number>();

  constructor(
    hyperliquid: HyperliquidAdapter,
    exitScheduler: ExitScheduler,
    positionSizer: PositionSizer,
    baselineManager: BaselineManager,
    perpCatalog: PerpCatalog,
    telegramService: TelegramService,
    config: TradeConfig
  ) {
    this.hyperliquid = hyperliquid;
    this.exitScheduler = exitScheduler;
    this.positionSizer = positionSizer;
    this.baselineManager = baselineManager;
    this.perpCatalog = perpCatalog;
    this.telegramService = telegramService;
    this.config = config;
  }

  /**
   * Exécute un trade d'opportunité (T0 ou T2)
   */
  async executeOpportunity(opportunity: TradeOpportunity): Promise<TradeResult | null> {
    try {
      console.log(`🎯 Exécution de l'opportunité: ${opportunity.token} (${opportunity.source})`);

      // 1. Vérifier le cooldown
      if (this.isInCooldown(opportunity.token)) {
        console.log(`⏰ ${opportunity.token} en cooldown, trade ignoré`);
        return null;
      }

      // 2. Vérifier que le token n'est pas déjà dans la baseline
      const isNew = await this.baselineManager.isTokenNew(opportunity.token);
      if (!isNew) {
        console.log(`📚 ${opportunity.token} déjà dans la baseline, trade ignoré`);
        return null;
      }

      // 3. Vérifier la disponibilité sur Hyperliquid
      const isAvailable = await this.hyperliquid.isSymbolTradable(opportunity.token);
      if (!isAvailable) {
        console.log(`❌ ${opportunity.token} non disponible sur Hyperliquid`);
        return null;
      }

      // 4. Obtenir le prix actuel
      const currentPrice = await this.hyperliquid.getCurrentPrice(opportunity.token);
      if (!currentPrice) {
        console.log(`❌ Impossible d'obtenir le prix pour ${opportunity.token}`);
        return null;
      }

             // 5. Calculer la taille de position
       const balance = await this.hyperliquid.getBalance();
               const positionSize = this.positionSizer.calculatePositionSize(
          balance.usd,
          'HYPERLIQUID',
          opportunity.token,
          currentPrice,
          this.config.riskPct
        );

             if (positionSize.notional <= 0) {
         console.log(`❌ Taille de position invalide pour ${opportunity.token}`);
         return null;
       }

      // 6. Exécuter le trade
             const tradeResult = await this.executeLongPosition(
         opportunity.token,
         positionSize.notional,
         currentPrice,
         positionSize.leverage
       );

      if (tradeResult.success) {
        // 7. Programmer la sortie
        await this.scheduleExit(opportunity.token, tradeResult.positionId!, positionSize);
        
        // 8. Ajouter au cooldown
        this.setCooldown(opportunity.token);
        
        // 9. Notifier Telegram
        await this.notifyTradeSuccess(tradeResult, opportunity);
      }

      return tradeResult;

    } catch (error) {
      console.error(`❌ Erreur lors de l'exécution de l'opportunité ${opportunity.token}:`, error);
      
      const errorResult: TradeResult = {
        success: false,
        token: opportunity.token,
        action: 'BUY',
        amount: 0,
        price: 0,
        leverage: 0,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString()
      };

      await this.notifyTradeError(errorResult, opportunity);
      return errorResult;
    }
  }

  /**
   * Exécute une position longue sur Hyperliquid
   */
  private async executeLongPosition(
    token: string,
    amount: number,
    price: number,
    leverage: number
  ): Promise<TradeResult> {
    try {
      if (this.config.dryRun) {
        console.log(`🧪 DRY_RUN: Position longue simulée pour ${token}`);
        
        const mockResult: TradeResult = {
          success: true,
          token,
          action: 'BUY',
          amount,
          price,
          leverage,
          positionId: `mock_${Date.now()}`,
          timestamp: new Date().toISOString()
        };

        return mockResult;
      }

      console.log(`💰 Exécution position longue: ${token} - ${amount} @ ${price} (levier: ${leverage})`);

      // Exécuter le trade sur Hyperliquid
      const order = await this.hyperliquid.openLongPosition(token, amount, leverage);
      
      const result: TradeResult = {
        success: true,
        token,
        action: 'BUY',
        amount,
        price,
        leverage,
        positionId: order.positionId,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Position ouverte avec succès: ${order.positionId}`);
      return result;

    } catch (error) {
      console.error(`❌ Erreur lors de l'ouverture de la position ${token}:`, error);
      throw error;
    }
  }

  /**
   * Programme la sortie de position
   */
    private async scheduleExit(token: string, positionId: string, positionSize: any): Promise<void> {
    try {
      // Stratégie de sortie: 50% après 1h, 50% après 4h
      const exit1h = new Date(Date.now() + 60 * 60 * 1000); // +1h
      const exit4h = new Date(Date.now() + 4 * 60 * 60 * 1000); // +4h

      await this.exitScheduler.scheduleExit(
        'HYPERLIQUID',
        token,
        positionSize.notional * 0.5, // 50% de la position
        60 * 60 * 1000, // 1h
        { originalOrderId: positionId, reason: 'PARTIAL_EXIT_1H' }
      );

      await this.exitScheduler.scheduleExit(
        'HYPERLIQUID',
        token,
        positionSize.notional, // 100% de la position
        4 * 60 * 60 * 1000, // 4h
        { originalOrderId: positionId, reason: 'FULL_EXIT_4H' }
      );

      console.log(`⏰ Sorties programmées pour ${token}: 50% à ${exit1h.toISOString()}, 100% à ${exit4h.toISOString()}`);

    } catch (error) {
      console.error(`❌ Erreur lors de la programmation des sorties pour ${token}:`, error);
    }
  }

  /**
   * Vérifie si un token est en cooldown
   */
  private isInCooldown(token: string): boolean {
    const cooldownUntil = this.cooldowns.get(token);
    if (!cooldownUntil) return false;
    
    return Date.now() < cooldownUntil;
  }

  /**
   * Définit le cooldown pour un token
   */
  private setCooldown(token: string): void {
    const cooldownMs = this.config.cooldownHours * 60 * 60 * 1000;
    this.cooldowns.set(token, Date.now() + cooldownMs);
    
    console.log(`⏰ Cooldown défini pour ${token}: ${this.config.cooldownHours}h`);
  }

  /**
   * Notifie le succès d'un trade
   */
  private async notifyTradeSuccess(trade: TradeResult, opportunity: TradeOpportunity): Promise<void> {
    try {
      if (this.telegramService) {
                 await this.telegramService.sendTradeExecuted(
           trade.token,
           'HYPERLIQUID',
           'long',
           trade.amount,
           trade.price
         );
      }
    } catch (error) {
      console.error('❌ Erreur lors de la notification de succès:', error);
    }
  }

  /**
   * Notifie l'erreur d'un trade
   */
  private async notifyTradeError(trade: TradeResult, opportunity: TradeOpportunity): Promise<void> {
    try {
      if (this.telegramService) {
        await this.telegramService.sendTradeError(trade.token, trade.error!);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la notification d\'erreur:', error);
    }
  }

  /**
   * Obtient le statut des trades actifs
   */
  getActiveTrades(): Map<string, TradeResult> {
    return new Map(this.activeTrades);
  }

  /**
   * Obtient le statut des cooldowns
   */
  getCooldownStatus(): { token: string; cooldownUntil: string; remainingMs: number }[] {
    const now = Date.now();
    return Array.from(this.cooldowns.entries()).map(([token, cooldownUntil]) => ({
      token,
      cooldownUntil: new Date(cooldownUntil).toISOString(),
      remainingMs: Math.max(0, cooldownUntil - now)
    }));
  }

  /**
   * Arrête l'exécuteur de trades
   */
  async stop(): Promise<void> {
    console.log('🛑 Arrêt du TradeExecutor...');
    
    // Sauvegarder les cooldowns
    // TODO: Persister les cooldowns en base
    
    console.log('✅ TradeExecutor arrêté');
  }
}
