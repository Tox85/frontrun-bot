#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const EventStore_1 = require("../core/EventStore");
const EventId_1 = require("../core/EventId");
const Timing_1 = require("../core/Timing");
async function testUnifiedSystem() {
    console.log('🧪 Test du système unifié EventId');
    try {
        // Ouvrir la base de données
        const dbPath = process.env.SQLITE_PATH || './data/bot.db';
        const db = new sqlite3_1.Database(dbPath);
        // Créer l'EventStore
        const eventStore = new EventStore_1.EventStore(db);
        console.log('✅ EventStore initialisé');
        // Test 1: Génération d'eventId unifié
        console.log('\n🔑 Test 1: Génération d\'eventId unifié');
        const eventId1 = (0, EventId_1.buildEventId)({
            source: 'bithumb.notice',
            base: 'ABC',
            url: 'https://www.bithumb.com/notice/view/123',
            markets: ['KRW'],
            tradeTimeUtc: '2024-01-01T12:00:00Z'
        });
        const eventId2 = (0, EventId_1.buildEventId)({
            source: 'bithumb.notice',
            base: 'ABC',
            url: 'https://www.bithumb.com/notice/view/123',
            markets: ['KRW'],
            tradeTimeUtc: '2024-01-01T12:00:00Z'
        });
        console.log(`EventId 1: ${eventId1.substring(0, 16)}...`);
        console.log(`EventId 2: ${eventId2.substring(0, 16)}...`);
        console.log(`✅ Déterministe: ${eventId1 === eventId2 ? 'OUI' : 'NON'}`);
        // Test 2: Classification timing
        console.log('\n⏰ Test 2: Classification timing');
        const now = new Date();
        const future = new Date(now.getTime() + 30 * 60 * 1000); // +30min
        const past = new Date(now.getTime() - 30 * 60 * 1000); // -30min
        console.log(`Maintenant: ${now.toISOString()}`);
        console.log(`Future (+30min): ${future.toISOString()}`);
        console.log(`Past (-30min): ${past.toISOString()}`);
        console.log(`Timing maintenant: ${(0, Timing_1.classifyListingTiming)(now)}`);
        console.log(`Timing future: ${(0, Timing_1.classifyListingTiming)(future)}`);
        console.log(`Timing past: ${(0, Timing_1.classifyListingTiming)(past)}`);
        console.log(`Timing null: ${(0, Timing_1.classifyListingTiming)(null)}`);
        // Test 3: Déduplication avec le nouveau schéma
        console.log('\n📝 Test 3: Déduplication avec le nouveau schéma');
        const result1 = await eventStore.tryMarkProcessed({
            eventId: eventId1,
            source: 'bithumb.notice',
            base: 'ABC',
            url: 'https://www.bithumb.com/notice/view/123',
            markets: ['KRW'],
            tradeTimeUtc: '2024-01-01T12:00:00Z',
            rawTitle: 'Test Notice ABC'
        });
        console.log(`Premier appel: ${result1}`);
        const result2 = await eventStore.tryMarkProcessed({
            eventId: eventId1,
            source: 'bithumb.notice',
            base: 'ABC',
            url: 'https://www.bithumb.com/notice/view/123',
            markets: ['KRW'],
            tradeTimeUtc: '2024-01-01T12:00:00Z',
            rawTitle: 'Test Notice ABC'
        });
        console.log(`Deuxième appel: ${result2}`);
        // Test 4: Vérifier les événements récents
        console.log('\n🕒 Test 4: Événements récents');
        const recentEvents = await eventStore.getRecentEvents(5);
        console.log(`Événements récents: ${recentEvents.length}`);
        recentEvents.forEach((event, index) => {
            console.log(`  ${index + 1}. ${event.event_id.substring(0, 16)}... | ${event.base} | ${event.source}`);
        });
        // Fermer la base de données
        db.close();
        console.log('\n✅ Test du système unifié terminé avec succès');
    }
    catch (error) {
        console.error('❌ Erreur lors du test:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    testUnifiedSystem();
}
//# sourceMappingURL=test-unified-system.js.map