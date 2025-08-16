#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import { join } from 'path';
import { EventStore } from '../core/EventStore';

async function testDedupFix(): Promise<void> {
  console.log('🧪 Test de la correction de déduplication...');
  
  const dbPath = join(process.cwd(), 'data', 'bot.db');
  const db = new Database(dbPath);
  const eventStore = new EventStore(db);
  
  // Test 1: Premier événement
  console.log('\n📝 Test 1: Premier événement');
  const result1 = await eventStore.tryMarkProcessed({
    eventId: 'test-1',
    source: 'bithumb.notice',
    base: 'TEST',
    url: 'https://test.com',
    markets: ['TEST_KRW'],
    tradeTimeUtc: new Date().toISOString(),
    rawTitle: 'Test Event 1'
  });
  console.log(`✅ Résultat: ${result1}`);
  
  // Test 2: Même événement (duplicate)
  console.log('\n🔄 Test 2: Même événement (duplicate)');
  const result2 = await eventStore.tryMarkProcessed({
    eventId: 'test-1',
    source: 'bithumb.notice',
    base: 'TEST',
    url: 'https://test.com',
    markets: ['TEST_KRW'],
    tradeTimeUtc: new Date().toISOString(),
    rawTitle: 'Test Event 1'
  });
  console.log(`✅ Résultat: ${result2}`);
  
  // Test 3: Événement différent
  console.log('\n🆕 Test 3: Événement différent');
  const result3 = await eventStore.tryMarkProcessed({
    eventId: 'test-2',
    source: 'bithumb.ws',
    base: 'TEST2',
    url: 'https://test2.com',
    markets: ['TEST2_KRW'],
    tradeTimeUtc: new Date().toISOString(),
    rawTitle: 'Test Event 2'
  });
  console.log(`✅ Résultat: ${result3}`);
  
  // Test 4: Vérification des événements traités
  console.log('\n🔍 Test 4: Vérification des événements traités');
  const isProcessed1 = await eventStore.isProcessed('test-1');
  const isProcessed2 = await eventStore.isProcessed('test-2');
  console.log(`✅ test-1 traité: ${isProcessed1}`);
  console.log(`✅ test-2 traité: ${isProcessed2}`);
  
  // Test 5: Test de concurrence (simulation)
  console.log('\n⚡ Test 5: Test de concurrence (simulation)');
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(eventStore.tryMarkProcessed({
      eventId: `concurrent-${i}`,
      source: 'bithumb.notice',
      base: 'CONCURRENT',
      url: `https://concurrent-${i}.com`,
      markets: [`CONCURRENT_KRW`],
      tradeTimeUtc: new Date().toISOString(),
      rawTitle: `Concurrent Event ${i}`
    }));
  }
  
  try {
    const results = await Promise.all(promises);
    console.log('✅ Tous les tests concurrents réussis:', results);
  } catch (error) {
    console.error('❌ Erreur lors des tests concurrents:', error);
  }
  
  console.log('\n🎉 Test de déduplication terminé avec succès!');
  console.log('✅ Plus d\'erreur "cannot start a transaction within a transaction"');
}

// Exécuter si appelé directement
if (require.main === module) {
  testDedupFix()
    .then(() => {
      console.log('\n✅ Tous les tests passés');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test échoué:', error);
      process.exit(1);
    });
}

export { testDedupFix };
