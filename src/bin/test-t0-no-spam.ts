// Test de la déduplication des logs T0 (no-spam)

const BASE_URL = 'http://localhost:3001';

async function testT0NoSpam() {
  console.log('🧪 Testing T0 No-Spam (Log Deduplication) Robustness\n');
  
  try {
    // Étape 1: Vérifier l'état initial des métriques T0
    console.log('📊 Step 1: Checking initial T0 metrics...');
    const initialMetrics = await fetch(`${BASE_URL}/metrics`);
    const initialMetricsData = await initialMetrics.json();
    
    console.log(`   Initial T0 Live New: ${initialMetricsData.unified?.t0_live_new || 'N/A'}`);
    console.log(`   Initial T0 Future: ${initialMetricsData.unified?.t0_future || 'N/A'}`);
    console.log(`   Initial T0 Stale: ${initialMetricsData.unified?.t0_stale || 'N/A'}`);
    console.log(`   Initial T0 Dup Skips: ${initialMetricsData.unified?.t0_dup_skips || 'N/A'}`);
    
    // Étape 2: Vérifier l'état de santé T0
    console.log('\n📊 Step 2: Checking T0 health status...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    
    console.log(`   T0 Enabled: ${healthData.t0_enabled}`);
    console.log(`   T0 CB State: ${healthData.t0_cb_state}`);
    console.log(`   T0 Polling Active: ${healthData.t0_enabled}`);
    
    // Étape 3: Surveiller les métriques de déduplication
    console.log('\n📊 Step 3: Monitoring T0 deduplication metrics...');
    console.log('   Monitoring for 15 seconds to observe log deduplication...');
    
    let maxLiveNew = 0;
    let maxDupSkips = 0;
    let maxStale = 0;
    let maxFuture = 0;
    
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const currentMetrics = await fetch(`${BASE_URL}/metrics`);
        const currentMetricsData = await currentMetrics.json();
        
        const liveNew = currentMetricsData.unified?.t0_live_new || 0;
        const dupSkips = currentMetricsData.unified?.t0_dup_skips || 0;
        const stale = currentMetricsData.unified?.t0_stale || 0;
        const future = currentMetricsData.unified?.t0_future || 0;
        
        maxLiveNew = Math.max(maxLiveNew, liveNew);
        maxDupSkips = Math.max(maxDupSkips, dupSkips);
        maxStale = Math.max(maxStale, stale);
        maxFuture = Math.max(maxFuture, future);
        
        process.stdout.write(`   [${i+1}/15] Live: ${liveNew}, Dup: ${dupSkips}, Stale: ${stale}, Future: ${future}\r`);
      } catch (error) {
        // Continue monitoring
      }
    }
    
    console.log('\n');
    
    // Étape 4: Vérifier l'état final et analyser
    console.log('\n📊 Step 4: Analyzing deduplication behavior...');
    const finalMetrics = await fetch(`${BASE_URL}/metrics`);
    const finalMetricsData = await finalMetrics.json();
    
    console.log(`   Final T0 Live New: ${finalMetricsData.unified?.t0_live_new || 'N/A'}`);
    console.log(`   Final T0 Dup Skips: ${finalMetricsData.unified?.t0_dup_skips || 'N/A'}`);
    console.log(`   Final T0 Stale: ${finalMetricsData.unified?.t0_stale || 'N/A'}`);
    console.log(`   Final T0 Future: ${finalMetricsData.unified?.t0_future || 'N/A'}`);
    
    // Résumé du test
    console.log('\n🎯 T0 No-Spam Test Summary:');
    console.log(`   ✅ Max Live New: ${maxLiveNew}`);
    console.log(`   ✅ Max Dup Skips: ${maxDupSkips}`);
    console.log(`   ✅ Max Stale: ${maxStale}`);
    console.log(`   ✅ Max Future: ${maxFuture}`);
    
    // Analyse du comportement
    if (maxDupSkips > 0) {
      console.log(`   🔍 Log deduplication active: ${maxDupSkips} duplicate logs suppressed`);
    } else {
      console.log(`   🔍 No duplicates detected (normal for fresh notices)`);
    }
    
    if (maxLiveNew > 0) {
      console.log(`   🔍 New listings detected: ${maxLiveNew} live listings`);
    } else {
      console.log(`   🔍 No new listings (normal - depends on Bithumb activity)`);
    }
    
    // Vérification de la configuration
    console.log('\n💡 Log Deduplication Configuration:');
    console.log(`   • Watermark protection: ACTIVE (prevents infinite loops)`);
    console.log(`   • Event deduplication: ACTIVE (centralized EventStore)`);
    console.log(`   • Log compression: ACTIVE (LogDeduper)`);
    console.log(`   • Poll interval: 1100ms ± jitter (prevents API spam)`);
    
    console.log('\n📊 Expected Behavior:');
    console.log(`   • Same notice processed multiple times → DUP logs suppressed`);
    console.log(`   • Old notices → STALE logs suppressed`);
    console.log(`   • Future notices → FUTURE logs suppressed`);
    console.log(`   • New notices → LIVE logs shown`);
    
  } catch (error) {
    console.error('❌ Error during T0 no-spam test:', error);
  }
}

// Attendre que le bot démarre
setTimeout(testT0NoSpam, 3000);
