/**
 * Configuration centralisée des variables d'environnement
 * Supporte les formats booléens multiples et validation robuste
 */

// Helpers pour parser les valeurs
export const toBool = (value?: string): boolean => {
  if (!value) return false;
  return /^(1|true|yes|on)$/i.test(value.trim());
};

export const toNumber = (value?: string, defaultValue: number = 0): number => {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const toString = (value?: string, defaultValue: string = ''): string => {
  return value?.trim() || defaultValue;
};

// Configuration principale
export const CONFIG = {
  // Environnement
  NODE_ENV: toString(process.env.NODE_ENV, 'development'),
  IS_PROD: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT,
  IS_RAILWAY: !!process.env.RAILWAY_ENVIRONMENT,
  LOG_LEVEL: toString(process.env.LOG_LEVEL, 'debug'), // Changé à debug par défaut
  LOG_FORMAT: toString(process.env.LOG_FORMAT, process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),

  // Ports
  PORT: toNumber(process.env.PORT, 3000),
  HEALTH_PORT: toNumber(process.env.HEALTH_PORT, 3000),

  // Hyperliquid
  HL_ENABLED: toBool(process.env.ENABLE_HYPERLIQUID),
  HL_TESTNET: toBool(process.env.HYPERLIQUID_TESTNET) || toBool(process.env.IS_DEMO),
  HL_WALLET: toString(process.env.HYPERLIQUID_WALLET_ADDRESS),
  HL_PRIVATE_KEY: toString(process.env.HYPERLIQUID_PRIVATE_KEY),
  HL_API_URL: toString(process.env.HL_API_URL),
  HL_WS_URL: toString(process.env.HL_WS_URL),

  // Exchanges
  UPBIT_ENABLED: toBool(process.env.ENABLE_UPBIT),
  BITHUMB_ENABLED: toBool(process.env.ENABLE_BITHUMB),
  BINANCE_ENABLED: toBool(process.env.ENABLE_BINANCE),
  BYBIT_ENABLED: toBool(process.env.ENABLE_BYBIT),

  // Binance
  BINANCE_API_KEY: toString(process.env.BINANCE_API_KEY),
  BINANCE_SECRET: toString(process.env.BINANCE_SECRET),

  // Bybit
  BYBIT_API_KEY: toString(process.env.BYBIT_API_KEY),
  BYBIT_SECRET: toString(process.env.BYBIT_SECRET),

  // Telegram
  TELEGRAM_ENABLED: toBool(process.env.ENABLE_TELEGRAM),
  TELEGRAM_BOT_TOKEN: toString(process.env.TELEGRAM_BOT_TOKEN),
  TELEGRAM_CHAT_ID: toString(process.env.TELEGRAM_CHAT_ID),

  // Trading
  TRADE_AMOUNT_USDT: toNumber(process.env.TRADE_AMOUNT_USDT, 400),
  LEVERAGE: toNumber(process.env.LEVERAGE, 20),

  POSITION_SIZE_USDC: toNumber(process.env.POSITION_SIZE_USDC, 400),

  // Risk Management
  // Risk Management - Stratégie Agressive
  RISK_PER_TRADE_USD: toNumber(process.env.RISK_PER_TRADE_USD, 400),
  RISK_PER_TRADE_USDC_DEFAULT: toNumber(process.env.RISK_PER_TRADE_USDC_DEFAULT, 0.5),
  RISK_PCT: toNumber(process.env.RISK_PCT, 0.15), // 15% par trade (agressif)
  LEVERAGE_TARGET: toNumber(process.env.LEVERAGE_TARGET, 8), // 8x levier (agressif)
  MAX_LEVERAGE_DEFAULT: toNumber(process.env.MAX_LEVERAGE_DEFAULT, 8), // 8x max
  ORDER_TIMEOUT_MS: toNumber(process.env.ORDER_TIMEOUT_MS, 15000),
  PERP_CHECK_TIMEOUT_MS: toNumber(process.env.PERP_CHECK_TIMEOUT_MS, 200),
  DRY_RUN: toBool(process.env.DRY_RUN),

  // Stratégie de Protection
  MAX_RISK_PER_TRADE: toNumber(process.env.MAX_RISK_PER_TRADE, 0.20), // 20% max par trade
  STOP_LOSS_PERCENT: toNumber(process.env.STOP_LOSS_PERCENT, 8), // 8% stop-loss
  TAKE_PROFIT_PERCENT: toNumber(process.env.TAKE_PROFIT_PERCENT, 15), // 15% take-profit
  
  // Circuit Breaker
  CIRCUIT_BREAKER_MAX_ERRORS: toNumber(process.env.CIRCUIT_BREAKER_MAX_ERRORS, 3),
  CIRCUIT_BREAKER_COOLDOWN_MS: toNumber(process.env.CIRCUIT_BREAKER_COOLDOWN_MS, 3600000),
  
  // Exit Strategy +180s
  EXIT_DELAY_MS: toNumber(process.env.EXIT_DELAY_MS, 180000), // 3 minutes
  EXIT_STRATEGY: toString(process.env.EXIT_STRATEGY, 'REDUCE_ONLY'),

  // Monitoring
  ENABLE_GLOBAL_MONITORING: toBool(process.env.ENABLE_GLOBAL_MONITORING),
  ENABLE_KOREAN_LOGS: toBool(process.env.ENABLE_KOREAN_LOGS),
  ENABLE_VERBOSE_LOGS: toBool(process.env.ENABLE_VERBOSE_LOGS) || true, // Activé par défaut

  // Debug
  ENVZ_ENABLED: toBool(process.env.ENVZ_ENABLED),

  // Nouvelles variables pour le bot optimisé
  UPBIT_POLL_MS: toNumber(process.env.UPBIT_POLL_MS, 2000), // Polling exact 2s
  EXIT_TIMEOUT_MINUTES: toNumber(process.env.EXIT_TIMEOUT_MINUTES, 3), // Sortie après 3 min
  BINANCE_INDEX_REFRESH_MS: toNumber(process.env.BINANCE_INDEX_REFRESH_MS, 600000), // 10 min
  SLIPPAGE_CAP_PCT: toNumber(process.env.SLIPPAGE_CAP_PCT, 2), // 2% de slippage max
  SYMBOL_MUTEX_TTL_MS: toNumber(process.env.SYMBOL_MUTEX_TTL_MS, 300000), // 5 min TTL
  HTTP_TOKEN: toString(process.env.HTTP_TOKEN, 'frontrun-bot-2024'), // Token simple pour /loglevel
  
  // Optimisations des timeouts et performances
  UPBIT_TIMEOUT_MS: toNumber(process.env.UPBIT_TIMEOUT_MS, 15000), // Timeout Upbit augmenté à 15s
  UPBIT_MAX_RETRIES: toNumber(process.env.UPBIT_MAX_RETRIES, 3), // Nombre max de tentatives Upbit
  UPBIT_RETRY_DELAY_MS: toNumber(process.env.UPBIT_RETRY_DELAY_MS, 2000), // Délai entre tentatives
  BINANCE_TIMEOUT_MS: toNumber(process.env.BINANCE_TIMEOUT_MS, 20000), // Timeout Binance à 20s
  BINANCE_BATCH_SIZE: toNumber(process.env.BINANCE_BATCH_SIZE, 50), // Taille des lots pour l'indexation
  API_RATE_LIMIT_MS: toNumber(process.env.API_RATE_LIMIT_MS, 100), // Délai entre appels API (100ms)
} as const;

// Export direct pour ENVZ_ENABLED
export const { ENVZ_ENABLED } = CONFIG;

// Validation de la configuration
export function validateConfig(): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validation des variables critiques
  if (CONFIG.HL_ENABLED && !CONFIG.HL_WALLET) {
    errors.push('HL_ENABLED=true mais HYPERLIQUID_WALLET_ADDRESS manquant');
  }

  if (CONFIG.BINANCE_ENABLED && (!CONFIG.BINANCE_API_KEY || !CONFIG.BINANCE_SECRET)) {
    errors.push('BINANCE_ENABLED=true mais clés API manquantes');
  }

  if (CONFIG.BYBIT_ENABLED && (!CONFIG.BYBIT_API_KEY || !CONFIG.BYBIT_SECRET)) {
    errors.push('BYBIT_ENABLED=true mais clés API manquantes');
  }

  if (CONFIG.TELEGRAM_ENABLED && (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID)) {
    errors.push('TELEGRAM_ENABLED=true mais configuration Telegram manquante');
  }

  // Vérification qu'au moins un exchange est activé
  if (!CONFIG.HL_ENABLED && !CONFIG.BINANCE_ENABLED && !CONFIG.BYBIT_ENABLED) {
    warnings.push('Aucun exchange activé - le bot fonctionnera en mode surveillance uniquement');
  }

  // Validation des paramètres de risque
  if (CONFIG.RISK_PER_TRADE_USDC_DEFAULT <= 0) {
    errors.push('RISK_PER_TRADE_USDC_DEFAULT doit être > 0');
  }

  if (CONFIG.RISK_PCT <= 0 || CONFIG.RISK_PCT > 1) {
    errors.push('RISK_PCT doit être entre 0 et 1');
  }

  if (CONFIG.MAX_LEVERAGE_DEFAULT <= 0) {
    errors.push('MAX_LEVERAGE_DEFAULT doit être > 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Fonction pour obtenir un résumé de la configuration (sans secrets)
export function getConfigSummary(): Record<string, any> {
  return {
    NODE_ENV: CONFIG.NODE_ENV,
    IS_PROD: CONFIG.IS_PROD,
    IS_RAILWAY: CONFIG.IS_RAILWAY,
    PORT: CONFIG.PORT,
    
    // Exchanges
    HL_ENABLED: CONFIG.HL_ENABLED,
    HL_TESTNET: CONFIG.HL_TESTNET,
    UPBIT_ENABLED: CONFIG.UPBIT_ENABLED,
    BITHUMB_ENABLED: CONFIG.BITHUMB_ENABLED,
    BINANCE_ENABLED: CONFIG.BINANCE_ENABLED,
    BYBIT_ENABLED: CONFIG.BYBIT_ENABLED,
    
    // Telegram
    TELEGRAM_ENABLED: CONFIG.TELEGRAM_ENABLED,
    
    // Trading
    DRY_RUN: CONFIG.DRY_RUN,
    TRADE_AMOUNT_USDT: CONFIG.TRADE_AMOUNT_USDT,
    LEVERAGE: CONFIG.LEVERAGE,
    STOP_LOSS_PERCENT: CONFIG.STOP_LOSS_PERCENT,
    
    // Risk
    RISK_PER_TRADE_USDC_DEFAULT: CONFIG.RISK_PER_TRADE_USDC_DEFAULT,
    RISK_PCT: CONFIG.RISK_PCT,
    MAX_LEVERAGE_DEFAULT: CONFIG.MAX_LEVERAGE_DEFAULT,
    
    // Monitoring
    ENABLE_GLOBAL_MONITORING: CONFIG.ENABLE_GLOBAL_MONITORING,
    ENABLE_KOREAN_LOGS: CONFIG.ENABLE_KOREAN_LOGS,
    ENABLE_VERBOSE_LOGS: CONFIG.ENABLE_VERBOSE_LOGS,
  };
}

// Fonction pour logger la configuration au démarrage
export function logConfigSummary(): void {
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
