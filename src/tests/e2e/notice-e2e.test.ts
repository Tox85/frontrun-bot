// Test E2E pour les notices T0/T2

import { HttpClient } from '../../lib/httpClient';
import { MetricsParser } from '../../lib/metricsParser';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TIMEOUT_MS = 5000;

describe('Notice E2E Tests', () => {
  let httpClient: HttpClient;
  let initialMetrics: any;

  beforeAll(async () => {
    httpClient = new HttpClient(TIMEOUT_MS);
    
    // Attendre que le bot soit prêt
    await waitForBot();
    
    // Récupérer les métriques initiales
    const response = await httpClient.getJSON(`${BASE_URL}/metrics`);
    initialMetrics = MetricsParser.parseFromJSON(response.data);
  }, 30000);

  describe('Phase C - T0 E2E (NEW puis DUP)', () => {
    it('should process new notice and increment t0_new_total', async () => {
      // Simuler un nouveau listing
      const newListing = {
        title: 'ZZTEST Listing Test',
        categories: ['listing'],
        pc_url: 'https://test.com/zztest',
        published_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
        markets: ['KRW']
      };

      const response = await httpClient.postJSON(`${BASE_URL}/simulate/notice`, newListing);
      expect(response.ok).toBe(true);

      // Attendre le traitement
      await sleep(500);

      // Vérifier que t0_new_total a augmenté
      const metricsResponse = await httpClient.getJSON(`${BASE_URL}/metrics`);
      const metrics = MetricsParser.parseFromJSON(metricsResponse.data);
      
      const newTotal = MetricsParser.getMetric(metrics, 't0_new_total');
      const initialNewTotal = MetricsParser.getMetric(initialMetrics, 't0_new_total');
      
      expect(newTotal).toBeGreaterThan(initialNewTotal);
    }, 10000);

    it('should skip duplicate notice and increment t0_dup_skips_total', async () => {
      // Rejouer le même event
      const duplicateListing = {
        title: 'ZZTEST Listing Test',
        categories: ['listing'],
        pc_url: 'https://test.com/zztest',
        published_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
        markets: ['KRW']
      };

      const response = await httpClient.postJSON(`${BASE_URL}/simulate/notice`, duplicateListing);
      expect(response.ok).toBe(true);

      await sleep(300);

      // Vérifier que t0_dup_skips_total a augmenté
      const metricsResponse = await httpClient.getJSON(`${BASE_URL}/metrics`);
      const metrics = MetricsParser.parseFromJSON(metricsResponse.data);
      
      const dupSkips = MetricsParser.getMetric(metrics, 't0_dup_skips_total');
      const initialDupSkips = MetricsParser.getMetric(initialMetrics, 't0_dup_skips_total');
      
      expect(dupSkips).toBeGreaterThan(initialDupSkips);
    }, 10000);
  });

  describe('Phase D - Watermark & Stale', () => {
    it('should skip old notice due to watermark/stale protection', async () => {
      // Simuler un listing ancien
      const oldDate = new Date();
      oldDate.setMinutes(oldDate.getMinutes() - 200); // MAX_NOTICE_AGE_MIN + 20
      
      const oldListing = {
        title: 'ZZTEST Old Listing',
        categories: ['listing'],
        pc_url: 'https://test.com/zztest-old',
        published_at: oldDate.toISOString().replace('T', ' ').replace('Z', ''),
        markets: ['KRW']
      };

      const response = await httpClient.postJSON(`${BASE_URL}/simulate/notice`, oldListing);
      expect(response.ok).toBe(true);

      await sleep(300);

      // Vérifier que le listing a été ignoré
      const metricsResponse = await httpClient.getJSON(`${BASE_URL}/metrics`);
      const metrics = MetricsParser.parseFromJSON(metricsResponse.data);
      
      const staleTotal = MetricsParser.getMetric(metrics, 't0_stale_total', 0);
      const watermarkSkips = MetricsParser.getMetric(metrics, 't0_watermark_skips_total', 0);
      
      expect(staleTotal).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Phase E - T2 E2E (filet)', () => {
    it('should detect WebSocket event for unknown symbol', async () => {
      // Simuler un event WebSocket
      const wsEvent = {
        symbol: 'YYTEST_KRW',
        type: 'listing',
        timestamp: Date.now()
      };

      const response = await httpClient.postJSON(`${BASE_URL}/simulate/ws`, wsEvent);
      expect(response.ok).toBe(true);

      await sleep(300);

      // Vérifier les métriques T2
      const metricsResponse = await httpClient.getJSON(`${BASE_URL}/metrics`);
      const metrics = MetricsParser.parseFromJSON(metricsResponse.data);
      
      const t2NewTotal = MetricsParser.getMetric(metrics, 't2_new_total', 0);
      
      expect(t2NewTotal).toBeGreaterThan(0);
    }, 10000);
  });
});

// Helpers
async function waitForBot(): Promise<void> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Bot not ready yet
    }
    await sleep(1000);
  }
  throw new Error('Bot failed to start within 30 seconds');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
