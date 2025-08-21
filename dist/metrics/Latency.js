"use strict";
/**
 * Latency - Métriques de latence haute précision (ms)
 * Utilise process.hrtime.bigint() pour une précision nanoseconde
 * Estimateur P² pour p95/p99 sans stockage de toutes les valeurs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.latency = exports.Latency = void 0;
const Quantiles_1 = require("../core/Quantiles");
class Latency {
    flows = new Map();
    quantiles = Quantiles_1.Quantiles.getInstance();
    counters = {
        t0_new_total: 0,
        t0_dup_total: 0,
        t0_future_total: 0,
        t0_stale_total: 0,
        t0_slow_warnings_total: 0
    };
    // Seuils d'alerte (soft SLO)
    thresholds = {
        detect_to_insert: 300, // 300ms
        insert_to_order: 1500 // 1.5s
    };
    constructor() {
        // Pas besoin d'initialiser les estimateurs, ils sont gérés par Quantiles
    }
    /**
     * Commence un nouveau flow de latence (idempotent)
     */
    begin(flowId) {
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
    beginIfAbsent(flowId) {
        const f = this.flows.get(flowId);
        if (f)
            return; // pas de log, pas d'overwrite
        this.begin(flowId);
    }
    /**
     * Marque un point dans le flow de latence
     */
    mark(flowId, label) {
        const flow = this.flows.get(flowId);
        if (!flow) {
            // PATCH A: Fail-open silencieux pour ne pas casser la mesure
            this.begin(flowId);
            const newFlow = this.flows.get(flowId);
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
    calculateDeltas(flowId) {
        const flow = this.flows.get(flowId);
        if (!flow)
            return;
        const marks = flow.marks;
        // T0 fetch done → detected
        if (marks.has('t0_fetch_done') && marks.has('t0_detected')) {
            const delta = this.calculateDelta(marks.get('t0_fetch_done'), marks.get('t0_detected'));
            this.quantiles.recordLatency('t0_fetch', delta, undefined, true);
        }
        // T0 detected → dedup inserted
        if (marks.has('t0_detected') && marks.has('dedup_inserted')) {
            const delta = this.calculateDelta(marks.get('t0_detected'), marks.get('dedup_inserted'));
            this.quantiles.recordLatency('t0_detect_to_insert', delta, undefined, true);
            // Vérifier le seuil d'alerte
            if (delta > this.thresholds.detect_to_insert) {
                this.counters.t0_slow_warnings_total++;
                console.warn(`⚠️ T0 slow (detect→insert p95): ${delta}ms > ${this.thresholds.detect_to_insert}ms`);
            }
        }
        // Dedup inserted → order sent
        if (marks.has('dedup_inserted') && marks.has('order_sent')) {
            const delta = this.calculateDelta(marks.get('dedup_inserted'), marks.get('order_sent'));
            this.quantiles.recordLatency('t0_insert_to_order', delta, undefined, true);
            // Vérifier le seuil d'alerte
            if (delta > this.thresholds.insert_to_order) {
                this.counters.t0_slow_warnings_total++;
                console.warn(`⚠️ Trade path slow (insert→order p95): ${delta}ms > ${this.thresholds.insert_to_order}ms`);
            }
        }
        // Order sent → order ack
        if (marks.has('order_sent') && marks.has('order_ack')) {
            const delta = this.calculateDelta(marks.get('order_sent'), marks.get('order_ack'));
            this.quantiles.recordLatency('t0_order_to_ack', delta, undefined, true);
        }
    }
    /**
     * Calcule la différence entre deux timestamps en millisecondes
     */
    calculateDelta(start, end) {
        const diff = end - start;
        return Number(diff) / 1_000_000; // Convertir ns en ms
    }
    /**
     * Incrémente un compteur
     */
    incrementCounter(counter) {
        this.counters[counter]++;
    }
    /**
     * Getters pour les métriques
     */
    getT0FetchP95Ms() {
        const stats = this.quantiles.getOperationStats('t0_fetch');
        return stats?.p95 || 0;
    }
    getT0DetectToInsertP95Ms() {
        const stats = this.quantiles.getOperationStats('t0_detect_to_insert');
        return stats?.p95 || 0;
    }
    getT0InsertToOrderP95Ms() {
        const stats = this.quantiles.getOperationStats('t0_insert_to_order');
        return stats?.p95 || 0;
    }
    getT0OrderToAckP95Ms() {
        const stats = this.quantiles.getOperationStats('t0_order_to_ack');
        return stats?.p95 || 0;
    }
    getT0NewTotal() {
        return this.counters.t0_new_total;
    }
    getT0DupTotal() {
        return this.counters.t0_dup_total;
    }
    getT0FutureTotal() {
        return this.counters.t0_future_total;
    }
    getT0StaleTotal() {
        return this.counters.t0_stale_total;
    }
    getT0SlowWarningsTotal() {
        return this.counters.t0_slow_warnings_total;
    }
    /**
     * Récupère toutes les métriques
     */
    getMetrics() {
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
    cleanupFlow(flowId) {
        this.flows.delete(flowId);
    }
    /**
     * Nettoie tous les flows (pour éviter la fuite mémoire)
     */
    cleanupAllFlows() {
        this.flows.clear();
    }
    /**
     * Reset des compteurs (pour les tests)
     */
    resetCounters() {
        this.counters = {
            t0_new_total: 0,
            t0_dup_total: 0,
            t0_future_total: 0,
            t0_stale_total: 0,
            t0_slow_warnings_total: 0
        };
    }
}
exports.Latency = Latency;
// Instance singleton
exports.latency = new Latency();
//# sourceMappingURL=Latency.js.map