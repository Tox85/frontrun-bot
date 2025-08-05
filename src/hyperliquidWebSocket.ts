import * as ccxt from 'ccxt';
import WebSocket from 'ws';
import { HYPERLIQUID_CONFIG } from './hyperliquidConfig';

interface HyperliquidMessage {
  type: string;
  data: any;
}

interface HyperliquidMarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

export class HyperliquidWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private isConnectedFlag: boolean = false;
  private onNewListing: ((symbol: string, metadata?: any) => void) | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private exchange: ccxt.hyperliquid;
  private knownSymbols: Set<string> = new Set();
  private lastLogTime: number = 0;

  constructor() {
    console.log("🔌 Initialisation WebSocket Hyperliquid...");
    
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

    this.exchange = new ccxt.hyperliquid(config);
  }

  public async startListening(callback: (symbol: string, metadata?: any) => void): Promise<void> {
    this.onNewListing = callback;
    
    // Charger les marchés existants
    await this.loadExistingMarkets();
    
    // Démarrer la surveillance WebSocket
    this.connect();
  }

  private async loadExistingMarkets(): Promise<void> {
    try {
      console.log("🔄 Chargement des marchés Hyperliquid existants...");
      await this.exchange.loadMarkets();
      
      const markets = Object.keys(this.exchange.markets);
      console.log(`✅ ${markets.length} marchés Hyperliquid chargés`);
      
      // Extraire les symboles de base (sans /USDC)
      markets.forEach(market => {
        const baseSymbol = market.split('/')[0];
        if (baseSymbol && baseSymbol.length >= 2 && baseSymbol.length <= 10) {
          this.knownSymbols.add(baseSymbol);
        }
      });
      
      console.log(`🇺🇸 ${this.knownSymbols.size} tokens Hyperliquid existants initialisés`);
      console.log("📋 Exemples:", Array.from(this.knownSymbols).slice(0, 10));
      
    } catch (error) {
      console.error("❌ Erreur chargement marchés Hyperliquid:", error);
    }
  }

  private connect(): void {
    try {
      console.log(`🔌 Connexion WebSocket Hyperliquid: ${HYPERLIQUID_CONFIG.wsUrl}`);
      
      this.ws = new WebSocket(HYPERLIQUID_CONFIG.wsUrl);

      this.ws.on('open', () => {
        console.log('✅ WebSocket Hyperliquid connecté');
        this.isConnectedFlag = true;
        this.reconnectAttempts = 0;
        this.subscribeToMarkets();
        this.startPing();
      });

      this.ws.on('message', (data: string) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        console.log('❌ WebSocket Hyperliquid déconnecté');
        this.isConnectedFlag = false;
        this.stopPing();
        this.handleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('❌ Erreur WebSocket Hyperliquid:', error);
      });

    } catch (error) {
      console.error('❌ Erreur connexion WebSocket Hyperliquid:', error);
      this.handleReconnect();
    }
  }

  private subscribeToMarkets(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Abonnement aux données de marché
    const subscribeMessage = {
      method: 'subscribe',
      params: {
        channels: ['marketData', 'trades', 'orderbook']
      }
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log('📡 Abonnement aux marchés Hyperliquid activé');
  }

  private handleMessage(data: string): void {
    try {
      const message: HyperliquidMessage = JSON.parse(data);
      
      // Traitement des différents types de messages
      switch (message.type) {
        case 'marketData':
          this.processMarketData(message.data);
          break;
        case 'trades':
          this.processTrades(message.data);
          break;
        case 'orderbook':
          this.processOrderbook(message.data);
          break;
        case 'newMarket':
          this.processNewMarket(message.data);
          break;
        default:
          // Ignorer les autres types de messages
          break;
      }
    } catch (error) {
      console.error('❌ Erreur parsing message Hyperliquid:', error);
    }
  }

  private processMarketData(data: any): void {
    // Traitement des données de marché
    // Détection de nouveaux tokens ou changements de prix
    const now = Date.now();
    if (now - this.lastLogTime > 1000) { // Log une fois par seconde max
      console.log('📊 Données marché Hyperliquid reçues');
      this.lastLogTime = now;
    }
  }

  private processTrades(data: any): void {
    // Traitement des trades
    // Détection d'activité anormale
    const now = Date.now();
    if (now - this.lastLogTime > 1000) {
      console.log('🔄 Trades Hyperliquid reçus');
      this.lastLogTime = now;
    }
  }

  private processOrderbook(data: any): void {
    // Traitement du carnet d'ordres
    // Détection de gros ordres
    const now = Date.now();
    if (now - this.lastLogTime > 1000) {
      console.log('📚 Orderbook Hyperliquid reçu');
      this.lastLogTime = now;
    }
  }

  private processNewMarket(data: any): void {
    // Traitement des nouveaux marchés
    if (data && data.symbol) {
      const baseSymbol = data.symbol.split('/')[0];
      
      if (baseSymbol && !this.knownSymbols.has(baseSymbol)) {
        console.log(`🆕 NOUVEAU TOKEN HYPERLIQUID DÉTECTÉ !`);
        console.log(`Symbole : ${baseSymbol}`);
        console.log(`Marché complet : ${data.symbol}`);
        
        // Ajouter aux symboles connus
        this.knownSymbols.add(baseSymbol);
        
        // Notifier le callback
        if (this.onNewListing) {
          this.onNewListing(baseSymbol, {
            exchange: 'Hyperliquid',
            fullSymbol: data.symbol,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping toutes les 30 secondes
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Tentative de reconnexion Hyperliquid ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('❌ Nombre maximum de tentatives de reconnexion atteint');
    }
  }

  public stopListening(): void {
    console.log('🛑 Arrêt WebSocket Hyperliquid...');
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnectedFlag = false;
  }

  public isConnected(): boolean {
    return this.isConnectedFlag;
  }

  public async hasPerp(symbol: string): Promise<boolean> {
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

  public getKnownSymbolsCount(): number {
    return this.knownSymbols.size;
  }

  public getKnownSymbols(): string[] {
    return Array.from(this.knownSymbols);
  }
} 