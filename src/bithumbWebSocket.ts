import WebSocket from 'ws';
import axios from 'axios';

interface BithumbWebSocketMessage {
  type: string;
  content: any;
  ts: number;
}

interface BithumbTickerData {
  symbol: string;
  closePrice: string;
  volume: string;
  [key: string]: any;
}

export class BithumbWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private isConnectedFlag: boolean = false;
  private knownSymbols: Set<string> = new Set();
  private onNewListing: ((symbol: string, metadata?: any) => void) | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log("🔌 Initialisation WebSocket Bithumb...");
    this.initializeExistingTokens();
  }

  private async initializeExistingTokens(): Promise<void> {
    try {
      console.log("🔄 Initialisation des tokens Bithumb existants...");
      
      // Utiliser l'API principale qui contient tous les marchés
      const response = await axios.get('https://api.bithumb.com/v1/market/all', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      console.log("📡 Réponse API Bithumb reçue:", response.status);
      
      // L'API retourne directement un tableau de marchés
      if (Array.isArray(response.data)) {
        const markets = response.data;
        console.log("📊 Nombre de marchés reçus:", markets.length);
        
        // Filtrer les marchés KRW et extraire les symboles
        const krwMarkets = markets.filter((market: any) => 
          market.market && market.market.startsWith('KRW-')
        );
        
        console.log("📊 Paires KRW trouvées:", krwMarkets.length);
        
        krwMarkets.forEach((market: any) => {
          const symbol = market.market.replace('KRW-', '');
          this.knownSymbols.add(symbol);
        });
        
        console.log(`🇰🇷 ${this.knownSymbols.size} tokens Bithumb existants initialisés`);
        console.log("📋 Exemples:", Array.from(this.knownSymbols).slice(0, 10));
      } else if (response.data && response.data.data) {
        // Format alternatif avec data.data
        const markets = response.data.data;
        console.log("📊 Nombre de marchés reçus (format alternatif):", markets.length);
        
        const krwMarkets = markets.filter((market: any) => 
          market.market && market.market.startsWith('KRW-')
        );
        
        console.log("📊 Paires KRW trouvées:", krwMarkets.length);
        
        krwMarkets.forEach((market: any) => {
          const symbol = market.market.replace('KRW-', '');
          this.knownSymbols.add(symbol);
        });
        
        console.log(`🇰🇷 ${this.knownSymbols.size} tokens Bithumb existants initialisés`);
        console.log("📋 Exemples:", Array.from(this.knownSymbols).slice(0, 10));
      } else {
        console.warn("⚠️ Format de réponse Bithumb inattendu:", typeof response.data, response.data);
      }
    } catch (error) {
      console.warn("⚠️ Impossible d'initialiser les tokens Bithumb existants:", error instanceof Error ? error.message : String(error));
      console.log("🔄 Le WebSocket détectera les tokens au fur et à mesure...");
    }
  }



  public startListening(callback: (symbol: string, metadata?: any) => void): void {
    this.onNewListing = callback;
    this.connect();
  }

  private connect(): void {
    try {
      console.log("🔌 Connexion WebSocket Bithumb...");
      
      // Endpoint WebSocket Bithumb officiel
      this.ws = new WebSocket('wss://pubwss.bithumb.com/pub/ws');

      this.ws.on('open', () => {
        console.log("✅ WebSocket Bithumb connecté");
        this.isConnectedFlag = true;
        this.reconnectAttempts = 0;
        this.subscribeToTickers();
        this.startPing();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        console.log(`🔌 WebSocket Bithumb fermé: ${code} - ${reason.toString()}`);
        this.isConnectedFlag = false;
        this.stopPing();
        this.handleReconnect();
      });

      this.ws.on('error', (error: Error) => {
        console.error("❌ Erreur WebSocket Bithumb:", error.message);
        this.isConnectedFlag = false;
      });

    } catch (error) {
      console.error("❌ Erreur connexion WebSocket:", error);
      this.handleReconnect();
    }
  }

  private subscribeToTickers(): void {
    if (!this.ws || !this.isConnectedFlag) return;

    try {
      // Message de souscription exact selon la documentation Bithumb
      const subscribeMessage = {
        type: "ticker",
        symbols: ["ALL"],
        tickTypes: ["24H"]
      };

      this.ws.send(JSON.stringify(subscribeMessage));
      console.log("📡 Abonnement aux tickers Bithumb activé (ALL symbols, 24H)");

    } catch (error) {
      console.error("❌ Erreur abonnement:", error);
    }
  }

  private startPing(): void {
    // Ping toutes les 30 secondes pour maintenir la connexion
    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnectedFlag) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Log tous les messages pour debug
      if (message.type === 'ticker') {
        console.log("📨 Message ticker Bithumb reçu:", JSON.stringify(message, null, 2));
      } else if (message.status) {
        console.log("📨 Message de statut Bithumb:", message.resmsg);
      } else {
        console.log("📨 Message WebSocket inconnu:", JSON.stringify(message, null, 2));
      }
      
      // Traiter seulement les messages de type ticker
      if (message.type !== 'ticker') return;
      
      const symbol = message?.content?.symbol;
      if (symbol && symbol.endsWith('_KRW')) {
        const baseSymbol = symbol.replace('_KRW', '');
        
        if (!this.knownSymbols.has(baseSymbol)) {
          this.knownSymbols.add(baseSymbol);
          console.log(`🟢 Nouveau token listé sur Bithumb : ${baseSymbol}/KRW`);
          
          if (this.onNewListing) {
            this.onNewListing(baseSymbol, {
              volume: message.content?.acc_trade_value_24H || '0'
            });
          }
        }
      }
    } catch (err) {
      console.error('❌ Erreur parsing message Bithumb :', err);
    }
  }

  private handleTickerData(content: BithumbTickerData): void {
    if (content && content.symbol) {
      const symbol = content.symbol;
      
      // Détecter les nouveaux symboles KRW
      if (symbol.includes('_KRW')) {
        const tokenSymbol = symbol.replace('_KRW', '');
        
        if (!this.knownSymbols.has(tokenSymbol)) {
          this.knownSymbols.add(tokenSymbol);
          
          if (this.onNewListing) {
            console.log(`🆕 NOUVEAU LISTING BITHUMB: ${tokenSymbol} (${symbol})`);
            this.onNewListing(tokenSymbol, {
              source: 'Bithumb',
              timestamp: Date.now(),
              symbol: symbol,
              price: content.closePrice,
              volume: content.volume,
              type: 'websocket'
            });
          }
        }
      }
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${this.reconnectDelay}ms...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error("❌ Nombre maximum de tentatives de reconnexion atteint");
    }
  }

  public stopListening(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopPing();
    this.isConnectedFlag = false;
    this.onNewListing = null;
    console.log("🛑 WebSocket Bithumb arrêté");
  }

  public getKnownSymbolsCount(): number {
    return this.knownSymbols.size;
  }

  public getKnownSymbols(): string[] {
    return Array.from(this.knownSymbols);
  }

  public isConnected(): boolean {
    return this.isConnectedFlag;
  }
}

