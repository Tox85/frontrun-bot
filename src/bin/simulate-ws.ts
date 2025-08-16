#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import { BithumbWSWatcher } from '../watchers/BithumbWSWatcher';
import { BaselineManager } from '../core/BaselineManager';
import { MigrationRunner } from '../store/Migrations';

async function simulateWS(): Promise<void> {
  console.log('🧪 Simulation de détection T2 (WebSocket)');
  
  try {
    // Ouvrir la base de données
    const dbPath = process.env.SQLITE_PATH || './data/bot.db';
    const db = new Database(dbPath);
    
    // Exécuter les migrations
    const migrationRunner = new MigrationRunner(db);
    await migrationRunner.runMigrations();
    console.log('✅ Migrations exécutées');
    
    // Initialiser le BaselineManager
    const baselineManager = new BaselineManager(db);
    await baselineManager.initialize();
    console.log('✅ BaselineManager initialisé');
    
    // Créer un EventStore mock pour la simulation
    const { EventStore } = await import('../core/EventStore.js');
    const eventStore = new EventStore(db);
    
    // Créer le watcher
    const watcher = new BithumbWSWatcher(db, eventStore, {
      wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
      restUrl: 'https://api.bithumb.com/public/ticker/ALL_KRW',
      debounceMs: 1000, // Réduire pour les tests
      warmupMs: 2000 // Réduire pour les tests
    });
    
    // Simuler un nouveau token
    const mockToken = {
      base: 'WS_TEST',
      symbol: 'WS_TEST_KRW',
      source: 'bithumb.ws' as const,
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
      const result = await db.get(
        'SELECT COUNT(*) as count FROM processed_events WHERE base = ?',
        [mockToken.base]
      );
      console.log(`\n📊 Événements traités pour ${mockToken.base}: ${(result as any)?.count || 0}`);
      
      // Vérifier la baseline
      const baselineStats = await baselineManager.getBaselineKRStats();
      console.log(`\n📚 Baseline KR: ${baselineStats?.total || 0} tokens`);
      
      // Vérifier le cooldown
      const cooldownResult = await db.get(
        'SELECT 1 FROM cooldowns WHERE base = ? AND expires_at_utc > datetime("now")',
        [mockToken.base]
      );
      const isInCooldown = !!cooldownResult;
      console.log(`⏳ Token en cooldown: ${isInCooldown}`);
    } else {
      console.log('⚠️ Token déjà dans la baseline, simulation ignorée');
    }
    
    // Fermer
    db.close();
    
    console.log('\n✅ Simulation T2 terminée');
    
  } catch (error) {
    console.error('❌ Erreur lors de la simulation:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  simulateWS();
}
