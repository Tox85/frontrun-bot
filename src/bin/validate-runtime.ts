#!/usr/bin/env ts-node

// Script de validation runtime - Bot prod-ready

import { HttpClient } from '../lib/httpClient';
import { MetricsParser } from '../lib/metricsParser';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function main() {
  console.log('🧪 VALIDATION RUNTIME - BOT PROD-READY');
  console.log(`📍 Base URL: ${BASE_URL}`);
  
  const httpClient = new HttpClient(1500);
  
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
    
  } catch (error) {
    console.error('❌ Validation échouée:', error);
  }
}

main();
