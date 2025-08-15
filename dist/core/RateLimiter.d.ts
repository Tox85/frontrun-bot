type RateLimitConfig = {
    timeWindow: number;
    maxRequests: number;
    retryDelay: number;
    maxRetries: number;
    backoffMultiplier: number;
};
type RateLimitState = {
    currentRequests: number;
    resetTime: number;
    consecutiveFailures: number;
    circuitOpenUntil: number;
};
export type CanMakeResult = {
    allowed: true;
} | {
    allowed: false;
    delay: number;
    reason: string;
};
export declare class RateLimiter {
    private readonly defaultConfig;
    private limits;
    private states;
    constructor(defaultConfig?: Partial<RateLimitConfig>);
    private upper;
    /** Store a fully-merged config for the exchange (no reference to defaultConfig). */
    setLimit(exchange: string, cfg: Partial<RateLimitConfig>): void;
    private getConfig;
    private getState;
    /** Decide if we can fire now. DOES NOT mutate counters; call recordSuccess/Failure after. */
    canMakeRequest(exchange: string): CanMakeResult;
    /** Call after a successful request that consumed quota. */
    recordSuccess(exchange: string): void;
    /** Call after a failure (HTTP/429 or network). */
    recordFailure(exchange: string): void;
    /** Wait until we're allowed again (uses precise remaining delay or retryDelay fallback). */
    waitForAvailability(exchange: string): Promise<void>;
    /** Helper: run fn with rate limit + backoff; throws after maxRetries. */
    executeWithRateLimit<T>(exchange: string, fn: () => Promise<T>): Promise<T>;
    getStateSnapshot(exchange: string): RateLimitState | null;
    resetState(): void;
}
export declare const rateLimiter: RateLimiter;
export {};
