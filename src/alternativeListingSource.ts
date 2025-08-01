import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ListingSource, ListingMetadata } from './listingSource';

export class AlternativeListingSource implements ListingSource {
  private intervalId: NodeJS.Timeout | null = null;
  private knownTokens: Set<string>;
  private knownTokensPath: string;
  private lastCheck: number = 0;

  constructor() {
    this.knownTokensPath = path.resolve(__dirname, "../knownTokens.json");
    this.knownTokens = this.loadKnownTokens();
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
      // Ne pas faire échouer le bot pour une erreur de sauvegarde
    }
  }

  private async fetchBithumbTickers(): Promise<string[]> {
    try {
      // Utiliser l'API publique Bithumb qui est accessible
      const response = await axios.get("https://api.bithumb.com/public/ticker/ALL_KRW", {
        timeout: 5000, // Timeout augmenté à 5 secondes
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.data || !response.data.data) {
        throw new Error("Données API invalides");
      }

      const tokens = Object.keys(response.data.data).filter(token => token !== "date");
      console.log(`📊 Nombre de tokens Bithumb : ${tokens.length}`);
      return tokens;
    } catch (error) {
      console.error("❌ Erreur fetch Bithumb API :", error);
      return [];
    }
  }

  private async fetchUpbitTickers(): Promise<string[]> {
    try {
      // API Upbit comme alternative
      const response = await axios.get("https://api.upbit.com/v1/market/all", {
        timeout: 5000, // Timeout augmenté à 5 secondes
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const markets = response.data.filter((market: any) => 
        market.market.startsWith('KRW-') && 
        !market.market.includes('USDT') && 
        !market.market.includes('BTC')
      );

      const tokens = markets.map((market: any) => market.market.replace('KRW-', ''));
      console.log(`📊 Nombre de tokens Upbit : ${tokens.length}`);
      return tokens;
    } catch (error) {
      console.error("❌ Erreur fetch Upbit API :", error);
      return [];
    }
  }

  startListening(callback: (symbol: string, metadata?: ListingMetadata) => void): void {
    console.log("🔄 Démarrage de la surveillance alternative (Bithumb + Upbit)...");
    console.log(`🔢 Tokens déjà connus : ${this.knownTokens.size}`);
    
    this.intervalId = setInterval(async () => {
      try {
        console.log("🔍 Vérification des nouveaux listings...");
        
        // Récupérer les tokens des deux sources en parallèle avec gestion d'erreurs
        const [bithumbResult, upbitResult] = await Promise.allSettled([
          this.fetchBithumbTickers(),
          this.fetchUpbitTickers()
        ]);

        // Traiter les résultats avec gestion d'erreurs
        const bithumbTokens = bithumbResult.status === 'fulfilled' ? bithumbResult.value : [];
        const upbitTokens = upbitResult.status === 'fulfilled' ? upbitResult.value : [];

        // Combiner et dédupliquer
        const allTokens = [...new Set([...bithumbTokens, ...upbitTokens])];
        const newTokens = allTokens.filter(token => !this.knownTokens.has(token));

        // Logs optimisés pour éviter le spam
        if (newTokens.length > 0) {
          console.log(`📊 Bithumb: ${bithumbTokens.length}, Upbit: ${upbitTokens.length}, Nouveaux: ${newTokens.length}`);
          for (const token of newTokens) {
            console.log(`➕ ${token}`);
          }
        } else {
          // Log très peu fréquent pour éviter le spam avec 2s
          if (Math.random() < 0.05) { // 5% de chance de logger
            console.log("⏳ Surveillance active...");
          }
        }

        if (newTokens.length > 0) {
          console.log("🆕 NOUVEAUX TOKENS DÉTECTÉS :", newTokens);

          for (const token of newTokens) {
            const metadata: ListingMetadata = {
              title: `Nouveau token détecté via API alternative`,
              url: `https://api.bithumb.com/public/ticker/${token}_KRW`,
              timestamp: Date.now()
            };

            callback(token, metadata);
            this.knownTokens.add(token);
          }
          
          // Sauvegarder seulement quand il y a de nouveaux tokens
          this.saveKnownTokens();
        }

        this.lastCheck = Date.now();

      } catch (error) {
        console.error('❌ Erreur lors de la vérification :', error);
        
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
    }, 2000); // Vérification toutes les 2 secondes (ultra-rapide avec sécurité)
  }

  stopListening(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("🛑 Surveillance alternative arrêtée.");
    }
  }
} 