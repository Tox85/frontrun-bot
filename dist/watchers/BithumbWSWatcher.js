"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BithumbWSWatcher = void 0;
const events_1 = require("events");
const ws_1 = require("ws");
const EventId_1 = require("../core/EventId");
class BithumbWSWatcher extends events_1.EventEmitter {
    config;
    db;
    eventStore;
    ws = null;
    isRunning = false;
    isConnected = false;
    reconnectAttempts = 0;
    reconnectTimer = null;
    warmupTimer = null;
    debounceTimers = new Map();
    doubleCheckTimers = new Map();
    baseMutex = new Set();
    heartbeatInterval = null;
    isStopped = false;
    connectionStartTime = 0;
    lastMessageTime = 0;
    performanceMetrics = {
        messagesProcessed: 0,
        tokensDetected: 0,
        avgProcessingTime: 0,
        connectionUptime: 0,
        reconnects: 0
    };
    constructor(db, eventStore, config = {}) {
        super();
        this.db = db;
        this.eventStore = eventStore;
        this.config = {
            wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
            restUrl: 'https://api.bithumb.com/public/ticker/ALL_KRW',
            debounceMs: 10000, // 10s comme requis
            warmupMs: 5000, // 5s comme requis
            maxReconnectAttempts: 10,
            reconnectIntervalMs: 5000,
            heartbeatIntervalMs: 25000, // 25-30s comme requis
            connectionTimeoutMs: 15000,
            ...config
        };
    }
    async start() {
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
    stop() {
        if (!this.isRunning)
            return;
        console.log('🛑 Arrêt du BithumbWSWatcher...');
        this.isStopped = true;
        this.isRunning = false;
        this.cleanupTimers();
        this.disconnect();
        this.stopHeartbeat();
    }
    async connect() {
        this.setupWebSocket();
    }
    setupWebSocket() {
        try {
            console.log('🔌 Connexion au WebSocket Bithumb...');
            this.ws = new ws_1.WebSocket(this.config.wsUrl);
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
                }
                catch (error) {
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
        }
        catch (error) {
            console.error('❌ Erreur lors de la création du WebSocket:', error);
            this.handleReconnection();
        }
    }
    subscribeToKRWTickers() {
        if (!this.ws || this.ws.readyState !== ws_1.WebSocket.OPEN)
            return;
        try {
            // S'abonner aux tickers KRW
            const subscribeMessage = {
                type: 'ticker',
                symbols: ['ALL_KRW'],
                tickTypes: ['1H']
            };
            this.ws.send(JSON.stringify(subscribeMessage));
            console.log('📡 Abonnement aux tickers KRW envoyé');
        }
        catch (error) {
            console.error('❌ Erreur lors de l\'abonnement:', error);
        }
    }
    processTicker(content) {
        try {
            const symbol = content.symbol;
            if (!symbol)
                return;
            // Extraire la base du symbole (ex: BTC_KRW -> BTC)
            const base = this.extractBaseFromSymbol(symbol);
            if (!base)
                return;
            // Vérifier que c'est un nouveau token
            this.checkNewToken(base, symbol);
        }
        catch (error) {
            console.error('❌ Erreur lors du traitement du ticker:', error);
        }
    }
    extractBaseFromSymbol(symbol) {
        // Format attendu: BASE_KRW (ex: BTC_KRW)
        const parts = symbol.split('_');
        if (parts.length !== 2)
            return null;
        const base = parts[0];
        if (!base || typeof base !== 'string')
            return null;
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
    async checkNewToken(base, symbol) {
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
                clearTimeout(this.debounceTimers.get(base));
            }
            this.debounceTimers.set(base, setTimeout(async () => {
                await this.handleNewToken(base, symbol);
                this.debounceTimers.delete(base);
            }, this.config.debounceMs));
        }
        finally {
            this.baseMutex.delete(base);
        }
    }
    async handleNewToken(base, symbol) {
        console.log(`🔍 Nouveau token potentiel détecté via WS: ${base} (${symbol})`);
        // Double-check REST après 3-5s comme requis
        const delay = 3000 + Math.random() * 2000; // 3-5s aléatoire
        this.doubleCheckTimers.set(base, setTimeout(async () => {
            await this.performDoubleCheckREST(base, symbol);
            this.doubleCheckTimers.delete(base);
        }, delay));
        console.log(`⏳ Double-check REST programmé pour ${base} dans ${Math.round(delay)}ms`);
    }
    async performDoubleCheckREST(base, symbol) {
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
                    source: 'bithumb.ws',
                    eventId,
                    confirmed: true
                });
                // Ajouter au cooldown
                await this.addCooldown(base, 'ws_detected', 24);
                this.performanceMetrics.tokensDetected++;
            }
            else {
                console.log(`❌ Faux positif détecté pour ${base} - pas dans REST`);
            }
        }
        catch (error) {
            console.error(`❌ Erreur lors du double-check REST pour ${base}:`, error);
        }
    }
    async doubleCheckREST(base) {
        try {
            const response = await fetch(`https://api.bithumb.com/public/ticker/${base}_KRW`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.status === '0000' && data.data) {
                // Vérifier si la base est présente dans la réponse REST
                const symbol = `${base}_KRW`;
                return data.data.hasOwnProperty(symbol);
            }
            return false;
        }
        catch (error) {
            console.error(`❌ Erreur lors du double-check REST pour ${base}:`, error);
            return false; // En cas d'erreur, on considère que c'est un faux positif
        }
    }
    generateEventId(base) {
        // EventId déterministe via EventId builder centralisé
        const eventId = (0, EventId_1.buildEventId)({
            source: 'bithumb.ws',
            base,
            url: '',
            markets: ['KRW'],
            tradeTimeUtc: ''
        });
        console.log(`🔑 Generated WS eventId: ${eventId.substring(0, 8)}...`);
        return eventId;
    }
    async isInBaselineKR(base) {
        const result = await this.db.get('SELECT 1 FROM baseline_kr WHERE base = ?', [base]);
        return !!result;
    }
    async isInCooldown(base) {
        const result = await this.db.get('SELECT 1 FROM cooldowns WHERE base = ? AND expires_at_utc > datetime("now")', [base]);
        return !!result;
    }
    async isEventProcessed(eventId) {
        return await this.eventStore.isProcessed(eventId);
    }
    async addProcessedEvent(eventId, base, source) {
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
            }
            else {
                console.log(`⏭️ [DEDUP] DUPLICATE ${eventId.substring(0, 8)}... base=${base} source=${source}`);
            }
        }
        catch (error) {
            console.error(`❌ [DEDUP] Error in WebSocket deduplication:`, error);
        }
    }
    async addCooldown(base, reason, hours) {
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        await this.db.run('INSERT OR REPLACE INTO cooldowns (base, expires_at_utc, reason, created_at_utc) VALUES (?, ?, ?, datetime("now"))', [base, expiresAt, reason]);
    }
    startWarmup() {
        if (this.warmupTimer) {
            clearTimeout(this.warmupTimer);
        }
        this.warmupTimer = setTimeout(() => {
            console.log('🔥 Warm-up terminé (5s), surveillance active');
            this.warmupTimer = null;
        }, this.config.warmupMs);
        console.log(`⏳ Warm-up en cours (${this.config.warmupMs}ms)`);
    }
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        // Envoyer un ping toutes les 25-30s comme requis
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === ws_1.WebSocket.OPEN) {
                try {
                    // Envoyer un ping simple
                    this.ws.send(JSON.stringify({ type: 'ping' }));
                }
                catch (error) {
                    console.warn('⚠️ Erreur lors de l\'envoi du heartbeat:', error);
                }
            }
        }, this.config.heartbeatIntervalMs);
    }
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    handleReconnection() {
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
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    cleanupTimers() {
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
    handleWebSocketMessage(data) {
        this.lastMessageTime = Date.now();
        this.performanceMetrics.messagesProcessed++;
        try {
            if (data.type === 'ticker' && data.content) {
                this.processTicker(data.content);
            }
            else if (data.type === 'pong') {
                // Réponse au ping
                console.log('🏓 Pong reçu');
            }
        }
        catch (error) {
            console.error('❌ Erreur lors du traitement du message:', error);
        }
    }
    getMetrics() {
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
exports.BithumbWSWatcher = BithumbWSWatcher;
//# sourceMappingURL=BithumbWSWatcher.js.map