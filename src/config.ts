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

// Validation de la configuration
export function validateConfig() {
  const errors: string[] = [];

  if (!BYBIT_CONFIG.apiKey) {
    errors.push('BYBIT_API_KEY manquant dans .env');
  }
  if (!BYBIT_CONFIG.secret) {
    errors.push('BYBIT_SECRET manquant dans .env');
  }
  if (TRADING_CONFIG.tradeAmountUsdt <= 0) {
    errors.push('TRADE_AMOUNT_USDT doit être > 0');
  }
  if (TRADING_CONFIG.leverage <= 0) {
    errors.push('LEVERAGE doit être > 0');
  }
  if (TRADING_CONFIG.stopLossPercent <= 0) {
    errors.push('STOP_LOSS_PERCENT doit être > 0');
  }

  if (errors.length > 0) {
    console.error('❌ Erreurs de configuration :');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Configuration invalide');
  }

  console.log('✅ Configuration validée :');
  console.log(`  - Mode: ${BYBIT_CONFIG.isDemo ? 'Demo' : 'Réel'}`);
  console.log(`  - API Key: ${BYBIT_CONFIG.apiKey ? BYBIT_CONFIG.apiKey.substring(0, 8) + '...' : 'MANQUANT'}`);
  console.log(`  - Secret: ${BYBIT_CONFIG.secret ? '***' + BYBIT_CONFIG.secret.substring(-4) : 'MANQUANT'}`);
  console.log(`  - Sandbox: ${BYBIT_CONFIG.sandbox}`);
  console.log(`  - Montant par trade: ${TRADING_CONFIG.tradeAmountUsdt} USDT`);
  console.log(`  - Levier: ${TRADING_CONFIG.leverage}x`);
  console.log(`  - Stop Loss: ${TRADING_CONFIG.stopLossPercent}%`);
  console.log(`  - Clôture auto: ${TRADING_CONFIG.autoCloseMinutes} minutes`);
} 