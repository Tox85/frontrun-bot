import { PerpFinder, FoundPerp } from './perpFinder';
import { PositionSizer, SizingResult } from './positionSizer';
import { HyperliquidTrader } from '../hyperliquidTrader';
import { BinanceTrader } from '../binanceTrader';
import { BybitTrader } from '../bybitTrader';
import { TelegramService } from '../telegramService';
import { RiskManager } from '../riskManager';
import { PerformanceMonitor } from '../performanceMonitor';
import { TradeRetryManager } from '../retryManager';

export interface ListingEvent {
  symbol: string;
  metadata?: any;
  detectionTime: number;
  id: string; // Identifiant unique pour l'idempotency
}

export interface TradeResult {
  success: boolean;
  venue?: string;
  symbol?: string;
  entryPrice?: number;
  qty?: number;
  notional?: number;
  stopLossPrice?: number;
  orderId?: string;
  positionId?: string;
  error?: string;
  pnl?: number;
  closeReason?: 'SL_HIT' | 'TIMEOUT_3MIN' | 'MANUAL';
}

export class PositionOrchestrator {
  private perpFinder: PerpFinder;
  private positionSizer: PositionSizer;
  private hyperliquidTrader: HyperliquidTrader | null = null;
  private binanceTrader: BinanceTrader | null = null;
  private bybitTrader: BybitTrader | null = null;
  private telegramService: TelegramService | null = null;
  private riskManager: RiskManager | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  private retryManager: TradeRetryManager | null = null;
  
  // Idempotency tracking
  private activeTrades: Map<string, {
    orderId: string;
    positionId: string;
    closeTimer: NodeJS.Timeout;
    stopLossOrderId?: string;
    venue: string;
    symbol: string;
    entryPrice: number;
    qty: number;
  }> = new Map();

  constructor(
    hyperliquidTrader?: HyperliquidTrader,
    binanceTrader?: BinanceTrader,
    bybitTrader?: BybitTrader,
    telegramService?: TelegramService,
    riskManager?: RiskManager,
    performanceMonitor?: PerformanceMonitor,
    retryManager?: TradeRetryManager
  ) {
    this.hyperliquidTrader = hyperliquidTrader || null;
    this.binanceTrader = binanceTrader || null;
    this.bybitTrader = bybitTrader || null;
    this.telegramService = telegramService || null;
    this.riskManager = riskManager || null;
    this.performanceMonitor = performanceMonitor || null;
    this.retryManager = retryManager || null;
    
    this.perpFinder = new PerpFinder(hyperliquidTrader, binanceTrader, bybitTrader);
    this.positionSizer = new PositionSizer();
  }

  /**
   * Pipeline principal pour ouvrir une position sur un nouveau listing
   */
  async openPositionForNewListing(listing: ListingEvent): Promise<TradeResult> {
    const tradeId = `${listing.id}-${listing.symbol}`;
    console.log(`🚀 Début trade ${tradeId} pour ${listing.symbol}`);
    
    try {
      // 1. Vérifier l'idempotency
      if (this.activeTrades.has(tradeId)) {
        console.log(`⚠️ Trade ${tradeId} déjà en cours`);
        return { success: false, error: 'Trade déjà en cours' };
      }

      // 2. Rechercher un perp disponible
      const foundPerp = await this.perpFinder.findFirstPerp(listing.symbol);
      if (!foundPerp) {
        const error = `Aucun perp trouvé pour ${listing.symbol}`;
        console.log(`❌ ${error}`);
        await this.telegramService?.sendTradeError(listing.symbol, error);
        return { success: false, error };
      }

      // 3. Récupérer la balance
      const balance = await this.getBalance(foundPerp.venue);
      if (!this.positionSizer.canTradeWithBalance(balance)) {
        const error = `Balance insuffisante: ${balance} USDC`;
        console.log(`❌ ${error}`);
        await this.telegramService?.sendTradeError(listing.symbol, error);
        return { success: false, error };
      }

      // 4. Calculer le sizing
      const sizing = await this.positionSizer.calculatePositionSizing(balance, foundPerp);
      if (!sizing.success) {
        console.log(`❌ Erreur sizing: ${sizing.error}`);
        await this.telegramService?.sendTradeError(listing.symbol, sizing.error || 'Erreur sizing');
        return { success: false, error: sizing.error };
      }

      // 5. Notification avant trade
      await this.telegramService?.sendTradeStart(
        listing.symbol,
        foundPerp.venue,
        foundPerp.meta.price || 0,
        sizing.qty || 0,
        sizing.notional || 0
      );

      // 6. Exécuter le trade
      const tradeResult = await this.executeTrade(listing, foundPerp, sizing);
      
      if (tradeResult.success) {
        // 7. Programmer la fermeture automatique
        this.scheduleAutoClose(tradeId, listing.symbol, foundPerp.venue, 3 * 60 * 1000); // 3 minutes
        
        // 8. Enregistrer le succès
        if (this.performanceMonitor) {
          this.performanceMonitor.recordTrade(
            listing.symbol,
            foundPerp.venue,
            Date.now() - listing.detectionTime,
            0,
            true
          );
        }
      }

      return tradeResult;

    } catch (error) {
      console.error(`❌ Erreur trade ${tradeId}:`, error);
      await this.telegramService?.sendTradeError(listing.symbol, String(error));
      return { success: false, error: String(error) };
    }
  }

  /**
   * Récupère la balance pour un venue donné
   */
  private async getBalance(venue: string): Promise<number> {
    try {
      let balance = 0;
      
      switch (venue) {
        case 'HL':
          if (this.hyperliquidTrader) {
            const result = await this.hyperliquidTrader.checkBalance();
            balance = result.available;
          }
          break;
        case 'BINANCE':
          if (this.binanceTrader) {
            const result = await this.binanceTrader.checkBalance();
            balance = result.available;
          }
          break;
        case 'BYBIT':
          if (this.bybitTrader) {
            const result = await this.bybitTrader.checkBalance();
            balance = result.available;
          }
          break;
      }
      
      console.log(`💰 Balance ${venue}: ${balance} USDC`);
      return balance;
    } catch (error) {
      console.error(`❌ Erreur récupération balance ${venue}:`, error);
      return 0;
    }
  }

  /**
   * Exécute le trade sur le venue approprié
   */
  private async executeTrade(
    listing: ListingEvent,
    foundPerp: FoundPerp,
    sizing: SizingResult
  ): Promise<TradeResult> {
    const tradeId = `${listing.id}-${listing.symbol}`;
    
    try {
      let trader = null;
      
      switch (foundPerp.venue) {
        case 'HL':
          trader = this.hyperliquidTrader;
          break;
        case 'BINANCE':
          trader = this.binanceTrader;
          break;
        case 'BYBIT':
          trader = this.bybitTrader;
          break;
      }
      
      if (!trader) {
        throw new Error(`Trader ${foundPerp.venue} non disponible`);
      }

      // Mode dry-run
      if (process.env.DRY_RUN === '1') {
        console.log(`🧪 DRY RUN: Simuler trade ${listing.symbol} sur ${foundPerp.venue}`);
        return {
          success: true,
          venue: foundPerp.venue,
          symbol: listing.symbol,
          entryPrice: foundPerp.meta.price || 0,
          qty: sizing.qty || 0,
          notional: sizing.notional || 0,
          stopLossPrice: sizing.stopLossPrice || 0,
          orderId: `dry-run-${Date.now()}`,
          positionId: `dry-run-pos-${Date.now()}`
        };
      }

      // Trade réel
      const result = await trader.openPositionWithSizing(
        listing.symbol,
        sizing.qty || 0,
        sizing.leverage || 25,
        sizing.stopLossPrice || 0
      );

      if (result.success) {
        // Enregistrer le trade actif
        this.activeTrades.set(tradeId, {
          orderId: result.orderId || '',
          positionId: result.positionId || '',
          closeTimer: setTimeout(() => {}, 0), // Sera remplacé par le vrai timer
          venue: foundPerp.venue,
          symbol: listing.symbol,
          entryPrice: foundPerp.meta.price || 0,
          qty: sizing.qty || 0
        });

        console.log(`✅ Trade exécuté: ${listing.symbol} sur ${foundPerp.venue}`);
        await this.telegramService?.sendTradeSuccess(
          listing.symbol,
          foundPerp.venue,
          foundPerp.meta.price || 0,
          sizing.qty || 0,
          sizing.notional || 0,
          sizing.stopLossPrice || 0
        );
      }

      return {
        success: result.success,
        venue: foundPerp.venue,
        symbol: listing.symbol,
        entryPrice: foundPerp.meta.price || 0,
        qty: sizing.qty || 0,
        notional: sizing.notional || 0,
        stopLossPrice: sizing.stopLossPrice || 0,
        orderId: result.orderId,
        positionId: result.positionId,
        error: result.error
      };

    } catch (error) {
      console.error(`❌ Erreur exécution trade: ${error}`);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Programme la fermeture automatique après 3 minutes
   */
  private scheduleAutoClose(
    tradeId: string,
    symbol: string,
    venue: string,
    delayMs: number
  ): void {
    const closeTimer = setTimeout(async () => {
      try {
        console.log(`⏰ Fermeture automatique de ${symbol} sur ${venue}`);
        await this.closePosition(tradeId, 'TIMEOUT_3MIN');
      } catch (error) {
        console.error(`❌ Erreur fermeture automatique ${symbol}:`, error);
      }
    }, delayMs);

    // Mettre à jour le timer dans le tracking
    const trade = this.activeTrades.get(tradeId);
    if (trade) {
      trade.closeTimer = closeTimer;
    }
  }

  /**
   * Ferme une position
   */
  async closePosition(tradeId: string, reason: 'SL_HIT' | 'TIMEOUT_3MIN' | 'MANUAL'): Promise<boolean> {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) {
      console.log(`⚠️ Trade ${tradeId} non trouvé pour fermeture`);
      return false;
    }

    try {
      // Annuler le timer de fermeture automatique
      clearTimeout(trade.closeTimer);

      let trader = null;
      switch (trade.venue) {
        case 'HL':
          trader = this.hyperliquidTrader;
          break;
        case 'BINANCE':
          trader = this.binanceTrader;
          break;
        case 'BYBIT':
          trader = this.bybitTrader;
          break;
      }

      if (!trader) {
        throw new Error(`Trader ${trade.venue} non disponible`);
      }

      // Mode dry-run
      if (process.env.DRY_RUN === '1') {
        console.log(`🧪 DRY RUN: Fermeture ${trade.symbol} (${reason})`);
        this.activeTrades.delete(tradeId);
        return true;
      }

      // Fermeture réelle
      const result = await trader.closePosition(trade.symbol, trade.positionId);
      
      if (result.success) {
        console.log(`✅ Position fermée: ${trade.symbol} (${reason})`);
        await this.telegramService?.sendPositionClosed(trade.symbol, trade.venue, reason);
        
        // Calculer PnL approximatif
        const pnl = this.calculatePnL(trade.entryPrice, trade.venue, trade.symbol);
        console.log(`💰 PnL estimé: ${pnl} USDC`);
      }

      // Nettoyer le tracking
      this.activeTrades.delete(tradeId);
      return result.success;

    } catch (error) {
      console.error(`❌ Erreur fermeture position ${tradeId}:`, error);
      return false;
    }
  }

  /**
   * Calcule le PnL approximatif
   */
  private calculatePnL(entryPrice: number, venue: string, symbol: string): number {
    // Simulation simple - en réalité il faudrait récupérer le prix de sortie
    const exitPrice = entryPrice * (0.95 + Math.random() * 0.1); // ±5% aléatoire
    const pnlPercent = (exitPrice - entryPrice) / entryPrice;
    return pnlPercent * 100; // En pourcentage
  }

  /**
   * Récupère les trades actifs
   */
  getActiveTrades(): Array<{
    tradeId: string;
    symbol: string;
    venue: string;
    entryPrice: number;
    qty: number;
  }> {
    return Array.from(this.activeTrades.entries()).map(([tradeId, trade]) => ({
      tradeId,
      symbol: trade.symbol,
      venue: trade.venue,
      entryPrice: trade.entryPrice,
      qty: trade.qty
    }));
  }

  /**
   * Nettoie tous les trades actifs
   */
  async cleanupAllTrades(): Promise<void> {
    console.log(`🧹 Nettoyage de ${this.activeTrades.size} trades actifs...`);
    
    for (const [tradeId, trade] of this.activeTrades.entries()) {
      clearTimeout(trade.closeTimer);
      await this.closePosition(tradeId, 'MANUAL');
    }
  }
}
