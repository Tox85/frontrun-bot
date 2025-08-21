#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const NoticeClient_1 = require("../watchers/NoticeClient");
const TelegramService_1 = require("../notify/TelegramService");
const BaselineManager_1 = require("../core/BaselineManager");
const Migrations_1 = require("../store/Migrations");
const WatermarkStore_1 = require("../store/WatermarkStore");
const HttpClient_1 = require("../core/HttpClient");
async function simulateNotice() {
    console.log('🚀 Simulation du NoticeClient...');
    try {
        // Créer une base de données temporaire
        const db = new sqlite3_1.Database(':memory:');
        // Exécuter les migrations
        const migrationRunner = new Migrations_1.MigrationRunner(db);
        await migrationRunner.runMigrations();
        console.log('✅ Migrations exécutées');
        // Initialiser le BaselineManager
        const baselineManager = new BaselineManager_1.BaselineManager(db);
        await baselineManager.initialize();
        console.log('✅ BaselineManager initialisé');
        // Créer un TelegramService mock
        const telegramService = new TelegramService_1.TelegramService({
            botToken: 'mock-token',
            chatId: 'mock-chat'
        });
        // Créer le WatermarkStore
        const watermarkStore = new WatermarkStore_1.WatermarkStore(db);
        await watermarkStore.initializeAtBoot('bithumb.notice');
        // Créer le NoticeClient
        const noticeClient = new NoticeClient_1.NoticeClient('https://api.bithumb.com/v1/notices', new HttpClient_1.HttpClient('NoticeClient', {
            timeoutMs: 5000,
            maxRetries: 3,
            baseRetryDelayMs: 250,
            maxRetryDelayMs: 500,
            jitterPercent: 20
        }), watermarkStore, 60000, // logDedupWindowMs
        2 // logDedupMaxPerWindow
        );
        console.log('✅ NoticeClient créé avec succès');
        // Simuler une notice
        const mockNotice = {
            id: Date.now(),
            title: '원화 마켓 신규 상장: TEST',
            categories: ['공지', '마켓'],
            pc_url: 'https://test.com',
            published_at: new Date().toISOString()
        };
        // Tester le traitement de la notice
        const processedResults = await noticeClient.processNotice(mockNotice);
        if (processedResults && processedResults.length > 0) {
            // Prendre le premier résultat pour la simulation
            const processed = processedResults[0];
            if (!processed) {
                console.log('⚠️ Notice non traitée (pas de résultat valide)');
                return;
            }
            console.log('✅ Notice traitée avec succès:', {
                base: processed.base,
                eventId: processed.eventId,
                source: processed.source
            });
            // Vérifier si c'est un nouveau token
            const isNew = await baselineManager.isTokenNew(processed.base);
            console.log(`🔍 Token ${processed.base} est nouveau: ${isNew}`);
            if (isNew) {
                // Enregistrer l'événement
                await db.run('INSERT OR IGNORE INTO processed_events (event_id, base, source, url, created_at_utc) VALUES (?, ?, ?, ?, datetime("now"))', [processed.eventId, processed.base, processed.source, processed.url]);
                console.log('✅ Événement enregistré en DB');
                // Notification Telegram
                await telegramService.sendMessage(`🧪 **SIMULATION NOTICE** 🧪\n\n**Token:** \`${processed.base}\`\n**Source:** ${processed.source}`);
                console.log('✅ Notification Telegram envoyée');
            }
        }
        else {
            console.log('⚠️ Notice non traitée (pas un listing)');
        }
        console.log('✅ Simulation terminée avec succès');
    }
    catch (error) {
        console.error('❌ Erreur lors de la simulation:', error);
    }
}
// Lancer la simulation
simulateNotice().catch(console.error);
//# sourceMappingURL=simulate-notice.js.map