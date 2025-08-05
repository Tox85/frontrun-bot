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
  private lastLogTime: number = 0;
  private errorCount: number = 0;
  private successCount: number = 0;

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
      const response = await axios.get("https://api.upbit.com/v1/market/all", {
        timeout: 5000, // Timeout plus court pour rapidité
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
      return tokens;
    } catch (error) {
      // Log seulement les erreurs critiques (pas les timeouts normaux)
      if (error instanceof Error && !error.message.includes('timeout') && !error.message.includes('429')) {
        console.error("❌ Erreur fetch Upbit API :", error.message);
      }
      
      // Essayer un endpoint alternatif Upbit
      try {
        const response = await axios.get("https://api.upbit.com/v1/ticker?markets=KRW-BTC", {
          timeout: 3000, // Timeout très court
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; UpbitBot/1.0)',
            'Accept': 'application/json'
          }
        });
        
        if (response.data && Array.isArray(response.data)) {
          return ['BTC']; // Retourner au moins BTC pour confirmer que l'API fonctionne
        }
      } catch (altError) {
        // Log silencieux pour l'endpoint alternatif
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
        
        // Log silencieux pour Railway
        console.log(`🆕 NOUVEAU LISTING BITHUMB: ${symbol}`);
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
        console.log(`✅ ${addedCount} nouveaux tokens Bithumb ajoutés`);
        this.saveKnownTokens();
      }
      
      console.log(`📊 État final: Upbit ${this.knownTokens.size - bithumbTokens.length} tokens, Bithumb ${bithumbTokens.length} tokens`);
    }, 5000);
    
    // Démarrer le polling Upbit avec logs réduits
    this.startUpbitPolling(callback);
  }

  private startUpbitPolling(callback: (symbol: string, metadata?: ListingMetadata) => void): void {
    // Polling Upbit toutes les 2 secondes (optimal pour détection rapide)
    this.intervalId = setInterval(async () => {
      try {
        const upbitTokens = await this.fetchUpbitTickers();
        
        // Log silencieux - seulement si nouveaux tokens détectés
        let newTokensFound = 0;
        
        for (const token of upbitTokens) {
          if (!this.knownTokens.has(token)) {
            this.knownTokens.add(token);
            newTokensFound++;
            
            const listingMetadata: ListingMetadata = {
              title: `🆕 NOUVEAU LISTING UPBIT : ${token}`,
              url: `https://upbit.com/exchange?code=CRIX.UPBIT.KRW-${token}`,
              source: 'Upbit REST API',
              timestamp: Date.now()
            };
            
            // Log seulement les nouveaux tokens
            console.log(`🆕 NOUVEAU LISTING UPBIT: ${token}`);
            callback(token, listingMetadata);
          }
        }
        
        // Log de statut silencieux (toutes les 30 secondes)
        const now = Date.now();
        if (now - this.lastLogTime > 30000) {
          console.log(`⏳ Surveillance active... (Upbit: ${upbitTokens.length}, Bithumb WebSocket: ${this.bithumbWebSocket.getKnownSymbolsCount()})`);
          this.lastLogTime = now;
        }
        
        if (newTokensFound > 0) {
          this.saveKnownTokens();
        }
        
      } catch (error) {
        // Log seulement les erreurs critiques
        if (error instanceof Error && !error.message.includes('timeout')) {
          console.error("❌ Erreur polling Upbit:", error.message);
        }
      }
    }, 2000);
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