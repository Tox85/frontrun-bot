"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const events_1 = require("events");
class TelegramService extends events_1.EventEmitter {
    config;
    messageQueue = [];
    isProcessing = false;
    processingTimer = null;
    messageIdCounter = 0;
    isObserverMode = false;
    constructor(config = {}) {
        super();
        this.config = {
            enabled: true,
            botToken: '',
            chatId: '',
            baseUrl: 'https://api.telegram.org/bot',
            queueDelayMs: 1000, // 1 seconde entre les messages
            maxRetries: 3,
            retryBackoffMs: 2000,
            timeoutMs: 10000,
            ...config
        };
    }
    // Configuration du mode observateur
    setObserverMode(enabled) {
        this.isObserverMode = enabled;
        if (enabled) {
            console.log('👁️ TelegramService en mode observateur - aucun message envoyé');
        }
        else {
            console.log('📱 TelegramService en mode normal');
        }
    }
    // Envoi de message avec priorité
    async sendMessage(text, priority = 'medium') {
        if (!this.config.enabled || this.isObserverMode) {
            console.log(`ℹ️ Message ignoré (enabled: ${this.config.enabled}, observer: ${this.isObserverMode}): ${text.substring(0, 100)}...`);
            return 'ignored';
        }
        const messageId = `msg_${++this.messageIdCounter}`;
        const message = {
            id: messageId,
            text,
            priority,
            retryCount: 0,
            maxRetries: this.config.maxRetries,
            createdAt: Date.now()
        };
        // Ajouter à la queue selon la priorité
        this.addToQueue(message);
        // Démarrer le traitement si pas déjà en cours
        this.startProcessing();
        return messageId;
    }
    // Messages spécifiques du bot
    async sendInit(botMode, balances, configSummary) {
        const text = `🚀 Bot Frontrun Bithumb démarré\n\n` +
            `📊 Mode: ${botMode}\n` +
            `💰 Balances:\n${Object.entries(balances).map(([exchange, balance]) => `  ${exchange}: ${balance}`).join('\n')}\n\n` +
            `⚙️ Configuration: ${JSON.stringify(configSummary, null, 2)}`;
        return this.sendMessage(text, 'high');
    }
    async sendListingDetected(event) {
        const text = `🆕 Nouveau listing détecté!\n\n` +
            `🏢 Exchange: ${event.exchange}\n` +
            `🔤 Symbole: ${event.symbol}\n` +
            `📰 Titre: ${event.title}\n` +
            `🔗 URL: ${event.url}\n` +
            `⏰ Détecté: ${event.tsUTC}`;
        return this.sendMessage(text, 'high');
    }
    async sendTradeExecuted(symbol, exchange, side, qty, price) {
        const text = `✅ Trade exécuté!\n\n` +
            `🔤 Symbole: ${symbol}\n` +
            `🏢 Exchange: ${exchange}\n` +
            `📈 Side: ${side.toUpperCase()}\n` +
            `📊 Quantité: ${qty}\n` +
            `💰 Prix: ${price}`;
        return this.sendMessage(text, 'high');
    }
    async sendTradeError(symbol, error) {
        const text = `❌ Erreur de trade!\n\n` +
            `🔤 Symbole: ${symbol}\n` +
            `🚨 Erreur: ${error}`;
        return this.sendMessage(text, 'high');
    }
    async sendExitScheduled(symbol, exchange, dueAt) {
        const text = `⏰ Exit planifié!\n\n` +
            `🔤 Symbole: ${symbol}\n` +
            `🏢 Exchange: ${exchange}\n` +
            `🕐 Sortie prévue: ${dueAt}`;
        return this.sendMessage(text, 'medium');
    }
    async sendExitExecuted(symbol, exchange, pnl) {
        const text = `🔚 Exit exécuté!\n\n` +
            `🔤 Symbole: ${symbol}\n` +
            `🏢 Exchange: ${exchange}\n` +
            `💰 PnL: ${pnl > 0 ? '+' : ''}${pnl}`;
        return this.sendMessage(text, 'medium');
    }
    // Gestion de la queue
    addToQueue(message) {
        // Insérer selon la priorité (high en premier)
        const insertIndex = this.messageQueue.findIndex(m => m.priority === 'low');
        if (insertIndex === -1) {
            this.messageQueue.push(message);
        }
        else {
            this.messageQueue.splice(insertIndex, 0, message);
        }
        console.log(`📝 Message ajouté à la queue: ${message.id} (priorité: ${message.priority})`);
        this.emit('messageQueued', message);
    }
    startProcessing() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        this.processNextMessage();
    }
    async processNextMessage() {
        if (this.messageQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        const message = this.messageQueue.shift();
        try {
            await this.sendToTelegram(message);
            // Attendre le délai configuré avant le message suivant
            this.processingTimer = setTimeout(() => {
                this.processNextMessage();
            }, this.config.queueDelayMs);
        }
        catch (error) {
            console.error(`❌ Erreur lors de l'envoi du message ${message.id}:`, error);
            // Gérer les retries
            if (message.retryCount < message.maxRetries) {
                message.retryCount++;
                const backoffDelay = this.config.retryBackoffMs * Math.pow(2, message.retryCount - 1);
                message.nextRetryAt = Date.now() + backoffDelay;
                // Remettre en queue pour retry
                this.messageQueue.unshift(message);
                console.log(`🔄 Message ${message.id} remis en queue pour retry ${message.retryCount}/${message.maxRetries} dans ${backoffDelay}ms`);
                // Continuer le traitement après le backoff
                this.processingTimer = setTimeout(() => {
                    this.processNextMessage();
                }, backoffDelay);
            }
            else {
                console.error(`🚨 Message ${message.id} abandonné après ${message.maxRetries} tentatives`);
                this.emit('messageFailed', message);
            }
        }
    }
    async sendToTelegram(message) {
        if (!this.config.botToken || !this.config.chatId) {
            throw new Error('Configuration Telegram manquante');
        }
        const url = `${this.config.baseUrl}${this.config.botToken}/sendMessage`;
        const payload = {
            chat_id: this.config.chatId,
            text: message.text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeoutMs)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // Gérer le rate limiting
            if (response.status === 429) {
                const retryAfter = response.headers.get('retry-after');
                if (retryAfter) {
                    const retryAfterMs = parseInt(retryAfter) * 1000;
                    console.log(`⏳ Rate limit atteint, retry après ${retryAfterMs}ms`);
                    // Remettre le message en queue avec le délai spécifié
                    message.nextRetryAt = Date.now() + retryAfterMs;
                    this.messageQueue.unshift(message);
                    // Continuer le traitement après le délai
                    this.processingTimer = setTimeout(() => {
                        this.processNextMessage();
                    }, retryAfterMs);
                    return;
                }
            }
            throw new Error(`HTTP ${response.status}: ${errorData.description || response.statusText}`);
        }
        const result = await response.json();
        if (!result.ok) {
            throw new Error(`Telegram API error: ${result.description}`);
        }
        console.log(`✅ Message ${message.id} envoyé avec succès`);
        this.emit('messageSent', message);
    }
    // Gestion de l'arrêt
    stop() {
        if (this.processingTimer) {
            clearTimeout(this.processingTimer);
            this.processingTimer = null;
        }
        this.isProcessing = false;
        console.log('🛑 TelegramService arrêté');
    }
    // Getters pour le monitoring
    getStatus() {
        return {
            enabled: this.config.enabled,
            observerMode: this.isObserverMode,
            queueLength: this.messageQueue.length,
            isProcessing: this.isProcessing,
            config: this.config
        };
    }
    getQueueStats() {
        const stats = {
            total: this.messageQueue.length,
            byPriority: { high: 0, medium: 0, low: 0 },
            nextRetryCount: 0
        };
        for (const message of this.messageQueue) {
            stats.byPriority[message.priority]++;
            if (message.nextRetryAt && message.nextRetryAt > Date.now()) {
                stats.nextRetryCount++;
            }
        }
        return stats;
    }
    // Méthode pour vider la queue (utile pour les tests)
    clearQueue() {
        this.messageQueue = [];
        console.log('🧹 Queue Telegram vidée');
    }
}
exports.TelegramService = TelegramService;
//# sourceMappingURL=TelegramService.js.map