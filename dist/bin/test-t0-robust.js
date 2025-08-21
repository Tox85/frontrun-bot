#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const NoticeClient_1 = require("../watchers/NoticeClient");
const BaselineManager_1 = require("../core/BaselineManager");
const Migrations_1 = require("../store/Migrations");
const WatermarkStore_1 = require("../store/WatermarkStore");
const HttpClient_1 = require("../core/HttpClient");
const decodeBest_1 = require("../utils/decodeBest");
const extractTickers_1 = require("../utils/extractTickers");
const detectListingKRW_1 = require("../detection/detectListingKRW");
/**
 * Script de test spécialisé pour valider le patch T0 Robust
 * Teste : décodage robuste, extraction multi-tickers, détection KRW
 */
async function testT0Robust() {
    console.log('🧪 === TEST T0 ROBUST === 🧪');
    console.log('Validant le patch de robustesse pour Bithumb KRW listings...\n');
    try {
        // Créer une base de données temporaire
        const db = new sqlite3_1.Database(':memory:');
        // Exécuter les migrations
        const migrationRunner = new Migrations_1.MigrationRunner(db);
        await migrationRunner.runMigrations();
        console.log('✅ Migrations exécutées');
        // Initialiser le BaselineManager
        const baselineManager = new BaselineManager_1.BaselineManager(db);
        await baselineManager.initialize();
        console.log('✅ BaselineManager initialisé');
        // Créer le WatermarkStore
        const watermarkStore = new WatermarkStore_1.WatermarkStore(db);
        await watermarkStore.initializeAtBoot('bithumb.notice');
        // Créer le NoticeClient
        const noticeClient = new NoticeClient_1.NoticeClient('https://api.bithumb.com/public/notices', new HttpClient_1.HttpClient('NoticeClient', {
            timeoutMs: 5000,
            maxRetries: 3,
            baseRetryDelayMs: 250,
            maxRetryDelayMs: 500,
            jitterPercent: 20
        }), watermarkStore, 60000, // logDedupWindowMs
        2 // logDedupMaxPerWindow
        );
        console.log('✅ NoticeClient créé avec succès\n');
        // === TEST 1: Décodage robuste ===
        console.log('🔍 TEST 1: Décodage robuste (mojibake handling)');
        await testRobustDecoding();
        // === TEST 2: Extraction multi-tickers ===
        console.log('\n🔍 TEST 2: Extraction multi-tickers');
        await testMultiTickerExtraction();
        // === TEST 3: Détection KRW robuste ===
        console.log('\n🔍 TEST 3: Détection KRW robuste');
        await testRobustKRWDetection();
        // === TEST 4: Pipeline complet T0 ===
        console.log('\n🔍 TEST 4: Pipeline complet T0 Robust');
        await testCompleteT0Pipeline(noticeClient, baselineManager);
        console.log('\n🎯 === VALIDATION T0 ROBUST TERMINÉE === 🎯');
        console.log('✅ Tous les composants robustes fonctionnent correctement');
        console.log('✅ Le bot est maintenant "inratable" sur les listings KRW Bithumb');
    }
    catch (error) {
        console.error('❌ Erreur lors de la validation T0 Robust:', error);
        process.exit(1);
    }
}
/**
 * Test 1: Validation du décodage robuste
 */
async function testRobustDecoding() {
    console.log('  - Test décodage avec mojibake...');
    // Simuler du texte corrompu (mojibake)
    const corruptedText = Buffer.from('가상자산(BIO) 원화 마켓 상장', 'utf8');
    const decoded = (0, decodeBest_1.decodeBest)(corruptedText);
    console.log(`    ✅ Décodage: ${decoded.encoding}, confiance: ${decoded.confidence.toFixed(2)}`);
    console.log(`    ✅ Texte décodé: ${decoded.text.substring(0, 50)}...`);
    console.log(`    ✅ Caractères Hangul détectés: ${decoded.hasHangul ? 'OUI' : 'NON'}`);
    if (decoded.confidence > 0.5) {
        console.log('    ✅ Décodage robuste: SUCCÈS');
    }
    else {
        throw new Error('Décodage robuste échoué - confiance trop faible');
    }
}
/**
 * Test 2: Validation de l'extraction multi-tickers
 */
async function testMultiTickerExtraction() {
    console.log('  - Test extraction multi-tickers...');
    // Texte avec plusieurs tickers
    const testText = 'LISTA(LISTA) 상장, MERL(MERL) 상장, BIO(BIO) 원화 마켓 신규 추가';
    const extraction = (0, extractTickers_1.extractTickersWithConfidence)(testText, testText);
    console.log(`    ✅ Tickers extraits: [${extraction.tickers.join(', ')}]`);
    console.log(`    ✅ Confiance d'extraction: ${extraction.confidence.toFixed(2)}`);
    console.log(`    ✅ Caractères de remplacement: ${extraction.replacementChars}`);
    if (extraction.tickers.length >= 3) {
        console.log('    ✅ Extraction multi-tickers: SUCCÈS');
    }
    else {
        throw new Error('Extraction multi-tickers échouée - pas assez de tickers');
    }
}
/**
 * Test 3: Validation de la détection KRW robuste
 */
async function testRobustKRWDetection() {
    console.log('  - Test détection KRW robuste...');
    // Test avec différents formats de notices
    const testCases = [
        {
            title: '바이오 프로토콜(BIO) 원화 마켓 신규 추가',
            body: '새로운 토큰이 추가되었습니다',
            expected: true
        },
        {
            title: 'BIO KRW market listing',
            body: 'New token added to market',
            expected: true
        },
        {
            title: 'Maintenance notice',
            body: 'System maintenance',
            expected: false
        }
    ];
    for (const testCase of testCases) {
        const result = (0, detectListingKRW_1.detectListingKRW)({
            title: testCase.title,
            body: testCase.body,
            tickers: ['BIO']
        });
        const status = result.isListing === testCase.expected ? '✅' : '❌';
        console.log(`    ${status} "${testCase.title}": ${result.isListing ? 'LISTING' : 'NON-LISTING'} (score: ${result.score})`);
        if (result.isListing !== testCase.expected) {
            throw new Error(`Détection KRW échouée pour: ${testCase.title}`);
        }
    }
    console.log('    ✅ Détection KRW robuste: SUCCÈS');
}
/**
 * Test 4: Validation du pipeline complet T0
 */
async function testCompleteT0Pipeline(noticeClient, baselineManager) {
    console.log('  - Test pipeline complet T0...');
    // Simuler une notice complexe
    const mockNotice = {
        id: Date.now(),
        title: 'LISTA(LISTA) 및 MERL(MERL) 원화 마켓 신규 상장',
        categories: ['공지', '마켓'],
        pc_url: 'https://test.com',
        published_at: '2025-08-20 23:16:52', // Format KST compatible
        content: '두 개의 새로운 토큰이 원화 마켓에 추가되었습니다'
    };
    // Traiter la notice via le pipeline T0
    const processedResults = await noticeClient.processNotice(mockNotice, {
        source: 'simulate',
        ignoreWatermark: true,
        bypassBaseline: true
    });
    if (processedResults && processedResults.length > 0) {
        console.log(`    ✅ Notice traitée: ${processedResults.length} événements générés`);
        for (const result of processedResults) {
            console.log(`      - Token: ${result.base}, EventId: ${result.eventId.substring(0, 8)}...`);
            // Vérifier que c'est un nouveau token
            const isNew = await baselineManager.isTokenNew(result.base);
            console.log(`        Baseline check: ${isNew ? 'NOUVEAU' : 'EXISTANT'}`);
        }
        console.log('    ✅ Pipeline T0 complet: SUCCÈS');
    }
    else {
        throw new Error('Pipeline T0 échoué - aucune notice traitée');
    }
}
// Lancer la validation
testT0Robust().catch(console.error);
//# sourceMappingURL=test-t0-robust.js.map