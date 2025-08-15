"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BithumbWSWatcher = void 0;
const TokenRegistry_1 = require("../store/TokenRegistry");
const events_1 = require("events");
class BithumbWSWatcher extends events_1.EventEmitter {
    config;
    tokenRegistry;
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
    messageBuffer = []; // Buffer pour traitement en batch
    bufferFlushInterval = null;
    connectionStartTime = 0;
    lastMessageTime = 0;
    performanceMetrics = {
        messagesProcessed: 0,
        tokensDetected: 0,
        avgProcessingTime: 0,
        connectionUptime: 0
    };
    constructor(tokenRegistry, config = {}) {
        super();
        this.tokenRegistry = tokenRegistry;
        this.config = {
            wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
            restUrl: 'https://api.bithumb.com/public/ticker/ALL_KRW',
            debounceMs: 1000,
            warmupMs: 5000,
            maxReconnectAttempts: 10,
            reconnectIntervalMs: 5000,
            heartbeatIntervalMs: 30000,
            aggressiveMode: true, // Mode agressif par défaut
            connectionTimeoutMs: 15000,
            messageBufferSize: 50,
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
        this.stopMessageBuffer();
    }
    async connect() {
        this.setupWebSocket();
    }
    setupWebSocket() {
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
                // Démarrer le buffer de messages
                this.startMessageBuffer();
                // Démarrer le warm-up
                this.startWarmup();
            };
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
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
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
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
        // Éviter le traitement simultané d'une même base
        if (this.baseMutex.has(base)) {
            return;
        }
        this.baseMutex.add(base);
        try {
            // Vérifier que le token n'est pas déjà dans la baseline
            const isInBaseline = await this.tokenRegistry.isInBaselineKR(base);
            if (isInBaseline) {
                console.log(`ℹ️ Token ${base} déjà dans la baseline KR, ignoré`);
                return;
            }
            // Vérifier le cooldown
            const isInCooldown = await this.tokenRegistry.isInCooldown(base);
            if (isInCooldown) {
                console.log(`⏳ Token ${base} en cooldown, ignoré`);
                return;
            }
            // Debounce pour éviter le spam
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
        // Double-check REST pour éviter les faux positifs
        const isConfirmed = await this.doubleCheckREST(base);
        if (isConfirmed) {
            console.log(`✅ Nouveau token confirmé via REST: ${base}`);
            // Générer l'event ID
            const eventId = TokenRegistry_1.TokenRegistry.generateEventId('bithumb.ws', base);
            // Vérifier que l'événement n'a pas déjà été traité
            const isEventProcessed = await this.tokenRegistry.isEventProcessed(eventId);
            if (isEventProcessed) {
                console.log(`ℹ️ Événement WS déjà traité pour ${base}`);
                return;
            }
            // Ajouter l'événement traité
            const isNewEvent = await this.tokenRegistry.addProcessedEvent({
                eventId,
                source: 'bithumb.ws',
                base,
                url: '',
                tradeTimeUtc: undefined
            });
            if (isNewEvent) {
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
                await this.tokenRegistry.addCooldown(base, 'ws_detected', 24);
            }
        }
        else {
            console.log(`❌ Faux positif détecté pour ${base} - pas dans REST`);
        }
    }
    async doubleCheckREST(base) {
        try {
            console.log(`🔍 Double-check REST pour ${base}...`);
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
    startWarmup() {
        if (this.warmupTimer) {
            clearTimeout(this.warmupTimer);
        }
        this.warmupTimer = setTimeout(() => {
            console.log('🔥 Warm-up terminé, surveillance active');
            this.warmupTimer = null;
        }, this.config.warmupMs);
        console.log(`⏳ Warm-up en cours (${this.config.warmupMs}ms)`);
    }
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        // Envoyer un ping toutes les 30 secondes
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Backoff exponentiel, max 30s
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
        this.isConnected = false;
    }
    cleanupTimers() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.warmupTimer) {
            clearTimeout(this.warmupTimer);
            this.warmupTimer = null;
        }
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        for (const timer of this.doubleCheckTimers.values()) {
            clearTimeout(timer);
        }
        this.doubleCheckTimers.clear();
    }
    startMessageBuffer() {
        if (this.bufferFlushInterval) {
            clearInterval(this.bufferFlushInterval);
        }
        // Traiter les messages en batch toutes les 100ms pour optimiser les performances
        this.bufferFlushInterval = setInterval(() => {
            if (this.messageBuffer.length > 0) {
                this.processMessageBatch();
            }
        }, 100);
    }
    stopMessageBuffer() {
        if (this.bufferFlushInterval) {
            clearInterval(this.bufferFlushInterval);
            this.bufferFlushInterval = null;
        }
        // Traiter les messages restants
        if (this.messageBuffer.length > 0) {
            this.processMessageBatch();
        }
    }
    processMessageBatch() {
        const startTime = Date.now();
        const batch = [...this.messageBuffer];
        this.messageBuffer = [];
        // Traitement parallèle des messages
        const processingPromises = batch.map(message => this.processWebSocketMessage(message));
        Promise.all(processingPromises).then(() => {
            const processingTime = Date.now() - startTime;
            this.performanceMetrics.messagesProcessed += batch.length;
            this.performanceMetrics.avgProcessingTime =
                (this.performanceMetrics.avgProcessingTime + processingTime) / 2;
            if (this.config.aggressiveMode && batch.length > 0) {
                console.log(`⚡ Batch traité: ${batch.length} messages en ${processingTime}ms`);
            }
        });
    }
    handleWebSocketMessage(data) {
        // Ajouter au buffer pour traitement en batch
        this.messageBuffer.push(data);
        // Si le buffer est plein, le traiter immédiatement
        if (this.messageBuffer.length >= this.config.messageBufferSize) {
            this.processMessageBatch();
        }
        this.lastMessageTime = Date.now();
    }
    processWebSocketMessage(data) {
        try {
            if (data.type === 'ticker' && data.content) {
                this.processTicker(data.content);
            }
        }
        catch (error) {
            console.error('❌ Erreur lors du parsing du message WebSocket:', error);
        }
    }
    // Méthode pour obtenir les métriques de performance
    getPerformanceMetrics() {
        const now = Date.now();
        this.performanceMetrics.connectionUptime = this.isConnected ? now - this.connectionStartTime : 0;
        return {
            ...this.performanceMetrics,
            bufferSize: this.messageBuffer.length,
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            lastMessageAge: now - this.lastMessageTime
        };
    }
    // Getters pour le monitoring
    getStatus() {
        return {
            isRunning: this.isRunning,
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            config: this.config
        };
    }
    // Méthode pour forcer une reconnexion (utile pour les tests)
    async forceReconnect() {
        console.log('🔄 Reconnexion forcée...');
        this.cleanupTimers();
        this.reconnectAttempts = 0;
        await this.connect();
    }
}
exports.BithumbWSWatcher = BithumbWSWatcher;
//# sourceMappingURL=BithumbWSWatcher.js.map