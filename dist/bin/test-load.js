#!/usr/bin/env ts-node
"use strict";
// Script de test de charge simple
Object.defineProperty(exports, "__esModule", { value: true });
const StructuredLogger_1 = require("../core/StructuredLogger");
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const logger = new StructuredLogger_1.StructuredLogger(StructuredLogger_1.LogLevel.INFO);
async function testLoad() {
    console.log('🧪 TEST DE CHARGE SIMPLE - BOT FRONTRUN');
    console.log('='.repeat(50));
    console.log(`📍 Base URL: ${BASE_URL}`);
    console.log(`🕐 Start Time: ${new Date().toISOString()}\n`);
    try {
        // Test 1: Health check en boucle
        console.log('📊 Test 1: Health check en boucle (10 requêtes)');
        await testHealthCheckLoop(10);
        // Test 2: Metrics en boucle
        console.log('\n📊 Test 2: Metrics en boucle (10 requêtes)');
        await testMetricsLoop(10);
        // Test 3: Simulation en boucle
        console.log('\n📊 Test 3: Simulation en boucle (5 requêtes)');
        await testSimulationLoop(5);
        // Test 4: Charge simultanée
        console.log('\n📊 Test 4: Charge simultanée (5 requêtes concurrentes)');
        await testConcurrentLoad(5);
        console.log('\n🎉 Tests de charge terminés avec succès !');
    }
    catch (error) {
        console.error('❌ Erreur lors des tests de charge:', error);
    }
}
async function testHealthCheckLoop(count) {
    const responseTimes = [];
    for (let i = 0; i < count; i++) {
        const startTime = Date.now();
        try {
            const response = await fetch(`${BASE_URL}/health`);
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            if (response.ok) {
                console.log(`   [${i + 1}/${count}] Health OK - ${responseTime}ms`);
            }
            else {
                console.log(`   [${i + 1}/${count}] Health ERROR - ${response.status}`);
            }
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            console.log(`   [${i + 1}/${count}] Health FAILED - ${error}`);
        }
        // Attendre 100ms entre les requêtes
        await sleep(100);
    }
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    console.log(`   📊 Temps moyen: ${avgTime.toFixed(0)}ms`);
}
async function testMetricsLoop(count) {
    const responseTimes = [];
    for (let i = 0; i < count; i++) {
        const startTime = Date.now();
        try {
            const response = await fetch(`${BASE_URL}/metrics`);
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            if (response.ok) {
                console.log(`   [${i + 1}/${count}] Metrics OK - ${responseTime}ms`);
            }
            else {
                console.log(`   [${i + 1}/${count}] Metrics ERROR - ${response.status}`);
            }
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            console.log(`   [${i + 1}/${count}] Metrics FAILED - ${error}`);
        }
        await sleep(100);
    }
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    console.log(`   📊 Temps moyen: ${avgTime.toFixed(0)}ms`);
}
async function testSimulationLoop(count) {
    const responseTimes = [];
    for (let i = 0; i < count; i++) {
        const startTime = Date.now();
        try {
            const response = await fetch(`${BASE_URL}/simulate/notice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Test Load ${i + 1}`,
                    categories: ['listing'],
                    pc_url: 'https://test.com/load-test',
                    published_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
                    markets: ['KRW']
                })
            });
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            if (response.ok) {
                console.log(`   [${i + 1}/${count}] Simulation OK - ${responseTime}ms`);
            }
            else {
                console.log(`   [${i + 1}/${count}] Simulation ERROR - ${response.status}`);
            }
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            console.log(`   [${i + 1}/${count}] Simulation FAILED - ${error}`);
        }
        await sleep(200);
    }
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    console.log(`   📊 Temps moyen: ${avgTime.toFixed(0)}ms`);
}
async function testConcurrentLoad(count) {
    const startTime = Date.now();
    const promises = [];
    for (let i = 0; i < count; i++) {
        promises.push((async () => {
            try {
                const response = await fetch(`${BASE_URL}/health`);
                if (response.ok) {
                    console.log(`   [${i + 1}/${count}] Concurrent Health OK`);
                }
                else {
                    console.log(`   [${i + 1}/${count}] Concurrent Health ERROR - ${response.status}`);
                }
            }
            catch (error) {
                console.log(`   [${i + 1}/${count}] Concurrent Health FAILED - ${error}`);
            }
        })());
    }
    await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    console.log(`   📊 Temps total: ${totalTime}ms (${count} requêtes simultanées)`);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Exécution
if (require.main === module) {
    testLoad().catch(console.error);
}
//# sourceMappingURL=test-load.js.map