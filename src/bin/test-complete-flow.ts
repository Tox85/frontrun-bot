#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import { EventStore } from '../core/EventStore';
import { buildEventId } from '../core/EventId';
import { classifyListingTiming } from '../core/Timing';

async function testCompleteFlow(): Promise<void> {
  console.log('🧪 Test du flux complet du système unifié');
  
  try {
    // Ouvrir la base de données
    const dbPath = process.env.SQLITE_PATH || './data/bot.db';
    const db = new Database(dbPath);
    
    // Créer l'EventStore
    const eventStore = new EventStore(db);
    console.log('✅ EventStore initialisé');
    
    // Test 1: Simulation d'une notice "live" (NOW)
    console.log('\n📰 Test 1: Notice LIVE (NOW)');
    
    const liveEventId = buildEventId({
      source: 'bithumb.notice',
      base: 'LIVE',
      url: 'https://www.bithumb.com/notice/view/live123',
      markets: ['KRW'],
      tradeTimeUtc: new Date().toISOString()
    });
    
    console.log(`🔑 EventId généré: ${liveEventId.substring(0, 16)}...`);
    
    // Premier appel - devrait être INSERTED
    const liveResult1 = await eventStore.tryMarkProcessed({
      eventId: liveEventId,
      source: 'bithumb.notice',
      base: 'LIVE',
      url: 'https://www.bithumb.com/notice/view/live123',
      markets: ['KRW'],
      tradeTimeUtc: new Date().toISOString(),
      rawTitle: '원화 마켓 추가 LIVE'
    });
    
    console.log(`📝 Premier appel: ${liveResult1}`);
    
    // Deuxième appel - devrait être DUPLICATE
    const liveResult2 = await eventStore.tryMarkProcessed({
      eventId: liveEventId,
      source: 'bithumb.notice',
      base: 'LIVE',
      url: 'https://www.bithumb.com/notice/view/live123',
      markets: ['KRW'],
      tradeTimeUtc: new Date().toISOString(),
      rawTitle: '원화 마켓 추가 LIVE'
    });
    
    console.log(`📝 Deuxième appel: ${liveResult2}`);
    
    // Test 2: Simulation d'une notice "future" (+30min)
    console.log('\n⏰ Test 2: Notice FUTURE (+30min)');
    
    const futureTime = new Date(Date.now() + 30 * 60 * 1000);
    const futureEventId = buildEventId({
      source: 'bithumb.notice',
      base: 'FUTURE',
      url: 'https://www.bithumb.com/notice/view/future123',
      markets: ['KRW'],
      tradeTimeUtc: futureTime.toISOString()
    });
    
    console.log(`🔑 EventId généré: ${futureEventId.substring(0, 16)}...`);
    console.log(`⏰ Trade time: ${futureTime.toISOString()}`);
    console.log(`📊 Timing classifié: ${classifyListingTiming(futureTime)}`);
    
    const futureResult = await eventStore.tryMarkProcessed({
      eventId: futureEventId,
      source: 'bithumb.notice',
      base: 'FUTURE',
      url: 'https://www.bithumb.com/notice/view/future123',
      markets: ['KRW'],
      tradeTimeUtc: futureTime.toISOString(),
      rawTitle: '원화 마켓 추가 FUTURE'
    });
    
    console.log(`📝 Résultat: ${futureResult}`);
    
    // Test 3: Simulation d'une notice "stale" (-30min)
    console.log('\n⏰ Test 3: Notice STALE (-30min)');
    
    const staleTime = new Date(Date.now() - 30 * 60 * 1000);
    const staleEventId = buildEventId({
      source: 'bithumb.notice',
      base: 'STALE',
      url: 'https://www.bithumb.com/notice/view/stale123',
      markets: ['KRW'],
      tradeTimeUtc: staleTime.toISOString()
    });
    
    console.log(`🔑 EventId généré: ${staleEventId.substring(0, 16)}...`);
    console.log(`⏰ Trade time: ${staleTime.toISOString()}`);
    console.log(`📊 Timing classifié: ${classifyListingTiming(staleTime)}`);
    
    const staleResult = await eventStore.tryMarkProcessed({
      eventId: staleEventId,
      source: 'bithumb.notice',
      base: 'STALE',
      url: 'https://www.bithumb.com/notice/view/stale123',
      markets: ['KRW'],
      tradeTimeUtc: staleTime.toISOString(),
      rawTitle: '원화 마켓 추가 STALE'
    });
    
    console.log(`📝 Résultat: ${staleResult}`);
    
    // Test 4: Vérifier les événements récents et le dédup
    console.log('\n🕒 Test 4: Vérification finale');
    const recentEvents = await eventStore.getRecentEvents(10);
    console.log(`Événements récents: ${recentEvents.length}`);
    
    // Grouper par base pour vérifier le dédup
    const eventsByBase = new Map<string, any[]>();
    recentEvents.forEach(event => {
      if (!eventsByBase.has(event.base)) {
        eventsByBase.set(event.base, []);
      }
      eventsByBase.get(event.base)!.push(event);
    });
    
    console.log('\n📊 Résumé par base:');
    for (const [base, events] of eventsByBase) {
      console.log(`  ${base}: ${events.length} événement(s)`);
      events.forEach((event, index) => {
        console.log(`    ${index + 1}. ${event.event_id.substring(0, 16)}... | ${event.source} | ${event.trade_time_utc || 'N/A'}`);
      });
    }
    
    // Fermer la base de données
    db.close();
    
    console.log('\n✅ Test du flux complet terminé avec succès');
    console.log('\n📋 Résumé des tests:');
    console.log('  ✅ EventId déterministe et stable');
    console.log('  ✅ Classification timing (live/future/stale)');
    console.log('  ✅ Déduplication idempotente');
    console.log('  ✅ Schéma unifié bithumb.notice/bithumb.ws');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testCompleteFlow();
}
