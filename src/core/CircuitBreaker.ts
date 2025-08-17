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

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private errorCount = 0;
  private lastErrorTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private openCount = 0;
  private totalRequests = 0;
  private failedRequests = 0;
  private successfulRequests = 0;
  private openTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    this.totalRequests++;

    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
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
    } catch (error) {
      this.onError();
      if (fallback) {
        return await fallback();
      }
      throw error;
    }
  }

  private onSuccess(): void {
    this.errorCount = 0;
    this.lastSuccessTime = Date.now();
    this.successfulRequests++;
    
    if (this.state === 'HALF_OPEN') {
      this.transitionToClosed();
    }
  }

  private onError(): void {
    this.errorCount++;
    this.lastErrorTime = Date.now();
    this.failedRequests++;

    if (this.state === 'CLOSED' && this.errorCount >= this.config.errorsBeforeOpen) {
      this.transitionToOpen();
    }
  }

  private transitionToOpen(): void {
    this.state = 'OPEN';
    this.openCount++;
    console.warn(`[${this.name}] Circuit breaker OPEN after ${this.errorCount} errors`);
    
    // Programmer la transition vers HALF_OPEN
    this.openTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.config.openDurationMs);
  }

  private transitionToHalfOpen(): void {
    this.state = 'HALF_OPEN';
    console.log(`[${this.name}] Circuit breaker HALF_OPEN - testing recovery`);
    
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  private transitionToClosed(): void {
    this.state = 'CLOSED';
    console.log(`[${this.name}] Circuit breaker CLOSED - recovered`);
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastErrorTime) return false;
    return Date.now() - this.lastErrorTime >= this.config.openDurationMs;
  }

  getStats(): CircuitBreakerStats {
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

  reset(): void {
    this.state = 'CLOSED';
    this.errorCount = 0;
    this.lastErrorTime = null;
    this.lastSuccessTime = null;
    
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  isHalfOpen(): boolean {
    return this.state === 'HALF_OPEN';
  }

  isClosed(): boolean {
    return this.state === 'CLOSED';
  }
}
