import { Database } from 'sqlite3';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { EventStore } from '../core/EventStore';
import { buildEventId } from '../core/EventId';

export interface BithumbWSEvent {
  base: string;
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  source: 'bithumb.ws';
}

export interface WSConfig {
  wsUrl: string;
  restUrl: string;
  debounceMs: number;
  warmupMs: number;
  maxReconnectAttempts: number;
  reconnectIntervalMs: number;
  heartbeatIntervalMs: number;
  connectionTimeoutMs: number;
}

// Interface pour la réponse REST de Bithumb
interface BithumbRESTResponse {
  status: string;
  data: Record<string, any>;
}

export class BithumbWSWatcher extends EventEmitter {
  private config: WSConfig;
  private db: Database;
  private eventStore: EventStore;
  private ws: WebSocket | null = null;
  private isRunning: boolean = false;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private warmupTimer: NodeJS.Timeout | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private doubleCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private baseMutex: Set<string> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isStopped: boolean = false;
  private connectionStartTime: number = 0;
  private lastMessageTime: number = 0;
  private performanceMetrics: {
    messagesProcessed: number;
    tokensDetected: number;
    avgProcessingTime: number;
    connectionUptime: number;
    reconnects: number;
  } = {
    messagesProcessed: 0,
    tokensDetected: 0,
    avgProcessingTime: 0,
    connectionUptime: 0,
    reconnects: 0
  };

  constructor(db: Database, eventStore: EventStore, config: Partial<WSConfig> = {}) {
    super();
    this.db = db;
    this.eventStore = eventStore;
    this.config = {
      wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
      restUrl: 'https://api.bithumb.com/public/ticker/ALL_KRW',
      debounceMs: 10000, // 10s comme requis
      warmupMs: 5000,    // 5s comme requis
      maxReconnectAttempts: 10,
      reconnectIntervalMs: 5000,
      heartbeatIntervalMs: 25000, // 25-30s comme requis
      connectionTimeoutMs: 15000,
      ...config
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ BithumbWSWatcher déjà en cours d\'exécution');
      return;
    }

    console.log('🔌 Démarrage du BithumbWSWatcher...');
    console.log(`🌐 WebSocket URL: ${this.config.wsUrl}`);
    console.log(`🔍 REST URL: ${this.config.restUrl}`);
    console.log(`⏳ Warm-up: ${this.config.warmupMs}ms, Debounce: ${this.config.debounceMs}ms`);

    this.isRunning = true;
    this.isStopped = false;
    await this.connect();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🛑 Arrêt du BithumbWSWatcher...');
    this.isStopped = true;
    this.isRunning = false;

    this.cleanupTimers();
    await this.disconnect();
    this.stopHeartbeat();
  }

  private async connect(): Promise<void> {
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    try {
      console.log('🔌 Connexion au WebSocket Bithumb...');
      
      this.ws = new WebSocket(this.config.wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ Connexion WebSocket Bithumb établie');
        this.reconnectAttempts = 0;
        this.isConnected = true;
        this.connectionStartTime = Date.now();
        
        // Envoyer l'abonnement aux tickers KRW
        this.subscribeToKRWTickers();
        
        // Démarrer le heartbeat
        this.startHeartbeat();
        
        // Démarrer le warm-up (5s comme requis)
        this.startWarmup();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString());
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.warn('⚠️ Erreur lors du parsing du message WebSocket:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket fermé: ${event.code} - ${event.reason || 'Fermeture normale'}`);
        this.isConnected = false;
        this.stopHeartbeat();
        
        // Gérer les reconnexions
        if (event.code !== 1000) { // 1000 = fermeture normale
          this.handleReconnection();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ Erreur WebSocket:', error);
        this.isConnected = false;
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de la création du WebSocket:', error);
      this.handleReconnection();
    }
  }

  private subscribeToKRWTickers(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      // S'abonner aux tickers KRW
      const subscribeMessage = {
        type: 'ticker',
        symbols: ['ALL_KRW'],
        tickTypes: ['1H']
      };

      this.ws.send(JSON.stringify(subscribeMessage));
      console.log('📡 Abonnement aux tickers KRW envoyé');

    } catch (error) {
      console.error('❌ Erreur lors de l\'abonnement:', error);
    }
  }

  private processTicker(content: any): void {
    try {
      const symbol = content.symbol;
      if (!symbol) return;

      // Extraire la base du symbole (ex: BTC_KRW -> BTC)
      const base = this.extractBaseFromSymbol(symbol);
      if (!base) return;

      // Vérifier que c'est un nouveau token
      this.checkNewToken(base, symbol);

    } catch (error) {
      console.error('❌ Erreur lors du traitement du ticker:', error);
    }
  }

  private extractBaseFromSymbol(symbol: string): string | null {
    // Format attendu: BASE_KRW (ex: BTC_KRW)
    const parts = symbol.split('_');
    if (parts.length !== 2) return null;

    const base = parts[0];
    if (!base || typeof base !== 'string') return null;
    
    // ⚠️ Ignorer les symboles 1 caractère (W, T, etc.) comme requis
    if (base.length === 1) {
      console.log(`⚠️ Symbole 1 caractère ignoré: ${base} (${symbol})`);
      return null;
    }
    
    // Filtrer les tokens stables
    if (['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'].includes(base)) {
      return null;
    }

    // Vérifier que la base est valide (lettres majuscules et chiffres)
    if (!/^[A-Z0-9.]+$/.test(base)) {
      return null;
    }

    return base;
  }

  private async checkNewToken(base: string, symbol: string): Promise<void> {
    // Éviter le traitement simultané d'une même base (mutex)
    if (this.baseMutex.has(base)) {
      console.log(`🔒 Base ${base} déjà en traitement (mutex)`);
      return;
    }

    this.baseMutex.add(base);

    try {
      // Vérifier que le token n'est pas déjà dans la baseline
      const isInBaseline = await this.isInBaselineKR(base);
      if (isInBaseline) {
        console.log(`ℹ️ Token ${base} déjà dans la baseline KR, ignoré`);
        return;
      }

      // Vérifier le cooldown
      const isInCooldown = await this.isInCooldown(base);
      if (isInCooldown) {
        console.log(`⏳ Token ${base} en cooldown, ignoré`);
        return;
      }

      // Debounce 10s par base comme requis
      if (this.debounceTimers.has(base)) {
        clearTimeout(this.debounceTimers.get(base)!);
      }

      this.debounceTimers.set(base, setTimeout(async () => {
        await this.handleNewToken(base, symbol);
        this.debounceTimers.delete(base);
      }, this.config.debounceMs));

    } finally {
      this.baseMutex.delete(base);
    }
  }

  private async handleNewToken(base: string, symbol: string): Promise<void> {
    console.log(`🔍 Nouveau token potentiel détecté via WS: ${base} (${symbol})`);

    // Double-check REST après 3-5s comme requis
    const delay = 3000 + Math.random() * 2000; // 3-5s aléatoire
    
    this.doubleCheckTimers.set(base, setTimeout(async () => {
      await this.performDoubleCheckREST(base, symbol);
      this.doubleCheckTimers.delete(base);
    }, delay));
    
    console.log(`⏳ Double-check REST programmé pour ${base} dans ${Math.round(delay)}ms`);
  }

  private async performDoubleCheckREST(base: string, symbol: string): Promise<void> {
    try {
      console.log(`🔍 Double-check REST pour ${base}...`);
      
      const isConfirmed = await this.doubleCheckREST(base);
      
      if (isConfirmed) {
        console.log(`✅ Nouveau token confirmé via REST: ${base}`);
        
        // Générer l'event ID déterministe (bithumb.ws|base|KRW)
        const eventId = this.generateEventId(base);
        
        // Vérifier que l'événement n'a pas déjà été traité
        const isEventProcessed = await this.isEventProcessed(eventId);
        if (isEventProcessed) {
          console.log(`ℹ️ Événement WS déjà traité pour ${base}`);
          return;
        }

        // Ajouter l'événement traité
        await this.addProcessedEvent(eventId, base, 'bithumb.ws');
        
        console.log(`🆕 Nouveau listing détecté via WebSocket: ${base}`);
        
        // Émettre l'événement pour traitement
        this.emit('newToken', {
          base,
          symbol,
          source: 'bithumb.ws' as const,
          eventId,
          confirmed: true
        });

        // Ajouter au cooldown
        await this.addCooldown(base, 'ws_detected', 24);
        
        this.performanceMetrics.tokensDetected++;
      } else {
        console.log(`❌ Faux positif détecté pour ${base} - pas dans REST`);
      }

    } catch (error) {
      console.error(`❌ Erreur lors du double-check REST pour ${base}:`, error);
    }
  }

  private async doubleCheckREST(base: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.bithumb.com/public/ticker/${base}_KRW`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as BithumbRESTResponse;
      
      if (data.status === '0000' && data.data) {
        // Vérifier si la base est présente dans la réponse REST
        const symbol = `${base}_KRW`;
        return data.data.hasOwnProperty(symbol);
      }

      return false;

    } catch (error) {
      console.error(`❌ Erreur lors du double-check REST pour ${base}:`, error);
      return false; // En cas d'erreur, on considère que c'est un faux positif
    }
  }

  private generateEventId(base: string): string {
    // EventId déterministe via EventId builder centralisé
            const eventId = buildEventId({
          source: 'bithumb.ws',
          base,
          url: '',
          markets: ['KRW'],
          tradeTimeUtc: ''
        });
    
    console.log(`🔑 Generated WS eventId: ${eventId.substring(0, 8)}...`);
    return eventId;
  }

  private async isInBaselineKR(base: string): Promise<boolean> {
    const result = await this.db.get(
      'SELECT 1 FROM baseline_kr WHERE base = ?',
      [base]
    );
    return !!result;
  }

  private async isInCooldown(base: string): Promise<boolean> {
    const result = await this.db.get(
      'SELECT 1 FROM cooldowns WHERE base = ? AND expires_at_utc > datetime("now")',
      [base]
    );
    return !!result;
  }

  private async isEventProcessed(eventId: string): Promise<boolean> {
    return await this.eventStore.isProcessed(eventId);
  }

  private async addProcessedEvent(eventId: string, base: string, source: string): Promise<void> {
    try {
      const dedupResult = await this.eventStore.tryMarkProcessed({
        eventId,
        source: source === 'bithumb.ws' ? 'bithumb.ws' : 'bithumb.notice',
        base,
        url: '',
        markets: ['KRW'],
        tradeTimeUtc: '',
        rawTitle: `WS Event ${base}`
      });
      
      if (dedupResult === 'INSERTED') {
        console.log(`✅ [DEDUP] INSERTED ${eventId.substring(0, 8)}... base=${base} source=${source}`);
      } else {
        console.log(`⏭️ [DEDUP] DUPLICATE ${eventId.substring(0, 8)}... base=${base} source=${source}`);
      }
    } catch (error) {
      console.error(`❌ [DEDUP] Error in WebSocket deduplication:`, error);
    }
  }

  private async addCooldown(base: string, reason: string, hours: number): Promise<void> {
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    await this.db.run(
      'INSERT OR REPLACE INTO cooldowns (base, expires_at_utc, reason, created_at_utc) VALUES (?, ?, ?, datetime("now"))',
      [base, expiresAt, reason]
    );
  }

  private startWarmup(): void {
    if (this.warmupTimer) {
      clearTimeout(this.warmupTimer);
    }

    this.warmupTimer = setTimeout(() => {
      console.log('🔥 Warm-up terminé (5s), surveillance active');
      this.warmupTimer = null;
    }, this.config.warmupMs);

    console.log(`⏳ Warm-up en cours (${this.config.warmupMs}ms)`);
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Envoyer un ping toutes les 25-30s comme requis
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          // Envoyer un ping simple
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.warn('⚠️ Erreur lors de l\'envoi du heartbeat:', error);
        }
      }
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('🚨 Nombre maximum de tentatives de reconnexion atteint');
      this.stop();
      return;
    }
    
    this.reconnectAttempts++;
    this.performanceMetrics.reconnects++;
    
    // Backoff exponentiel: 1→2→4... max 60s comme requis
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 60000);
    
    console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} dans ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isStopped) {
        this.setupWebSocket();
      }
    }, delay);
  }

  private async disconnect(): Promise<void> {
    if (this.ws) {
      // Vérifier l'état avant de fermer
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Graceful shutdown');
      }
      
      // Retirer tous les listeners après fermeture
      this.ws.removeAllListeners();
      this.ws = null;
    }
  }

  private cleanupTimers(): void {
    if (this.warmupTimer) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Nettoyer tous les timers de debounce
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Nettoyer tous les timers de double-check
    for (const timer of this.doubleCheckTimers.values()) {
      clearTimeout(timer);
    }
    this.doubleCheckTimers.clear();
  }

  private handleWebSocketMessage(data: any): void {
    this.lastMessageTime = Date.now();
    this.performanceMetrics.messagesProcessed++;
    
    try {
      if (data.type === 'ticker' && data.content) {
        this.processTicker(data.content);
      } else if (data.type === 'pong') {
        // Réponse au ping
        console.log('🏓 Pong reçu');
      }
    } catch (error) {
      console.error('❌ Erreur lors du traitement du message:', error);
    }
  }

  getMetrics(): any {
    const now = Date.now();
    return {
      ...this.performanceMetrics,
      connectionUptime: this.isConnected ? now - this.connectionStartTime : 0,
      isConnected: this.isConnected,
      isRunning: this.isRunning,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}
