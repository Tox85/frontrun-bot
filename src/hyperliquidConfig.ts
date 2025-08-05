import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const HYPERLIQUID_CONFIG = {
  enabled: process.env.HYPERLIQUID_ENABLED === 'true',
  // Configuration pour testnet/mainnet
  isTestnet: process.env.IS_DEMO === 'true',
  // Authentification
  walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS || '',
  privateKey: process.env.HYPERLIQUID_PRIVATE_KEY || '',
  // URLs selon l'environnement
  apiUrl: process.env.IS_DEMO === 'true' 
    ? 'https://api.hyperliquid-testnet.xyz'
    : 'https://api.hyperliquid.xyz',
  wsUrl: process.env.IS_DEMO === 'true'
    ? 'wss://api.hyperliquid-testnet.xyz/ws'
    : 'wss://api.hyperliquid.xyz/ws',
};

export function validateHyperliquidConfig() {
  console.log('✅ Configuration Hyperliquid validée :');
  console.log(`  - Activé: ${HYPERLIQUID_CONFIG.enabled}`);
  console.log(`  - Testnet: ${HYPERLIQUID_CONFIG.isTestnet}`);
  console.log(`  - Wallet: ${HYPERLIQUID_CONFIG.walletAddress ? HYPERLIQUID_CONFIG.walletAddress.substring(0, 8) + '...' : 'NON CONFIGURÉ'}`);
  console.log(`  - API URL: ${HYPERLIQUID_CONFIG.apiUrl}`);
  console.log(`  - WebSocket URL: ${HYPERLIQUID_CONFIG.wsUrl}`);
  
  // Vérifications d'authentification
  if (!HYPERLIQUID_CONFIG.walletAddress) {
    console.warn('⚠️ HYPERLIQUID_WALLET_ADDRESS non configuré - Mode simulation activé');
  }
  if (!HYPERLIQUID_CONFIG.privateKey) {
    console.warn('⚠️ HYPERLIQUID_PRIVATE_KEY non configuré - Mode simulation activé');
  }
} 