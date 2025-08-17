export interface HttpClientResponse<T = any> {
    status: number;
    data: T;
    headers: Record<string, string>;
    ok: boolean;
}
export declare class HttpClient {
    private defaultTimeoutMs;
    constructor(defaultTimeoutMs?: number);
    getJSON<T = any>(url: string, timeoutMs?: number): Promise<HttpClientResponse<T>>;
    postJSON<T = any>(url: string, body: any, timeoutMs?: number): Promise<HttpClientResponse<T>>;
    private extractHeaders;
}
