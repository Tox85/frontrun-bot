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
  private lastLogTime: number = 0;

  constructor() {
    console.log("🔌 Initialisation WebSocket Bithumb...");
    this.initializeExistingTokens();
  }

  private async initializeExistingTokens(): Promise<void> {
    try {
      console.log("🔄 Initialisation des tokens Bithumb existants...");
      
      // Utiliser l'API principale qui contient tous les marchés
      const response = await axios.get('https://api.bithumb.com/public/ticker/ALL_KRW', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      console.log("📡 Réponse API Bithumb reçue:", response.status);
      
      // Debug: afficher la structure de la réponse
      console.log("🔍 Structure de la réponse:", Object.keys(response.data));
      
      // L'API retourne un objet avec les données des tickers
      if (response.data && response.data.data) {
        const tickers = response.data.data;
        console.log("📊 Nombre de tickers reçus:", Object.keys(tickers).length);
        
        // Debug: afficher quelques exemples de clés
        const sampleKeys = Object.keys(tickers).slice(0, 5);
        console.log("🔍 Exemples de clés:", sampleKeys);
        
        // ✅ CORRECTION : Les clés sont directement les symboles (BTC, ETH, etc.)
        // Pas besoin de chercher _KRW, toutes les clés sont des tokens KRW
        let tokenCount = 0;
        Object.keys(tickers).forEach(symbol => {
          // Filtrer les symboles valides (exclure les symboles trop courts ou spéciaux)
          if (symbol && symbol.length >= 2 && symbol.length <= 10 && /^[A-Z0-9]+$/.test(symbol)) {
            this.knownSymbols.add(symbol);
            tokenCount++;
          }
        });
        
        console.log(`🇰🇷 ${tokenCount} tokens Bithumb existants initialisés`);
        console.log("📋 Exemples:", Array.from(this.knownSymbols).slice(0, 10));
        
        // Si aucun token n'a été trouvé, essayer un format alternatif
        if (tokenCount === 0) {
          console.log("⚠️ Aucun token trouvé, tentative format alternatif...");
          await this.tryAlternativeFormat();
        }
      } else {
        console.warn("⚠️ Format de réponse Bithumb inattendu:", typeof response.data);
        await this.tryAlternativeFormat();
      }
    } catch (error) {
      console.warn("⚠️ Impossible d'initialiser les tokens Bithumb existants:", error instanceof Error ? error.message : String(error));
      console.log("🔄 Le WebSocket détectera les tokens au fur et à mesure...");
    }
  }

  private async tryAlternativeFormat(): Promise<void> {
    try {
      console.log("🔄 Tentative avec format alternatif...");
      
      // Essayer l'API des marchés
      const response = await axios.get('https://api.bithumb.com/public/markets', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      console.log("📡 Réponse API marchés reçue:", response.status);
      
      if (response.data && response.data.data) {
        const markets = response.data.data;
        console.log("📊 Nombre de marchés reçus:", markets.length);
        
        let tokenCount = 0;
        markets.forEach((market: any) => {
          if (market.market && market.market.startsWith('KRW-')) {
            const baseSymbol = market.market.replace('KRW-', '');
            this.knownSymbols.add(baseSymbol);
            tokenCount++;
          }
        });
        
        console.log(`🇰🇷 ${tokenCount} tokens Bithumb (format alternatif) initialisés`);
        console.log("📋 Exemples:", Array.from(this.knownSymbols).slice(0, 10));
      }
    } catch (error) {
      console.warn("⚠️ Format alternatif échoué:", error instanceof Error ? error.message : String(error));
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
      
      // Log seulement les messages importants (nouveaux listings)
      if (message.type === 'ticker' && message.content) {
        this.processTickerMessage(message.content);
      } else if (message.status && message.status !== '0000') {
        // Log seulement les erreurs de statut
        console.log("⚠️ Message de statut Bithumb:", message.resmsg || message.status);
      }
      
    } catch (err) {
      console.error('❌ Erreur parsing message Bithumb :', err);
    }
  }

  private processTickerMessage(content: any): void {
    // Vérifier si c'est un nouveau ticker
    if (content && content.symbol) {
      const symbol = content.symbol;
      
      // ✅ CORRECTION : Les symboles peuvent être au format "BTC" ou "BTC_KRW"
      // Normaliser le symbole
      let tokenSymbol = symbol;
      
      // Si le symbole contient _KRW, l'extraire
      if (symbol.includes('_KRW')) {
        tokenSymbol = symbol.replace('_KRW', '');
      }
      
      // Vérifier si c'est un symbole valide
      if (tokenSymbol && tokenSymbol.length >= 2 && tokenSymbol.length <= 10 && /^[A-Z0-9]+$/.test(tokenSymbol)) {
        // Vérifier si c'est un nouveau token
        if (!this.knownSymbols.has(tokenSymbol)) {
          this.knownSymbols.add(tokenSymbol);
          
          // Log avec timestamp pour éviter le spam
          const now = Date.now();
          if (now - this.lastLogTime > 1000) { // Log max 1 fois par seconde
            console.log(`🆕 NOUVEAU LISTING BITHUMB: ${tokenSymbol} (${symbol})`);
            this.lastLogTime = now;
          }
          
          if (this.onNewListing) {
            this.onNewListing(tokenSymbol, {
              source: 'Bithumb WebSocket',
              timestamp: Date.now(),
              symbol: symbol,
              price: content.closePrice || '0',
              volume: content.acc_trade_value_24H || '0',
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

