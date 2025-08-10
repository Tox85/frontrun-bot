import dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configuration Bybit
export const BYBIT_CONFIG = {
  apiKey: process.env.BYBIT_API_KEY || '',
  secret: process.env.BYBIT_SECRET || '',
  isDemo: process.env.IS_DEMO === 'true',
  sandbox: process.env.IS_DEMO === 'true', // Pour CCXT
  testnet: process.env.IS_DEMO === 'true', // Pour Bybit testnet
};

// Configuration Binance
export const BINANCE_CONFIG = {
  apiKey: process.env.BINANCE_API_KEY || '',
  secret: process.env.BINANCE_SECRET || '',
  isDemo: process.env.IS_DEMO === 'true',
  sandbox: process.env.IS_DEMO === 'true',
  testnet: process.env.IS_DEMO === 'true',
};

// Configuration Telegram
export const TELEGRAM_CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  enabled: process.env.TELEGRAM_ENABLED === 'true',
};

// Configuration Trading
export const TRADING_CONFIG = {
  tradeAmountUsdt: Number(process.env.TRADE_AMOUNT_USDT) || 400,
  leverage: Number(process.env.LEVERAGE) || 20,
  stopLossPercent: Number(process.env.STOP_LOSS_PERCENT) || 5,
  autoCloseMinutes: 3,
};

// Configuration Risk Management
export const RISK_CONFIG = {
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
export function validateConfig() {
  const errors: string[] = [];

  // Validation des exchanges
  if (!RISK_CONFIG.hlEnabled && !RISK_CONFIG.binanceEnabled && !RISK_CONFIG.bybitEnabled) {
    errors.push('Au moins un exchange doit être activé (HL_ENABLED, BINANCE_ENABLED, BYBIT_ENABLED)');
  }

  // Validation des paramètres de risque
  if (RISK_CONFIG.riskPerTradeDefault <= 0) {
    errors.push('RISK_PER_TRADE_USDC_DEFAULT doit être > 0');
  }
  if (RISK_CONFIG.riskPctOfBalance <= 0 || RISK_CONFIG.riskPctOfBalance > 1) {
    errors.push('RISK_PCT_OF_BAL doit être entre 0 et 1');
  }
  if (RISK_CONFIG.maxLeverageDefault <= 0) {
    errors.push('MAX_LEVERAGE_DEFAULT doit être > 0');
  }

  // Validation des timeouts
  if (RISK_CONFIG.orderTimeoutMs <= 0) {
    errors.push('ORDER_TIMEOUT_MS doit être > 0');
  }
  if (RISK_CONFIG.perpCheckTimeoutMs <= 0) {
    errors.push('PERP_CHECK_TIMEOUT_MS doit être > 0');
  }

  // Validation des clés API si activées
  if (RISK_CONFIG.binanceEnabled) {
    if (!BINANCE_CONFIG.apiKey) {
      errors.push('BINANCE_API_KEY manquant pour Binance activé');
    }
    if (!BINANCE_CONFIG.secret) {
      errors.push('BINANCE_SECRET manquant pour Binance activé');
    }
  }

  if (!BYBIT_CONFIG.apiKey) {
    errors.push('BYBIT_API_KEY manquant dans .env');
  }
  if (!BYBIT_CONFIG.secret) {
    errors.push('BYBIT_SECRET manquant dans .env');
  }

  if (errors.length > 0) {
    console.error('❌ Erreurs de configuration :');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Configuration invalide');
  }

  console.log('✅ Configuration validée :');
  console.log(`  - Mode: ${RISK_CONFIG.dryRun ? 'DRY RUN' : 'PRODUCTION'}`);
  console.log(`  - Hyperliquid: ${RISK_CONFIG.hlEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
  console.log(`  - Binance: ${RISK_CONFIG.binanceEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
  console.log(`  - Bybit: ${RISK_CONFIG.bybitEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
  console.log(`  - Risk/Trade: ${RISK_CONFIG.riskPerTradeDefault} USDC`);
  console.log(`  - Risk % Balance: ${RISK_CONFIG.riskPctOfBalance * 100}%`);
  console.log(`  - Max Levier: ${RISK_CONFIG.maxLeverageDefault}x`);
  console.log(`  - Timeout Ordre: ${RISK_CONFIG.orderTimeoutMs}ms`);
  console.log(`  - Timeout Perp Check: ${RISK_CONFIG.perpCheckTimeoutMs}ms`);
} 