"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
class CircuitBreaker {
    name;
    config;
    state = 'CLOSED';
    errorCount = 0;
    lastErrorTime = null;
    lastSuccessTime = null;
    openCount = 0;
    totalRequests = 0;
    failedRequests = 0;
    successfulRequests = 0;
    openTimer = null;
    constructor(name, config) {
        this.name = name;
        this.config = config;
    }
    async execute(operation, fallback) {
        this.totalRequests++;
        if (this.state === 'OPEN') {
            if (this.shouldAttemptReset()) {
                this.transitionToHalfOpen();
            }
            else {
                this.failedRequests++;
                if (fallback) {
                    return await fallback();
                }
                throw new Error(`Circuit breaker ${this.name} is OPEN`);
            }
        }
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onError();
            if (fallback) {
                return await fallback();
            }
            throw error;
        }
    }
    onSuccess() {
        this.errorCount = 0;
        this.lastSuccessTime = Date.now();
        this.successfulRequests++;
        if (this.state === 'HALF_OPEN') {
            this.transitionToClosed();
        }
    }
    onError() {
        this.errorCount++;
        this.lastErrorTime = Date.now();
        this.failedRequests++;
        if (this.state === 'CLOSED' && this.errorCount >= this.config.errorsBeforeOpen) {
            this.transitionToOpen();
        }
    }
    transitionToOpen() {
        this.state = 'OPEN';
        this.openCount++;
        console.warn(`[${this.name}] Circuit breaker OPEN after ${this.errorCount} errors`);
        // Programmer la transition vers HALF_OPEN
        this.openTimer = setTimeout(() => {
            this.transitionToHalfOpen();
        }, this.config.openDurationMs);
    }
    transitionToHalfOpen() {
        this.state = 'HALF_OPEN';
        console.log(`[${this.name}] Circuit breaker HALF_OPEN - testing recovery`);
        if (this.openTimer) {
            clearTimeout(this.openTimer);
            this.openTimer = null;
        }
    }
    transitionToClosed() {
        this.state = 'CLOSED';
        console.log(`[${this.name}] Circuit breaker CLOSED - recovered`);
    }
    shouldAttemptReset() {
        if (!this.lastErrorTime)
            return false;
        return Date.now() - this.lastErrorTime >= this.config.openDurationMs;
    }
    getStats() {
        return {
            state: this.state,
            errorCount: this.errorCount,
            lastErrorTime: this.lastErrorTime,
            lastSuccessTime: this.lastSuccessTime,
            openCount: this.openCount,
            totalRequests: this.totalRequests,
            failedRequests: this.failedRequests,
            successfulRequests: this.successfulRequests
        };
    }
    reset() {
        this.state = 'CLOSED';
        this.errorCount = 0;
        this.lastErrorTime = null;
        this.lastSuccessTime = null;
        if (this.openTimer) {
            clearTimeout(this.openTimer);
            this.openTimer = null;
        }
    }
    isOpen() {
        return this.state === 'OPEN';
    }
    isHalfOpen() {
        return this.state === 'HALF_OPEN';
    }
    isClosed() {
        return this.state === 'CLOSED';
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=CircuitBreaker.js.map