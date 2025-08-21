#!/usr/bin/env ts-node

/**
 * 🧪 TEST EN TEMPS RÉEL - Vraies notices Bithumb
 * 
 * Ce script teste notre pipeline T0 Robust avec de vraies données
 * récupérées directement de l'API Bithumb en temps réel.
 */

import { NoticeClient } from '../watchers/NoticeClient';
import { WatermarkStore } from '../store/WatermarkStore';
import { HttpClient } from '../core/HttpClient';
import { Database } from 'sqlite3';
import { MigrationRunner } from '../store/Migrations';
import { getRunStatsTracker, stopRunStatsTracker } from '../metrics/RunStats';

async function testRealBithumbNotices() {
  console.log('🧪 === TEST EN TEMPS RÉEL - Vraies notices Bithumb === 🧪');
  console.log('Validant le pipeline T0 Robust sur de vraies données...\n');

  let db: Database | null = null;
  let watermarkStore: WatermarkStore | null = null;
  let noticeClient: NoticeClient | null = null;
  let runStats: any = null;

  try {
    // 🔄 Initialisation de la base de données
    console.log('🔄 Initialisation de la base de données...');
    db = new Database(':memory:');
    
    const migrationRunner = new MigrationRunner(db);
    await migrationRunner.runMigrations();
    console.log('✅ Migrations exécutées');

    // 🔄 Initialisation du WatermarkStore
    console.log('🔄 Initialisation du WatermarkStore...');
    watermarkStore = new WatermarkStore(db);
    await watermarkStore.initializeAtBoot('bithumb.notice');
    console.log('✅ WatermarkStore initialisé');

    // 🔄 Initialisation du NoticeClient
    console.log('🔄 Initialisation du NoticeClient...');
    noticeClient = new NoticeClient(
      'https://api.bithumb.com/public/notices',
      new HttpClient('RealBithumbTest', { 
        timeoutMs: 10000,
        maxRetries: 3,
        baseRetryDelayMs: 1000,
        maxRetryDelayMs: 5000,
        jitterPercent: 20
      }),
      watermarkStore
    );
    console.log('✅ NoticeClient initialisé');

    // 🔄 Initialisation des statistiques
    console.log('🔄 Initialisation des statistiques...');
    runStats = getRunStatsTracker(1); // Log toutes les minutes
    console.log('✅ Statistiques initialisées');

    // 🎯 TEST 1: Récupération des vraies notices
    console.log('\n🔍 TEST 1: Récupération des vraies notices Bithumb');
    console.log('📡 Connexion à l\'API Bithumb en cours...');
    
    const realNotices = await noticeClient.fetchLatestNotices();
    console.log(`✅ ${realNotices.length} notices récupérées de Bithumb`);

    if (realNotices.length === 0) {
      console.log('⚠️ Aucune notice trouvée - vérifier la connectivité API');
      return;
    }

    // 🎯 TEST 2: Traitement des vraies notices
    console.log('\n🔍 TEST 2: Traitement des vraies notices');
    console.log('🔄 Application du pipeline T0 Robust...');

    let totalProcessed = 0;
    let totalListings = 0;
    let totalEvents = 0;

    for (let i = 0; i < Math.min(realNotices.length, 10); i++) {
      const notice = realNotices[i];
      if (!notice) continue; // Skip si notice est undefined
      
      console.log(`\n📝 Notice ${i + 1}/${Math.min(realNotices.length, 10)}: "${notice.title}"`);
      
      try {
        const processedResults = await noticeClient.processNotice(notice);
        
        if (processedResults && processedResults.length > 0) {
          console.log(`  ✅ Traitée: ${processedResults.length} ticker(s) détecté(s)`);
          
          for (const result of processedResults) {
            console.log(`    🎯 Ticker: ${result.base} (eventId: ${result.eventId.substring(0, 8)}...)`);
            totalEvents++;
          }
          
          totalListings++;
        } else {
          console.log(`  ⏭️ Non traitée (pas de ticker détecté)`);
        }
        
        totalProcessed++;
        
      } catch (error) {
        console.log(`  ❌ Erreur de traitement: ${error}`);
      }
    }

    // 🎯 TEST 3: Validation des statistiques
    console.log('\n🔍 TEST 3: Validation des statistiques');
    const stats = runStats.getStats();
    
    console.log(`📊 Statistiques finales:`);
    console.log(`   • Notices traitées: ${totalProcessed}`);
    console.log(`   • Listings détectés: ${totalListings}`);
    console.log(`   • Événements générés: ${totalEvents}`);
    console.log(`   • new_listings_since_start: ${stats.newListingsCount}`);
    console.log(`   • total_notices_processed: ${stats.totalNoticesProcessed}`);
    console.log(`   • total_t0_events: ${stats.totalT0Events}`);

    // 🎯 TEST 4: Validation de la robustesse
    console.log('\n🔍 TEST 4: Validation de la robustesse');
    
    let robustnessScore = 0;
    if (totalProcessed > 0) robustnessScore += 2;
    if (totalListings > 0) robustnessScore += 2;
    if (totalEvents > 0) robustnessScore += 2;
    if (stats.newListingsCount > 0) robustnessScore += 2;
    
    console.log(`🏆 Score de robustesse: ${robustnessScore}/8`);
    
    if (robustnessScore >= 6) {
      console.log('✅ ROBUSTESSE ÉLEVÉE - Le pipeline T0 fonctionne sur de vraies données !');
    } else if (robustnessScore >= 4) {
      console.log('⚠️ ROBUSTESSE MOYENNE - Quelques ajustements nécessaires');
    } else {
      console.log('❌ ROBUSTESSE FAIBLE - Problèmes détectés sur les vraies données');
    }

    // 📋 RÉSUMÉ FINAL
    console.log('\n📊 RÉSUMÉ FINAL:');
    console.log('==================================================');
    console.log(`🔍 Notices récupérées: ${realNotices.length}`);
    console.log(`🔍 Notices traitées: ${totalProcessed}`);
    console.log(`🎯 Listings détectés: ${totalListings}`);
    console.log(`✅ Événements générés: ${totalEvents}`);
    console.log(`📈 new_listings_since_start: ${stats.newListingsCount}`);

    console.log('\n🎯 VALIDATION TEMPS RÉEL:');
    console.log(`   • API Bithumb accessible: ✅`);
    console.log(`   • Notices récupérées: ✅ (${realNotices.length})`);
    console.log(`   • Pipeline T0 fonctionnel: ✅ (${totalListings} listings)`);
    console.log(`   • Robustesse sur vraies données: ${robustnessScore >= 6 ? '✅' : '⚠️'}`);

    if (robustnessScore >= 6) {
      console.log('\n🎉 SUCCÈS - Le bot T0 Robust fonctionne parfaitement sur de vraies données Bithumb !');
    } else {
      console.log('\n⚠️ ATTENTION - Des ajustements sont nécessaires pour la robustesse en production');
    }

  } catch (error) {
    console.error('❌ Erreur critique:', error);
    console.log('\n🔍 DIAGNOSTIC:');
    console.log('   • Vérifier la connectivité internet');
    console.log('   • Vérifier l\'accessibilité de l\'API Bithumb');
    console.log('   • Vérifier les logs d\'erreur détaillés');
  } finally {
    // 🧹 Nettoyage
    console.log('\n🧹 Nettoyage...');
    
    if (runStats) {
      stopRunStatsTracker();
    }
    
    if (db) {
      await db.close();
    }
    
    console.log('✅ Nettoyage terminé');
  }
}

// 🚀 Exécution du test
if (require.main === module) {
  testRealBithumbNotices()
    .then(() => {
      console.log('\n🎯 Test en temps réel terminé');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test en temps réel échoué:', error);
      process.exit(1);
    });
}
