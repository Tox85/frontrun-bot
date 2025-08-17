// HTTP Client robuste avec AbortController et timeout dur

export interface HttpClientResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
  ok: boolean;
}

export class HttpClient {
  private defaultTimeoutMs: number;

  constructor(defaultTimeoutMs: number = 1500) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  async getJSON<T = any>(url: string, timeoutMs?: number): Promise<HttpClientResponse<T>> {
    const timeout = timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FrontrunBot-Validator/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      return {
        status: response.status,
        data,
        headers: this.extractHeaders(response.headers),
        ok: response.ok
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  async postJSON<T = any>(url: string, body: any, timeoutMs?: number): Promise<HttpClientResponse<T>> {
    const timeout = timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FrontrunBot-Validator/1.0'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      return {
        status: response.status,
        data,
        headers: this.extractHeaders(response.headers),
        ok: response.ok
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}
