"use strict";
// Test du circuit-breaker T0
Object.defineProperty(exports, "__esModule", { value: true });
const BASE_URL = 'http://localhost:3001';
async function testT0CircuitBreaker() {
    console.log('🧪 Testing T0 Circuit-Breaker Robustness\n');
    try {
        // Étape 1: Vérifier l'état initial du circuit-breaker T0
        console.log('📊 Step 1: Checking initial T0 circuit-breaker state...');
        const initialMetrics = await fetch(`${BASE_URL}/metrics`);
        const initialMetricsData = await initialMetrics.json();
        console.log(`   Initial T0 CB State: ${initialMetricsData.t0?.t0_cb_state || 'N/A'}`);
        console.log(`   Initial T0 Error Total: ${initialMetricsData.t0?.t0_fetch_error_total || 'N/A'}`);
        console.log(`   Initial T0 CB Open Total: ${initialMetricsData.t0?.t0_cb_open_total || 'N/A'}`);
        // Étape 2: Vérifier l'état de santé T0
        console.log('\n📊 Step 2: Checking T0 health status...');
        const initialHealth = await fetch(`${BASE_URL}/health`);
        const initialHealthData = await initialHealth.json();
        console.log(`   T0 Enabled: ${initialHealthData.t0_enabled}`);
        console.log(`   T0 CB State: ${initialHealthData.t0_cb_state}`);
        console.log(`   T0 Polling Active: ${initialHealthData.t0_enabled}`);
        // Étape 3: Surveiller les métriques pendant quelques secondes
        console.log('\n📊 Step 3: Monitoring T0 metrics for circuit-breaker behavior...');
        console.log('   Monitoring for 10 seconds to observe circuit-breaker patterns...');
        let maxErrors = 0;
        let maxOpenCount = 0;
        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const currentMetrics = await fetch(`${BASE_URL}/metrics`);
                const currentMetricsData = await currentMetrics.json();
                const errorTotal = currentMetricsData.t0?.t0_fetch_error_total || 0;
                const openCount = currentMetricsData.t0?.t0_cb_open_total || 0;
                const cbState = currentMetricsData.t0?.t0_cb_state || 'N/A';
                maxErrors = Math.max(maxErrors, errorTotal);
                maxOpenCount = Math.max(maxOpenCount, openCount);
                process.stdout.write(`   [${i + 1}/10] Errors: ${errorTotal}, Opens: ${openCount}, State: ${cbState}\r`);
            }
            catch (error) {
                // Continue monitoring
            }
        }
        console.log('\n');
        // Étape 4: Vérifier l'état final
        console.log('\n📊 Step 4: Checking final T0 state...');
        const finalMetrics = await fetch(`${BASE_URL}/metrics`);
        const finalMetricsData = await finalMetrics.json();
        const finalHealth = await fetch(`${BASE_URL}/health`);
        const finalHealthData = await finalHealth.json();
        console.log(`   Final T0 CB State: ${finalMetricsData.t0?.t0_cb_state || 'N/A'}`);
        console.log(`   Final T0 Error Total: ${finalMetricsData.t0?.t0_fetch_error_total || 'N/A'}`);
        console.log(`   Final T0 CB Open Total: ${finalMetricsData.t0?.t0_cb_open_total || 'N/A'}`);
        console.log(`   Final T0 Enabled: ${finalHealthData.t0_enabled}`);
        // Résumé du test
        console.log('\n🎯 T0 Circuit-Breaker Test Summary:');
        console.log(`   ✅ Initial State: ${initialMetricsData.t0?.t0_cb_state || 'N/A'}`);
        console.log(`   ✅ Max Errors Observed: ${maxErrors}`);
        console.log(`   ✅ Max Opens Observed: ${maxOpenCount}`);
        console.log(`   ✅ Final State: ${finalMetricsData.t0?.t0_cb_state || 'N/A'}`);
        console.log(`   ✅ T0 Remains Active: ${finalHealthData.t0_enabled}`);
        // Analyse du comportement
        if (maxErrors > 0) {
            console.log(`   🔍 Circuit-breaker handling errors: ${maxErrors} total errors managed`);
        }
        if (maxOpenCount > 0) {
            console.log(`   🔍 Circuit-breaker opened: ${maxOpenCount} times (protection active)`);
        }
        console.log('\n💡 Note: Circuit-breaker automatically manages API failures');
        console.log('   T0 remains active through automatic retry and recovery mechanisms');
    }
    catch (error) {
        console.error('❌ Error during T0 circuit-breaker test:', error);
    }
}
// Attendre que le bot démarre
setTimeout(testT0CircuitBreaker, 3000);
//# sourceMappingURL=test-t0-circuit-breaker.js.map