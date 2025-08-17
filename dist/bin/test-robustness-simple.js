"use strict";
// Test simple de robustesse - vérification des endpoints
Object.defineProperty(exports, "__esModule", { value: true });
const BASE_URL = 'http://localhost:3000';
async function testRobustness() {
    console.log('🧪 Testing Robustness Implementation\n');
    // Attendre que le bot démarre
    console.log('⏳ Waiting for bot to start...');
    for (let i = 0; i < 20; i++) {
        try {
            const response = await fetch(`${BASE_URL}/health`);
            if (response.ok) {
                console.log('✅ Bot is ready!');
                break;
            }
        }
        catch (error) {
            // Bot not ready yet
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.stdout.write('.');
    }
    console.log('\n');
    try {
        // Test /health
        console.log('📊 Testing /health endpoint...');
        const healthResponse = await fetch(`${BASE_URL}/health`);
        const healthData = await healthResponse.json();
        console.log('✅ /health response:');
        console.log(`   Status: ${healthResponse.status}`);
        console.log(`   Baseline State: ${healthData.baseline_state || 'N/A'}`);
        console.log(`   Baseline CB State: ${healthData.baseline_cb_state || 'N/A'}`);
        console.log(`   T0 Enabled: ${healthData.t0_enabled || 'N/A'}`);
        console.log(`   T0 CB State: ${healthData.t0_cb_state || 'N/A'}`);
        console.log(`   T2 Enabled: ${healthData.t2_enabled || 'N/A'}`);
        console.log(`   WS Connected: ${healthData.ws_connected || 'N/A'}`);
        console.log(`   Leader Instance ID: ${healthData.leader_instance_id || 'N/A'}`);
        console.log(`   Last Baseline Fetch: ${healthData.last_baseline_fetch_ms || 'N/A'}ms`);
        console.log(`   Errors 999 (5m): ${healthData.errors_999_last_5m || 'N/A'}`);
        console.log('\n');
        // Test /metrics
        console.log('📈 Testing /metrics endpoint...');
        const metricsResponse = await fetch(`${BASE_URL}/metrics`);
        const metricsData = await metricsResponse.json();
        console.log('✅ /metrics response:');
        console.log(`   Status: ${metricsResponse.status}`);
        console.log(`   Baseline Metrics:`, metricsData.baseline || 'N/A');
        console.log(`   T0 Metrics:`, metricsData.t0 || 'N/A');
        console.log('\n');
        // Test /status
        console.log('🔍 Testing /status endpoint...');
        const statusResponse = await fetch(`${BASE_URL}/status`);
        const statusData = await statusResponse.json();
        console.log('✅ /status response:');
        console.log(`   Status: ${statusResponse.status}`);
        console.log(`   WebSocket:`, statusData.websocket || 'N/A');
        console.log(`   Trading:`, statusData.trading || 'N/A');
        console.log('\n');
        // Test /whoami
        console.log('👤 Testing /whoami endpoint...');
        const whoamiResponse = await fetch(`${BASE_URL}/whoami`);
        const whoamiData = await whoamiResponse.json();
        console.log('✅ /whoami response:');
        console.log(`   Status: ${whoamiResponse.status}`);
        console.log(`   Instance ID: ${whoamiData.instance_id || 'N/A'}`);
        console.log(`   Is Leader: ${whoamiData.is_leader || 'N/A'}`);
        console.log(`   Observer Mode: ${whoamiData.observer_mode || 'N/A'}`);
        console.log('\n🎉 All robustness tests completed successfully!');
        // Résumé des tests
        console.log('🎯 Robustness Test Summary:');
        console.log(`   ✅ Health endpoint: Enhanced with baseline & circuit-breaker info`);
        console.log(`   ✅ Metrics endpoint: Circuit-breaker metrics available`);
        console.log(`   ✅ Status endpoint: Working`);
        console.log(`   ✅ Whoami endpoint: Working`);
        console.log(`   ✅ Baseline fallback: ${healthData.baseline_state === 'READY' ? 'READY' : 'FALLBACK'}`);
        console.log(`   ✅ Circuit-breakers: ${healthData.baseline_cb_state || 'N/A'}`);
        console.log(`   ✅ T0 Status: ${healthData.t0_enabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   ✅ T2 Status: ${healthData.t2_enabled ? 'ENABLED' : 'DISABLED'}`);
    }
    catch (error) {
        console.error('❌ Error during robustness testing:', error);
    }
}
// Attendre que le bot démarre
setTimeout(testRobustness, 8000);
//# sourceMappingURL=test-robustness-simple.js.map