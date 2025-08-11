#!/usr/bin/env node

/**
 * Script pour tester le bot localement en mode production (comme Railway)
 * Ce script simule l'environnement Railway sans charger le fichier .env
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

console.log('🚂 Simulation de l\'environnement Railway en local...');
console.log('');

// Variables d'environnement pour simuler Railway
const railwayEnv = {
  // Environnement
  NODE_ENV: 'production',
  RAILWAY_ENVIRONMENT: 'production',
  
  // Port
  PORT: '8080',
  
  // Hyperliquid
  HL_ENABLED: '1',
  HL_TESTNET: '1',
  HYPERLIQUID_WALLET_ADDRESS: '0x1234567890123456789012345678901234567890',
  HYPERLIQUID_PRIVATE_KEY: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  
  // Exchanges
  UPBIT_ENABLED: '1',
  BITHUMB_ENABLED: '1',
  BINANCE_ENABLED: '0',
  BYBIT_ENABLED: '0',
  
  // Telegram (désactivé pour les tests)
  TELEGRAM_ENABLED: '0',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  
  // Trading
  TRADE_AMOUNT_USDT: '400',
  LEVERAGE: '20',
  STOP_LOSS_PERCENT: '5',
  POSITION_SIZE_USDC: '400',
  
  // Risk Management
  RISK_PER_TRADE_USDC_DEFAULT: '0.5',
  RISK_PCT_OF_BAL: '0.04',
  MAX_LEVERAGE_DEFAULT: '25',
  ORDER_TIMEOUT_MS: '15000',
  PERP_CHECK_TIMEOUT_MS: '200',
  DRY_RUN: '1',
  
  // Monitoring
  ENABLE_GLOBAL_MONITORING: '0',
  ENABLE_KOREAN_LOGS: '1',
  ENABLE_VERBOSE_LOGS: '0',
  
  // Debug
  ENVZ_ENABLED: '1',
  
  // Désactiver le chargement .env
  DOTENV_DISABLE: 'true'
};

console.log('🔧 Configuration Railway simulée:');
Object.entries(railwayEnv).forEach(([key, value]) => {
  if (key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET') || key.includes('PRIVATE')) {
    console.log(`  ${key}: ${value ? '****' + value.slice(-4) : 'undefined'}`);
  } else {
    console.log(`  ${key}: ${value}`);
  }
});

console.log('');
console.log('🚀 Démarrage du bot en mode Railway simulé...');
console.log('');

// Construire le projet d'abord
console.log('📦 Construction du projet...');

// Utiliser la bonne commande npm selon l'OS
const npmCommand = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
const buildProcess = spawn(npmCommand, ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, ...railwayEnv }
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Échec de la construction');
    process.exit(code);
  }
  
  console.log('✅ Construction réussie');
  console.log('');
  
  // Démarrer le bot
  console.log('🤖 Démarrage du bot...');
  const botProcess = spawn('node', ['dist/main.js'], {
    stdio: 'inherit',
    env: { ...process.env, ...railwayEnv }
  });
  
  botProcess.on('close', (code) => {
    console.log(`\n🛑 Bot arrêté avec le code: ${code}`);
    process.exit(code);
  });
  
  botProcess.on('error', (error) => {
    console.error('❌ Erreur lors du démarrage du bot:', error);
    process.exit(1);
  });
  
  // Gestion des signaux
  process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt demandé...');
    botProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Arrêt demandé...');
    botProcess.kill('SIGTERM');
  });
});
