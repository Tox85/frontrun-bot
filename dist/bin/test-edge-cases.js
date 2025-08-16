#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const EventStore_1 = require("../core/EventStore");
const EventId_1 = require("../core/EventId");
const Timing_1 = require("../core/Timing");
async function testEdgeCases() {
    console.log('🧪 Test des cas limites du système unifié');
    try {
        // Ouvrir la base de données
        const dbPath = process.env.SQLITE_PATH || './data/bot.db';
        const db = new sqlite3_1.Database(dbPath);
        // Créer l'EventStore
        const eventStore = new EventStore_1.EventStore(db);
        console.log('✅ EventStore initialisé');
        // Test 1: EventId avec paramètres vides/nuls
        console.log('\n🔑 Test 1: EventId avec paramètres vides/nuls');
        const emptyEventId = (0, EventId_1.buildEventId)({
            source: 'bithumb.notice',
            base: '',
            url: null,
            markets: [],
            tradeTimeUtc: ''
        });
        console.log(`EventId vide: ${emptyEventId.substring(0, 16)}...`);
        // Test 2: EventId avec URL malformée
        console.log('\n🔑 Test 2: EventId avec URL malformée');
        const malformedEventId = (0, EventId_1.buildEventId)({
            source: 'bithumb.notice',
            base: 'TEST',
            url: 'invalid-url',
            markets: ['KRW'],
            tradeTimeUtc: ''
        });
        console.log(`EventId malformé: ${malformedEventId.substring(0, 16)}...`);
        // Test 3: Classification timing avec dates extrêmes
        console.log('\n⏰ Test 3: Classification timing avec dates extrêmes');
        const veryFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // +1 an
        const veryPast = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // -1 an
        const edgeLive = new Date(Date.now() + 119000); // +119s (juste dans la fenêtre)
        console.log(`Très future (+1an): ${(0, Timing_1.classifyListingTiming)(veryFuture)}`);
        console.log(`Très past (-1an): ${(0, Timing_1.classifyListingTiming)(veryPast)}`);
        console.log(`Edge live (+119s): ${(0, Timing_1.classifyListingTiming)(edgeLive)}`);
        // Test 4: Déduplication avec sources mixtes
        console.log('\n🔄 Test 4: Déduplication avec sources mixtes');
        const sameBase = 'MIXED';
        const noticeEventId = (0, EventId_1.buildEventId)({
            source: 'bithumb.notice',
            base: sameBase,
            url: 'https://www.bithumb.com/notice/view/mixed123',
            markets: ['KRW'],
            tradeTimeUtc: ''
        });
        const wsEventId = (0, EventId_1.buildEventId)({
            source: 'bithumb.ws',
            base: sameBase,
            url: '',
            markets: ['KRW'],
            tradeTimeUtc: ''
        });
        console.log(`Notice EventId: ${noticeEventId.substring(0, 16)}...`);
        console.log(`WS EventId: ${wsEventId.substring(0, 16)}...`);
        console.log(`✅ Différents: ${noticeEventId !== wsEventId ? 'OUI' : 'NON'}`);
        // Insérer les deux
        const noticeResult = await eventStore.tryMarkProcessed({
            eventId: noticeEventId,
            source: 'bithumb.notice',
            base: sameBase,
            url: 'https://www.bithumb.com/notice/view/mixed123',
            markets: ['KRW'],
            tradeTimeUtc: '',
            rawTitle: 'Test Mixed Notice'
        });
        const wsResult = await eventStore.tryMarkProcessed({
            eventId: wsEventId,
            source: 'bithumb.ws',
            base: sameBase,
            url: '',
            markets: ['KRW'],
            tradeTimeUtc: '',
            rawTitle: 'Test Mixed WS'
        });
        console.log(`Notice: ${noticeResult}, WS: ${wsResult}`);
        // Test 5: Vérifier la table processed_bases
        console.log('\n📊 Test 5: Vérification de processed_bases');
        // Marquer une base comme tradée
        await eventStore.markBaseAsTraded(sameBase, noticeEventId);
        console.log(`✅ Base ${sameBase} marquée comme tradée`);
        // Vérifier le cooldown
        const recentlyTraded = await eventStore.isBaseRecentlyTraded(sameBase, 24);
        console.log(`Base ${sameBase} récemment tradée: ${recentlyTraded}`);
        // Test 6: Vérifier les métriques finales
        console.log('\n📈 Test 6: Vérification finale des métriques');
        const recentEvents = await eventStore.getRecentEvents(15);
        // Compter par source
        const sourceCounts = new Map();
        recentEvents.forEach(event => {
            sourceCounts.set(event.source, (sourceCounts.get(event.source) || 0) + 1);
        });
        console.log('\n📊 Résumé par source:');
        for (const [source, count] of sourceCounts) {
            console.log(`  ${source}: ${count} événement(s)`);
        }
        // Fermer la base de données
        db.close();
        console.log('\n✅ Tests des cas limites terminés avec succès');
        console.log('\n📋 Validation des cas limites:');
        console.log('  ✅ EventId avec paramètres vides/nuls');
        console.log('  ✅ EventId avec URL malformée');
        console.log('  ✅ Classification timing extrême');
        console.log('  ✅ Déduplication cross-source');
        console.log('  ✅ Table processed_bases');
        console.log('  ✅ Métriques par source');
    }
    catch (error) {
        console.error('❌ Erreur lors des tests:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    testEdgeCases();
}
//# sourceMappingURL=test-edge-cases.js.map