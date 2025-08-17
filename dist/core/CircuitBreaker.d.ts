export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export interface CircuitBreakerConfig {
    errorsBeforeOpen: number;
    openDurationMs: number;
    timeoutMs: number;
    maxRetries: number;
    baseRetryDelayMs: number;
    maxRetryDelayMs: number;
    jitterPercent: number;
}
export interface CircuitBreakerStats {
    state: CircuitBreakerState;
    errorCount: number;
    lastErrorTime: number | null;
    lastSuccessTime: number | null;
    openCount: number;
    totalRequests: number;
    failedRequests: number;
    successfulRequests: number;
}
export declare class CircuitBreaker {
    private readonly name;
    private readonly config;
    private state;
    private errorCount;
    private lastErrorTime;
    private lastSuccessTime;
    private openCount;
    private totalRequests;
    private failedRequests;
    private successfulRequests;
    private openTimer;
    constructor(name: string, config: CircuitBreakerConfig);
    execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onError;
    private transitionToOpen;
    private transitionToHalfOpen;
    private transitionToClosed;
    private shouldAttemptReset;
    getStats(): CircuitBreakerStats;
    reset(): void;
    isOpen(): boolean;
    isHalfOpen(): boolean;
    isClosed(): boolean;
}
