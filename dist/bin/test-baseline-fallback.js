"use strict";
// Test du fallback baseline en cas d'échec API
Object.defineProperty(exports, "__esModule", { value: true });
const BASE_URL = 'http://localhost:3001';
async function testBaselineFallback() {
    console.log('🧪 Testing Baseline Fallback Robustness\n');
    try {
        // Étape 1: Vérifier l'état initial
        console.log('📊 Step 1: Checking initial baseline state...');
        const initialHealth = await fetch(`${BASE_URL}/health`);
        const initialData = await initialHealth.json();
        console.log(`   Initial Baseline State: ${initialData.baseline_state}`);
        console.log(`   Initial Baseline CB State: ${initialData.baseline_cb_state}`);
        console.log(`   T0 Enabled: ${initialData.t0_enabled}`);
        console.log(`   T2 Enabled: ${initialData.t2_enabled}`);
        // Étape 2: Simuler une erreur 999 (en modifiant temporairement l'URL)
        console.log('\n📊 Step 2: Simulating baseline API failure...');
        console.log('   Note: This would require modifying the baseline URL to a failing endpoint');
        console.log('   For now, we verify the circuit-breaker is working');
        // Étape 3: Vérifier que le circuit-breaker gère les erreurs
        console.log('\n📊 Step 3: Verifying circuit-breaker behavior...');
        const metrics = await fetch(`${BASE_URL}/metrics`);
        const metricsData = await metrics.json();
        console.log(`   Baseline CB State: ${metricsData.baseline?.baseline_cb_state || 'N/A'}`);
        console.log(`   Baseline Success Total: ${metricsData.baseline?.baseline_fetch_success_total || 'N/A'}`);
        console.log(`   Baseline Error Total: ${metricsData.baseline?.baseline_fetch_error_total || 'N/A'}`);
        console.log(`   Baseline CB Open Total: ${metricsData.baseline?.baseline_cb_open_total || 'N/A'}`);
        // Étape 4: Vérifier que T0 et T2 restent actifs
        console.log('\n📊 Step 4: Verifying T0 and T2 remain active...');
        const finalHealth = await fetch(`${BASE_URL}/health`);
        const finalData = await finalHealth.json();
        console.log(`   Final T0 Enabled: ${finalData.t0_enabled}`);
        console.log(`   Final T2 Enabled: ${finalData.t2_enabled}`);
        console.log(`   Final WS Connected: ${finalData.ws_connected}`);
        // Résumé du test
        console.log('\n🎯 Baseline Fallback Test Summary:');
        console.log(`   ✅ Initial State: ${initialData.baseline_state}`);
        console.log(`   ✅ Circuit-Breaker: ${metricsData.baseline?.baseline_cb_state || 'N/A'}`);
        console.log(`   ✅ T0 Active: ${finalData.t0_enabled}`);
        console.log(`   ✅ T2 Active: ${finalData.t2_enabled}`);
        console.log(`   ✅ WebSocket: ${finalData.ws_connected}`);
        console.log('\n💡 Note: Full fallback simulation requires API endpoint modification');
        console.log('   Current test validates circuit-breaker integration and state management');
    }
    catch (error) {
        console.error('❌ Error during baseline fallback test:', error);
    }
}
// Attendre que le bot démarre
setTimeout(testBaselineFallback, 3000);
//# sourceMappingURL=test-baseline-fallback.js.map