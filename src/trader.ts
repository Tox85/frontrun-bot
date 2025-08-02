import { BybitTrader } from './bybitTrader';
import { validateConfig } from './config';
import { TelegramService } from './telegramService';

let bybitTrader: BybitTrader | null = null;
let telegramService: TelegramService | null = null;

export function setTelegramService(service: TelegramService) {
  telegramService = service;
}

export async function initializeTrader(): Promise<boolean> {
  try {
    // Valider la configuration
    validateConfig();
    
    // Initialiser le trader Bybit
    bybitTrader = new BybitTrader();
    const initialized = await bybitTrader.initialize();
    
    if (initialized) {
      console.log('✅ Trader Bybit initialisé avec succès');
    }
    
    return initialized;
  } catch (error) {
    console.error('❌ Erreur initialisation trader:', error);
    return false;
  }
}

export async function checkBalance(): Promise<{ available: number; total: number }> {
  if (!bybitTrader) {
    console.error('❌ Trader non initialisé');
    return { available: 0, total: 0 };
  }
  
  try {
    const balance = await bybitTrader.checkBalance();
    console.log(`💰 Balance disponible: ${balance.available} USDT`);
    console.log(`💰 Balance totale: ${balance.total} USDT`);
    return balance;
  } catch (error) {
    console.error('❌ Erreur récupération balance:', error);
    return { available: 0, total: 0 };
  }
}

export async function executeTrade(symbol: string, platform: 'Bybit'): Promise<void> {
  if (!bybitTrader) {
    console.error('❌ Trader non initialisé');
    return;
  }

  try {
    console.log(`💥 Exécution du trade sur ${symbol} via ${platform}...`);
    
    const result = await bybitTrader.openPosition(symbol);
    
    if (result.success) {
      console.log(`✅ Trade exécuté avec succès sur Bybit !`);
      console.log(`📊 Order ID: ${result.orderId}`);
      await telegramService?.sendTradeExecution(symbol, 'Bybit', true, `Order ID: ${result.orderId}`);
    } else {
      console.error(`❌ Échec du trade sur Bybit: ${result.error}`);
      await telegramService?.sendTradeExecution(symbol, 'Bybit', false, result.error);
    }
    
  } catch (error) {
    console.error(`❌ Erreur lors de l'exécution du trade sur ${symbol}:`, error);
    await telegramService?.sendTradeExecution(symbol, platform, false, error instanceof Error ? error.message : 'Erreur inconnue');
  }
}

export async function getActivePositions(): Promise<any[]> {
  if (!bybitTrader) {
    return [];
  }
  
  try {
    return await bybitTrader.getActivePositions();
  } catch (error) {
    console.error('❌ Erreur récupération positions:', error);
    return [];
  }
}
  