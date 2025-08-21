"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeExecutor = void 0;
const Latency_1 = require("../metrics/Latency");
class TradeExecutor {
    hyperliquid;
    exitScheduler;
    positionSizer;
    baselineManager;
    perpCatalog;
    telegramService;
    config;
    activeTrades = new Map();
    cooldowns = new Map();
    // Métriques pour le self-test
    tradesOpenedCount = 0;
    exitPendingCount = 0;
    constructor(hyperliquid, exitScheduler, positionSizer, baselineManager, perpCatalog, telegramService, config) {
        this.hyperliquid = hyperliquid;
        this.exitScheduler = exitScheduler;
        this.positionSizer = positionSizer;
        this.baselineManager = baselineManager;
        this.perpCatalog = perpCatalog;
        this.telegramService = telegramService;
        this.config = config;
    }
    /**
     * Exécute un trade d'opportunité (T0 ou T2)
     */
    async executeOpportunity(opportunity) {
        try {
            console.log(`🎯 Exécution de l'opportunité: ${opportunity.token} (${opportunity.source})`);
            console.log(`🧪 DEBUG: bypassBaseline: ${opportunity.bypassBaseline}, bypassCooldown: ${opportunity.bypassCooldown}, dryRun: ${opportunity.dryRun}`);
            // Créer un eventId pour le tracking de latence
            const eventId = `trade_${opportunity.token}_${Date.now()}`;
            // PATCH E: beginIfAbsent pour éviter les logs "already exists"
            Latency_1.latency.beginIfAbsent(eventId);
            // 1. Vérifier le cooldown (sauf si bypassCooldown=true)
            if (!opportunity.bypassCooldown && this.isInCooldown(opportunity.token)) {
                console.log(`⏰ ${opportunity.token} en cooldown, trade ignoré`);
                return null;
            }
            // 2. Vérifier que le token n'est pas déjà dans la baseline (sauf si bypassBaseline=true)
            if (!opportunity.bypassBaseline) {
                const isNew = await this.baselineManager.isTokenNew(opportunity.token);
                if (!isNew) {
                    console.log(`📚 ${opportunity.token} déjà dans la baseline, trade ignoré`);
                    return null;
                }
            }
            else {
                console.log(`🧪 DEBUG: Bypass baseline activé pour ${opportunity.token}`);
            }
            // 3. Vérifier la disponibilité sur Hyperliquid
            const isAvailable = await this.hyperliquid.isSymbolTradable(opportunity.token);
            if (!isAvailable) {
                console.log(`❌ ${opportunity.token} non disponible sur Hyperliquid`);
                return null;
            }
            // 4. Obtenir le prix actuel
            const currentPrice = await this.hyperliquid.getCurrentPrice(opportunity.token);
            if (!currentPrice) {
                console.log(`❌ Impossible d'obtenir le prix pour ${opportunity.token}`);
                return null;
            }
            // 5. Calculer la taille de position
            const balance = await this.hyperliquid.getBalance();
            const positionSize = this.positionSizer.calculatePositionSize(balance.usd, 'HYPERLIQUID', opportunity.token, currentPrice, this.config.riskPct);
            if (positionSize.notional <= 0) {
                console.log(`❌ Taille de position invalide pour ${opportunity.token}`);
                return null;
            }
            // 6. Marquer order_sent et exécuter le trade
            Latency_1.latency.mark(eventId, 'order_sent');
            const tradeResult = await this.executeLongPosition(opportunity.token, positionSize.notional, currentPrice, positionSize.leverage, opportunity.dryRun);
            // Marquer order_ack (succès ou échec)
            Latency_1.latency.mark(eventId, 'order_ack');
            if (tradeResult.success) {
                // 7. Programmer la sortie
                await this.scheduleExit(opportunity.token, tradeResult.positionId, positionSize);
                // 8. Ajouter au cooldown
                this.setCooldown(opportunity.token);
                // 9. Notifier Telegram
                await this.notifyTradeSuccess(tradeResult, opportunity);
            }
            return tradeResult;
        }
        catch (error) {
            console.error(`❌ Erreur lors de l'exécution de l'opportunité ${opportunity.token}:`, error);
            const errorResult = {
                success: false,
                token: opportunity.token,
                action: 'BUY',
                amount: 0,
                price: 0,
                leverage: 0,
                error: error instanceof Error ? error.message : 'Erreur inconnue',
                timestamp: new Date().toISOString()
            };
            await this.notifyTradeError(errorResult, opportunity);
            return errorResult;
        }
    }
    /**
     * Exécute une position longue sur Hyperliquid
     */
    async executeLongPosition(token, amount, price, leverage, dryRun) {
        try {
            // Mode self-test ou dry-run: simulation complète sans réseau
            const shouldDryRun = dryRun || process.env.SELFTEST_MODE === 'true' && process.env.TRADING_DRY_RUN_ON_SELFTEST === 'true';
            if (shouldDryRun) {
                console.log(`🧪 DRY-RUN: Position longue simulée pour ${token}`);
                // Simuler order_sent puis ack (succès) sans requête réseau
                const mockResult = {
                    success: true,
                    token,
                    action: 'BUY',
                    amount,
                    price,
                    leverage,
                    positionId: `mock_${Date.now()}`,
                    timestamp: new Date().toISOString()
                };
                // Incrémenter trades_opened pour le self-test
                this.incrementTradesOpened();
                // Programmer un petit exit de test (+5s) marqué EXECUTED localement
                setTimeout(() => {
                    this.incrementExitPending();
                    console.log(`🧪 SELFTEST_MODE: Exit planifié pour ${token} (simulé)`);
                }, 5000);
                return mockResult;
            }
            console.log(`💰 Exécution position longue: ${token} - ${amount} @ ${price} (levier: ${leverage})`);
            // Exécuter le trade sur Hyperliquid
            const order = await this.hyperliquid.openLongPosition(token, amount, leverage);
            const result = {
                success: true,
                token,
                action: 'BUY',
                amount,
                price,
                leverage,
                positionId: order.positionId,
                timestamp: new Date().toISOString()
            };
            console.log(`✅ Position ouverte avec succès: ${order.positionId}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Erreur lors de l'ouverture de la position ${token}:`, error);
            throw error;
        }
    }
    /**
     * Programme la sortie de position
     */
    async scheduleExit(token, positionId, positionSize) {
        try {
            // Stratégie de sortie: 50% après 1h, 50% après 4h
            const exit1h = new Date(Date.now() + 60 * 60 * 1000); // +1h
            const exit4h = new Date(Date.now() + 4 * 60 * 60 * 1000); // +4h
            await this.exitScheduler.scheduleExit('HYPERLIQUID', token, positionSize.notional * 0.5, // 50% de la position
            60 * 60 * 1000, // 1h
            { originalOrderId: positionId, reason: 'PARTIAL_EXIT_1H' });
            await this.exitScheduler.scheduleExit('HYPERLIQUID', token, positionSize.notional, // 100% de la position
            4 * 60 * 60 * 1000, // 4h
            { originalOrderId: positionId, reason: 'FULL_EXIT_4H' });
            console.log(`⏰ Sorties programmées pour ${token}: 50% à ${exit1h.toISOString()}, 100% à ${exit4h.toISOString()}`);
        }
        catch (error) {
            console.error(`❌ Erreur lors de la programmation des sorties pour ${token}:`, error);
        }
    }
    /**
     * Vérifie si un token est en cooldown
     */
    isInCooldown(token) {
        const cooldownUntil = this.cooldowns.get(token);
        if (!cooldownUntil)
            return false;
        return Date.now() < cooldownUntil;
    }
    /**
     * Définit le cooldown pour un token
     */
    setCooldown(token) {
        const cooldownMs = this.config.cooldownHours * 60 * 60 * 1000;
        this.cooldowns.set(token, Date.now() + cooldownMs);
        console.log(`⏰ Cooldown défini pour ${token}: ${this.config.cooldownHours}h`);
    }
    /**
     * Notifie le succès d'un trade
     */
    async notifyTradeSuccess(trade, opportunity) {
        try {
            if (this.telegramService) {
                await this.telegramService.sendTradeExecuted(trade.token, 'HYPERLIQUID', 'long', trade.amount, trade.price);
            }
        }
        catch (error) {
            console.error('❌ Erreur lors de la notification de succès:', error);
        }
    }
    /**
     * Notifie l'erreur d'un trade
     */
    async notifyTradeError(trade, opportunity) {
        try {
            if (this.telegramService) {
                await this.telegramService.sendTradeError(trade.token, trade.error);
            }
        }
        catch (error) {
            console.error('❌ Erreur lors de la notification d\'erreur:', error);
        }
    }
    /**
     * Obtient le statut des trades actifs
     */
    getActiveTrades() {
        return new Map(this.activeTrades);
    }
    /**
     * Obtient le statut des cooldowns
     */
    getCooldownStatus() {
        const now = Date.now();
        return Array.from(this.cooldowns.entries()).map(([token, cooldownUntil]) => ({
            token,
            cooldownUntil: new Date(cooldownUntil).toISOString(),
            remainingMs: Math.max(0, cooldownUntil - now)
        }));
    }
    /**
     * Arrête l'exécuteur de trades
     */
    async stop() {
        console.log('🛑 Arrêt du TradeExecutor...');
        // Sauvegarder les cooldowns
        // TODO: Persister les cooldowns en base
        console.log('✅ TradeExecutor arrêté');
    }
    /**
     * Méthodes pour le self-test
     */
    incrementTradesOpened() {
        this.tradesOpenedCount++;
    }
    incrementExitPending() {
        this.exitPendingCount++;
    }
    /**
     * Obtient les métriques pour le self-test
     */
    getSelfTestMetrics() {
        return {
            tradesOpened: this.tradesOpenedCount,
            exitPending: this.exitPendingCount
        };
    }
}
exports.TradeExecutor = TradeExecutor;
//# sourceMappingURL=TradeExecutor.js.map