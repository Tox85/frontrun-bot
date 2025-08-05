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
      
      this.ws = new WebSocket(HYPERLIQUID_CONFIG.wsUrl, {
        // Options pour améliorer la stabilité
        handshakeTimeout: 10000,
        perMessageDeflate: false,
        maxPayload: 100 * 1024 * 1024, // 100MB
      });

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

      this.ws.on('close', (code: number, reason: Buffer) => {
        console.log(`❌ WebSocket Hyperliquid déconnecté (code: ${code}, raison: ${reason.toString()})`);
        this.isConnectedFlag = false;
        this.stopPing();
        
        // Reconnexion automatique seulement si ce n'est pas un arrêt volontaire
        // Code 1000 = fermeture normale, 1001 = fermeture par le serveur
        if (code !== 1000 && code !== 1001) {
          this.handleReconnect();
        } else {
          console.log('ℹ️ Déconnexion normale - pas de reconnexion automatique');
          // Redémarrer après un délai plus long pour les déconnexions normales
          setTimeout(() => {
            console.log('🔄 Redémarrage de la surveillance Hyperliquid...');
            this.reconnectAttempts = 0;
            this.connect();
          }, 60000); // 1 minute
        }
      });

      this.ws.on('error', (error: Error) => {
        console.error('❌ Erreur WebSocket Hyperliquid:', error.message);
        this.isConnectedFlag = false;
        this.stopPing();
        
        // Reconnexion automatique en cas d'erreur
        this.handleReconnect();
      });

      this.ws.on('ping', () => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.pong();
        }
      });

      this.ws.on('pong', () => {
        // Réception d'un pong - connexion active
        if (Date.now() - this.lastLogTime > 60000) { // Log toutes les minutes
          console.log('💓 WebSocket Hyperliquid - connexion active');
          this.lastLogTime = Date.now();
        }
      });

    } catch (error) {
      console.error('❌ Erreur connexion WebSocket Hyperliquid:', error);
      this.handleReconnect();
    }
  }

  private subscribeToMarkets(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Abonnement selon l'API Hyperliquid réelle
    const subscribeMessage = {
      id: 1,
      method: 'subscribe',
      params: {
        channels: ['trades', 'orderbook', 'ticker']
      }
    };

    try {
      this.ws.send(JSON.stringify(subscribeMessage));
      console.log('📡 Abonnement aux marchés Hyperliquid activé');
    } catch (error) {
      console.error('❌ Erreur abonnement Hyperliquid:', error);
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: any = JSON.parse(data);
      
      // Traitement des différents types de messages Hyperliquid
      if (message.result === 'subscribed') {
        console.log('✅ Abonnement Hyperliquid confirmé');
        return;
      }
      
      if (message.result === 'pong') {
        // Réponse au heartbeat
        if (Date.now() - this.lastLogTime > 60000) {
          console.log('💓 WebSocket Hyperliquid - heartbeat reçu');
          this.lastLogTime = Date.now();
        }
        return;
      }
      
      // Traitement des données de marché
      if (message.channel === 'trades') {
        this.processTrades(message.data);
      } else if (message.channel === 'orderbook') {
        this.processOrderbook(message.data);
      } else if (message.channel === 'ticker') {
        this.processMarketData(message.data);
      } else if (message.type === 'error') {
        console.error('❌ Erreur WebSocket Hyperliquid:', message.error);
      } else {
        // Ignorer les autres types de messages silencieusement
      }
    } catch (error) {
      // Ne pas logger toutes les erreurs de parsing pour éviter le spam
      if (Date.now() - this.lastLogTime > 10000) { // Log max une fois par 10 secondes
        console.error('❌ Erreur parsing message Hyperliquid:', error);
        this.lastLogTime = Date.now();
      }
    }
  }

  private processMarketData(data: any): void {
    // Traitement des données de marché
    // Détection de nouveaux tokens ou changements de prix
    const now = Date.now();
    if (now - this.lastLogTime > 30000) { // Log une fois par 30 secondes max
      console.log('📊 Données marché Hyperliquid reçues');
      this.lastLogTime = now;
    }
  }

  private processTrades(data: any): void {
    // Traitement des trades
    // Détection d'activité anormale
    const now = Date.now();
    if (now - this.lastLogTime > 30000) {
      console.log('🔄 Trades Hyperliquid reçus');
      this.lastLogTime = now;
    }
  }

  private processOrderbook(data: any): void {
    // Traitement du carnet d'ordres
    // Détection de gros ordres
    const now = Date.now();
    if (now - this.lastLogTime > 30000) {
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
        try {
          // Envoyer un heartbeat valide pour Hyperliquid
          const heartbeatMessage = {
            id: Date.now(),
            method: 'ping'
          };
          
          this.ws.send(JSON.stringify(heartbeatMessage));
          
          // Log périodique de l'activité
          if (Date.now() - this.lastLogTime > 60000) { // Log toutes les minutes
            console.log('💓 WebSocket Hyperliquid - heartbeat envoyé');
            this.lastLogTime = Date.now();
          }
        } catch (error) {
          console.error('❌ Erreur envoi heartbeat:', error);
        }
      }
    }, 30000); // Heartbeat toutes les 30 secondes
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
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000); // Backoff exponentiel, max 30s
      
      console.log(`🔄 Tentative de reconnexion Hyperliquid ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${delay}ms`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('❌ Nombre maximum de tentatives de reconnexion atteint');
      console.log('🔄 Redémarrage de la surveillance dans 60 secondes...');
      
      // Redémarrer complètement après 60 secondes
      setTimeout(() => {
        this.reconnectAttempts = 0;
        this.connect();
      }, 60000);
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