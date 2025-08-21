#!/usr/bin/env ts-node

/**
 * Script de self-test e2e dry-run pour post-détection
 * Simule un vrai listing NEW (T0) et vérifie bout-en-bout sans ordre réel
 * Utilise SELFTEST_MODE=true et TRADING_DRY_RUN_ON_SELFTEST=true
 */

import { CONFIG } from '../config/env';
import { HttpClient } from '../core/HttpClient';
import { StructuredLogger, LogLevel } from '../core/StructuredLogger';
import { buildEventId } from '../core/EventId';

interface MetricsSnapshot {
  t0_new_total: number;
  t0_dup_total: number;
  trades_opened: number;
  exit_pending: number;
  telegram_messages_sent?: number;
  timestamp: string;
}

interface SelfTestResult {
  success: boolean;
  message: string;
  deltas: {
    t0_new_total: number;
    t0_dup_total: number;
    trades_opened: number;
    exit_pending: number;
    telegram_messages_sent?: number;
  };
  errors: string[];
  warnings: string[];
}

class SelfTestPostDetection {
  private httpClient: HttpClient;
  private logger: StructuredLogger;
  private baseUrl: string;
  private testTimeout: number = 8000; // 8 secondes
  private pollInterval: number = 500; // 500ms
  private maxPolls: number;

  constructor() {
    this.httpClient = new HttpClient('selftest', {
      timeoutMs: 30000, // 30 secondes (au lieu de 10s)
      maxRetries: 3,    // Plus de tentatives
      baseRetryDelayMs: 1000,
      maxRetryDelayMs: 5000,
      jitterPercent: 0.1
    });
    this.logger = new StructuredLogger(LogLevel.INFO);
    this.baseUrl = `http://localhost:${CONFIG.PORT}`;
    this.maxPolls = Math.floor(this.testTimeout / this.pollInterval);
  }

  async run(): Promise<void> {
    console.log('🧪 Démarrage du self-test post-détection...\n');

    // Vérifications préliminaires
    if (!this.validateEnvironment()) {
      process.exit(1);
    }

    // 1. Vérifier /readiness.t0_ready
    if (!await this.checkT0Ready()) {
      console.log('❌ T0 non prêt - self-test impossible');
      process.exit(1);
    }

    // 2. Capturer l'état initial des métriques
    const initialMetrics = await this.getMetrics();
    if (!initialMetrics) {
      console.log('❌ Impossible d\'obtenir les métriques initiales');
      process.exit(1);
    }

    console.log('📊 Métriques initiales:');
    this.logMetrics(initialMetrics);

    // 3. Déclencher le simulate/notice
    const testEventId = await this.triggerSimulateNotice();
    if (!testEventId) {
      console.log('❌ Impossible de déclencher la simulation');
      process.exit(1);
    }

    console.log(`🚀 Simulation déclenchée avec EventId: ${testEventId}`);

    // 4. Attendre et surveiller les métriques
    const finalMetrics = await this.waitForMetricsChange(initialMetrics);
    if (!finalMetrics) {
      console.log('❌ Timeout - métriques n\'ont pas changé');
      process.exit(1);
    }

    // 5. Analyser les résultats
    const result = this.analyzeResults(initialMetrics, finalMetrics);
    
    // 6. Afficher le résultat final
    this.displayFinalResult(result);

    // Exit avec le bon code
    process.exit(result.success ? 0 : 1);
  }

  private validateEnvironment(): boolean {
    console.log('🔍 Validation de l\'environnement...');

    // Vérifier SELFTEST_MODE
    if (process.env.SELFTEST_MODE !== 'true') {
      console.log('❌ SELFTEST_MODE doit être true');
      return false;
    }

    // Vérifier TRADING_DRY_RUN_ON_SELFTEST
    if (process.env.TRADING_DRY_RUN_ON_SELFTEST !== 'true') {
      console.log('❌ TRADING_DRY_RUN_ON_SELFTEST doit être true');
      return false;
    }

    // Vérifier que le bot est accessible
    try {
      const url = new URL(this.baseUrl);
      console.log(`✅ Environnement validé: ${url.hostname}:${url.port}`);
      return true;
    } catch (error) {
      console.log('❌ URL de base invalide:', error);
      return false;
    }
  }

  private async checkT0Ready(): Promise<boolean> {
    try {
      const response = await this.httpClient.get(`${this.baseUrl}/readiness`);
      if (response.status !== 200) {
        console.log(`❌ /readiness répond avec status ${response.status}`);
        return false;
      }

      const data = response.data as any;
      if (!data.t0_ready) {
        console.log('❌ /readiness.t0_ready != true');
        return false;
      }

      console.log('✅ T0 prêt pour le test');
      return true;
    } catch (error) {
      console.log('❌ Erreur lors de la vérification /readiness:', error);
      return false;
    }
  }

  private async getMetrics(): Promise<MetricsSnapshot | null> {
    try {
      const response = await this.httpClient.get(`${this.baseUrl}/metrics`);
      if (response.status !== 200) {
        return null;
      }

      const data = response.data as any;
      return {
        t0_new_total: data.t0_new_total || 0,
        t0_dup_total: data.t0_dup_total || 0,
        trades_opened: data.trades_opened || 0,
        exit_pending: data.exit_pending || 0,
        telegram_messages_sent: data.telegram_messages_sent || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.log('❌ Erreur lors de la récupération des métriques:', error);
      return null;
    }
  }

  private logMetrics(metrics: MetricsSnapshot): void {
    console.log(`  📈 t0_new_total: ${metrics.t0_new_total}`);
    console.log(`  🔄 t0_dup_total: ${metrics.t0_dup_total}`);
    console.log(`  💰 trades_opened: ${metrics.trades_opened}`);
    console.log(`  ⏰ exit_pending: ${metrics.exit_pending}`);
    console.log(`  📱 telegram_messages_sent: ${metrics.telegram_messages_sent}`);
  }

  private async triggerSimulateNotice(): Promise<string | null> {
    try {
      // Créer un EventId déterministe pour le test
      const testEventId = buildEventId({
        source: 'bithumb.notice',
        base: 'TESTCOIN',
        url: 'https://www.bithumb.com/notice/notice_detail/12345',
        markets: ['KRW'],
        tradeTimeUtc: new Date().toISOString()
      });
      
      // Données de test crédibles
      const testData = {
        title: 'TESTCOIN (KRW) 신규 상장',
        tradeTimeUtc: new Date().toISOString(),
        url: 'https://www.bithumb.com/notice/notice_detail/12345',
        eventId: testEventId
      };

      console.log('📤 Envoi de la simulation...');
      const response = await this.httpClient.post(`${this.baseUrl}/simulate/notice`, testData);
      
      if (response.status !== 200) {
        console.log(`❌ /simulate/notice répond avec status ${response.status}`);
        return null;
      }

      return testEventId;
    } catch (error) {
      console.log('❌ Erreur lors de la simulation:', error);
      return null;
    }
  }

  private async waitForMetricsChange(initialMetrics: MetricsSnapshot): Promise<MetricsSnapshot | null> {
    console.log(`⏳ Attente des changements de métriques (timeout: ${this.testTimeout}ms)...`);
    
    let pollCount = 0;
    
    while (pollCount < this.maxPolls) {
      await this.sleep(this.pollInterval);
      pollCount++;
      
      const currentMetrics = await this.getMetrics();
      if (!currentMetrics) {
        console.log(`⚠️ Poll ${pollCount}/${this.maxPolls}: Impossible d'obtenir les métriques`);
        continue;
      }

      // Vérifier si les métriques ont changé
      const hasChanged = this.hasMetricsChanged(initialMetrics, currentMetrics);
      if (hasChanged) {
        console.log(`✅ Changements détectés après ${pollCount * this.pollInterval}ms`);
        return currentMetrics;
      }

      if (pollCount % 4 === 0) { // Log tous les 2 secondes
        console.log(`⏳ Poll ${pollCount}/${this.maxPolls}: En attente...`);
      }
    }

    console.log(`⏰ Timeout après ${this.testTimeout}ms`);
    return null;
  }

  private hasMetricsChanged(initial: MetricsSnapshot, current: MetricsSnapshot): boolean {
    return (
      current.t0_new_total > initial.t0_new_total ||
      current.t0_dup_total > initial.t0_dup_total ||
      current.trades_opened > initial.trades_opened ||
      current.exit_pending > initial.exit_pending
    );
  }

  private analyzeResults(initial: MetricsSnapshot, final: MetricsSnapshot): SelfTestResult {
    const deltas = {
      t0_new_total: final.t0_new_total - initial.t0_new_total,
      t0_dup_total: final.t0_dup_total - initial.t0_dup_total,
      trades_opened: final.trades_opened - initial.trades_opened,
      exit_pending: final.exit_pending - initial.exit_pending,
      telegram_messages_sent: (final.telegram_messages_sent || 0) - (initial.telegram_messages_sent || 0)
    };

    const errors: string[] = [];
    const warnings: string[] = [];

    // Assertions critiques (fail fast)
    if (deltas.t0_new_total === 0) {
      errors.push('t0_new_total n\'a pas augmenté');
    }

    if (deltas.trades_opened === 0) {
      errors.push('trades_opened n\'a pas augmenté (même en dry-run)');
    }

    if (deltas.exit_pending === 0) {
      errors.push('exit_pending n\'a pas augmenté');
    }

    // Vérifications de bon fonctionnement
    if (deltas.t0_dup_total === 0) {
      warnings.push('t0_dup_total n\'a pas augmenté (dédup peut ne pas être testé)');
    }

    if (deltas.telegram_messages_sent === 0 && process.env.TELEGRAM_SMOKE === 'true') {
      warnings.push('telegram_messages_sent n\'a pas augmenté (Telegram peut être désactivé)');
    }

    const success = errors.length === 0;
    const message = success ? 'PASS' : 'FAIL';

    return {
      success,
      message,
      deltas,
      errors,
      warnings
    };
  }

  private displayFinalResult(result: SelfTestResult): void {
    console.log('\n📊 RÉSULTAT FINAL DU SELF-TEST:\n');
    
    console.log(`🎯 Statut: ${result.message}`);
    
    console.log('\n📈 Deltas observés:');
    console.log(`  ➕ t0_new_total: +${result.deltas.t0_new_total}`);
    console.log(`  🔄 t0_dup_total: +${result.deltas.t0_dup_total}`);
    console.log(`  💰 trades_opened: +${result.deltas.trades_opened}`);
    console.log(`  ⏰ exit_pending: +${result.deltas.exit_pending}`);
    console.log(`  📱 telegram_messages_sent: +${result.deltas.telegram_messages_sent}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Erreurs critiques:');
      result.errors.forEach(error => console.log(`  • ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️ Avertissements:');
      result.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    console.log(`\n${result.success ? '✅' : '❌'} Self-test ${result.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exécution du self-test
async function main() {
  try {
    const selfTest = new SelfTestPostDetection();
    await selfTest.run();
  } catch (error) {
    console.error('❌ Erreur fatale du self-test:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
