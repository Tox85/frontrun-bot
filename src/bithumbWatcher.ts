import WebSocket from 'ws';

export interface BithumbListing {
  symbol: string;
  fullSymbol: string;
  price: number;
  volume: number;
  timestamp: number;
  exchange: 'BITHUMB';
  source: 'websocket';
}

export class BithumbWatcher {
  private ws: WebSocket | null = null;
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private lastKnownTokens: Set<string> = new Set();
  private onNewListing: (listing: BithumbListing) => void;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(onNewListing: (listing: BithumbListing) => void) {
    this.onNewListing = onNewListing;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ BithumbWatcher déjà en cours d\'exécution');
      return;
    }

    console.log('🔍 Démarrage de la surveillance Bithumb (WebSocket temps réel)...');
    
    try {
      // Charger les tokens connus au démarrage
      await this.loadKnownTokens();
      
      // Démarrer la connexion WebSocket
      this.connectWebSocket();
      
      console.log('✅ Surveillance Bithumb démarrée avec succès');
    } catch (error) {
      console.error('❌ Erreur démarrage BithumbWatcher:', error);
      throw error;
    }
  }

  stop(): void {
    this.isRunning = false;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    console.log('🛑 Surveillance Bithumb arrêtée');
  }

  private connectWebSocket(): void {
    try {
      // WebSocket Bithumb pour les nouveaux listings
      this.ws = new WebSocket('wss://pubwss.bithumb.com/pub/ws');
      
      this.ws.on('open', () => {
        console.log('🔌 Connexion WebSocket Bithumb établie');
        this.isRunning = true;
        this.reconnectAttempts = 0;
        
        // S'abonner aux nouveaux listings
        this.subscribeToNewListings();
        
        // Démarrer le heartbeat
        this.startHeartbeat();
      });
      
      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('❌ Erreur parsing message WebSocket:', error);
        }
      });
      
      this.ws.on('close', () => {
        console.log('🔌 Connexion WebSocket Bithumb fermée');
        this.isRunning = false;
        this.handleReconnect();
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ Erreur WebSocket Bithumb:', error);
        this.isRunning = false;
      });
      
    } catch (error) {
      console.error('❌ Erreur connexion WebSocket Bithumb:', error);
      this.handleReconnect();
    }
  }

  private subscribeToNewListings(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    try {
      // S'abonner aux nouveaux marchés
      const subscribeMessage = {
        type: 'ticker',
        symbols: ['BTC_KRW', 'ETH_KRW'], // Marchés de base pour commencer
        tickTypes: ['1H']
      };
      
      this.ws.send(JSON.stringify(subscribeMessage));
      console.log('📡 Abonnement aux nouveaux marchés Bithumb activé');
      
    } catch (error) {
      console.error('❌ Erreur abonnement WebSocket:', error);
    }
  }

  private handleWebSocketMessage(message: any): void {
    try {
      // Log de surveillance coréenne
      if (process.env.ENABLE_KOREAN_LOGS === 'true') {
        console.log(`🇰🇷 WebSocket Bithumb actif - ${new Date().toLocaleTimeString()}`);
      }

      // Vérifier si c'est un nouveau listing
      if (message.type === 'ticker' && message.content) {
        const symbol = message.content.symbol;
        if (symbol && symbol.endsWith('_KRW')) {
          const cleanSymbol = symbol.replace('_KRW', '');
          
          // Vérifier si c'est un nouveau token
          if (!this.lastKnownTokens.has(cleanSymbol)) {
            console.log(`🆕 NOUVEAU LISTING BITHUMB DÉTECTÉ: ${cleanSymbol}`);
            
            const listing: BithumbListing = {
              symbol: cleanSymbol,
              fullSymbol: symbol,
              price: parseFloat(message.content.closePrice) || 0,
              volume: parseFloat(message.content.accTradeValue) || 0,
              timestamp: Date.now(),
              exchange: 'BITHUMB',
              source: 'websocket'
            };
            
            // Ajouter aux tokens connus
            this.lastKnownTokens.add(cleanSymbol);
            
            // Notifier le nouveau listing
            this.onNewListing(listing);
            
            // Sauvegarder dans knownTokens.json
            this.saveKnownTokens();
          }
        }
      }
      
      // Gérer les messages de statut
      if (message.status === '0000') {
        console.log('✅ Message WebSocket Bithumb traité avec succès');
      }
      
    } catch (error) {
      console.error('❌ Erreur traitement message WebSocket:', error);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          // Envoyer un ping pour maintenir la connexion
          this.ws.ping();
        } catch (error) {
          console.error('❌ Erreur heartbeat WebSocket:', error);
        }
      }
    }, 30000); // Toutes les 30 secondes
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Nombre maximum de tentatives de reconnexion atteint');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${this.reconnectDelay}ms...`);
    
    setTimeout(() => {
      if (this.isRunning) {
        this.connectWebSocket();
      }
    }, this.reconnectDelay);
    
    // Augmenter le délai pour la prochaine tentative
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private async loadKnownTokens(): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      const knownTokensFile = path.join(process.cwd(), 'knownTokens.json');
      
      if (fs.existsSync(knownTokensFile)) {
        const data = fs.readFileSync(knownTokensFile, 'utf8');
        const tokens = JSON.parse(data);
        this.lastKnownTokens = new Set(tokens);
        console.log(`📚 ${this.lastKnownTokens.size} tokens connus chargés depuis knownTokens.json`);
      } else {
        console.log('📚 Aucun fichier knownTokens.json trouvé, démarrage avec liste vide');
      }
    } catch (error) {
      console.error('❌ Erreur chargement tokens connus:', error);
      this.lastKnownTokens = new Set();
    }
  }

  private saveKnownTokens(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const knownTokensFile = path.join(process.cwd(), 'knownTokens.json');
      
      const tokens = Array.from(this.lastKnownTokens);
      fs.writeFileSync(knownTokensFile, JSON.stringify(tokens, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Erreur sauvegarde tokens connus:', error);
    }
  }

  getStatus(): { isRunning: boolean; tokenCount: number; wsState: string; reconnectAttempts: number } {
    return {
      isRunning: this.isRunning,
      tokenCount: this.lastKnownTokens.size,
      wsState: this.ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.ws.readyState] : 'NULL',
      reconnectAttempts: this.reconnectAttempts
    };
  }
}
