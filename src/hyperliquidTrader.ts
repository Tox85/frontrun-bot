import * as ccxt from 'ccxt';
import { HYPERLIQUID_CONFIG } from './hyperliquidConfig';

interface TradeResult {
  success: boolean;
  orderId?: string;
  positionId?: string;
  error?: string;
  details?: any;
}

export class HyperliquidTrader {
  private exchange: ccxt.hyperliquid;
  private isInitialized: boolean = false;
  private activePositions: Map<string, { orderId: string; closeTimer: NodeJS.Timeout }> = new Map();

  constructor() {
    console.log('🔧 Initialisation du trader Hyperliquid...');
    
    const config: any = {
      enableRateLimit: true,
      options: {
        defaultType: 'swap', // Futures/Perp
      }
    };

    // Configuration testnet si nécessaire
    if (HYPERLIQUID_CONFIG.isTestnet) {
      config.urls = {
        api: {
          public: HYPERLIQUID_CONFIG.apiUrl,
          private: HYPERLIQUID_CONFIG.apiUrl,
        }
      };
    }

    // Configuration d'authentification si disponible
    if (HYPERLIQUID_CONFIG.walletAddress && HYPERLIQUID_CONFIG.privateKey) {
      config.walletAddress = HYPERLIQUID_CONFIG.walletAddress;
      config.privateKey = HYPERLIQUID_CONFIG.privateKey;
      console.log(`🔐 Authentification configurée pour wallet: ${HYPERLIQUID_CONFIG.walletAddress.substring(0, 8)}...`);
    } else {
      console.log('⚠️ Mode simulation - pas d\'authentification configurée');
    }

    this.exchange = new ccxt.hyperliquid(config);
  }

  async initialize(): Promise<boolean> {
    try {
      // Validation de la configuration
      if (!HYPERLIQUID_CONFIG.enabled) {
        console.log('⚠️ Hyperliquid désactivé dans la configuration');
        return false;
      }

      // Charger les marchés
      await this.exchange.loadMarkets();
      console.log(`✅ ${Object.keys(this.exchange.markets).length} marchés Hyperliquid chargés`);

      console.log('✅ Trader Hyperliquid initialisé');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Erreur initialisation Hyperliquid:', error);
      return false;
    }
  }

  async checkBalance(): Promise<{ available: number; total: number }> {
    try {
      console.log('💰 Vérification balance Hyperliquid...');
      
      // Vérifier si l'authentification est configurée
      if (!HYPERLIQUID_CONFIG.walletAddress || !HYPERLIQUID_CONFIG.privateKey) {
        console.log('⚠️ Balance simulée (authentification requise pour balance réelle)');
        return {
          available: 1000, // USDC simulé
          total: 1000
        };
      }
      
      // Balance réelle avec authentification
      console.log('🔐 Récupération balance réelle...');
      const balance = await this.exchange.fetchBalance();
      const usdcBalance = balance.USDC || { free: 0, total: 0 };
      
      console.log(`💰 Balance USDC disponible: ${usdcBalance.free || 0}`);
      console.log(`💰 Balance USDC totale: ${usdcBalance.total || 0}`);
      
      return {
        available: usdcBalance.free || 0,
        total: usdcBalance.total || 0
      };
      
    } catch (error) {
      console.error('❌ Erreur récupération balance Hyperliquid:', error);
      
      // En cas d'erreur, retourner une balance simulée
      console.log('⚠️ Fallback vers balance simulée');
      return { available: 1000, total: 1000 };
    }
  }

  async openPosition(symbol: string): Promise<TradeResult> {
    try {
      console.log(`🚀 Ouverture position Hyperliquid sur ${symbol}...`);

      // Vérifier la balance
      const balance = await this.checkBalance();
      console.log(`💰 Balance disponible: ${balance.available} USDC`);
      
      // Chercher le bon format de symbole sur Hyperliquid
      const markets = Object.keys(this.exchange.markets);
      const symbolUpper = symbol.toUpperCase();
      const matchingMarket = markets.find(market => 
        market.toUpperCase().includes(symbolUpper) && 
        (market.includes('/USDC:USDC') || market.includes('/USDC'))
      );
      
      if (!matchingMarket) {
        return {
          success: false,
          error: `Symbole ${symbol} non trouvé sur Hyperliquid`
        };
      }
      
      console.log(`📊 Marché trouvé: ${matchingMarket}`);

      // Récupérer les informations du marché
      const market = this.exchange.markets[matchingMarket];
      console.log(`📊 Marché trouvé: ${market.symbol}, Type: ${market.type}`);

      // Vérifier si l'authentification est configurée pour le trading réel
      if (!HYPERLIQUID_CONFIG.walletAddress || !HYPERLIQUID_CONFIG.privateKey) {
        console.log('⚠️ Mode simulation - ordre simulé');
        
        // Ordre simulé
        const orderId = `hl_sim_${Date.now()}_${symbol}`;
        
        console.log(`✅ Position Hyperliquid simulée: ${orderId}`);
        console.log(`📊 Détails: ${matchingMarket}, Montant: 400 USDC, Levier: 20x`);
        
        // Programmer la fermeture automatique simulée
        this.scheduleAutoClose(symbol, orderId);
        
        return {
          success: true,
          orderId: orderId,
          details: {
            symbol: matchingMarket,
            amount: 400, // USDC
            leverage: 20,
            marketType: market.type,
            mode: 'simulation'
          }
        };
      }

      // Trading réel avec authentification
      console.log('🔐 Exécution ordre réel...');
      
      try {
        // Récupérer le prix actuel pour le slippage
        const ticker = await this.exchange.fetchTicker(matchingMarket);
        const currentPrice = ticker.last || ticker.close || 0;
        
        if (!currentPrice || currentPrice <= 0) {
          return {
            success: false,
            error: `Impossible de récupérer le prix actuel pour ${matchingMarket}`
          };
        }
        
        console.log(`📊 Prix actuel: ${currentPrice}`);
        
        // Créer l'ordre réel avec prix et options de slippage
        const order = await this.exchange.createOrder(
          matchingMarket,
          'market',
          'buy',
          400, // Montant en USDC
          currentPrice, // Prix pour calculer le slippage
          {
            leverage: 20,
            reduceOnly: false,
            slippage: 5 // 5% de slippage maximum
          }
        );
        
        console.log(`✅ Position Hyperliquid réelle ouverte: ${order.id}`);
        console.log(`📊 Détails: ${matchingMarket}, Montant: 400 USDC, Levier: 20x`);
        
        // Programmer la fermeture automatique réelle
        this.scheduleAutoClose(symbol, order.id);
        
        return {
          success: true,
          orderId: order.id,
          details: {
            symbol: matchingMarket,
            amount: 400, // USDC
            leverage: 20,
            marketType: market.type,
            mode: 'real',
            order: order
          }
        };
        
      } catch (orderError) {
        console.error('❌ Erreur création ordre réel:', orderError);
        return {
          success: false,
          error: `Erreur création ordre: ${orderError instanceof Error ? orderError.message : 'Erreur inconnue'}`
        };
      }
      
    } catch (error) {
      console.error(`❌ Erreur ouverture position Hyperliquid sur ${symbol}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  private scheduleAutoClose(symbol: string, orderId: string): void {
    // Fermeture automatique après 3 minutes
    const closeTimer = setTimeout(async () => {
      console.log(`⏰ Fermeture automatique position ${symbol}...`);
      await this.closePosition(symbol, orderId);
    }, 3 * 60 * 1000); // 3 minutes

    this.activePositions.set(symbol, { orderId, closeTimer });
  }

  async closePosition(symbol: string, orderId?: string): Promise<TradeResult> {
    try {
      console.log(`🔒 Fermeture position Hyperliquid sur ${symbol}...`);
      
      // Annuler le timer de fermeture automatique
      const position = this.activePositions.get(symbol);
      if (position) {
        clearTimeout(position.closeTimer);
        this.activePositions.delete(symbol);
      }
      
      // Vérifier si c'est un ordre simulé ou réel
      const isSimulated = orderId && orderId.startsWith('hl_sim_');
      
      if (isSimulated) {
        console.log('⚠️ Fermeture position simulée');
        console.log(`✅ Position Hyperliquid simulée fermée: ${symbol}`);
        
        return {
          success: true,
          orderId: orderId || 'unknown',
          details: { mode: 'simulation' }
        };
      }
      
      // Fermeture réelle avec authentification
      if (!HYPERLIQUID_CONFIG.walletAddress || !HYPERLIQUID_CONFIG.privateKey) {
        console.log('⚠️ Pas d\'authentification - fermeture simulée');
        return {
          success: true,
          orderId: orderId || 'unknown',
          details: { mode: 'simulation' }
        };
      }
      
      console.log('🔐 Fermeture position réelle...');
      
      try {
        // Chercher le bon format de symbole
        const markets = Object.keys(this.exchange.markets);
        const symbolUpper = symbol.toUpperCase();
        const matchingMarket = markets.find(market => 
          market.toUpperCase().includes(symbolUpper) && 
          (market.includes('/USDC:USDC') || market.includes('/USDC'))
        );
        
        if (!matchingMarket) {
          return {
            success: false,
            error: `Symbole ${symbol} non trouvé pour fermeture`
          };
        }
        
        // Récupérer le prix actuel pour le slippage
        const ticker = await this.exchange.fetchTicker(matchingMarket);
        const currentPrice = ticker.last || ticker.close || 0;
        
        if (!currentPrice || currentPrice <= 0) {
          return {
            success: false,
            error: `Impossible de récupérer le prix actuel pour fermeture ${matchingMarket}`
          };
        }
        
        console.log(`📊 Prix actuel pour fermeture: ${currentPrice}`);
        
        // Créer l'ordre de fermeture avec prix et options de slippage
        const closeOrder = await this.exchange.createOrder(
          matchingMarket,
          'market',
          'sell',
          400, // Montant en USDC
          currentPrice, // Prix pour calculer le slippage
          {
            reduceOnly: true, // Fermer la position
            slippage: 5 // 5% de slippage maximum
          }
        );
        
        console.log(`✅ Position Hyperliquid réelle fermée: ${closeOrder.id}`);
        
        return {
          success: true,
          orderId: closeOrder.id,
          details: { 
            mode: 'real',
            closeOrder: closeOrder
          }
        };
        
      } catch (closeError) {
        console.error('❌ Erreur fermeture position réelle:', closeError);
        return {
          success: false,
          error: `Erreur fermeture: ${closeError instanceof Error ? closeError.message : 'Erreur inconnue'}`
        };
      }
      
    } catch (error) {
      console.error(`❌ Erreur fermeture position Hyperliquid sur ${symbol}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  async getActivePositions(): Promise<any[]> {
    try {
      const positions = Array.from(this.activePositions.entries()).map(([symbol, data]) => ({
        symbol,
        orderId: data.orderId,
        status: 'active',
        exchange: 'Hyperliquid'
      }));
      
      return positions;
    } catch (error) {
      console.error('❌ Erreur récupération positions Hyperliquid:', error);
      return [];
    }
  }

  async hasPerp(symbol: string): Promise<boolean> {
    try {
      const markets = Object.keys(this.exchange.markets);
      const symbolUpper = symbol.toUpperCase();
      
      return markets.some(market => 
        market.toUpperCase().includes(symbolUpper) || 
        market.toUpperCase().includes(`${symbolUpper}USDC`) ||
        market.toUpperCase().includes(`${symbolUpper}PERP`)
      );
    } catch (error) {
      console.error(`❌ Erreur vérification perp Hyperliquid pour ${symbol}:`, error);
      return false;
    }
  }

  async getMarketInfo(symbol: string): Promise<any> {
    try {
      const symbolPair = `${symbol}/USDC`;
      const market = this.exchange.markets[symbolPair];
      
      if (market) {
        return {
          symbol: market.symbol,
          type: market.type,
          active: market.active,
          precision: market.precision,
          limits: market.limits
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Erreur récupération info marché pour ${symbol}:`, error);
      return null;
    }
  }

  async getTicker(symbol: string): Promise<any> {
    try {
      const symbolPair = `${symbol}/USDC`;
      const ticker = await this.exchange.fetchTicker(symbolPair);
      
      // Gérer les données manquantes
      const result = {
        symbol: ticker.symbol,
        last: ticker.last || 0,
        bid: ticker.bid || 0,
        ask: ticker.ask || 0,
        volume: ticker.baseVolume || 0,
        change: ticker.change || 0,
        percentage: ticker.percentage || 0
      };
      
      // Si toutes les données sont à 0, essayer une approche alternative
      if (result.last === 0 && result.bid === 0 && result.ask === 0) {
        console.log(`⚠️ Données ticker manquantes pour ${symbol}, utilisation de données alternatives`);
        
        // Essayer de récupérer les données via l'API REST
        try {
          const marketData = await this.exchange.fetchTicker(symbolPair);
          if (marketData && marketData.info) {
            result.last = marketData.info.last || 0;
            result.volume = marketData.info.volume || 0;
          }
        } catch (altError) {
          console.log(`⚠️ Impossible de récupérer les données alternatives pour ${symbol}`);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Erreur récupération ticker pour ${symbol}:`, error);
      return {
        symbol: `${symbol}/USDC`,
        last: 0,
        bid: 0,
        ask: 0,
        volume: 0,
        change: 0,
        percentage: 0
      };
    }
  }
} 