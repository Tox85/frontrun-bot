#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import { PerpCatalog } from '../store/PerpCatalog';

/**
 * Script de test pour valider la robustesse de l'UPSERT du PerpCatalog
 * 
 * Tests à effectuer :
 * 1. Double UPSERT sur la même (exchange, base) → zéro contrainte
 * 2. Vérification { inserted: true } puis { updated: true }
 * 3. Validation de l'index UNIQUE(exchange, base)
 */

async function testUpsertRobustness() {
  console.log('🧪 Test de la robustesse de l\'UPSERT du PerpCatalog...\n');

  // Créer une base de données en mémoire pour les tests
  const db = new Database(':memory:');
  
  // Créer la table perp_catalog avec le schéma complet
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

  // Créer l'index unique
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE UNIQUE INDEX unq_perp_catalog_exchange_base 
      ON perp_catalog(exchange, base)
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Créer le PerpCatalog
  const perpCatalog = new PerpCatalog(db, 10000); // 10s
  
  try {
    // Test 1: Premier UPSERT (INSERT)
    console.log('📋 Test 1: Premier UPSERT (INSERT)...');
    
    const tokens1 = [
      { base: 'BTC', symbol: 'BTCUSDT', leverageMax: 100, quote: 'USDT' }
    ];
    
    const result1 = await perpCatalog['updateCatalog']('TEST_EXCHANGE', tokens1);
    console.log(`   Résultat: ${JSON.stringify(result1)}`);
    
    if (result1.inserted === 1 && result1.updated === 0) {
      console.log('   ✅ Premier UPSERT: INSERT réussi');
    } else {
      console.log('   ❌ Premier UPSERT: INSERT échoué');
    }
    
    // Vérifier qu'une seule ligne existe
    const count1 = await new Promise<number>((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM perp_catalog WHERE exchange = ? AND base = ?',
        ['TEST_EXCHANGE', 'BTC'],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    console.log(`   Lignes en base: ${count1}`);
    if (count1 === 1) {
      console.log('   ✅ Une seule ligne insérée');
    } else {
      console.log('   ❌ Nombre de lignes incorrect');
    }
    
    // Test 2: Deuxième UPSERT sur la même (exchange, base) (UPDATE)
    console.log('\n📋 Test 2: Deuxième UPSERT (UPDATE)...');
    
    const tokens2 = [
      { base: 'BTC', symbol: 'BTCUSDT_NEW', leverageMax: 150, quote: 'USDT' }
    ];
    
    const result2 = await perpCatalog['updateCatalog']('TEST_EXCHANGE', tokens2);
    console.log(`   Résultat: ${JSON.stringify(result2)}`);
    
    if (result2.inserted === 0 && result2.updated === 1) {
      console.log('   ✅ Deuxième UPSERT: UPDATE réussi');
    } else {
      console.log('   ❌ Deuxième UPSERT: UPDATE échoué');
    }
    
    // Vérifier qu'il n'y a toujours qu'une seule ligne
    const count2 = await new Promise<number>((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM perp_catalog WHERE exchange = ? AND base = ?',
        ['TEST_EXCHANGE', 'BTC'],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    console.log(`   Lignes en base: ${count2}`);
    if (count2 === 1) {
      console.log('   ✅ Une seule ligne maintenue (UPDATE)');
    } else {
      console.log('   ❌ Nombre de lignes incorrect après UPDATE');
    }
    
    // Vérifier que les données ont été mises à jour
    const updatedRow = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM perp_catalog WHERE exchange = ? AND base = ?',
        ['TEST_EXCHANGE', 'BTC'],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    console.log(`   Données mises à jour: symbol=${updatedRow.symbol}, leverage_max=${updatedRow.leverage_max}`);
    if (updatedRow.symbol === 'BTCUSDT_NEW' && updatedRow.leverage_max === 150) {
      console.log('   ✅ Données correctement mises à jour');
    } else {
      console.log('   ❌ Données non mises à jour');
    }
    
    // Test 3: Troisième UPSERT avec métadonnées différentes
    console.log('\n📋 Test 3: Troisième UPSERT (métadonnées différentes)...');
    
    const tokens3 = [
      { base: 'BTC', symbol: 'BTCUSDT_FINAL', leverageMax: 200, quote: 'USDT' }
    ];
    
    const result3 = await perpCatalog['updateCatalog']('TEST_EXCHANGE', tokens3);
    console.log(`   Résultat: ${JSON.stringify(result3)}`);
    
    if (result3.inserted === 0 && result3.updated === 1) {
      console.log('   ✅ Troisième UPSERT: UPDATE réussi');
    } else {
      console.log('   ❌ Troisième UPSERT: UPDATE échoué');
    }
    
    // Test 4: Validation de l'index UNIQUE
    console.log('\n📋 Test 4: Validation de l\'index UNIQUE...');
    
    try {
      // Essayer d'insérer une ligne avec la même clé (exchange, base)
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO perp_catalog (exchange, base, quote, symbol, leverage_max) VALUES (?, ?, ?, ?, ?)',
          ['TEST_EXCHANGE', 'BTC', 'USDT', 'BTCUSDT_DUPLICATE', 100],
          (err) => {
            if (err) {
              console.log(`   ✅ Contrainte UNIQUE respectée: ${err.message}`);
              resolve();
            } else {
              console.log('   ❌ Contrainte UNIQUE non respectée');
              reject(new Error('Contrainte UNIQUE non respectée'));
            }
          }
        );
      });
    } catch (error) {
      // Attendu
    }
    
    // Vérifier le nombre final de lignes
    const finalCount = await new Promise<number>((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM perp_catalog',
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    console.log(`   Nombre total de lignes: ${finalCount}`);
    
    // Résumé final
    console.log('\n📊 Résumé des tests UPSERT:');
    console.log(`   - Premier UPSERT (INSERT): ${result1.inserted === 1 ? '✅' : '❌'}`);
    console.log(`   - Deuxième UPSERT (UPDATE): ${result2.updated === 1 ? '✅' : '❌'}`);
    console.log(`   - Troisième UPSERT (UPDATE): ${result3.updated === 1 ? '✅' : '❌'}`);
    console.log(`   - Contrainte UNIQUE: ${finalCount === 1 ? '✅' : '❌'}`);
    console.log(`   - Lignes finales: ${finalCount}`);
    
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
  testUpsertRobustness().catch(console.error);
}

export { testUpsertRobustness };
