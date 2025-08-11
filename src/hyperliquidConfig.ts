import { CONFIG } from './config/env';

export const HYPERLIQUID_CONFIG = {
  enabled: CONFIG.HL_ENABLED,
  // Configuration pour testnet/mainnet
  isTestnet: CONFIG.HL_TESTNET,
  // Authentification
  walletAddress: CONFIG.HL_WALLET,
  privateKey: CONFIG.HL_PRIVATE_KEY,
  // URLs selon l'environnement
  apiUrl: CONFIG.HL_TESTNET
    ? 'https://api.hyperliquid-testnet.xyz'
    : 'https://api.hyperliquid.xyz',
  wsUrl: CONFIG.HL_TESTNET
    ? 'wss://api.hyperliquid-testnet.xyz/ws'
    : 'wss://api.hyperliquid.xyz/ws',
};

export function validateHyperliquidConfig() {
  console.log('🔧 Validation de la configuration Hyperliquid :');
  console.log(`  - Activé: ${HYPERLIQUID_CONFIG.enabled}`);
  console.log(`  - Testnet: ${HYPERLIQUID_CONFIG.isTestnet}`);
  console.log(`  - Wallet: ${HYPERLIQUID_CONFIG.walletAddress ? HYPERLIQUID_CONFIG.walletAddress.substring(0, 8) + '...' : 'NON CONFIGURÉ'}`);
  console.log(`  - API URL: ${HYPERLIQUID_CONFIG.apiUrl}`);
  console.log(`  - WebSocket URL: ${HYPERLIQUID_CONFIG.wsUrl}`);
  
  // Vérifications d'authentification
  if (!HYPERLIQUID_CONFIG.enabled) {
    console.log('ℹ️ Hyperliquid désactivé - Mode surveillance uniquement');
    return;
  }
  
  if (!HYPERLIQUID_CONFIG.walletAddress) {
    console.warn('⚠️ HYPERLIQUID_WALLET_ADDRESS non configuré - Mode simulation activé');
  }
  if (!HYPERLIQUID_CONFIG.privateKey) {
    console.warn('⚠️ HYPERLIQUID_PRIVATE_KEY non configuré - Mode simulation activé');
  }
  
  if (HYPERLIQUID_CONFIG.walletAddress && HYPERLIQUID_CONFIG.privateKey) {
    console.log('✅ Configuration Hyperliquid complète - Mode trading activé');
  } else {
    console.log('⚠️ Configuration Hyperliquid partielle - Mode simulation');
  }
} 