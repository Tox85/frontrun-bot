// src/bithumbArticleScraper.ts
import axios from 'axios';
import { TelegramService } from './telegramService';

interface BithumbArticle {
  id: string;
  title: string;
  content: string;
  date: string;
  symbol?: string;
}

export class BithumbArticleScraper {
  private lastArticleId: string = '';
  private telegramService: TelegramService;
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(telegramService: TelegramService) {
    this.telegramService = telegramService;
  }

  async startMonitoring() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('📰 Démarrage surveillance articles Bithumb...');
    
    // Vérification initiale
    await this.checkNewArticles();
    
    // Surveillance toutes les 30 secondes
    this.checkInterval = setInterval(async () => {
      await this.checkNewArticles();
    }, 30000);
  }

  async stopMonitoring() {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('📰 Arrêt surveillance articles Bithumb');
  }

  private async checkNewArticles() {
    try {
      // Essayer plusieurs URLs et méthodes
      const urls = [
        'https://feed.bithumb.com/notice?category=&keyword=추가&page=1',
        'https://www.bithumb.com/notice',
        'https://api.bithumb.com/public/notice'
      ];

      for (const url of urls) {
        try {
          const response = await this.makeRequest(url);
          if (response && response.status === 200) {
            const articles = this.parseArticles(response.data);
            
            if (articles.length > 0) {
              const latestArticle = articles[0];
              
              if (this.lastArticleId !== latestArticle.id) {
                this.lastArticleId = latestArticle.id;
                
                // Vérifier si c'est un nouveau listing
                if (this.isListingArticle(latestArticle)) {
                  const symbol = this.extractSymbol(latestArticle);
                  if (symbol) {
                    console.log(`🆕 NOUVEAU LISTING DÉTECTÉ VIA ARTICLE: ${symbol}`);
                    await this.telegramService.sendNewListing(symbol, {
                      exchange: 'Bithumb',
                      source: 'Article',
                      title: latestArticle.title,
                      date: latestArticle.date
                    });
                    
                    // Émettre l'événement pour le trader
                    this.emitNewListing(symbol);
                  }
                }
              }
            }
            break; // Si on réussit, on arrête
          }
        } catch (error) {
          console.log(`⚠️ Échec pour ${url}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
          continue; // Essayer l'URL suivante
        }
      }
    } catch (error) {
      console.error('❌ Erreur surveillance articles Bithumb:', error);
    }
  }

  private async makeRequest(url: string) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    };

    return axios.get(url, {
      timeout: 15000,
      headers,
      validateStatus: (status) => status < 500, // Accepter les erreurs 4xx
      maxRedirects: 5
    });
  }

  private parseArticles(html: string): BithumbArticle[] {
    // Parser le HTML pour extraire les articles
    const articles: BithumbArticle[] = [];
    
    try {
      // Regex pour extraire les articles
      const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/g;
      let match;
      
      while ((match = articleRegex.exec(html)) !== null) {
        const articleHtml = match[1];
        
        // Extraire les informations
        const titleMatch = articleHtml.match(/<h[^>]*>([^<]+)<\/h[^>]*>/);
        const contentMatch = articleHtml.match(/<p[^>]*>([^<]+)<\/p>/);
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/);
        const idMatch = articleHtml.match(/data-id="([^"]+)"/);
        
        if (titleMatch) {
          articles.push({
            id: idMatch?.[1] || Date.now().toString(),
            title: titleMatch[1].trim(),
            content: contentMatch?.[1]?.trim() || '',
            date: dateMatch?.[1]?.trim() || new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('❌ Erreur parsing HTML:', error);
    }
    
    return articles;
  }

  private isListingArticle(article: BithumbArticle): boolean {
    const keywords = ['추가', '상장', 'listing', 'new', 'market', 'trading', 'coin', 'token'];
    const text = `${article.title} ${article.content}`.toLowerCase();
    
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractSymbol(article: BithumbArticle): string | null {
    // Regex pour extraire les symboles de crypto
    const symbolRegex = /([A-Z]{2,10})\/([A-Z]{2,10})/g;
    const match = symbolRegex.exec(article.title + ' ' + article.content);
    
    if (match) {
      return match[1]; // Retourner le symbole principal
    }
    
    // Fallback : chercher des patterns de symboles
    const text = article.title + ' ' + article.content;
    const cryptoRegex = /\b([A-Z]{3,10})\b/g;
    const matches = text.match(cryptoRegex);
    
    if (matches && matches.length > 0) {
      // Filtrer les mots communs
      const commonWords = ['THE', 'AND', 'FOR', 'NEW', 'MARKET', 'TRADING', 'COIN', 'TOKEN'];
      const symbol = matches.find(match => !commonWords.includes(match));
      return symbol || null;
    }
    
    return null;
  }

  private emitNewListing(symbol: string) {
    // Émettre l'événement pour que le trader puisse le traiter
    console.log(`📡 Émission événement nouveau listing: ${symbol}`);
  }
} 