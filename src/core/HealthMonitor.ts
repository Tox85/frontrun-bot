/**
 * HealthMonitor - Surveillance de la santé du bot
 * Métriques de performance, trading et baseline
 */

import { KRBaselineToken, HealthMetrics, BaselineSanity } from '../types/listing';

export interface BaselineStats {
  upbit_krw_tokens: number;
  bithumb_krw_tokens: number;
  kr_union_tokens: number;
  last_updated: string;
}

export interface PerformanceMetrics {
  detection_to_order: number[];  // ms
  order_to_ack: number[];       // ms
  trade_execution: number[];    // ms
  last_updated: string;
}

export interface TradingStatus {
  trading_enabled: boolean;
  consecutive_failures: number;
  circuit_breaker_triggered: boolean;
  last_failure: string | null;
}

export class HealthMonitor {
  private performanceMetrics: PerformanceMetrics;
  private tradingStatus: TradingStatus;
  private baselineStats: BaselineStats;

  constructor() {
    this.performanceMetrics = {
      detection_to_order: [],
      order_to_ack: [],
      trade_execution: [],
      last_updated: new Date().toISOString()
    };

    this.tradingStatus = {
      trading_enabled: true,
      consecutive_failures: 0,
      circuit_breaker_triggered: false,
      last_failure: null
    };

    this.baselineStats = {
      upbit_krw_tokens: 0,
      bithumb_krw_tokens: 0,
      kr_union_tokens: 0,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * CORRECTION CRITIQUE : Mettre à jour les vraies métriques par source
   */
  updateBaselineStats(stats: {
    upbit_krw_tokens: number;
    bithumb_krw_tokens: number;
    kr_union_tokens: number;
  }): void {
    // CORRECTION : Ne pas copier kr_union_tokens dans chaque source
    this.baselineStats = {
      upbit_krw_tokens: stats.upbit_krw_tokens,
      bithumb_krw_tokens: stats.bithumb_krw_tokens,
      kr_union_tokens: stats.kr_union_tokens,
      last_updated: new Date().toISOString()
    };
    
    // Log de debug pour vérifier les vraies valeurs
    console.log('🔍 DEBUG HealthMonitor - Vraies métriques:');
    console.log(`  📊 Upbit KRW tokens: ${stats.upbit_krw_tokens}`);
    console.log(`  📊 Bithumb KRW tokens: ${stats.bithumb_krw_tokens}`);
    console.log(`  📊 Union KR tokens: ${stats.kr_union_tokens}`);
    
    // Vérification de cohérence
    if (stats.upbit_krw_tokens === stats.kr_union_tokens || 
        stats.bithumb_krw_tokens === stats.kr_union_tokens) {
      console.warn('⚠️ ATTENTION: Possible bug de métriques - valeurs identiques détectées');
    }
  }

  /**
   * Enregistrer un événement de détection
   */
  recordDetectionEvent(event: {
    eventId: string;
    source: string;
    token_base: string;
    markets: string[];
    notice_url: string;
    detected_at: string;
    is_krw_listing: boolean;
    confidence_score: number;
  }): void {
    // Log de l'événement pour debug
    console.log(`📊 Événement enregistré: ${event.token_base} (${event.source})`);
  }

  /**
   * Enregistrer le temps de détection à ordre
   */
  recordDetectedToOrder(eventId: string, delayMs: number): void {
    this.performanceMetrics.detection_to_order.push(delayMs);
    if (this.performanceMetrics.detection_to_order.length > 100) {
      this.performanceMetrics.detection_to_order.shift();
    }
    this.performanceMetrics.last_updated = new Date().toISOString();
  }

  /**
   * Enregistrer le temps d'ordre à accusé
   */
  recordOrderToAck(eventId: string, delayMs: number): void {
    this.performanceMetrics.order_to_ack.push(delayMs);
    if (this.performanceMetrics.order_to_ack.length > 100) {
      this.performanceMetrics.order_to_ack.shift();
    }
    this.performanceMetrics.last_updated = new Date().toISOString();
  }

  /**
   * Enregistrer l'exécution d'un trade
   */
  recordTradeExecution(eventId: string, delayMs: number): void {
    this.performanceMetrics.trade_execution.push(delayMs);
    if (this.performanceMetrics.trade_execution.length > 100) {
      this.performanceMetrics.trade_execution.shift();
    }
    this.performanceMetrics.last_updated = new Date().toISOString();
  }

  /**
   * Enregistrer un échec de trading
   */
  recordTradingFailure(error: string): void {
    this.tradingStatus.consecutive_failures++;
    this.tradingStatus.last_failure = new Date().toISOString();
    
    console.warn(`⚠️ Échec de trading #${this.tradingStatus.consecutive_failures}: ${error}`);
    
    // Circuit breaker après 3 échecs consécutifs
    if (this.tradingStatus.consecutive_failures >= 3) {
      this.tradingStatus.trading_enabled = false;
      this.tradingStatus.circuit_breaker_triggered = true;
      console.error('🚨 CIRCUIT BREAKER ACTIVÉ: Trading désactivé après 3 échecs consécutifs');
    }
  }

  /**
   * Enregistrer un succès de trading
   */
  recordTradingSuccess(): void {
    this.tradingStatus.consecutive_failures = 0;
    this.tradingStatus.circuit_breaker_triggered = false;
    console.log('✅ Succès de trading - Circuit breaker réinitialisé');
  }

  /**
   * Calculer le 95ème percentile des latences
   */
  private calculateP95(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(0.95 * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Vérifier la santé de la baseline
   */
  private checkBaselineSanity(): BaselineSanity {
    const { upbit_krw_tokens, bithumb_krw_tokens, kr_union_tokens } = this.baselineStats;
    
    // Planchers de sanity selon le prompt Cursor
    const SANITY_FLOORS = {
      UPBIT_KRW_TOKENS: 200,
      BITHUMB_KRW_TOKENS: 200,
      KR_UNION_TOKENS: 300
    };
    
    const sanity = {
      upbit_sane: upbit_krw_tokens >= SANITY_FLOORS.UPBIT_KRW_TOKENS,
      bithumb_sane: bithumb_krw_tokens >= SANITY_FLOORS.BITHUMB_KRW_TOKENS,
      union_sane: kr_union_tokens >= SANITY_FLOORS.KR_UNION_TOKENS,
      overall_sane: false
    };
    
    sanity.overall_sane = sanity.upbit_sane && sanity.bithumb_sane && sanity.union_sane;
    
    // Log détaillé de la sanity
    console.log('🔍 SANITY CHECK Baseline:');
    console.log(`  📊 Upbit KRW: ${upbit_krw_tokens} tokens (plancher: ${SANITY_FLOORS.UPBIT_KRW_TOKENS}) - ${sanity.upbit_sane ? '✅' : '❌'}`);
    console.log(`  📊 Bithumb KRW: ${bithumb_krw_tokens} tokens (plancher: ${SANITY_FLOORS.BITHUMB_KRW_TOKENS}) - ${sanity.bithumb_sane ? '✅' : '❌'}`);
    console.log(`  📊 Union KR: ${kr_union_tokens} tokens (plancher: ${SANITY_FLOORS.KR_UNION_TOKENS}) - ${sanity.union_sane ? '✅' : '❌'}`);
    console.log(`  🎯 Overall: ${sanity.overall_sane ? '✅ SANE' : '❌ INSANE'}`);
    
    return sanity;
  }

  /**
   * Générer un rapport de santé complet
   */
  generateHealthReport(): HealthMetrics {
    const baselineSanity = this.checkBaselineSanity();
    
    return {
      timestamp: new Date().toISOString(),
      baseline: {
        upbit_krw_tokens: this.baselineStats.upbit_krw_tokens,
        bithumb_krw_tokens: this.baselineStats.bithumb_krw_tokens,
        kr_union_tokens: this.baselineStats.kr_union_tokens,
        sanity: baselineSanity.overall_sane,
        sanity_details: baselineSanity
      },
      performance: {
        p95_detection_to_order: this.calculateP95(this.performanceMetrics.detection_to_order),
        p95_order_to_ack: this.calculateP95(this.performanceMetrics.order_to_ack),
        p95_trade_execution: this.calculateP95(this.performanceMetrics.trade_execution),
        samples_count: this.performanceMetrics.detection_to_order.length
      },
      trading: {
        enabled: this.tradingStatus.trading_enabled,
        consecutive_failures: this.tradingStatus.consecutive_failures,
        circuit_breaker_triggered: this.tradingStatus.circuit_breaker_triggered,
        last_failure: this.tradingStatus.last_failure
      }
    };
  }

  /**
   * Vérifier si le trading est activé
   */
  isTradingEnabled(): boolean {
    return this.tradingStatus.trading_enabled;
  }

  /**
   * Forcer l'activation du trading
   */
  forceEnableTrading(): void {
    this.tradingStatus.trading_enabled = true;
    this.tradingStatus.consecutive_failures = 0;
    this.tradingStatus.circuit_breaker_triggered = false;
    console.log('🔓 Trading forcé activé');
  }

  /**
   * Obtenir les statistiques de performance
   */
  getPerformanceStats(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Obtenir les statistiques de la baseline
   */
  getBaselineStats(): BaselineStats {
    return { ...this.baselineStats };
  }
}
