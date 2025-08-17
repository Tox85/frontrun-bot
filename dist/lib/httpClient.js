"use strict";
// HTTP Client robuste avec AbortController et timeout dur
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
class HttpClient {
    defaultTimeoutMs;
    constructor(defaultTimeoutMs = 1500) {
        this.defaultTimeoutMs = defaultTimeoutMs;
    }
    async getJSON(url, timeoutMs) {
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
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw error;
        }
    }
    async postJSON(url, body, timeoutMs) {
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
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw error;
        }
    }
    extractHeaders(headers) {
        const result = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=httpClient.js.map