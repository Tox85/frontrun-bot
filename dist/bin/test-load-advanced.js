#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StructuredLogger_1 = require("../core/StructuredLogger");
class AdvancedLoadTester {
    logger;
    results = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    async runLoadTest(config) {
        console.log('🚀 Test de charge avancé démarré\n');
        console.log(`📊 Configuration:`);
        console.log(`   - URL de base: ${config.baseUrl}`);
        console.log(`   - Utilisateurs concurrents: ${config.concurrentUsers}`);
        console.log(`   - Requêtes par utilisateur: ${config.requestsPerUser}`);
        console.log(`   - Délai entre requêtes: ${config.delayBetweenRequests}ms`);
        console.log(`   - Timeout: ${config.timeout}ms\n`);
        const startTime = Date.now();
        // Initialiser les résultats
        config.endpoints.forEach(endpoint => {
            const key = `${endpoint.method} ${endpoint.path}`;
            this.results.set(key, {
                endpoint: endpoint.path,
                method: endpoint.method,
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                totalTime: 0,
                averageResponseTime: 0,
                minResponseTime: Infinity,
                maxResponseTime: 0,
                p95ResponseTime: 0,
                requestsPerSecond: 0,
                errors: []
            });
        });
        // Lancer les tests concurrents
        const promises = [];
        for (let user = 0; user < config.concurrentUsers; user++) {
            promises.push(this.runUserLoadTest(config, user));
        }
        await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        this.calculateFinalResults(totalTime);
        this.printResults();
    }
    async runUserLoadTest(config, userId) {
        for (let request = 0; request < config.requestsPerUser; request++) {
            const endpoint = config.endpoints[request % config.endpoints.length];
            if (!endpoint)
                continue;
            const key = `${endpoint.method} ${endpoint.path}`;
            const result = this.results.get(key);
            try {
                const requestStart = Date.now();
                const response = await this.makeRequest(`${config.baseUrl}${endpoint.path}`, endpoint.method, endpoint.body, endpoint.headers, config.timeout);
                const responseTime = Date.now() - requestStart;
                result.totalRequests++;
                result.successfulRequests++;
                result.totalTime += responseTime;
                result.minResponseTime = Math.min(result.minResponseTime, responseTime);
                result.maxResponseTime = Math.max(result.maxResponseTime, responseTime);
                if (response.status >= 400) {
                    result.failedRequests++;
                    result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
                }
            }
            catch (error) {
                result.totalRequests++;
                result.failedRequests++;
                result.errors.push(error instanceof Error ? error.message : String(error));
            }
            // Délai entre requêtes
            if (request < config.requestsPerUser - 1) {
                await this.sleep(config.delayBetweenRequests);
            }
        }
    }
    async makeRequest(url, method, body, headers, timeout = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: body ? JSON.stringify(body) : null,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    calculateFinalResults(totalTime) {
        this.results.forEach(result => {
            if (result.successfulRequests > 0) {
                result.averageResponseTime = result.totalTime / result.successfulRequests;
                result.requestsPerSecond = (result.totalRequests / totalTime) * 1000;
            }
        });
    }
    printResults() {
        console.log('\n📊 Résultats des tests de charge:\n');
        this.results.forEach((result, key) => {
            console.log(`🔗 ${key}`);
            console.log(`   📈 Total: ${result.totalRequests} requêtes`);
            console.log(`   ✅ Succès: ${result.successfulRequests}`);
            console.log(`   ❌ Échecs: ${result.failedRequests}`);
            console.log(`   ⏱️  Temps moyen: ${result.averageResponseTime.toFixed(2)}ms`);
            console.log(`   🚀 Temps min: ${result.minResponseTime}ms`);
            console.log(`   🐌 Temps max: ${result.maxResponseTime}ms`);
            console.log(`   📊 Requêtes/sec: ${result.requestsPerSecond.toFixed(2)}`);
            if (result.errors.length > 0) {
                console.log(`   ⚠️  Erreurs: ${result.errors.slice(0, 3).join(', ')}`);
                if (result.errors.length > 3) {
                    console.log(`      ... et ${result.errors.length - 3} autres`);
                }
            }
            console.log('');
        });
        // Résumé global
        const totalRequests = Array.from(this.results.values()).reduce((sum, r) => sum + r.totalRequests, 0);
        const totalSuccess = Array.from(this.results.values()).reduce((sum, r) => sum + r.successfulRequests, 0);
        const totalErrors = Array.from(this.results.values()).reduce((sum, r) => sum + r.failedRequests, 0);
        const avgResponseTime = Array.from(this.results.values()).reduce((sum, r) => sum + r.averageResponseTime, 0) / this.results.size;
        console.log('🎯 Résumé global:');
        console.log(`   📊 Total des requêtes: ${totalRequests}`);
        console.log(`   ✅ Taux de succès: ${((totalSuccess / totalRequests) * 100).toFixed(2)}%`);
        console.log(`   ❌ Taux d'échec: ${((totalErrors / totalRequests) * 100).toFixed(2)}%`);
        console.log(`   ⏱️  Temps de réponse moyen: ${avgResponseTime.toFixed(2)}ms`);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
async function runAdvancedLoadTest() {
    const logger = new StructuredLogger_1.StructuredLogger(StructuredLogger_1.LogLevel.INFO);
    const loadTester = new AdvancedLoadTester(logger);
    const config = {
        baseUrl: 'http://localhost:3001',
        endpoints: [
            { path: '/health', method: 'GET' },
            { path: '/metrics', method: 'GET' },
            { path: '/dashboard', method: 'GET' },
            {
                path: '/simulate/notice',
                method: 'POST',
                body: {
                    base: 'TEST_LOAD',
                    markets: ['KRW'],
                    published_at: new Date().toISOString()
                }
            }
        ],
        concurrentUsers: 5,
        requestsPerUser: 20,
        delayBetweenRequests: 100,
        timeout: 5000
    };
    try {
        await loadTester.runLoadTest(config);
        logger.info('Test de charge avancé terminé avec succès');
    }
    catch (error) {
        logger.error('Erreur lors du test de charge', error);
        console.error('❌ Erreur:', error);
    }
}
// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});
// Lancer le test
runAdvancedLoadTest().catch(console.error);
//# sourceMappingURL=test-load-advanced.js.map