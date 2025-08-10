import { HyperliquidTrader } from '../hyperliquidTrader';
import { BinanceTrader } from '../binanceTrader';
import { BybitTrader } from '../bybitTrader';

export interface FoundPerp {
  venue: 'HL' | 'BINANCE' | 'BYBIT';
  symbol: string;
  meta: {
    minOrderSize?: number;
    minNotional?: number;
    tickSize?: number;
    lotSize?: number;
    maxLeverage?: number;
    price?: number;
  };
}

export class PerpFinder {
  private hyperliquidTrader: HyperliquidTrader | null = null;
  private binanceTrader: BinanceTrader | null = null;
  private bybitTrader: BybitTrader | null = null;

  constructor(
    hyperliquidTrader?: HyperliquidTrader,
    binanceTrader?: BinanceTrader,
    bybitTrader?: BybitTrader
  ) {
    this.hyperliquidTrader = hyperliquidTrader || null;
    this.binanceTrader = binanceTrader || null;
    this.bybitTrader = bybitTrader || null;
  }

  /**
   * Normalise un symbole en différentes variantes possibles
   */
  private normalizeSymbol(input: string): string[] {
    const normalized = input.toUpperCase().trim();
    const variants = [normalized];
    
    // Ajouter variantes communes
    if (!normalized.endsWith('USDT')) {
      variants.push(`${normalized}USDT`);
    }
    if (!normalized.endsWith('-PERP')) {
      variants.push(`${normalized}-PERP`);
    }
    
    // Aliases spécifiques
    const aliases: Record<string, string[]> = {
      'BORA': ['BORA', 'BORAUSDT'],
      'APT': ['APT', 'APTUSDT'],
      'SUI': ['SUI', 'SUIUSDT'],
      'SEI': ['SEI', 'SEIUSDT'],
      'TIA': ['TIA', 'TIAUSDT'],
      'JUP': ['JUP', 'JUPUSDT'],
      'PYTH': ['PYTH', 'PYTHUSDT'],
      'WIF': ['WIF', 'WIFUSDT'],
      'BONK': ['BONK', 'BONKUSDT'],
      'MEME': ['MEME', 'MEMEUSDT'],
      'PEPE': ['PEPE', 'PEPEUSDT'],
      'SHIB': ['SHIB', 'SHIBUSDT'],
      'DOGE': ['DOGE', 'DOGEUSDT'],
      'FLOKI': ['FLOKI', 'FLOKIUSDT'],
      'BABYDOGE': ['BABYDOGE', 'BABYDOGEUSDT'],
      'SAFEMOON': ['SAFEMOON', 'SAFEMOONUSDT'],
      'MOON': ['MOON', 'MOONUSDT'],
      'STAR': ['STAR', 'STARUSDT'],
      'GEM': ['GEM', 'GEMUSDT'],
      'RARE': ['RARE', 'RAREUSDT'],
      'ALPHA': ['ALPHA', 'ALPHAUSDT'],
      'BETA': ['BETA', 'BETAUSDT'],
      'GAMMA': ['GAMMA', 'GAMMAUSDT'],
      'DELTA': ['DELTA', 'DELTAUSDT'],
      'THETA': ['THETA', 'THETAUSDT'],
      'OMEGA': ['OMEGA', 'OMEGAUSDT'],
      'SIGMA': ['SIGMA', 'SIGMAUSDT'],
      'ZETA': ['ZETA', 'ZETAUSDT'],
      'LAMBDA': ['LAMBDA', 'LAMBDAUSDT'],
      'PHI': ['PHI', 'PHIUSDT'],
      'PSI': ['PSI', 'PSIUSDT'],
      'CHI': ['CHI', 'CHIUSDT'],
      'XI': ['XI', 'XIUSDT'],
      'NU': ['NU', 'NUUSDT'],
      'MU': ['MU', 'MUUSDT'],
      'TAU': ['TAU', 'TAUUSDT'],
      'RHO': ['RHO', 'RHOUSDT'],
      'KAPPA': ['KAPPA', 'KAPPAUSDT'],
      'IOTA': ['IOTA', 'IOTAUSDT'],
      'ETA': ['ETA', 'ETAUSDT'],
    };

    if (aliases[normalized]) {
      variants.push(...aliases[normalized]);
    }

    return [...new Set(variants)]; // Supprimer les doublons
  }

  /**
   * Vérifie Hyperliquid pour un symbole
   */
  private async checkHL(symbols: string[]): Promise<FoundPerp | null> {
    if (!this.hyperliquidTrader) {
      console.log('⚠️ HyperliquidTrader non disponible');
      return null;
    }

    const timeout = parseInt(process.env.PERP_CHECK_TIMEOUT_MS || '200');
    
    try {
      for (const symbol of symbols) {
        const hasPerp = await Promise.race([
          this.hyperliquidTrader.hasPerp(symbol),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);

        if (hasPerp) {
          console.log(`✅ Perp trouvé sur Hyperliquid: ${symbol}`);
          
          // Récupérer les infos du marché
          const marketInfo = await this.hyperliquidTrader.getMarketInfo(symbol);
          const ticker = await this.hyperliquidTrader.getTicker(symbol);
          
          return {
            venue: 'HL',
            symbol,
            meta: {
              minOrderSize: marketInfo?.minOrderSize,
              minNotional: marketInfo?.minNotional,
              tickSize: marketInfo?.tickSize,
              lotSize: marketInfo?.lotSize,
              maxLeverage: 25, // HL par défaut
              price: ticker?.last
            }
          };
        }
      }
      
      return null;
    } catch (error) {
      console.log(`❌ Erreur vérification Hyperliquid: ${error}`);
      return null;
    }
  }

  /**
   * Vérifie Binance pour un symbole
   */
  private async checkBinance(symbols: string[]): Promise<FoundPerp | null> {
    if (!this.binanceTrader || process.env.BINANCE_ENABLED !== '1') {
      console.log('⚠️ BinanceTrader non disponible ou désactivé');
      return null;
    }

    const timeout = parseInt(process.env.PERP_CHECK_TIMEOUT_MS || '200');
    
    try {
      for (const symbol of symbols) {
        const hasPerp = await Promise.race([
          this.binanceTrader.hasPerp(symbol),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);

        if (hasPerp) {
          console.log(`✅ Perp trouvé sur Binance: ${symbol}`);
          
          const marketInfo = await this.binanceTrader.getMarketInfo(symbol);
          const ticker = await this.binanceTrader.getTicker(symbol);
          
          return {
            venue: 'BINANCE',
            symbol,
            meta: {
              minOrderSize: marketInfo?.minOrderSize,
              minNotional: marketInfo?.minNotional,
              tickSize: marketInfo?.tickSize,
              lotSize: marketInfo?.lotSize,
              maxLeverage: 25,
              price: ticker?.last
            }
          };
        }
      }
      
      return null;
    } catch (error) {
      console.log(`❌ Erreur vérification Binance: ${error}`);
      return null;
    }
  }

  /**
   * Vérifie Bybit pour un symbole
   */
  private async checkBybit(symbols: string[]): Promise<FoundPerp | null> {
    if (!this.bybitTrader || process.env.BYBIT_ENABLED !== '1') {
      console.log('⚠️ BybitTrader non disponible ou désactivé');
      return null;
    }

    const timeout = parseInt(process.env.PERP_CHECK_TIMEOUT_MS || '200');
    
    try {
      for (const symbol of symbols) {
        const hasPerp = await Promise.race([
          this.bybitTrader.hasPerp(symbol),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);

        if (hasPerp) {
          console.log(`✅ Perp trouvé sur Bybit: ${symbol}`);
          
          const marketInfo = await this.bybitTrader.getMarketInfo(symbol);
          const ticker = await this.bybitTrader.getTicker(symbol);
          
          return {
            venue: 'BYBIT',
            symbol,
            meta: {
              minOrderSize: marketInfo?.minOrderSize,
              minNotional: marketInfo?.minNotional,
              tickSize: marketInfo?.tickSize,
              lotSize: marketInfo?.lotSize,
              maxLeverage: 25,
              price: ticker?.last
            }
          };
        }
      }
      
      return null;
    } catch (error) {
      console.log(`❌ Erreur vérification Bybit: ${error}`);
      return null;
    }
  }

  /**
   * Trouve le premier perp disponible dans l'ordre HL → Binance → Bybit
   */
  async findFirstPerp(symbol: string): Promise<FoundPerp | null> {
    console.log(`🔍 Recherche perp pour: ${symbol}`);
    
    const symbols = this.normalizeSymbol(symbol);
    console.log(`📝 Variantes à tester: ${symbols.join(', ')}`);

    // Essayer Hyperliquid en premier
    const hlResult = await this.checkHL(symbols);
    if (hlResult) {
      return hlResult;
    }

    // Si HL indisponible, essayer Binance
    const binanceResult = await this.checkBinance(symbols);
    if (binanceResult) {
      return binanceResult;
    }

    // En dernier recours, essayer Bybit
    const bybitResult = await this.checkBybit(symbols);
    if (bybitResult) {
      return bybitResult;
    }

    console.log(`❌ Aucun perp trouvé pour ${symbol}`);
    return null;
  }
}
