#!/usr/bin/env ts-node
"use strict";
// Script de validation runtime - Bot prod-ready
Object.defineProperty(exports, "__esModule", { value: true });
const httpClient_1 = require("../lib/httpClient");
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
async function main() {
    console.log('🧪 VALIDATION RUNTIME - BOT PROD-READY');
    console.log(`📍 Base URL: ${BASE_URL}`);
    const httpClient = new httpClient_1.HttpClient(1500);
    try {
        // Phase A - Health check
        console.log('\n📊 Phase A: Health check');
        const health = await httpClient.getJSON(`${BASE_URL}/health`);
        console.log('✅ Health endpoint accessible');
        // Phase B - Metrics check
        console.log('\n📊 Phase B: Metrics check');
        const metrics = await httpClient.getJSON(`${BASE_URL}/metrics`);
        console.log('✅ Metrics endpoint accessible');
        console.log('\n🎉 Validation de base réussie!');
    }
    catch (error) {
        console.error('❌ Validation échouée:', error);
    }
}
main();
//# sourceMappingURL=validate-runtime.js.map