import { CircuitBreaker, CircuitBreakerConfig } from './CircuitBreaker';

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

export class HttpClient {
  private circuitBreaker: CircuitBreaker;

  constructor(
    private readonly name: string,
    private readonly config: HttpClientConfig
  ) {
    const cbConfig: CircuitBreakerConfig = {
      errorsBeforeOpen: 3,
      openDurationMs: 60000,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      baseRetryDelayMs: config.baseRetryDelayMs,
      maxRetryDelayMs: config.maxRetryDelayMs,
      jitterPercent: config.jitterPercent
    };

    this.circuitBreaker = new CircuitBreaker(name, cbConfig);
  }

  async get<T>(
    url: string,
    options?: {
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<HttpClientResponse<T>> {
    return this.circuitBreaker.execute(
      () => this.executeWithRetry(() => this.makeRequest<T>(url, 'GET', options)),
      () => this.fallbackRequest<T>(url, options)
    );
  }

  async post<T>(
    url: string,
    data?: any,
    options?: {
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<HttpClientResponse<T>> {
    return this.circuitBreaker.execute(
      () => this.executeWithRetry(() => this.makeRequest<T>(url, 'POST', { ...options, data })),
      () => this.fallbackRequest<T>(url, options)
    );
  }

  /**
   * Récupère une réponse en tant qu'ArrayBuffer pour le décodage binaire
   */
  async getArrayBuffer(url: string): Promise<{ buf: ArrayBuffer; headers: Headers }> {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    const buf = await res.arrayBuffer();
    return { buf, headers: res.headers };
  }

  private async executeWithRetry<T>(
    operation: () => Promise<HttpClientResponse<T>>
  ): Promise<HttpClientResponse<T>> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.config.maxRetries) {
          break;
        }

        const delay = this.calculateRetryDelay(attempt);
        console.warn(`[${this.name}] Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries + 1})`);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private async makeRequest<T>(
    url: string,
    method: 'GET' | 'POST',
    options?: {
      headers?: Record<string, string>;
      data?: any;
      signal?: AbortSignal;
    }
  ): Promise<HttpClientResponse<T>> {
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
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeoutMs}ms`);
      }
      
      throw error;
    }
  }

  private async fallbackRequest<T>(
    url: string,
    options?: {
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<HttpClientResponse<T>> {
    console.warn(`[${this.name}] Using fallback for ${url}`);
    throw new Error(`Circuit breaker ${this.name} is OPEN - no fallback available`);
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.baseRetryDelayMs * Math.pow(2, attempt);
    const maxDelay = Math.min(baseDelay, this.config.maxRetryDelayMs);
    const jitter = maxDelay * (this.config.jitterPercent / 100) * Math.random();
    
    return Math.floor(maxDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  isCircuitBreakerOpen(): boolean {
    return this.circuitBreaker.isOpen();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}
