#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const BithumbWSWatcher_1 = require("../watchers/BithumbWSWatcher");
const BaselineManager_1 = require("../core/BaselineManager");
const Migrations_1 = require("../store/Migrations");
async function simulateWS() {
    console.log('🧪 Simulation de détection T2 (WebSocket)');
    try {
        // Ouvrir la base de données
        const dbPath = process.env.SQLITE_PATH || './data/bot.db';
        const db = new sqlite3_1.Database(dbPath);
        // Exécuter les migrations
        const migrationRunner = new Migrations_1.MigrationRunner(db);
        await migrationRunner.runMigrations();
        console.log('✅ Migrations exécutées');
        // Initialiser le BaselineManager
        const baselineManager = new BaselineManager_1.BaselineManager(db);
        await baselineManager.initialize();
        console.log('✅ BaselineManager initialisé');
        // Créer un EventStore mock pour la simulation
        const { EventStore } = await import('../core/EventStore.js');
        const eventStore = new EventStore(db);
        // Créer le watcher
        const watcher = new BithumbWSWatcher_1.BithumbWSWatcher(db, eventStore, {
            wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
            restUrl: 'https://api.bithumb.com/public/ticker/ALL_KRW',
            debounceMs: 1000, // Réduire pour les tests
            warmupMs: 2000 // Réduire pour les tests
        });
        // Simuler un nouveau token
        const mockToken = {
            base: 'WS_TEST',
            symbol: 'WS_TEST_KRW',
            source: 'bithumb.ws',
            eventId: 'test_ws_event',
            confirmed: true
        };
        console.log('🔌 Token WS simulé:', mockToken);
        // Vérifier si c'est un nouveau token
        const isNew = await baselineManager.isTokenNew(mockToken.base);
        console.log(`🔍 Token ${mockToken.base} est nouveau: ${isNew}`);
        if (isNew) {
            // Simuler la détection via WebSocket
            watcher.emit('newToken', mockToken);
            console.log('✅ Événement WS émis');
            // Vérifier le résultat
            const result = await db.get('SELECT COUNT(*) as count FROM processed_events WHERE base = ?', [mockToken.base]);
            console.log(`\n📊 Événements traités pour ${mockToken.base}: ${result?.count || 0}`);
            // Vérifier la baseline
            const baselineStats = await baselineManager.getBaselineKRStats();
            console.log(`\n📚 Baseline KR: ${baselineStats?.total || 0} tokens`);
            // Vérifier le cooldown
            const cooldownResult = await db.get('SELECT 1 FROM cooldowns WHERE base = ? AND expires_at_utc > datetime("now")', [mockToken.base]);
            const isInCooldown = !!cooldownResult;
            console.log(`⏳ Token en cooldown: ${isInCooldown}`);
        }
        else {
            console.log('⚠️ Token déjà dans la baseline, simulation ignorée');
        }
        // Fermer
        db.close();
        console.log('\n✅ Simulation T2 terminée');
    }
    catch (error) {
        console.error('❌ Erreur lors de la simulation:', error);
        process.exit(1);
    }
}
// Exécuter si appelé directement
if (require.main === module) {
    simulateWS();
}
//# sourceMappingURL=simulate-ws.js.map