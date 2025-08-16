#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const EventStore_1 = require("../core/EventStore");
const EventId_1 = require("../core/EventId");
const Migrations_1 = require("../store/Migrations");
async function testDedup() {
    console.log('🧪 Test de déduplication en conditions réelles');
    try {
        // Ouvrir la base de données
        const dbPath = process.env.SQLITE_PATH || './data/bot.db';
        const db = new sqlite3_1.Database(dbPath);
        // Exécuter les migrations
        const migrationRunner = new Migrations_1.MigrationRunner(db);
        await migrationRunner.runMigrations();
        // Créer l'EventStore
        const eventStore = new EventStore_1.EventStore(db);
        console.log('✅ EventStore initialisé');
        // Test 1: Événement T0 (notice)
        console.log('\n📰 Test 1: Événement T0 (notice)');
        const noticeEventId = (0, EventId_1.buildEventId)({
            source: 'bithumb.notice',
            base: 'TOWNS',
            url: 'https://www.bithumb.com/notice/123',
            markets: ['KRW'],
            tradeTimeUtc: '2024-01-01T12:00:00Z'
        });
        console.log(`🔑 EventId généré: ${noticeEventId.substring(0, 16)}...`);
        // Premier appel - devrait être INSERTED
        const result1 = await eventStore.tryMarkProcessed({
            eventId: noticeEventId,
            source: 'bithumb.notice',
            base: 'TOWNS',
            url: 'https://www.bithumb.com/notice/123',
            markets: ['KRW'],
            tradeTimeUtc: '2024-01-01T12:00:00Z',
            rawTitle: 'Test Notice'
        });
        console.log(`📝 Premier appel: ${result1}`);
        // Deuxième appel avec le même eventId - devrait être DUPLICATE
        const result2 = await eventStore.tryMarkProcessed({
            eventId: noticeEventId,
            source: 'bithumb.notice',
            base: 'TOWNS',
            url: 'https://www.bithumb.com/notice/123',
            markets: ['KRW'],
            tradeTimeUtc: '2024-01-01T12:00:00Z',
            rawTitle: 'Test Notice'
        });
        console.log(`📝 Deuxième appel: ${result2}`);
        // Test 2: Événement T2 (WebSocket)
        console.log('\n🔌 Test 2: Événement T2 (WebSocket)');
        const wsEventId = (0, EventId_1.buildEventId)({
            source: 'bithumb.ws',
            base: 'ETH',
            url: '',
            markets: ['KRW'],
            tradeTimeUtc: ''
        });
        console.log(`🔑 EventId généré: ${wsEventId.substring(0, 16)}...`);
        // Premier appel - devrait être INSERTED
        const result3 = await eventStore.tryMarkProcessed({
            eventId: wsEventId,
            source: 'bithumb.ws',
            base: 'ETH',
            url: '',
            markets: ['KRW'],
            tradeTimeUtc: '',
            rawTitle: 'Test WS'
        });
        console.log(`📝 Premier appel: ${result3}`);
        // Deuxième appel avec le même eventId - devrait être DUPLICATE
        const result4 = await eventStore.tryMarkProcessed({
            eventId: wsEventId,
            source: 'bithumb.ws',
            base: 'ETH',
            url: '',
            markets: ['KRW'],
            tradeTimeUtc: '',
            rawTitle: 'Test WS'
        });
        console.log(`📝 Deuxième appel: ${result4}`);
        // Test 3: Vérifier les statistiques
        console.log('\n📊 Test 3: Statistiques de déduplication');
        const stats = await eventStore.getDedupStats();
        console.log(`Total events: ${stats.total}`);
        console.log('Par source:', stats.bySource);
        console.log('Par base:', stats.byBase);
        // Test 4: Vérifier les événements récents
        console.log('\n🕒 Test 4: Événements récents');
        const recentEvents = await eventStore.getRecentEvents(10);
        console.log(`Événements récents: ${recentEvents.length}`);
        recentEvents.forEach((event, index) => {
            console.log(`  ${index + 1}. ${event.event_id.substring(0, 16)}... | ${event.base} | ${event.source}`);
        });
        // Fermer la base de données
        db.close();
        console.log('\n✅ Test de déduplication terminé avec succès');
    }
    catch (error) {
        console.error('❌ Erreur lors du test:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    testDedup();
}
//# sourceMappingURL=test-dedup.js.map