import ccxt from 'ccxt';
import fs from 'fs';
import path from 'path';

export interface GlobalTokenInfo {
  symbol: string;
  exchange: string;
  firstSeen: number;
  isListedGlobally: boolean;
}

export class BinanceChecker {
  private knownGlobalTokens: Set<string>;
  private knownGlobalTokensPath: string;
  private binance: any;
  private intervalId: NodeJS.Timeout | null = null;
  private lastCheckTime: number = 0;
  private checkInterval: number = 300000; // 5 minutes
  private errorCount: number = 0;
  private successCount: number = 0;

  constructor() {
    this.knownGlobalTokensPath = path.resolve(__dirname, "../knownGlobalTokens.json");
    this.knownGlobalTokens = this.loadKnownGlobalTokens();
    this.binance = new ccxt.binance({
      enableRateLimit: true,
      timeout: 10000,
    });
  }

  private loadKnownGlobalTokens(): Set<string> {
    try {
      if (!fs.existsSync(this.knownGlobalTokensPath)) {
        fs.writeFileSync(this.knownGlobalTokensPath, JSON.stringify([], null, 2));
      }
      const data = fs.readFileSync(this.knownGlobalTokensPath, "utf-8");
      const tokens = JSON.parse(data);
      return new Set(tokens);
    } catch (error) {
      console.warn("⚠️ Impossible de charger knownGlobalTokens.json, initialisation vide.");
      fs.writeFileSync(this.knownGlobalTokensPath, JSON.stringify([], null, 2));
      return new Set();
    }
  }

  private saveKnownGlobalTokens() {
    try {
      const array = Array.from(this.knownGlobalTokens);
      console.log(`💾 Sauvegarde de ${array.length} tokens globaux dans knownGlobalTokens.json`);
      fs.writeFileSync(this.knownGlobalTokensPath, JSON.stringify(array, null, 2));
      console.log(`✅ Fichier global sauvegardé avec succès`);
    } catch (error) {
      console.warn(`⚠️ Erreur sauvegarde globale (ignorée): ${error}`);
    }
  }

  private async fetchBinanceTickers(): Promise<string[]> {
    try {
      const markets = await this.binance.loadMarkets();
      
      // Filtrer les paires USDT (spot) et USDT (perp)
      const binanceTokens = new Set<string>();
      
      for (const [symbol, market] of Object.entries(markets)) {
        const marketData = market as any;
        if (marketData.active && 
            (symbol.endsWith('/USDT') || symbol.endsWith('/USDC')) &&
            !symbol.includes('UPUSDT') && // Exclure les paires inversées
            !symbol.includes('DOWNUSDT') &&
            !symbol.includes('TEST') &&
            !symbol.includes('DEMO')) {
          
          const baseToken = symbol.split('/')[0];
          if (baseToken.length >= 2 && baseToken.length <= 10) {
            binanceTokens.add(baseToken);
          }
        }
      }
      
      return Array.from(binanceTokens);
    } catch (error) {
      console.error("❌ Erreur fetch Binance API :", error);
      this.errorCount++;
      return [];
    }
  }

  public async checkForNewGlobalTokens(): Promise<string[]> {
    try {
      console.log("🔍 Vérification des nouveaux tokens globaux sur Binance...");
      const currentTokens = await this.fetchBinanceTickers();
      const newTokens: string[] = [];

      for (const token of currentTokens) {
        if (!this.knownGlobalTokens.has(token)) {
          newTokens.push(token);
          this.knownGlobalTokens.add(token);
          console.log(`🌍 NOUVEAU TOKEN GLOBAL DÉTECTÉ: ${token} sur Binance`);
        }
      }

      if (newTokens.length > 0) {
        this.saveKnownGlobalTokens();
        console.log(`✅ ${newTokens.length} nouveaux tokens globaux ajoutés`);
      } else {
        console.log(`📊 Aucun nouveau token global détecté (${currentTokens.length} tokens surveillés)`);
      }

      this.successCount++;
      return newTokens;
    } catch (error) {
      console.error("❌ Erreur vérification tokens globaux:", error);
      this.errorCount++;
      return [];
    }
  }

  public async checkIfTokenIsListedGlobally(symbol: string): Promise<boolean> {
    return this.knownGlobalTokens.has(symbol.toUpperCase());
  }

  public async findPerpOnBinance(symbol: string): Promise<boolean> {
    try {
      const perpSymbol = `${symbol.toUpperCase()}/USDT:USDT`;
      const markets = await this.binance.loadMarkets();
      
      if (markets[perpSymbol] && markets[perpSymbol].active) {
        console.log(`✅ Perp ${symbol} trouvé sur Binance: ${perpSymbol}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Erreur recherche perp ${symbol} sur Binance:`, error);
      return false;
    }
  }

  public async getGlobalTokenInfo(symbol: string): Promise<GlobalTokenInfo> {
    const isListedGlobally = await this.checkIfTokenIsListedGlobally(symbol);
    const hasPerpOnBinance = await this.findPerpOnBinance(symbol);
    
    return {
      symbol: symbol.toUpperCase(),
      exchange: 'Binance',
      firstSeen: Date.now(),
      isListedGlobally: isListedGlobally || hasPerpOnBinance
    };
  }

  public startGlobalMonitoring(): void {
    if (this.intervalId) {
      console.log("⚠️ Monitoring global déjà actif");
      return;
    }

    console.log("🌍 Démarrage du monitoring global Binance...");
    
    // Première vérification immédiate
    this.checkForNewGlobalTokens();
    
    // Vérification périodique
    this.intervalId = setInterval(async () => {
      await this.checkForNewGlobalTokens();
    }, this.checkInterval);

    console.log(`✅ Monitoring global Binance actif (intervalle: ${this.checkInterval/1000}s)`);
  }

  public stopGlobalMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("🛑 Monitoring global Binance arrêté");
    }
  }

  public getStats(): { totalGlobal: number; successCount: number; errorCount: number } {
    return {
      totalGlobal: this.knownGlobalTokens.size,
      successCount: this.successCount,
      errorCount: this.errorCount
    };
  }

  public getKnownGlobalTokens(): string[] {
    return Array.from(this.knownGlobalTokens);
  }
}
