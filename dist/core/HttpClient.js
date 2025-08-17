"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
const CircuitBreaker_1 = require("./CircuitBreaker");
class HttpClient {
    name;
    config;
    circuitBreaker;
    constructor(name, config) {
        this.name = name;
        this.config = config;
        const cbConfig = {
            errorsBeforeOpen: 3,
            openDurationMs: 60000,
            timeoutMs: config.timeoutMs,
            maxRetries: config.maxRetries,
            baseRetryDelayMs: config.baseRetryDelayMs,
            maxRetryDelayMs: config.maxRetryDelayMs,
            jitterPercent: config.jitterPercent
        };
        this.circuitBreaker = new CircuitBreaker_1.CircuitBreaker(name, cbConfig);
    }
    async get(url, options) {
        return this.circuitBreaker.execute(() => this.executeWithRetry(() => this.makeRequest(url, 'GET', options)), () => this.fallbackRequest(url, options));
    }
    async post(url, data, options) {
        return this.circuitBreaker.execute(() => this.executeWithRetry(() => this.makeRequest(url, 'POST', { ...options, data })), () => this.fallbackRequest(url, options));
    }
    async executeWithRetry(operation) {
        let lastError;
        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (attempt === this.config.maxRetries) {
                    break;
                }
                const delay = this.calculateRetryDelay(attempt);
                console.warn(`[${this.name}] Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries + 1})`);
                await this.sleep(delay);
            }
        }
        throw lastError;
    }
    async makeRequest(url, method, options) {
        const controller = new AbortController();
        const signal = options?.signal || controller.signal;
        // Timeout automatique
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'User-Agent': this.config.userAgent || 'BithumbBot/2.0',
                    'Content-Type': 'application/json',
                    ...options?.headers
                },
                body: options?.data ? JSON.stringify(options.data) : null,
                signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                data,
                status: response.status,
                statusText: response.statusText,
                headers: this.extractHeaders(response.headers)
            };
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.config.timeoutMs}ms`);
            }
            throw error;
        }
    }
    async fallbackRequest(url, options) {
        console.warn(`[${this.name}] Using fallback for ${url}`);
        throw new Error(`Circuit breaker ${this.name} is OPEN - no fallback available`);
    }
    calculateRetryDelay(attempt) {
        const baseDelay = this.config.baseRetryDelayMs * Math.pow(2, attempt);
        const maxDelay = Math.min(baseDelay, this.config.maxRetryDelayMs);
        const jitter = maxDelay * (this.config.jitterPercent / 100) * Math.random();
        return Math.floor(maxDelay + jitter);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    extractHeaders(headers) {
        const result = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
    getCircuitBreakerStats() {
        return this.circuitBreaker.getStats();
    }
    isCircuitBreakerOpen() {
        return this.circuitBreaker.isOpen();
    }
    resetCircuitBreaker() {
        this.circuitBreaker.reset();
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=HttpClient.js.map