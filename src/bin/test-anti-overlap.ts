#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import { PerpCatalog } from '../store/PerpCatalog';

/**
 * Script de test pour valider le comportement anti-overlap du PerpCatalog
 * 
 * Tests à effectuer :
 * 1. Deux refreshs parallèles → un seul vrai refresh + coalescing
 * 2. Gestion des erreurs sans rester coincé actif
 * 3. Métriques correctes (guard_runs, guard_coalesced)
 */

async function testAntiOverlap() {
  console.log('🧪 Test du comportement anti-overlap du PerpCatalog...\n');

  // Créer une base de données en mémoire pour les tests
  const db = new Database(':memory:');
  
  // Créer la table perp_catalog
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE perp_catalog (
        exchange TEXT NOT NULL,
        base TEXT NOT NULL,
        quote TEXT NOT NULL DEFAULT 'USDT',
        symbol TEXT NOT NULL,
        leverage_max REAL DEFAULT 100,
        last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at_utc TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (exchange, base)
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Créer le PerpCatalog avec un intervalle court pour les tests
  const perpCatalog = new PerpCatalog(db, 5000); // 5s
  
  try {
    // Test 1: Deux refreshs parallèles
    console.log('📋 Test 1: Deux refreshs parallèles...');
    
    const startTime = Date.now();
    
    // Lancer deux refreshs quasi simultanément
    const refresh1 = perpCatalog.refreshAllExchanges();
    const refresh2 = perpCatalog.refreshAllExchanges();
    
    // Attendre les deux
    const [result1, result2] = await Promise.all([refresh1, refresh2]);
    const duration = Date.now() - startTime;
    
    console.log(`   Durée totale: ${duration}ms`);
    console.log(`   Résultats identiques: ${result1 === result2 ? '✅' : '❌'}`);
    
    // Vérifier les compteurs du guard
    const guard = (perpCatalog as any).guard;
    const counters = guard.getCounters();
    console.log(`   Guard runs: ${counters.guard_runs}`);
    console.log(`   Guard coalesced: ${counters.guard_coalesced}`);
    
    if (counters.guard_runs === 1 && counters.guard_coalesced === 1) {
      console.log('   ✅ Coalescing fonctionne correctement');
    } else {
      console.log('   ❌ Coalescing ne fonctionne pas');
    }
    
    // Test 2: Gestion des erreurs
    console.log('\n📋 Test 2: Gestion des erreurs...');
    
    // Mock une erreur dans updateCatalog
    const originalUpdateCatalog = perpCatalog['updateCatalog'];
    perpCatalog['updateCatalog'] = async () => {
      throw new Error('Test error');
    };
    
    try {
      await perpCatalog.refreshAllExchanges();
      console.log('   ❌ L\'erreur n\'a pas été propagée');
    } catch (error) {
      console.log(`   ✅ Erreur propagée: ${(error as Error).message}`);
      
      // Vérifier que le guard est redevenu inactif
      const guardState = guard.state;
      if (!guardState.active && guardState.inFlight === null) {
        console.log('   ✅ Guard redevenu inactif après erreur');
      } else {
        console.log('   ❌ Guard reste actif après erreur');
      }
    }
    
    // Restaurer la méthode originale
    perpCatalog['updateCatalog'] = originalUpdateCatalog;
    
    // Test 3: Nouveau refresh après erreur
    console.log('\n📋 Test 3: Nouveau refresh après erreur...');
    
    try {
      await perpCatalog.refreshAllExchanges();
      console.log('   ✅ Refresh après erreur réussi');
    } catch (error) {
      console.log(`   ❌ Refresh après erreur échoué: ${(error as Error).message}`);
    }
    
    const finalCounters = guard.getCounters();
    console.log(`   Guard runs final: ${finalCounters.guard_runs}`);
    console.log(`   Guard coalesced final: ${finalCounters.guard_coalesced}`);
    
    // Test 4: Validation des métriques
    console.log('\n📋 Test 4: Validation des métriques...');
    
    const expectedRuns = 3; // 2 tests + 1 après erreur
    const expectedCoalesced = 1; // 1 coalescing dans le test 1
    
    if (finalCounters.guard_runs === expectedRuns) {
      console.log(`   ✅ Guard runs correct: ${finalCounters.guard_runs}`);
    } else {
      console.log(`   ❌ Guard runs incorrect: attendu ${expectedRuns}, obtenu ${finalCounters.guard_runs}`);
    }
    
    if (finalCounters.guard_coalesced === expectedCoalesced) {
      console.log(`   ✅ Guard coalesced correct: ${finalCounters.guard_coalesced}`);
    } else {
      console.log(`   ❌ Guard coalesced incorrect: attendu ${expectedCoalesced}, obtenu ${finalCounters.guard_coalesced}`);
    }
    
    // Résumé final
    console.log('\n📊 Résumé des tests:');
    console.log(`   - Coalescing: ${counters.guard_coalesced === 1 ? '✅' : '❌'}`);
    console.log(`   - Gestion erreurs: ${guard.state.active === false ? '✅' : '❌'}`);
    console.log(`   - Métriques: ${finalCounters.guard_runs === expectedRuns ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  } finally {
    // Nettoyage
    perpCatalog.stop();
    db.close();
  }
}

// Exécuter les tests si le script est appelé directement
if (require.main === module) {
  testAntiOverlap().catch(console.error);
}

export { testAntiOverlap };
