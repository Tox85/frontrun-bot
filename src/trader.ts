import { BybitTrader } from './bybitTrader';
import { HyperliquidTrader } from './hyperliquidTrader';

let bybitTrader: BybitTrader | null = null;
let hyperliquidTrader: HyperliquidTrader | null = null;

// Fonction pour synchroniser les traders depuis main.ts
export function setHyperliquidTrader(trader: HyperliquidTrader) {
  hyperliquidTrader = trader;
  console.log('🔄 Trader Hyperliquid synchronisé avec trader.ts');
}

export function setBybitTrader(trader: BybitTrader) {
  bybitTrader = trader;
  console.log('🔄 Trader Bybit synchronisé avec trader.ts');
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

export async function executeTrade(symbol: string, exchange: string): Promise<void> {
  console.log(`🚀 Exécution trade ${symbol} sur ${exchange}`);
  
  try {
    switch (exchange.toLowerCase()) {
      case 'hyperliquid':
        if (hyperliquidTrader) {
          await hyperliquidTrader.openPosition(symbol);
          console.log(`✅ Position longue ouverte sur Hyperliquid: ${symbol}`);
        } else {
          throw new Error('Trader Hyperliquid non disponible');
        }
        break;
        
      case 'bybit':
        if (bybitTrader) {
          await bybitTrader.openPosition(symbol);
          console.log(`✅ Position longue ouverte sur Bybit: ${symbol}`);
        } else {
          throw new Error('Trader Bybit non disponible');
        }
        break;
        
      default:
        throw new Error(`Exchange non supporté: ${exchange}`);
    }
    
    // Programmer la fermeture automatique dans 3 minutes
    setTimeout(async () => {
      try {
        await closePosition(symbol, exchange);
      } catch (error) {
        console.error(`❌ Erreur fermeture automatique ${symbol}:`, error);
      }
    }, 3 * 60 * 1000); // 3 minutes
    
  } catch (error) {
    console.error(`❌ Erreur exécution trade ${symbol} sur ${exchange}:`, error);
    throw error;
  }
}

async function closePosition(symbol: string, exchange: string): Promise<void> {
  console.log(`🔒 Fermeture position ${symbol} sur ${exchange}`);
  
  try {
    switch (exchange.toLowerCase()) {
      case 'hyperliquid':
        if (hyperliquidTrader) {
          await hyperliquidTrader.closePosition(symbol);
          console.log(`✅ Position fermée sur Hyperliquid: ${symbol}`);
        }
        break;
        
      case 'bybit':
        if (bybitTrader) {
          await bybitTrader.closePosition(symbol);
          console.log(`✅ Position fermée sur Bybit: ${symbol}`);
        }
        break;
    }
  } catch (error) {
    console.error(`❌ Erreur fermeture position ${symbol} sur ${exchange}:`, error);
    throw error;
  }
}




  