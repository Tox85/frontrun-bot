export interface HttpClientConfig {
    timeoutMs: number;
    maxRetries: number;
    baseRetryDelayMs: number;
    maxRetryDelayMs: number;
    jitterPercent: number;
    userAgent?: string;
}
export interface HttpClientResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
}
export declare class HttpClient {
    private readonly name;
    private readonly config;
    private circuitBreaker;
    constructor(name: string, config: HttpClientConfig);
    get<T>(url: string, options?: {
        headers?: Record<string, string>;
        signal?: AbortSignal;
    }): Promise<HttpClientResponse<T>>;
    post<T>(url: string, data?: any, options?: {
        headers?: Record<string, string>;
        signal?: AbortSignal;
    }): Promise<HttpClientResponse<T>>;
    private executeWithRetry;
    private makeRequest;
    private fallbackRequest;
    private calculateRetryDelay;
    private sleep;
    private extractHeaders;
    getCircuitBreakerStats(): import("./CircuitBreaker").CircuitBreakerStats;
    isCircuitBreakerOpen(): boolean;
    resetCircuitBreaker(): void;
}
