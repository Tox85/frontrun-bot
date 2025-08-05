import { BybitTrader } from './bybitTrader';
import { HyperliquidTrader } from './hyperliquidTrader';
import { validateConfig } from './config';
import { validateHyperliquidConfig } from './hyperliquidConfig';
import { TelegramService } from './telegramService';

let bybitTrader: BybitTrader | null = null;
let hyperliquidTrader: HyperliquidTrader | null = null;
let telegramService: TelegramService | null = null;
let riskManager: any = null; // RiskManager

export function setTelegramService(service: TelegramService) {
  telegramService = service;
}

export function setRiskManager(manager: any) {
  riskManager = manager;
}

export async function initializeTrader(): Promise<boolean> {
  try {
    // Valider la configuration
    validateConfig();
    validateHyperliquidConfig();
    
    // Initialiser le trader Hyperliquid (priorité)
    hyperliquidTrader = new HyperliquidTrader();
    const hyperliquidInitialized = await hyperliquidTrader.initialize();
    
    if (hyperliquidInitialized) {
      console.log('✅ Trader Hyperliquid initialisé avec succès');
      return true;
    }
    
    // Fallback vers Bybit si Hyperliquid échoue
    console.log('⚠️ Hyperliquid échoué, tentative avec Bybit...');
    bybitTrader = new BybitTrader();
    const bybitInitialized = await bybitTrader.initialize();
    
    if (bybitInitialized) {
      console.log('✅ Trader Bybit initialisé avec succès');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Erreur initialisation trader:', error);
    return false;
  }
}

export async function checkBalance(): Promise<{ available: number; total: number }> {
  // Essayer Hyperliquid en premier
  if (hyperliquidTrader) {
    try {
      return await hyperliquidTrader.checkBalance();
    } catch (error) {
      console.error('❌ Erreur balance Hyperliquid:', error);
    }
  }
  
  // Fallback vers Bybit
  if (bybitTrader) {
    try {
      return await bybitTrader.checkBalance();
  } catch (error) {
      console.error('❌ Erreur balance Bybit:', error);
    }
  }
  
  console.error('❌ Aucun trader disponible');
  return { available: 0, total: 0 };
}

async function openPosition(symbol: string, exchange: string): Promise<boolean> {
  try {
    let trader = null;
    
    if (exchange === 'Hyperliquid') {
      trader = hyperliquidTrader;
    } else if (exchange === 'Bybit') {
      trader = bybitTrader;
    }
    
    if (!trader) {
      console.error(`❌ Trader ${exchange} non initialisé`);
      return false;
    }
    
    const result = await trader.openPosition(symbol);
    return result.success;
  } catch (error) {
    console.error(`❌ Erreur ouverture position ${symbol}:`, error);
    return false;
  }
}

async function closePosition(symbol: string, exchange: string): Promise<boolean> {
  try {
    let trader = null;
    
    if (exchange === 'Hyperliquid') {
      trader = hyperliquidTrader;
    } else if (exchange === 'Bybit') {
      trader = bybitTrader;
    }
    
    if (!trader) {
      console.error(`❌ Trader ${exchange} non initialisé`);
      return false;
    }
    
    const result = await trader.closePosition(symbol);
    return result.success;
  } catch (error) {
    console.error(`❌ Erreur fermeture position ${symbol}:`, error);
    return false;
  }
}

export async function executeTrade(symbol: string, exchange: string): Promise<boolean> {
  try {
    console.log(`🚀 Exécution trade ${symbol} sur ${exchange}...`);
    
    // Ouvrir la position
    const openResult = await openPosition(symbol, exchange);
    
    if (openResult) {
      console.log(`✅ Position ouverte sur ${symbol}`);
      
      // Attendre 3 minutes puis fermer
      setTimeout(async () => {
        try {
          console.log(`⏰ Fermeture automatique de la position ${symbol}...`);
          const closeResult = await closePosition(symbol, exchange);
          
          if (closeResult && riskManager) {
            // Calculer le profit (simulation pour l'instant)
            const profit = Math.random() * 20 - 10; // -10 à +10 USDC
            await riskManager.closePosition(symbol, profit);
            console.log(`💰 Position fermée avec profit: ${profit.toFixed(2)} USDC`);
          }
        } catch (error) {
          console.error(`❌ Erreur fermeture position ${symbol}:`, error);
        }
      }, 3 * 60 * 1000); // 3 minutes
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Erreur exécution trade ${symbol}:`, error);
    return false;
  }
}

export async function getActivePositions(): Promise<any[]> {
  const positions = [];
  
  if (hyperliquidTrader) {
    try {
      const hyperliquidPositions = await hyperliquidTrader.getActivePositions();
      positions.push(...hyperliquidPositions);
    } catch (error) {
      console.error('❌ Erreur récupération positions Hyperliquid:', error);
    }
  }
  
  if (bybitTrader) {
    try {
      const bybitPositions = await bybitTrader.getActivePositions();
      positions.push(...bybitPositions);
  } catch (error) {
      console.error('❌ Erreur récupération positions Bybit:', error);
    }
  }
  
  return positions;
}
  