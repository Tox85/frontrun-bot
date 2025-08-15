"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = exports.RateLimiter = void 0;
class RateLimiter {
    defaultConfig;
    limits = new Map(); // ALWAYS merged configs, never default by ref
    states = new Map();
    constructor(defaultConfig) {
        const base = {
            timeWindow: 60_000,
            maxRequests: 60,
            retryDelay: 1_000,
            maxRetries: 3,
            backoffMultiplier: 2,
        };
        this.defaultConfig = Object.freeze({ ...base, ...defaultConfig });
        // Configuration par défaut pour les exchanges principaux
        this.setLimit('BITHUMB', {
            maxRequests: 100,
            timeWindow: 60000,
            retryDelay: 1000,
            maxRetries: 3,
            backoffMultiplier: 2
        });
    }
    upper(s) { return s.toUpperCase(); }
    /** Store a fully-merged config for the exchange (no reference to defaultConfig). */
    setLimit(exchange, cfg) {
        const key = this.upper(exchange);
        const merged = { ...this.defaultConfig, ...cfg };
        this.limits.set(key, merged);
        // Initialiser l'état immédiatement pour que getStateSnapshot fonctionne
        if (!this.states.has(key)) {
            this.states.set(key, {
                currentRequests: 0,
                resetTime: 0,
                consecutiveFailures: 0,
                circuitOpenUntil: 0,
            });
        }
    }
    getConfig(exchangeUpper) {
        // If no specific config, return default (but tests set one for 'TEST')
        return this.limits.get(exchangeUpper) ?? this.defaultConfig;
    }
    getState(exchangeUpper) {
        const prev = this.states.get(exchangeUpper);
        if (prev)
            return prev;
        const st = {
            currentRequests: 0,
            resetTime: 0, // 0 → non initialisé
            consecutiveFailures: 0,
            circuitOpenUntil: 0,
        };
        this.states.set(exchangeUpper, st);
        return st;
    }
    /** Decide if we can fire now. DOES NOT mutate counters; call recordSuccess/Failure after. */
    canMakeRequest(exchange) {
        const key = this.upper(exchange);
        const cfg = this.getConfig(key);
        const st = this.getState(key);
        const now = Date.now();
        // Circuit breaker
        if (st.circuitOpenUntil > now) {
            return { allowed: false, delay: st.circuitOpenUntil - now, reason: 'Circuit breaker actif' };
        }
        // Initialise / rotate window
        if (st.resetTime === 0 || now >= st.resetTime) {
            st.currentRequests = 0;
            st.resetTime = now + cfg.timeWindow; // IMPORTANT: utilise la config exchange, pas default
        }
        if (st.currentRequests < cfg.maxRequests) {
            return { allowed: true };
        }
        return { allowed: false, delay: Math.max(0, st.resetTime - now), reason: 'Rate limit atteint' };
    }
    /** Call after a successful request that consumed quota. */
    recordSuccess(exchange) {
        const key = this.upper(exchange);
        const cfg = this.getConfig(key);
        const st = this.getState(key);
        // Initialiser la fenêtre de temps si pas encore fait
        if (st.resetTime === 0) {
            st.resetTime = Date.now() + cfg.timeWindow;
        }
        // Consomme 1 (permet de dépasser temporairement la limite)
        st.currentRequests += 1;
        // Réarmement des échecs
        st.consecutiveFailures = 0;
        // Si on a atteint le plafond, la prochaine canMakeRequest retournera delay jusqu'à resetTime
    }
    /** Call after a failure (HTTP/429 or network). */
    recordFailure(exchange) {
        const key = this.upper(exchange);
        const cfg = this.getConfig(key);
        const st = this.getState(key);
        st.consecutiveFailures += 1;
        const penalty = cfg.retryDelay * Math.pow(cfg.backoffMultiplier, Math.max(0, st.consecutiveFailures - 1));
        st.circuitOpenUntil = Date.now() + penalty;
    }
    /** Wait until we're allowed again (uses precise remaining delay or retryDelay fallback). */
    async waitForAvailability(exchange) {
        const key = this.upper(exchange);
        // loop simple, l'appelant doit avoir une cancellation s'il en veut
        while (true) {
            const res = this.canMakeRequest(key);
            if (res.allowed)
                return;
            const delay = Math.max(res.delay ?? this.getConfig(key).retryDelay, 0);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    /** Helper: run fn with rate limit + backoff; throws after maxRetries. */
    async executeWithRateLimit(exchange, fn) {
        const key = this.upper(exchange);
        const cfg = this.getConfig(key);
        let attempt = 0;
        while (true) {
            await this.waitForAvailability(key);
            try {
                const out = await fn();
                this.recordSuccess(key);
                return out;
            }
            catch (e) {
                attempt++;
                this.recordFailure(key);
                if (attempt >= cfg.maxRetries)
                    throw e;
                const st = this.getState(key);
                const wait = Math.max(0, st.circuitOpenUntil - Date.now());
                if (wait > 0)
                    await new Promise(r => setTimeout(r, wait));
            }
        }
    }
    getStateSnapshot(exchange) {
        const s = this.states.get(this.upper(exchange));
        return s ? { ...s } : null;
    }
    resetState() {
        this.states.clear();
        // Recréer les états pour les exchanges configurés
        for (const [exchange, config] of this.limits) {
            this.states.set(exchange, {
                currentRequests: 0,
                resetTime: 0,
                consecutiveFailures: 0,
                circuitOpenUntil: 0,
            });
        }
    }
}
exports.RateLimiter = RateLimiter;
// Export de l'instance singleton
exports.rateLimiter = new RateLimiter();
//# sourceMappingURL=RateLimiter.js.map