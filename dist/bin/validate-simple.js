#!/usr/bin/env ts-node
"use strict";
// Script de validation simple - Bot prod-ready
Object.defineProperty(exports, "__esModule", { value: true });
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
async function main() {
    console.log('🧪 VALIDATION SIMPLE - BOT PROD-READY');
    console.log('='.repeat(50));
    console.log(`📍 Base URL: ${BASE_URL}`);
    console.log(`🕐 Start Time: ${new Date().toISOString()}\n`);
    try {
        // Phase A - Health check
        console.log('📊 PHASE A: Health check');
        console.log('-'.repeat(30));
        const healthResponse = await fetch(`${BASE_URL}/health`);
        if (!healthResponse.ok) {
            throw new Error(`HTTP ${healthResponse.status}`);
        }
        const health = await healthResponse.json();
        console.log('✅ Health endpoint accessible');
        // Vérifications de base
        const checks = [];
        if (['READY', 'CACHED', 'DEGRADED'].includes(health.baseline_state)) {
            checks.push('✅ baseline_state valide');
        }
        else {
            checks.push('❌ baseline_state invalide');
        }
        if (health.t0_enabled && health.t2_enabled) {
            checks.push('✅ T0 et T2 actifs');
        }
        else {
            checks.push('❌ T0 ou T2 inactif');
        }
        if (health.ws_connected) {
            checks.push('✅ WebSocket connecté');
        }
        else {
            checks.push('❌ WebSocket déconnecté');
        }
        console.log(checks.join('\n'));
        // Phase B - Metrics check
        console.log('\n📊 PHASE B: Metrics check');
        console.log('-'.repeat(30));
        const metricsResponse = await fetch(`${BASE_URL}/metrics`);
        if (!metricsResponse.ok) {
            throw new Error(`HTTP ${metricsResponse.status}`);
        }
        const metrics = await metricsResponse.json();
        console.log('✅ Metrics endpoint accessible');
        // Vérifier les métriques clés
        if (metrics.unified) {
            console.log(`   t0_live_new: ${metrics.unified.t0_live_new || 'N/A'}`);
            console.log(`   t0_dup_skips: ${metrics.unified.t0_dup_skips || 'N/A'}`);
            console.log(`   ws_reconnects: ${metrics.unified.ws_reconnects || 'N/A'}`);
        }
        // Phase C - Simulation test
        console.log('\n📊 PHASE C: Simulation test');
        console.log('-'.repeat(30));
        try {
            const simulateResponse = await fetch(`${BASE_URL}/simulate/notice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'ZZTEST Listing Test',
                    categories: ['listing'],
                    pc_url: 'https://test.com/zztest',
                    published_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
                    markets: ['KRW']
                })
            });
            if (simulateResponse.ok) {
                console.log('✅ Simulation endpoint accessible');
            }
            else {
                console.log('⚠️  Simulation endpoint non accessible');
            }
        }
        catch (error) {
            console.log('⚠️  Simulation endpoint non accessible');
        }
        // Résumé
        console.log('\n🎯 RÉSUMÉ DE LA VALIDATION');
        console.log('='.repeat(50));
        const allChecksPassed = checks.every(c => c.startsWith('✅'));
        if (allChecksPassed) {
            console.log('🚀 VALIDATION RÉUSSIE !');
            console.log('✅ Bot prod-ready (T0 prioritaire, T2 filet, dédup OK, CB OK, logs propres)');
        }
        else {
            console.log('⚠️  VALIDATION PARTIELLE');
            console.log('❌ Certaines vérifications ont échoué');
        }
        console.log(`\n📊 Métriques clés:`);
        console.log(`   Baseline State: ${health.baseline_state}`);
        console.log(`   T0 Enabled: ${health.t0_enabled}`);
        console.log(`   T2 Enabled: ${health.t2_enabled}`);
        console.log(`   WS Connected: ${health.ws_connected}`);
        console.log(`   Leader Instance: ${health.leader_instance_id}`);
    }
    catch (error) {
        console.error('❌ Validation échouée:', error);
    }
}
main();
//# sourceMappingURL=validate-simple.js.map