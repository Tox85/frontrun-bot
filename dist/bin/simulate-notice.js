#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TokenRegistry_1 = require("../store/TokenRegistry");
const TelegramService_1 = require("../notify/TelegramService");
const BithumbNoticePoller_1 = require("../watchers/BithumbNoticePoller");
const sqlite3_1 = require("sqlite3");
async function simulateNotice() {
    console.log('🚀 Simulation du NoticePoller...');
    try {
        // Créer une base de données temporaire
        const db = new sqlite3_1.Database(':memory:');
        // Initialiser le TokenRegistry
        const tokenRegistry = new TokenRegistry_1.TokenRegistry(db);
        await tokenRegistry.initialize();
        // Créer un TelegramService mock
        const telegramService = new TelegramService_1.TelegramService({
            botToken: 'mock-token',
            chatId: 'mock-chat'
        });
        // Créer le poller avec la nouvelle signature
        const poller = new BithumbNoticePoller_1.BithumbNoticePoller(tokenRegistry, telegramService, {
            pollIntervalMs: 5000,
            maxNoticesPerPoll: 5,
            enableTelegram: true,
            enableLogging: true
        });
        console.log('✅ NoticePoller créé avec succès');
        // Simuler une notice
        const mockNotice = {
            eventId: 'mock-event-123',
            base: 'TEST',
            title: 'Test Notice',
            url: 'https://test.com',
            publishedAtUtc: new Date().toISOString(),
            priority: 'high',
            status: 'live',
            source: 'bithumb.api'
        };
        // Tester le traitement de la notice
        await poller['processNotice'](mockNotice);
        console.log('✅ Simulation terminée avec succès');
    }
    catch (error) {
        console.error('❌ Erreur lors de la simulation:', error);
    }
}
// Lancer la simulation
simulateNotice().catch(console.error);
//# sourceMappingURL=simulate-notice.js.map