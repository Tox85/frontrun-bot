#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import { TokenRegistry } from '../store/TokenRegistry';
import { BithumbWSWatcher } from '../watchers/BithumbWSWatcher';

async function simulateWS(): Promise<void> {
  console.log('🧪 Simulation de détection T2 (WebSocket)');
  
  try {
    // Ouvrir la base de données
    const dbPath = process.env.SQLITE_PATH || './data/bot.db';
    const db = new Database(dbPath);
    
    // Initialiser le TokenRegistry
    const tokenRegistry = new TokenRegistry(db);
    await tokenRegistry.initialize();
    
    // Créer le watcher
    const watcher = new BithumbWSWatcher(tokenRegistry, {
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
    
    // Traiter le token
    await watcher['handleNewToken'](mockToken.base, mockToken.symbol);
    
    // Vérifier le résultat
    const stats = await tokenRegistry.getProcessedEventsStats();
    console.log('\n📊 Statistiques après simulation:');
    console.log(`  Total événements: ${stats.total}`);
    console.log(`  Par source:`, stats.bySource);
    
    // Vérifier la baseline
    const baselineStats = await tokenRegistry.getBaselineKRStats();
    console.log(`\n📚 Baseline KR: ${baselineStats.total} tokens`);
    
    // Vérifier le cooldown
    const isInCooldown = await tokenRegistry.isInCooldown(mockToken.base);
    console.log(`⏳ Token en cooldown: ${isInCooldown}`);
    
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
