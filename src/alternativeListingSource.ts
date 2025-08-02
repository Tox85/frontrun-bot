import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ListingSource, ListingMetadata } from './listingSource';
import { BithumbWebSocket } from './bithumbWebSocket';

export class AlternativeListingSource implements ListingSource {
  private intervalId: NodeJS.Timeout | null = null;
  private knownTokens: Set<string>;
  private knownTokensPath: string;
  private bithumbWebSocket: BithumbWebSocket;
  private userAgentIndex: number = 0;

  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];

  constructor() {
    this.knownTokensPath = path.resolve(__dirname, "../knownTokens.json");
    this.knownTokens = this.loadKnownTokens();
    this.bithumbWebSocket = new BithumbWebSocket();
  }

  private loadKnownTokens(): Set<string> {
    try {
      if (!fs.existsSync(this.knownTokensPath)) {
        fs.writeFileSync(this.knownTokensPath, JSON.stringify([], null, 2));
      }
      const data = fs.readFileSync(this.knownTokensPath, "utf-8");
      const tokens = JSON.parse(data);
      return new Set(tokens);
    } catch (error) {
      console.warn("⚠️ Impossible de charger knownTokens.json, initialisation vide.");
      fs.writeFileSync(this.knownTokensPath, JSON.stringify([], null, 2));
      return new Set();
    }
  }

  private saveKnownTokens() {
    try {
      const array = Array.from(this.knownTokens);
      console.log(`💾 Sauvegarde de ${array.length} tokens dans knownTokens.json`);
      fs.writeFileSync(this.knownTokensPath, JSON.stringify(array, null, 2));
      console.log(`✅ Fichier sauvegardé avec succès`);
    } catch (error) {
      console.warn(`⚠️ Erreur sauvegarde (ignorée): ${error}`);
    }
  }

  private async fetchBithumbTickers(): Promise<string[]> {
    // WebSocket Bithumb gère automatiquement la détection des nouveaux listings
    // Cette méthode n'est plus nécessaire car le WebSocket fait le travail en temps réel
      return [];
  }

  private async fetchUpbitTickers(): Promise<string[]> {
    try {
      console.log("🔍 Récupération des tokens via API Upbit.");
      const response = await axios.get("https://api.upbit.com/v1/market/all", {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const markets = response.data.filter((market: any) => 
        market.market.startsWith('KRW-') && 
        !market.market.includes('USDT') && 
        !market.market.includes('BTC')
      );

      const tokens = markets.map((market: any) => market.market.replace('KRW-', ''));
      console.log(`🇰🇷 Nombre de tokens Upbit : ${tokens.length}`);
      return tokens;
    } catch (error) {
      console.error("❌ Erreur fetch Upbit API :", error);
      
      // Essayer un endpoint alternatif Upbit
      try {
        console.log("🔄 Tentative endpoint alternatif Upbit...");
        const response = await axios.get("https://api.upbit.com/v1/ticker?markets=KRW-BTC", {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; UpbitBot/1.0)',
            'Accept': 'application/json'
          }
        });
        
        if (response.data && Array.isArray(response.data)) {
          console.log(`🇰🇷 Test endpoint alternatif Upbit réussi`);
          return ['BTC']; // Retourner au moins BTC pour confirmer que l'API fonctionne
        }
      } catch (fallbackError) {
        console.error("❌ Échec endpoint alternatif Upbit :", fallbackError);
      }
      
      return [];
    }
  }

  startListening(callback: (symbol: string, metadata?: ListingMetadata) => void): void {
    console.log("🔄 Démarrage de la surveillance (Bithumb WebSocket + Upbit REST)...");
    console.log(`🔢 Tokens déjà connus : ${this.knownTokens.size}`);
    
    // Démarrer le WebSocket Bithumb pour la détection en temps réel
    this.bithumbWebSocket.startListening((symbol: string, metadata?: any) => {
      // Callback pour les nouveaux listings Bithumb détectés via WebSocket
      if (!this.knownTokens.has(symbol)) {
        this.knownTokens.add(symbol);
        
        const listingMetadata: ListingMetadata = {
          title: `🆕 NOUVEAU LISTING BITHUMB : ${symbol}`,
          url: `https://bithumb.com/trade/${symbol}_KRW`,
          source: 'Bithumb WebSocket',
          timestamp: Date.now()
        };
        
        console.log(`🆕 NOUVEAU LISTING BITHUMB (WebSocket): ${symbol}`);
        callback(symbol, listingMetadata);
        this.saveKnownTokens();
      }
    });
    
    // Synchroniser les tokens Bithumb avec knownTokens.json après un délai
    setTimeout(() => {
      const bithumbTokens = this.bithumbWebSocket.getKnownSymbols();
      console.log(`🔄 Synchronisation Bithumb: ${bithumbTokens.length} tokens détectés`);
      
      // Ajouter tous les tokens Bithumb connus à knownTokens.json
      let addedCount = 0;
      bithumbTokens.forEach(token => {
        if (!this.knownTokens.has(token)) {
          this.knownTokens.add(token);
          addedCount++;
        }
      });
      
      if (addedCount > 0) {
        console.log(`📊 ${addedCount} tokens Bithumb ajoutés à knownTokens.json`);
        this.saveKnownTokens();
      }
      
      console.log(`📊 État final: Upbit ${this.knownTokens.size - bithumbTokens.length} tokens, Bithumb ${bithumbTokens.length} tokens`);
    }, 5000);
    
    // Polling Upbit toutes les 2 secondes
    this.intervalId = setInterval(async () => {
      try {
        console.log("🔄 Vérification des nouveaux listings Upbit...");
        
        const upbitTokens = await this.fetchUpbitTickers();
        const newTokens = upbitTokens.filter(token => !this.knownTokens.has(token));

        if (newTokens.length > 0) {
          console.log(`📊 Upbit: ${upbitTokens.length}, Nouveaux: ${newTokens.length}`);

          for (const token of newTokens) {
            this.knownTokens.add(token);
            
            const metadata: ListingMetadata = {
              title: `🆕 NOUVEAU LISTING UPBIT : ${token}`,
              url: `https://upbit.com/exchange?code=CRIX.UPBIT.KRW-${token}`,
              source: 'Upbit REST',
              timestamp: Date.now()
            };

            console.log(`🆕 NOUVEAU LISTING UPBIT: ${token}`);
            callback(token, metadata);
          }
          
          this.saveKnownTokens();
        } else {
          // Log très peu fréquent pour éviter le spam
          if (Math.random() < 0.05) { // 5% de chance de logger
            console.log("⏳ Surveillance active... (Upbit: " + upbitTokens.length + ", Bithumb WebSocket: " + this.bithumbWebSocket.getKnownSymbolsCount() + ")");
          }
        }

      } catch (error) {
        console.error('❌ Erreur lors de la vérification Upbit :', error);
        
        // Si erreur de rate limiting, attendre un peu plus
        if (error instanceof Error && (error.message?.includes('429') || error.message?.includes('rate limit'))) {
          console.warn('⚠️ Rate limit détecté, pause de 15 secondes...');
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
        
        // Si timeout, pause courte
        if (error instanceof Error && error.message?.includes('timeout')) {
          console.warn('⏱️ Timeout détecté, pause de 5 secondes...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }, 2000); // Vérification Upbit toutes les 2 secondes
  }

  stopListening(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.bithumbWebSocket.stopListening();
    console.log("🛑 Surveillance arrêtée.");
  }
} 