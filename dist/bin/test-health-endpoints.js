"use strict";
// Using native fetch (Node.js 18+)
Object.defineProperty(exports, "__esModule", { value: true });
const BASE_URL = 'http://localhost:3000';
async function testHealthEndpoints() {
    console.log('🧪 Testing health endpoints...\n');
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
        console.log(`   Unified Metrics:`, metricsData.unified || 'N/A');
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
        console.log('\n🎉 All health endpoints tested successfully!');
    }
    catch (error) {
        console.error('❌ Error testing endpoints:', error);
    }
}
// Attendre que le bot démarre
setTimeout(testHealthEndpoints, 5000);
//# sourceMappingURL=test-health-endpoints.js.map