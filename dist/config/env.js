"use strict";
/**
 * Configuration centralisée des variables d'environnement
 * Supporte les formats booléens multiples et validation robuste
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENVZ_ENABLED = exports.CONFIG = exports.toString = exports.toNumber = exports.toBool = void 0;
exports.validateConfig = validateConfig;
exports.getConfigSummary = getConfigSummary;
exports.logConfigSummary = logConfigSummary;
// Helpers pour parser les valeurs
const toBool = (value) => {
    if (!value)
        return false;
    return /^(1|true|yes|on)$/i.test(value.trim());
};
exports.toBool = toBool;
const toNumber = (value, defaultValue = 0) => {
    if (!value)
        return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
};
exports.toNumber = toNumber;
const toString = (value, defaultValue = '') => {
    return value?.trim() || defaultValue;
};
exports.toString = toString;
// Configuration principale
exports.CONFIG = {
    // Environnement
    NODE_ENV: (0, exports.toString)(process.env.NODE_ENV, 'development'),
    IS_PROD: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT,
    IS_RAILWAY: !!process.env.RAILWAY_ENVIRONMENT,
    LOG_LEVEL: (0, exports.toString)(process.env.LOG_LEVEL, 'debug'), // Changé à debug par défaut
    LOG_FORMAT: (0, exports.toString)(process.env.LOG_FORMAT, process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
    // Ports
    PORT: (0, exports.toNumber)(process.env.PORT, 3000),
    HEALTH_PORT: (0, exports.toNumber)(process.env.HEALTH_PORT, 3000),
    // Hyperliquid
    HL_ENABLED: (0, exports.toBool)(process.env.ENABLE_HYPERLIQUID),
    HL_TESTNET: (0, exports.toBool)(process.env.HYPERLIQUID_TESTNET) || (0, exports.toBool)(process.env.IS_DEMO),
    HL_WALLET: (0, exports.toString)(process.env.HYPERLIQUID_WALLET_ADDRESS),
    HL_PRIVATE_KEY: (0, exports.toString)(process.env.HYPERLIQUID_PRIVATE_KEY),
    HL_API_URL: (0, exports.toString)(process.env.HL_API_URL),
    HL_WS_URL: (0, exports.toString)(process.env.HL_WS_URL),
    // Exchanges
    UPBIT_ENABLED: (0, exports.toBool)(process.env.ENABLE_UPBIT),
    BITHUMB_ENABLED: (0, exports.toBool)(process.env.ENABLE_BITHUMB),
    BINANCE_ENABLED: (0, exports.toBool)(process.env.ENABLE_BINANCE),
    BYBIT_ENABLED: (0, exports.toBool)(process.env.ENABLE_BYBIT),
    // Binance
    BINANCE_API_KEY: (0, exports.toString)(process.env.BINANCE_API_KEY),
    BINANCE_SECRET: (0, exports.toString)(process.env.BINANCE_SECRET),
    // Bybit
    BYBIT_API_KEY: (0, exports.toString)(process.env.BYBIT_API_KEY),
    BYBIT_SECRET: (0, exports.toString)(process.env.BYBIT_SECRET),
    // Telegram
    TELEGRAM_ENABLED: (0, exports.toBool)(process.env.ENABLE_TELEGRAM),
    TELEGRAM_BOT_TOKEN: (0, exports.toString)(process.env.TELEGRAM_BOT_TOKEN),
    TELEGRAM_CHAT_ID: (0, exports.toString)(process.env.TELEGRAM_CHAT_ID),
    // Trading
    TRADE_AMOUNT_USDT: (0, exports.toNumber)(process.env.TRADE_AMOUNT_USDT, 400),
    LEVERAGE: (0, exports.toNumber)(process.env.LEVERAGE, 20),
    POSITION_SIZE_USDC: (0, exports.toNumber)(process.env.POSITION_SIZE_USDC, 400),
    // Risk Management
    // Risk Management - Stratégie Agressive
    RISK_PER_TRADE_USD: (0, exports.toNumber)(process.env.RISK_PER_TRADE_USD, 400),
    RISK_PER_TRADE_USDC_DEFAULT: (0, exports.toNumber)(process.env.RISK_PER_TRADE_USDC_DEFAULT, 0.5),
    RISK_PCT: (0, exports.toNumber)(process.env.RISK_PCT, 0.15), // 15% par trade (agressif)
    LEVERAGE_TARGET: (0, exports.toNumber)(process.env.LEVERAGE_TARGET, 8), // 8x levier (agressif)
    MAX_LEVERAGE_DEFAULT: (0, exports.toNumber)(process.env.MAX_LEVERAGE_DEFAULT, 8), // 8x max
    ORDER_TIMEOUT_MS: (0, exports.toNumber)(process.env.ORDER_TIMEOUT_MS, 15000),
    PERP_CHECK_TIMEOUT_MS: (0, exports.toNumber)(process.env.PERP_CHECK_TIMEOUT_MS, 200),
    DRY_RUN: (0, exports.toBool)(process.env.DRY_RUN),
    // Stratégie de Protection
    MAX_RISK_PER_TRADE: (0, exports.toNumber)(process.env.MAX_RISK_PER_TRADE, 0.20), // 20% max par trade
    STOP_LOSS_PERCENT: (0, exports.toNumber)(process.env.STOP_LOSS_PERCENT, 8), // 8% stop-loss
    TAKE_PROFIT_PERCENT: (0, exports.toNumber)(process.env.TAKE_PROFIT_PERCENT, 15), // 15% take-profit
    // Circuit Breaker
    CIRCUIT_BREAKER_MAX_ERRORS: (0, exports.toNumber)(process.env.CIRCUIT_BREAKER_MAX_ERRORS, 3),
    CIRCUIT_BREAKER_COOLDOWN_MS: (0, exports.toNumber)(process.env.CIRCUIT_BREAKER_COOLDOWN_MS, 3600000),
    // Exit Strategy +180s
    EXIT_DELAY_MS: (0, exports.toNumber)(process.env.EXIT_DELAY_MS, 180000), // 3 minutes
    EXIT_STRATEGY: (0, exports.toString)(process.env.EXIT_STRATEGY, 'REDUCE_ONLY'),
    // Monitoring
    ENABLE_GLOBAL_MONITORING: (0, exports.toBool)(process.env.ENABLE_GLOBAL_MONITORING),
    ENABLE_KOREAN_LOGS: (0, exports.toBool)(process.env.ENABLE_KOREAN_LOGS),
    ENABLE_VERBOSE_LOGS: (0, exports.toBool)(process.env.ENABLE_VERBOSE_LOGS) || true, // Activé par défaut
    // Debug
    ENVZ_ENABLED: (0, exports.toBool)(process.env.ENVZ_ENABLED),
    // Nouvelles variables pour le bot optimisé
    UPBIT_POLL_MS: (0, exports.toNumber)(process.env.UPBIT_POLL_MS, 2000), // Polling exact 2s
    EXIT_TIMEOUT_MINUTES: (0, exports.toNumber)(process.env.EXIT_TIMEOUT_MINUTES, 3), // Sortie après 3 min
    BINANCE_INDEX_REFRESH_MS: (0, exports.toNumber)(process.env.BINANCE_INDEX_REFRESH_MS, 600000), // 10 min
    SLIPPAGE_CAP_PCT: (0, exports.toNumber)(process.env.SLIPPAGE_CAP_PCT, 2), // 2% de slippage max
    SYMBOL_MUTEX_TTL_MS: (0, exports.toNumber)(process.env.SYMBOL_MUTEX_TTL_MS, 300000), // 5 min TTL
    HTTP_TOKEN: (0, exports.toString)(process.env.HTTP_TOKEN, 'frontrun-bot-2024'), // Token simple pour /loglevel
    // Optimisations des timeouts et performances
    UPBIT_TIMEOUT_MS: (0, exports.toNumber)(process.env.UPBIT_TIMEOUT_MS, 15000), // Timeout Upbit augmenté à 15s
    UPBIT_MAX_RETRIES: (0, exports.toNumber)(process.env.UPBIT_MAX_RETRIES, 3), // Nombre max de tentatives Upbit
    UPBIT_RETRY_DELAY_MS: (0, exports.toNumber)(process.env.UPBIT_RETRY_DELAY_MS, 2000), // Délai entre tentatives
    BINANCE_TIMEOUT_MS: (0, exports.toNumber)(process.env.BINANCE_TIMEOUT_MS, 20000), // Timeout Binance à 20s
    BINANCE_BATCH_SIZE: (0, exports.toNumber)(process.env.BINANCE_BATCH_SIZE, 50), // Taille des lots pour l'indexation
    API_RATE_LIMIT_MS: (0, exports.toNumber)(process.env.API_RATE_LIMIT_MS, 100), // Délai entre appels API (100ms)
};
// Export direct pour ENVZ_ENABLED
exports.ENVZ_ENABLED = exports.CONFIG.ENVZ_ENABLED;
// Validation de la configuration
function validateConfig() {
    const errors = [];
    const warnings = [];
    // Validation des variables critiques
    if (exports.CONFIG.HL_ENABLED && !exports.CONFIG.HL_WALLET) {
        errors.push('HL_ENABLED=true mais HYPERLIQUID_WALLET_ADDRESS manquant');
    }
    if (exports.CONFIG.BINANCE_ENABLED && (!exports.CONFIG.BINANCE_API_KEY || !exports.CONFIG.BINANCE_SECRET)) {
        errors.push('BINANCE_ENABLED=true mais clés API manquantes');
    }
    if (exports.CONFIG.BYBIT_ENABLED && (!exports.CONFIG.BYBIT_API_KEY || !exports.CONFIG.BYBIT_SECRET)) {
        errors.push('BYBIT_ENABLED=true mais clés API manquantes');
    }
    if (exports.CONFIG.TELEGRAM_ENABLED && (!exports.CONFIG.TELEGRAM_BOT_TOKEN || !exports.CONFIG.TELEGRAM_CHAT_ID)) {
        errors.push('TELEGRAM_ENABLED=true mais configuration Telegram manquante');
    }
    // Vérification qu'au moins un exchange est activé
    if (!exports.CONFIG.HL_ENABLED && !exports.CONFIG.BINANCE_ENABLED && !exports.CONFIG.BYBIT_ENABLED) {
        warnings.push('Aucun exchange activé - le bot fonctionnera en mode surveillance uniquement');
    }
    // Validation des paramètres de risque
    if (exports.CONFIG.RISK_PER_TRADE_USDC_DEFAULT <= 0) {
        errors.push('RISK_PER_TRADE_USDC_DEFAULT doit être > 0');
    }
    if (exports.CONFIG.RISK_PCT <= 0 || exports.CONFIG.RISK_PCT > 1) {
        errors.push('RISK_PCT doit être entre 0 et 1');
    }
    if (exports.CONFIG.MAX_LEVERAGE_DEFAULT <= 0) {
        errors.push('MAX_LEVERAGE_DEFAULT doit être > 0');
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
// Fonction pour obtenir un résumé de la configuration (sans secrets)
function getConfigSummary() {
    return {
        NODE_ENV: exports.CONFIG.NODE_ENV,
        IS_PROD: exports.CONFIG.IS_PROD,
        IS_RAILWAY: exports.CONFIG.IS_RAILWAY,
        PORT: exports.CONFIG.PORT,
        // Exchanges
        HL_ENABLED: exports.CONFIG.HL_ENABLED,
        HL_TESTNET: exports.CONFIG.HL_TESTNET,
        UPBIT_ENABLED: exports.CONFIG.UPBIT_ENABLED,
        BITHUMB_ENABLED: exports.CONFIG.BITHUMB_ENABLED,
        BINANCE_ENABLED: exports.CONFIG.BINANCE_ENABLED,
        BYBIT_ENABLED: exports.CONFIG.BYBIT_ENABLED,
        // Telegram
        TELEGRAM_ENABLED: exports.CONFIG.TELEGRAM_ENABLED,
        // Trading
        DRY_RUN: exports.CONFIG.DRY_RUN,
        TRADE_AMOUNT_USDT: exports.CONFIG.TRADE_AMOUNT_USDT,
        LEVERAGE: exports.CONFIG.LEVERAGE,
        STOP_LOSS_PERCENT: exports.CONFIG.STOP_LOSS_PERCENT,
        // Risk
        RISK_PER_TRADE_USDC_DEFAULT: exports.CONFIG.RISK_PER_TRADE_USDC_DEFAULT,
        RISK_PCT: exports.CONFIG.RISK_PCT,
        MAX_LEVERAGE_DEFAULT: exports.CONFIG.MAX_LEVERAGE_DEFAULT,
        // Monitoring
        ENABLE_GLOBAL_MONITORING: exports.CONFIG.ENABLE_GLOBAL_MONITORING,
        ENABLE_KOREAN_LOGS: exports.CONFIG.ENABLE_KOREAN_LOGS,
        ENABLE_VERBOSE_LOGS: exports.CONFIG.ENABLE_VERBOSE_LOGS,
    };
}
// Fonction pour logger la configuration au démarrage
function logConfigSummary() {
    const summary = getConfigSummary();
    console.log('🔧 Configuration du bot :');
    console.log(`  📍 Environnement: ${summary.NODE_ENV} ${summary.IS_RAILWAY ? '(Railway)' : '(Local)'}`);
    console.log(`  🌐 Port: ${summary.PORT}`);
    console.log(`  🔄 Mode: ${summary.DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
    console.log('\n  💰 Exchanges:');
    console.log(`    Hyperliquid: ${summary.HL_ENABLED ? '✅' : '❌'} ${summary.HL_TESTNET ? '(Testnet)' : '(Mainnet)'}`);
    console.log(`    Upbit: ${summary.UPBIT_ENABLED ? '✅' : '❌'}`);
    console.log(`    Bithumb: ${summary.BITHUMB_ENABLED ? '✅' : '❌'}`);
    console.log(`    Binance: ${summary.BINANCE_ENABLED ? '✅' : '❌'}`);
    console.log(`    Bybit: ${summary.BYBIT_ENABLED ? '✅' : '❌'}`);
    console.log('\n  📱 Telegram:');
    console.log(`    Activé: ${summary.TELEGRAM_ENABLED ? '✅' : '❌'}`);
    console.log('\n  ⚙️ Paramètres:');
    console.log(`    Trade Amount: ${summary.TRADE_AMOUNT_USDT} USDT`);
    console.log(`    Levier: ${summary.LEVERAGE}x`);
    console.log(`    Stop Loss: ${summary.STOP_LOSS_PERCENT}%`);
    console.log(`    Risk/Trade: ${summary.RISK_PER_TRADE_USDC_DEFAULT} USDC`);
    console.log(`    Risk % Balance: ${(summary.RISK_PCT_OF_BAL * 100).toFixed(1)}%`);
    console.log(`    Max Levier: ${summary.MAX_LEVERAGE_DEFAULT}x`);
    console.log('\n  📊 Monitoring:');
    console.log(`    Global: ${summary.ENABLE_GLOBAL_MONITORING ? '✅' : '❌'}`);
    console.log(`    Logs Coréens: ${summary.ENABLE_KOREAN_LOGS ? '✅' : '❌'}`);
    console.log(`    Logs Verbose: ${summary.ENABLE_VERBOSE_LOGS ? '✅' : '❌'}`);
}
//# sourceMappingURL=env.js.map