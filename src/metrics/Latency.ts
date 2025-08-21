/**
 * Latency - Métriques de latence haute précision (ms)
 * Utilise process.hrtime.bigint() pour une précision nanoseconde
 * Estimateur P² pour p95/p99 sans stockage de toutes les valeurs
 */

import { Quantiles } from '../core/Quantiles';

export type LatencyLabel = 
  | 't0_fetch_done'
  | 't0_detected' 
  | 'dedup_inserted'
  | 'order_sent'
  | 'order_ack';

export interface LatencyFlow {
  flowId: string;
  startTime: bigint;
  marks: Map<LatencyLabel, bigint>;
}

export interface LatencyMetrics {
  t0_fetch_p95_ms: number;
  t0_detect_to_insert_p95_ms: number;
  t0_insert_to_order_p95_ms: number;
  t0_order_to_ack_p95_ms: number;
  t0_new_total: number;
  t0_dup_total: number;
  t0_future_total: number;
  t0_stale_total: number;
  t0_slow_warnings_total: number;
}

export class Latency {
  private flows = new Map<string, LatencyFlow>();
  private quantiles = Quantiles.getInstance();
  private counters = {
    t0_new_total: 0,
    t0_dup_total: 0,
    t0_future_total: 0,
    t0_stale_total: 0,
    t0_slow_warnings_total: 0
  };

  // Seuils d'alerte (soft SLO)
  private readonly thresholds = {
    detect_to_insert: 300,    // 300ms
    insert_to_order: 1500     // 1.5s
  };

  constructor() {
    // Pas besoin d'initialiser les estimateurs, ils sont gérés par Quantiles
  }

  /**
   * Commence un nouveau flow de latence (idempotent)
   */
  begin(flowId: string): void {
    // PATCH A: Silence sur re-begin, pas de log "already exists"
    if (this.flows.has(flowId)) {
      return; // No-op silencieux
    }
    
    this.flows.set(flowId, {
      flowId,
      startTime: process.hrtime.bigint(),
      marks: new Map()
    });
  }

  /**
   * Commence un flow seulement s'il n'existe pas (idempotent)
   */
  beginIfAbsent(flowId: string): void {
    const f = this.flows.get(flowId);
    if (f) return;            // pas de log, pas d'overwrite
    this.begin(flowId);
  }

  /**
   * Marque un point dans le flow de latence
   */
  mark(flowId: string, label: LatencyLabel): void {
    const flow = this.flows.get(flowId);
    if (!flow) {
      // PATCH A: Fail-open silencieux pour ne pas casser la mesure
      this.begin(flowId);
      const newFlow = this.flows.get(flowId)!;
      newFlow.marks.set(label, process.hrtime.bigint());
      return;
    }

    flow.marks.set(label, process.hrtime.bigint());
    
    // Calculer les deltas quand les paires sont disponibles
    this.calculateDeltas(flowId);
  }

  /**
   * Calcule les deltas de latence et nourrit les estimateurs
   */
  private calculateDeltas(flowId: string): void {
    const flow = this.flows.get(flowId);
    if (!flow) return;

    const marks = flow.marks;
    
    // T0 fetch done → detected
    if (marks.has('t0_fetch_done') && marks.has('t0_detected')) {
      const delta = this.calculateDelta(marks.get('t0_fetch_done')!, marks.get('t0_detected')!);
      this.quantiles.recordLatency('t0_fetch', delta, undefined, true);
    }

    // T0 detected → dedup inserted
    if (marks.has('t0_detected') && marks.has('dedup_inserted')) {
      const delta = this.calculateDelta(marks.get('t0_detected')!, marks.get('dedup_inserted')!);
      this.quantiles.recordLatency('t0_detect_to_insert', delta, undefined, true);
      
      // Vérifier le seuil d'alerte
      if (delta > this.thresholds.detect_to_insert) {
        this.counters.t0_slow_warnings_total++;
        console.warn(`⚠️ T0 slow (detect→insert p95): ${delta}ms > ${this.thresholds.detect_to_insert}ms`);
      }
    }

    // Dedup inserted → order sent
    if (marks.has('dedup_inserted') && marks.has('order_sent')) {
      const delta = this.calculateDelta(marks.get('dedup_inserted')!, marks.get('order_sent')!);
      this.quantiles.recordLatency('t0_insert_to_order', delta, undefined, true);
      
      // Vérifier le seuil d'alerte
      if (delta > this.thresholds.insert_to_order) {
        this.counters.t0_slow_warnings_total++;
        console.warn(`⚠️ Trade path slow (insert→order p95): ${delta}ms > ${this.thresholds.insert_to_order}ms`);
      }
    }

    // Order sent → order ack
    if (marks.has('order_sent') && marks.has('order_ack')) {
      const delta = this.calculateDelta(marks.get('order_sent')!, marks.get('order_ack')!);
      this.quantiles.recordLatency('t0_order_to_ack', delta, undefined, true);
    }
  }

  /**
   * Calcule la différence entre deux timestamps en millisecondes
   */
  private calculateDelta(start: bigint, end: bigint): number {
    const diff = end - start;
    return Number(diff) / 1_000_000; // Convertir ns en ms
  }

  /**
   * Incrémente un compteur
   */
  incrementCounter(counter: keyof typeof this.counters): void {
    this.counters[counter]++;
  }

  /**
   * Getters pour les métriques
   */
  getT0FetchP95Ms(): number {
    const stats = this.quantiles.getOperationStats('t0_fetch');
    return stats?.p95 || 0;
  }

  getT0DetectToInsertP95Ms(): number {
    const stats = this.quantiles.getOperationStats('t0_detect_to_insert');
    return stats?.p95 || 0;
  }

  getT0InsertToOrderP95Ms(): number {
    const stats = this.quantiles.getOperationStats('t0_insert_to_order');
    return stats?.p95 || 0;
  }

  getT0OrderToAckP95Ms(): number {
    const stats = this.quantiles.getOperationStats('t0_order_to_ack');
    return stats?.p95 || 0;
  }

  getT0NewTotal(): number {
    return this.counters.t0_new_total;
  }

  getT0DupTotal(): number {
    return this.counters.t0_dup_total;
  }

  getT0FutureTotal(): number {
    return this.counters.t0_future_total;
  }

  getT0StaleTotal(): number {
    return this.counters.t0_stale_total;
  }

  getT0SlowWarningsTotal(): number {
    return this.counters.t0_slow_warnings_total;
  }

  /**
   * Récupère toutes les métriques
   */
  getMetrics(): LatencyMetrics {
    return {
      t0_fetch_p95_ms: this.getT0FetchP95Ms(),
      t0_detect_to_insert_p95_ms: this.getT0DetectToInsertP95Ms(),
      t0_insert_to_order_p95_ms: this.getT0InsertToOrderP95Ms(),
      t0_order_to_ack_p95_ms: this.getT0OrderToAckP95Ms(),
      t0_new_total: this.getT0NewTotal(),
      t0_dup_total: this.getT0DupTotal(),
      t0_future_total: this.getT0FutureTotal(),
      t0_stale_total: this.getT0StaleTotal(),
      t0_slow_warnings_total: this.getT0SlowWarningsTotal()
    };
  }

  /**
   * Nettoie les flows terminés
   */
  cleanupFlow(flowId: string): void {
    this.flows.delete(flowId);
  }
  
  /**
   * Nettoie tous les flows (pour éviter la fuite mémoire)
   */
  cleanupAllFlows(): void {
    this.flows.clear();
  }

  /**
   * Reset des compteurs (pour les tests)
   */
  resetCounters(): void {
    this.counters = {
      t0_new_total: 0,
      t0_dup_total: 0,
      t0_future_total: 0,
      t0_stale_total: 0,
      t0_slow_warnings_total: 0
    };
  }
}

// Instance singleton
export const latency = new Latency();
