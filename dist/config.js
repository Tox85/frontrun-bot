"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RISK_CONFIG = exports.TRADING_CONFIG = exports.TELEGRAM_CONFIG = exports.BINANCE_CONFIG = exports.BYBIT_CONFIG = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Charger les variables d'environnement
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
// Configuration Bybit
exports.BYBIT_CONFIG = {
    apiKey: process.env.BYBIT_API_KEY || '',
    secret: process.env.BYBIT_SECRET || '',
    isDemo: process.env.IS_DEMO === 'true',
    sandbox: process.env.IS_DEMO === 'true', // Pour CCXT
    testnet: process.env.IS_DEMO === 'true', // Pour Bybit testnet
};
// Configuration Binance
exports.BINANCE_CONFIG = {
    apiKey: process.env.BINANCE_API_KEY || '',
    secret: process.env.BINANCE_SECRET || '',
    isDemo: process.env.IS_DEMO === 'true',
    sandbox: process.env.IS_DEMO === 'true',
    testnet: process.env.IS_DEMO === 'true',
};
// Configuration Telegram
exports.TELEGRAM_CONFIG = {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    enabled: process.env.TELEGRAM_ENABLED === 'true',
};
// Configuration Trading
exports.TRADING_CONFIG = {
    tradeAmountUsdt: Number(process.env.TRADE_AMOUNT_USDT) || 400,
    leverage: Number(process.env.LEVERAGE) || 20,
    stopLossPercent: Number(process.env.STOP_LOSS_PERCENT) || 5,
    autoCloseMinutes: 3,
};
// Configuration Risk Management
exports.RISK_CONFIG = {
    riskPerTradeDefault: parseFloat(process.env.RISK_PER_TRADE_USDC_DEFAULT || '0.5'),
    riskPctOfBalance: parseFloat(process.env.RISK_PCT_OF_BAL || '0.04'),
    maxLeverageDefault: parseInt(process.env.MAX_LEVERAGE_DEFAULT || '25'),
    orderTimeoutMs: parseInt(process.env.ORDER_TIMEOUT_MS || '15000'),
    perpCheckTimeoutMs: parseInt(process.env.PERP_CHECK_TIMEOUT_MS || '200'),
    dryRun: process.env.DRY_RUN === '1',
    hlEnabled: process.env.HL_ENABLED === '1',
    binanceEnabled: process.env.BINANCE_ENABLED === '1',
    bybitEnabled: process.env.BYBIT_ENABLED === '1',
};
// Validation de la configuration
function validateConfig() {
    const errors = [];
    // Validation des exchanges
    if (!exports.RISK_CONFIG.hlEnabled && !exports.RISK_CONFIG.binanceEnabled && !exports.RISK_CONFIG.bybitEnabled) {
        errors.push('Au moins un exchange doit être activé (HL_ENABLED, BINANCE_ENABLED, BYBIT_ENABLED)');
    }
    // Validation des paramètres de risque
    if (exports.RISK_CONFIG.riskPerTradeDefault <= 0) {
        errors.push('RISK_PER_TRADE_USDC_DEFAULT doit être > 0');
    }
    if (exports.RISK_CONFIG.riskPctOfBalance <= 0 || exports.RISK_CONFIG.riskPctOfBalance > 1) {
        errors.push('RISK_PCT_OF_BAL doit être entre 0 et 1');
    }
    if (exports.RISK_CONFIG.maxLeverageDefault <= 0) {
        errors.push('MAX_LEVERAGE_DEFAULT doit être > 0');
    }
    // Validation des timeouts
    if (exports.RISK_CONFIG.orderTimeoutMs <= 0) {
        errors.push('ORDER_TIMEOUT_MS doit être > 0');
    }
    if (exports.RISK_CONFIG.perpCheckTimeoutMs <= 0) {
        errors.push('PERP_CHECK_TIMEOUT_MS doit être > 0');
    }
    // Validation des clés API si activées
    if (exports.RISK_CONFIG.binanceEnabled) {
        if (!exports.BINANCE_CONFIG.apiKey) {
            errors.push('BINANCE_API_KEY manquant pour Binance activé');
        }
        if (!exports.BINANCE_CONFIG.secret) {
            errors.push('BINANCE_SECRET manquant pour Binance activé');
        }
    }
    if (!exports.BYBIT_CONFIG.apiKey) {
        errors.push('BYBIT_API_KEY manquant dans .env');
    }
    if (!exports.BYBIT_CONFIG.secret) {
        errors.push('BYBIT_SECRET manquant dans .env');
    }
    if (errors.length > 0) {
        console.error('❌ Erreurs de configuration :');
        errors.forEach(error => console.error(`  - ${error}`));
        throw new Error('Configuration invalide');
    }
    console.log('✅ Configuration validée :');
    console.log(`  - Mode: ${exports.RISK_CONFIG.dryRun ? 'DRY RUN' : 'PRODUCTION'}`);
    console.log(`  - Hyperliquid: ${exports.RISK_CONFIG.hlEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    console.log(`  - Binance: ${exports.RISK_CONFIG.binanceEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    console.log(`  - Bybit: ${exports.RISK_CONFIG.bybitEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    console.log(`  - Risk/Trade: ${exports.RISK_CONFIG.riskPerTradeDefault} USDC`);
    console.log(`  - Risk % Balance: ${exports.RISK_CONFIG.riskPctOfBalance * 100}%`);
    console.log(`  - Max Levier: ${exports.RISK_CONFIG.maxLeverageDefault}x`);
    console.log(`  - Timeout Ordre: ${exports.RISK_CONFIG.orderTimeoutMs}ms`);
    console.log(`  - Timeout Perp Check: ${exports.RISK_CONFIG.perpCheckTimeoutMs}ms`);
}
//# sourceMappingURL=config.js.map