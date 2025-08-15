/**
 * HyperliquidAdapter - Interface pour Hyperliquid testnet
 * 
 * Conforme au super prompt Bithumb-only :
 * - Trading sur HL testnet uniquement
 * - Long immédiat + exit +180s
 * - Risk sizing: balance * RISK_PCT * LEVERAGE_TARGET
 */

export interface HLConfig {
  testnet: boolean;
  privateKey: string;
  walletAddress?: string;
  baseUrl: string;
  timeoutMs: number;
}

export interface HLPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  leverage: number;
}

export interface HLOrder {
  id: string;
  positionId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  timestamp: number;
}

export interface HLBalance {
  usd: number;
  available: number;
  locked: number;
}

export class HyperliquidAdapter {
  private config: HLConfig;
  private isConnected: boolean = false;
  private lastHeartbeat: number = 0;

  constructor(config: HLConfig) {
    this.config = {
      ...config,
      baseUrl: config.testnet 
        ? 'https://api.hyperliquid-testnet.xyz' 
        : 'https://api.hyperliquid.xyz'
    };
  }

  /**
   * Initialise la connexion à Hyperliquid
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔌 Initialisation de la connexion Hyperliquid...');
      
      // Vérifier la connectivité
      await this.checkConnectivity();
      
      // Vérifier l'authentification
      await this.authenticate();
      
      this.isConnected = true;
      this.lastHeartbeat = Date.now();
      
      console.log('✅ Connexion Hyperliquid établie');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation Hyperliquid:', error);
      throw error;
    }
  }

  /**
   * Vérifie la connectivité à l'API
   */
  private async checkConnectivity(): Promise<void> {
    try {
      console.log('🔌 Testing Hyperliquid connectivity...');
      
      const response = await fetch(`${this.config.baseUrl}/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'allMids' }),
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Hyperliquid connectivity OK - ${Object.keys(data).length} markets available`);
      
    } catch (error) {
      console.error('❌ Hyperliquid connectivity failed:', error);
      throw error;
    }
  }

  /**
   * Authentifie l'utilisateur
   */
  private async authenticate(): Promise<void> {
    try {
      // Vérifier que la clé privée est présente
      if (!this.config.privateKey || this.config.privateKey === 'replace_me') {
        throw new Error('Private key not configured');
      }

      // Vérifier que l'adresse wallet est présente
      if (!this.config.walletAddress) {
        throw new Error('Wallet address not configured');
      }

      console.log(`🔐 Authenticating wallet: ${this.config.walletAddress}`);

      // Tester la récupération de l'état utilisateur
      try {
        const userState = await this.getUserState();
        
        if (userState && userState.user) {
          console.log('✅ User authentication successful');
          console.log(`💰 Balance: ${userState.user.marginSummary?.accountValue || 'N/A'} USD`);
        } else {
          console.log('⚠️ User not found or no balance - this is normal for new testnet accounts');
        }
      } catch (userStateError: any) {
        // Gérer l'erreur 422 (wallet non trouvé) gracieusement
        if (userStateError.message?.includes('422') || userStateError.message?.includes('Unprocessable Entity')) {
          console.log('⚠️ Wallet not found on testnet - this is normal for new accounts');
          console.log('💡 The wallet will be created automatically on first trade');
        } else {
          throw userStateError; // Relancer les autres erreurs
        }
      }

      console.log('✅ Hyperliquid authentication completed');

    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Obtient le solde du compte
   */
  async getBalance(): Promise<HLBalance> {
    try {
      // Simulation pour le moment (à remplacer par l'API réelle)
      return {
        usd: 10000,      // Solde total
        available: 9500,  // Solde disponible
        locked: 500       // Solde verrouillé
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du solde:', error);
      throw error;
    }
  }

  /**
   * Obtient les positions ouvertes
   */
  async getPositions(): Promise<HLPosition[]> {
    try {
      // Simulation pour le moment (à remplacer par l'API réelle)
      return [];
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des positions:', error);
      throw error;
    }
  }

  /**
   * Ouvre une position long
   */
  async openLongPosition(
    symbol: string, 
    notional: number, 
    leverage: number = 10
  ): Promise<HLOrder> {
    try {
      console.log(`🚀 Ouverture position long ${symbol}: $${notional} (levier ${leverage}x)`);
      
      // Calculer la taille de la position
      const positionSize = notional / leverage;
      
      // Simulation de l'ordre (à remplacer par l'API réelle)
      const order: HLOrder = {
        id: `hl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        positionId: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        side: 'BUY',
        size: positionSize,
        price: 0, // Prix du marché
        status: 'PENDING',
        timestamp: Date.now()
      };
      
      console.log(`📋 Ordre créé: ${order.id}`);
      
      // Simuler le remplissage
      setTimeout(() => {
        console.log(`✅ Position ${symbol} ouverte avec succès`);
      }, 1000);
      
      return order;
      
    } catch (error) {
      console.error(`❌ Erreur lors de l'ouverture de la position ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Ferme une position (reduce-only)
   */
  async closePosition(
    symbol: string, 
    size: number
  ): Promise<HLOrder> {
    try {
      console.log(`🔒 Fermeture position ${symbol}: ${size}`);
      
      // Simulation de l'ordre de fermeture (à remplacer par l'API réelle)
      const order: HLOrder = {
        id: `hl_close_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        positionId: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        side: 'SELL',
        size,
        price: 0, // Prix du marché
        status: 'PENDING',
        timestamp: Date.now()
      };
      
      console.log(`📋 Ordre de fermeture créé: ${order.id}`);
      
      // Simuler le remplissage
      setTimeout(() => {
        console.log(`✅ Position ${symbol} fermée avec succès`);
      }, 1000);
      
      return order;
      
    } catch (error) {
      console.error(`❌ Erreur lors de la fermeture de la position ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Obtient le statut d'un ordre
   */
  async getOrderStatus(orderId: string): Promise<HLOrder['status']> {
    try {
      // Simulation pour le moment (à remplacer par l'API réelle)
      return 'FILLED';
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification du statut de l'ordre ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Annule un ordre
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      console.log(`❌ Annulation de l'ordre ${orderId}`);
      
      // Simulation pour le moment (à remplacer par l'API réelle)
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de l'annulation de l'ordre ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Obtient le prix actuel d'un symbole
   */
  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      // Simulation pour le moment (à remplacer par l'API réelle)
      // Retourner un prix factice basé sur le symbole
      const basePrice = symbol.includes('BTC') ? 50000 : 
                       symbol.includes('ETH') ? 3000 : 
                       symbol.includes('SOL') ? 100 : 1;
      
      return basePrice + (Math.random() - 0.5) * basePrice * 0.01; // ±0.5%
      
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération du prix de ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Vérifie si un symbole est disponible pour le trading
   */
  async isSymbolTradable(symbol: string): Promise<boolean> {
    try {
      // Simulation pour le moment (à remplacer par l'API réelle)
      const tradableSymbols = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'MATICUSD'];
      return tradableSymbols.includes(symbol);
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification de la disponibilité de ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Obtient les informations de levier pour un symbole
   */
  async getLeverageInfo(symbol: string): Promise<{
    maxLeverage: number;
    minSize: number;
    maxSize: number;
  }> {
    try {
      // Simulation pour le moment (à remplacer par l'API réelle)
      return {
        maxLeverage: 100,
        minSize: 1,
        maxSize: 1000000
      };
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des infos de levier pour ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les métadonnées de l'univers (perps disponibles)
   */
  async getMeta(): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseUrl}/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'meta' }),
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Meta retrieved: ${data.universe?.length || 0} perps available`);
      return data;
      
    } catch (error) {
      console.error('❌ Failed to get meta:', error);
      throw error;
    }
  }

  /**
   * Récupère l'état utilisateur (balance, positions)
   */
  async getUserState(): Promise<any> {
    if (!this.config.walletAddress) {
      throw new Error('Wallet address not configured');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          type: 'userState',
          user: this.config.walletAddress.toLowerCase()
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ User state retrieved for ${this.config.walletAddress}`);
      return data;
      
    } catch (error) {
      console.error('❌ Failed to get user state:', error);
      throw error;
    }
  }

  /**
   * Vérifie la santé de la connexion
   */
  async healthCheck(): Promise<{
    isConnected: boolean;
    lastHeartbeat: number;
    latency: number;
  }> {
    const startTime = Date.now();
    
    try {
      await this.checkConnectivity();
      const latency = Date.now() - startTime;
      
      return {
        isConnected: this.isConnected,
        lastHeartbeat: this.lastHeartbeat,
        latency
      };
    } catch (error) {
      return {
        isConnected: false,
        lastHeartbeat: this.lastHeartbeat,
        latency: -1
      };
    }
  }

  /**
   * Arrête l'adaptateur
   */
  async stop(): Promise<void> {
    this.isConnected = false;
    console.log('🛑 HyperliquidAdapter arrêté');
  }

  /**
   * Getters pour le monitoring
   */
  getStatus(): {
    isConnected: boolean;
    lastHeartbeat: number;
    config: Omit<HLConfig, 'privateKey'>;
  } {
    return {
      isConnected: this.isConnected,
      lastHeartbeat: this.lastHeartbeat,
      config: {
        testnet: this.config.testnet,
        baseUrl: this.config.baseUrl,
        timeoutMs: this.config.timeoutMs
      }
    };
  }
}
