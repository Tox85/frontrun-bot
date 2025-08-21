#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
/**
 * Validateur T0 end-to-end pour vérifier la pipeline complète
 */
class T0Validator {
    baseUrl;
    testBase;
    dryRun;
    constructor(baseUrl, testBase, dryRun = false) {
        this.baseUrl = baseUrl;
        this.testBase = testBase;
        this.dryRun = dryRun;
    }
    /**
     * Récupère les métriques depuis l'API de manière robuste
     */
    async getMetricsRobust() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/metrics`);
            const metrics = response.data;
            // Lecture robuste avec fallback à 0
            return {
                new: Number(metrics?.t0?.t0_new_total || 0),
                dup: Number(metrics?.t0?.t0_dup_total || 0),
                future: Number(metrics?.t0?.t0_future_total || 0),
                p95_detect_insert: Number(metrics?.t0?.t0_detect_to_insert_p95_ms || 0),
                p95_insert_order: Number(metrics?.t0?.t0_insert_to_order_p95_ms || 0)
            };
        }
        catch (error) {
            console.error('❌ Erreur lors de la récupération des métriques:', error);
            return {
                new: 0,
                dup: 0,
                future: 0,
                p95_detect_insert: 0,
                p95_insert_order: 0
            };
        }
    }
    /**
     * Pause avec promesse
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Simule une notice live
     */
    async simulateNoticeLive() {
        console.log('📡 Simulation notice live:', this.testBase);
        // PATCH: Générer publishedAt en KST (UTC+9) avec offset explicite
        const nowUtc = new Date();
        const kstMs = nowUtc.getTime() + 9 * 60 * 60 * 1000;
        const publishedAtKst = new Date(kstMs).toISOString().replace('Z', '+09:00');
        // Garder ces valeurs constantes pour les duplicatas
        const stableUrl = `https://api.bithumb.com/v1/notices/${this.testBase}-e2e`;
        const notice = {
            title: `${this.testBase}(테스트) 원화 마켓 상장 안내`,
            content: `테스트 토큰 ${this.testBase}의 원화 마켓 상장을 안내합니다.`,
            url: stableUrl,
            publishedAt: publishedAtKst, // ✅ KST conforme au feed
            tradeTimeUtc: nowUtc.toISOString()
        };
        if (this.dryRun) {
            console.log('🧪 DRY RUN - Notice:', notice);
            return;
        }
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/simulate/notice`, notice);
            console.log('✅ Notice simulée avec succès');
            if (response.data?.notice) {
                console.log('🧪 Simulated notice processed:', response.data.notice.base);
                console.log('T0 candidate base=' + response.data.notice.base, 'eventId=' + response.data.notice.eventId);
            }
        }
        catch (error) {
            console.error('❌ Erreur lors de la simulation:', error);
            throw error;
        }
    }
    /**
     * Teste la déduplication (5x la même notice)
     */
    async testDeduplication() {
        console.log('�� Test déduplication (5x la même notice)...');
        // Garder les mêmes valeurs pour avoir le même eventId
        const nowUtc = new Date();
        const kstMs = nowUtc.getTime() + 9 * 60 * 60 * 1000;
        const publishedAtKst = new Date(kstMs).toISOString().replace('Z', '+09:00');
        const stableUrl = `https://api.bithumb.com/v1/notices/${this.testBase}-e2e`;
        const notice = {
            title: `${this.testBase}(테스트) 원화 마켓 상장 안내 - DEDUP TEST`,
            content: `테스트 토큰 ${this.testBase}의 원화 마켓 상장을 안내합니다.`,
            url: stableUrl,
            publishedAt: publishedAtKst,
            tradeTimeUtc: nowUtc.toISOString()
        };
        if (this.dryRun) {
            console.log('🧪 DRY RUN - DEDUP Test:', notice);
            return;
        }
        // Envoyer 5 fois la même notice
        for (let i = 0; i < 5; i++) {
            try {
                await axios_1.default.post(`${this.baseUrl}/simulate/notice`, notice);
                console.log(`✅ DEDUP notice ${i + 1}/5 envoyée`);
            }
            catch (error) {
                console.error(`❌ Erreur DEDUP notice ${i + 1}/5:`, error);
            }
        }
    }
    /**
     * Teste une notice future (pas de trade)
     */
    async testFutureNotice() {
        console.log('⏰ Test notice future (pas de trade)...');
        const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h
        const kstMs = futureTime.getTime() + 9 * 60 * 60 * 1000;
        const publishedAtKst = new Date(kstMs).toISOString().replace('Z', '+09:00');
        const notice = {
            title: `${this.testBase}(테스트) 원화 마켓 상장 안내 - FUTURE TEST`,
            content: `테스트 토큰 ${this.testBase}의 원화 마켓 상장을 안내합니다.`,
            url: `https://api.bithumb.com/v1/notices/${this.testBase}-future`,
            publishedAt: publishedAtKst,
            tradeTimeUtc: futureTime.toISOString()
        };
        if (this.dryRun) {
            console.log('🧪 DRY RUN - Future notice:', notice);
            return;
        }
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/simulate/notice`, notice);
            console.log('✅ Test notice future réussi');
            if (response.data?.notice) {
                console.log('🧪 Future notice processed:', response.data.notice.base);
            }
        }
        catch (error) {
            console.error('❌ Erreur notice future:', error);
            throw error;
        }
    }
    /**
     * Valide les résultats finaux
     */
    validateResults(initial, final) {
        const errors = [];
        // Vérifier que t0_new_total a augmenté de 1
        if (final.new !== initial.new + 1) {
            errors.push(`t0_new_total n'a pas augmenté de 1: ${initial.new} -> ${final.new}`);
        }
        // Vérifier que t0_detect_to_insert_p95_ms > 0
        if (final.p95_detect_insert === 0) {
            errors.push('t0_detect_to_insert_p95_ms est nul');
        }
        // Vérifier que t0_insert_to_order_p95_ms > 0 (si trading activé)
        if (final.p95_insert_order === 0) {
            errors.push('t0_insert_to_order_p95_ms est nul');
        }
        // Vérifier que la déduplication fonctionne
        if (final.dup === 0) {
            errors.push('Déduplication non fonctionnelle: t0_dup_total = 0');
        }
        return {
            success: errors.length === 0,
            errors
        };
    }
    /**
     * Exécute la validation complète
     */
    async run() {
        console.log('🧪 Validation e2e T0 - Démarrage...');
        // 1. Récupérer les métriques initiales
        const initial = await this.getMetricsRobust();
        console.log('📊 Métriques initiales:', initial);
        // 2. Simuler une notice live
        await this.simulateNoticeLive();
        // 3. Attendre le traitement et récupérer les métriques finales
        console.log('⏳ Attente active pour le traitement...');
        let final = await this.getMetricsRobust();
        // Attendre que t0_new_total augmente (max 5s)
        let attempts = 0;
        while (final.new === initial.new && attempts < 25) { // 25 * 200ms = 5s
            await this.sleep(200);
            final = await this.getMetricsRobust();
            attempts++;
        }
        console.log('📊 Métriques finales:', final);
        // 4. Tester la déduplication
        await this.testDeduplication();
        // 5. Tester une notice future
        await this.testFutureNotice();
        // 6. Valider les résultats
        const results = this.validateResults(initial, final);
        // 7. Afficher le résumé
        console.log('\n📋 Résultats de la validation:');
        console.log(`   Succès: ${results.success ? '✅' : '❌'}`);
        console.log(`   Message: ${results.success ? 'Validation T0 complète' : 'Échec de la validation'}`);
        if (results.errors.length > 0) {
            console.log('   Erreurs:');
            results.errors.forEach(error => console.log(`     ❌ ${error}`));
        }
        console.log('   Métriques finales:');
        console.log(`     t0_new_total: ${final.new}`);
        console.log(`     t0_dup_total: ${final.dup}`);
        console.log(`     t0_future_total: ${final.future}`);
        console.log(`     t0_detect_to_insert_p95_ms: ${final.p95_detect_insert}ms`);
        console.log(`     t0_insert_to_order_p95_ms: ${final.p95_insert_order}ms`);
        if (!results.success) {
            process.exit(1);
        }
    }
}
// Configuration
const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
const testBase = process.env.TEST_BASE || 'TESTA';
const dryRun = process.env.DRY_RUN === 'true';
console.log('🚀 Validation T0 - Configuration:');
console.log(`   Base URL: ${baseUrl}`);
console.log(`   Test Base: ${testBase}`);
console.log(`   Dry Run: ${dryRun}`);
// Exécution
const validator = new T0Validator(baseUrl, testBase, dryRun);
validator.run().catch(error => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
});
//# sourceMappingURL=validate-t0-live.js.map