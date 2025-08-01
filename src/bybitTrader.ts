import * as ccxt from 'ccxt';
import { BYBIT_CONFIG, TRADING_CONFIG } from './config';

interface TradeResult {
  success: boolean;
  orderId?: string;
  positionId?: string;
  error?: string;
  details?: any;
}

export class BybitTrader {
  private exchange: ccxt.bybit;
  private activePositions: Map<string, { orderId: string; closeTimer: NodeJS.Timeout }> = new Map();

  constructor() {
    const config: any = {
      apiKey: BYBIT_CONFIG.apiKey,
      secret: BYBIT_CONFIG.secret,
      enableRateLimit: true,
      options: {
        defaultType: 'swap', // Futures/Perp
      }
    };

    // Configuration spécifique pour le testnet
    if (BYBIT_CONFIG.sandbox) {
      config.urls = {
        api: {
          public: 'https://api-testnet.bybit.com',
          private: 'https://api-testnet.bybit.com',
        }
      };
      config.sandbox = true;
    }

    this.exchange = new ccxt.bybit(config);
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🔧 Initialisation du trader Bybit...');
      // Ne pas charger les marchés ici car cela nécessite une authentification
      // Les marchés seront chargés lors de la première utilisation
      console.log('✅ Trader Bybit initialisé');
      return true;
    } catch (error) {
      console.error('❌ Erreur initialisation Bybit:', error);
      return false;
    }
  }

  private async ensureMarketsLoaded(): Promise<void> {
    if (!this.exchange.markets || Object.keys(this.exchange.markets).length === 0) {
      await this.exchange.loadMarkets();
    }
  }

  async checkBalance(): Promise<{ available: number; total: number }> {
    try {
      const balance = await this.exchange.fetchBalance();
      const usdtBalance = balance.USDT || { free: 0, total: 0 };
      return {
        available: usdtBalance.free || 0,
        total: usdtBalance.total || 0
      };
    } catch (error) {
      console.error('❌ Erreur récupération balance:', error);
      return { available: 0, total: 0 };
    }
  }

  async openPosition(symbol: string): Promise<TradeResult> {
    try {
      console.log(`🚀 Ouverture position sur ${symbol}...`);

      // Vérifier la balance
      const balance = await this.checkBalance();
      console.log(`💰 Balance disponible: ${balance.available} USDT`);
      
      if (balance.available < TRADING_CONFIG.tradeAmountUsdt) {
        return {
          success: false,
          error: `Balance insuffisante: ${balance.available} USDT disponible, ${TRADING_CONFIG.tradeAmountUsdt} USDT requis`
        };
      }

      const symbolPair = `${symbol}USDT`;

      // Charger les marchés si nécessaire
      await this.ensureMarketsLoaded();

      // Vérifier que le symbole existe
      if (!this.exchange.markets[symbolPair]) {
        return {
          success: false,
          error: `Symbole ${symbolPair} non trouvé sur Bybit`
        };
      }

      // Ouvrir la position (long) avec le montant configuré
      const order = await this.exchange.createOrder(
        symbolPair,
        'market',
        'buy',
        TRADING_CONFIG.tradeAmountUsdt, // Montant en USDT
        undefined,
        {
          leverage: TRADING_CONFIG.leverage,
          timeInForce: 'IOC' // Immediate or Cancel
        }
      );

      console.log(`✅ Position ouverte: ${order.id}`);
      console.log(`💰 Montant: ${TRADING_CONFIG.tradeAmountUsdt} USDT (${TRADING_CONFIG.leverage}x)`);

      // Programmer la clôture automatique
      this.scheduleAutoClose(symbol, order.id);

      return {
        success: true,
        orderId: order.id,
        details: order
      };

    } catch (error) {
      console.error(`❌ Erreur ouverture position ${symbol}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  private scheduleAutoClose(symbol: string, orderId: string): void {
    const closeTimer = setTimeout(async () => {
      console.log(`⏰ Clôture automatique de la position ${symbol}...`);
      await this.closePosition(symbol, orderId);
    }, TRADING_CONFIG.autoCloseMinutes * 60 * 1000);

    this.activePositions.set(symbol, { orderId, closeTimer });
  }

  async closePosition(symbol: string, orderId?: string): Promise<TradeResult> {
    try {
      console.log(`🔒 Fermeture position ${symbol}...`);

      const symbolPair = `${symbol}USDT`;

      // Récupérer la taille de la position ouverte
      const positions = await this.exchange.fetchPositions([symbolPair]);
      const positionToClose = positions && positions.length > 0 ? positions[0] : null;
      const amountToClose =
        positionToClose && typeof positionToClose.contracts === 'number'
          ? positionToClose.contracts
          : positionToClose && positionToClose.info && typeof positionToClose.info.size === 'number'
          ? positionToClose.info.size
          : null;

      if (!amountToClose || amountToClose === 0) {
        return {
          success: false,
          error: 'Aucune position ouverte à fermer'
        };
      }

      // Fermer la position (sell)
      const closeOrder = await this.exchange.createOrder(
        symbolPair,
        'market',
        'sell',
        amountToClose,
        undefined,
        {
          reduceOnly: true
        }
      );

      // Nettoyer le timer
      if (this.activePositions.has(symbol)) {
        clearTimeout(this.activePositions.get(symbol)!.closeTimer);
        this.activePositions.delete(symbol);
      }

      console.log(`✅ Position fermée: ${closeOrder.id}`);
      return {
        success: true,
        orderId: closeOrder.id,
        details: closeOrder
      };

    } catch (error) {
      console.error(`❌ Erreur fermeture position ${symbol}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  async getActivePositions(): Promise<any[]> {
    try {
      const positions = await this.exchange.fetchPositions();
      return positions.filter((pos: any) => pos.size > 0);
    } catch (error) {
      console.error('❌ Erreur récupération positions:', error);
      return [];
    }
  }
} 