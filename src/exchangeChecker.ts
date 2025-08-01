// src/exchangeChecker.ts
import ccxt from "ccxt";
import { BYBIT_CONFIG } from "./config";

export async function hasPerpOnBybit(symbol: string): Promise<boolean> {
  try {
    const config: any = {
      enableRateLimit: true,
      options: {
        defaultType: 'swap', // Futures/Perp
      }
    };

    // Configuration spécifique pour le testnet
    if (BYBIT_CONFIG.sandbox) {
      config.urls = {
        api: {
          public: 'https://api-testnet.bybit.com',
          private: 'https://api-testnet.bybit.com',
        }
      };
      config.sandbox = true;
    }

    const exchange = new ccxt.bybit(config);
    await exchange.loadMarkets();
    
    // Chercher le symbole dans les marchés disponibles
    const markets = Object.keys(exchange.markets);
    const symbolUpper = symbol.toUpperCase();
    
    // Vérifier si le symbole existe dans les marchés perpétuels USDT
    const hasMarket = markets.some(market => 
      market.toUpperCase().includes(`${symbolUpper}USDT`) ||
      market.toUpperCase().includes(`${symbolUpper}PERP`)
    );
    
    console.log(`🔍 Bybit ${symbol}: ${hasMarket ? '✅' : '❌'}`);
    return hasMarket;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Erreur lors de la vérification de Bybit pour ${symbol}:`, error.message);
    } else {
      console.error(`❌ Erreur inconnue lors de la vérification de Bybit pour ${symbol}`);
    }
    return false;
  }
}

export async function hasPerpOnHyperliquid(symbol: string): Promise<boolean> {
  try {
    const exchange = new ccxt.hyperliquid();
    await exchange.loadMarkets();
    
    // Chercher le symbole dans les marchés disponibles
    const markets = Object.keys(exchange.markets);
    const symbolUpper = symbol.toUpperCase();
    
    // Vérifier si le symbole existe dans les marchés
    return markets.some(market => 
      market.toUpperCase().includes(symbolUpper) || 
      market.toUpperCase().includes(`${symbolUpper}USDC`) ||
      market.toUpperCase().includes(`${symbolUpper}PERP`)
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Erreur lors de la vérification de Hyperliquid pour ${symbol}:`, error.message);
    } else {
      console.error(`❌ Erreur inconnue lors de la vérification de Hyperliquid pour ${symbol}`);
    }
    return false;
  }
}
