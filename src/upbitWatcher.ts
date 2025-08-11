import axios from 'axios';

export interface UpbitListing {
  symbol: string;
  fullSymbol: string;
  price: number;
  volume: number;
  timestamp: number;
  exchange: 'UPBIT';
}

export class UpbitWatcher {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastKnownTokens: Set<string> = new Set();
  private onNewListing: (listing: UpbitListing) => void;
  private pollingInterval: number = process.env.RAILWAY_ENVIRONMENT ? 5000 : 2000; // Adaptatif : 5s Railway, 2s local

  constructor(onNewListing: (listing: UpbitListing) => void) {
    this.onNewListing = onNewListing;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ UpbitWatcher déjà en cours d\'exécution');
      return;
    }

    console.log('🔍 Démarrage de la surveillance Upbit (polling 2s)...');
    
    try {
      // Charger les tokens connus au démarrage
      await this.loadKnownTokens();
      
      // Démarrer le polling
      this.isRunning = true;
      this.intervalId = setInterval(async () => {
        await this.checkNewListings();
      }, this.pollingInterval);
      
      console.log('✅ Surveillance Upbit démarrée avec succès');
    } catch (error) {
      console.error('❌ Erreur démarrage UpbitWatcher:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Surveillance Upbit arrêtée');
  }

  private async loadKnownTokens(): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      const knownTokensFile = path.join(process.cwd(), 'knownTokens.json');
      
      if (fs.existsSync(knownTokensFile)) {
        const data = fs.readFileSync(knownTokensFile, 'utf8');
        const tokens = JSON.parse(data);
        this.lastKnownTokens = new Set(tokens);
        console.log(`📚 ${this.lastKnownTokens.size} tokens connus chargés depuis knownTokens.json`);
      } else {
        console.log('📚 Aucun fichier knownTokens.json trouvé, démarrage avec liste vide');
      }
    } catch (error) {
      console.error('❌ Erreur chargement tokens connus:', error);
      this.lastKnownTokens = new Set();
    }
  }

  private async checkNewListings(): Promise<void> {
    try {
      if (!this.isRunning) return;

      // Log de surveillance coréenne - DÉSACTIVÉ pour éviter le spam
      // if (process.env.ENABLE_KOREAN_LOGS === 'true' && !process.env.RAILWAY_ENVIRONMENT) {
      //   console.log(`🇰🇷 Polling Upbit... (${new Date().toLocaleTimeString()})`);
      // }

      const currentTokens = await this.fetchUpbitListings();
      if (currentTokens.length === 0) return;

      const newTokens = currentTokens.filter(token => !this.lastKnownTokens.has(token.symbol));
      
      if (newTokens.length > 0) {
        console.log(`🆕 ${newTokens.length} nouveau(x) token(s) détecté(s) sur Upbit:`, newTokens.map(t => t.symbol));
        
        for (const token of newTokens) {
          // Ajouter aux tokens connus
          this.lastKnownTokens.add(token.symbol);
          
          // Notifier le nouveau listing
          this.onNewListing(token);
          
          // Sauvegarder dans knownTokens.json
          await this.saveKnownTokens();
        }
      }
    } catch (error) {
      console.error('❌ Erreur vérification Upbit:', error);
    }
  }

  private async fetchUpbitListings(): Promise<UpbitListing[]> {
    try {
      // API Upbit pour récupérer tous les marchés
      const response = await axios.get('https://api.upbit.com/v1/market/all', {
        timeout: 15000,  // Augmenté à 15s pour Railway
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const markets = response.data;
      const listings: UpbitListing[] = [];

      for (const market of markets) {
        if (market.market.startsWith('KRW-')) {
          const symbol = market.market.replace('KRW-', '');
          
          // Récupérer le prix et volume actuels
          try {
            const tickerResponse = await axios.get(`https://api.upbit.com/v1/ticker?markets=${market.market}`, {
              timeout: 8000  // Augmenté pour Railway
            });
            
            if (tickerResponse.data && tickerResponse.data[0]) {
              const ticker = tickerResponse.data[0];
              listings.push({
                symbol,
                fullSymbol: market.market,
                price: ticker.trade_price || 0,
                volume: ticker.acc_trade_volume_24h || 0,
                timestamp: Date.now(),
                exchange: 'UPBIT'
              });
            }
          } catch (tickerError) {
            // Si erreur ticker, utiliser les données de base
            listings.push({
              symbol,
              fullSymbol: market.market,
              price: 0,
              volume: 0,
              timestamp: Date.now(),
              exchange: 'UPBIT'
            });
          }
        }
      }

      return listings;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        console.warn('⚠️ Timeout Upbit - Réessai dans 30s...');
      } else {
        console.error('❌ Erreur récupération Upbit:', error);
      }
      return [];
    }
  }

  private async saveKnownTokens(): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      const knownTokensFile = path.join(process.cwd(), 'knownTokens.json');
      
      const tokens = Array.from(this.lastKnownTokens);
      fs.writeFileSync(knownTokensFile, JSON.stringify(tokens, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Erreur sauvegarde tokens connus:', error);
    }
  }

  getStatus(): { isRunning: boolean; tokenCount: number; lastCheck: number } {
    return {
      isRunning: this.isRunning,
      tokenCount: this.lastKnownTokens.size,
      lastCheck: Date.now()
    };
  }
}
