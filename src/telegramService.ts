import axios from 'axios';
import { TELEGRAM_CONFIG } from './config';

export class TelegramService {
  private botToken: string;
  private chatId: string;
  private enabled: boolean;
  private baseUrl: string;
  private messageWhitelist: Set<string> = new Set([
    'NOUVEAU LISTING DÉTECTÉ',
    'STATUT DU BOT',
    'MISE À JOUR BALANCE',
    'ERREUR BOT',
    'EXÉCUTION DE TRADE',
    'Rapport Risque Quotidien',
    'Rapport de Risque',
    'DIAGNOSTIC SYSTÈME',
    'TOKEN AJOUTÉ À LA FILE D\'ATTENTE',
    'Test de diagnostic Telegram'
  ]);

  constructor() {
    this.botToken = TELEGRAM_CONFIG.botToken;
    this.chatId = TELEGRAM_CONFIG.chatId;
    this.enabled = TELEGRAM_CONFIG.enabled;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    
    // Validation de la configuration
    if (!this.enabled || !this.botToken || !this.chatId) {
      console.log('⚠️ Telegram désactivé ou mal configuré - Mode console uniquement');
      console.log('🔍 Debug Telegram config:', {
        enabled: this.enabled,
        hasToken: !!this.botToken,
        hasChatId: !!this.chatId,
        tokenLength: this.botToken?.length || 0,
        chatIdLength: this.chatId?.length || 0
      });
    } else {
      console.log('✅ Service Telegram configuré');
      console.log('🔍 Debug Telegram config:', {
        enabled: this.enabled,
        hasToken: !!this.botToken,
        hasChatId: !!this.chatId,
        tokenLength: this.botToken?.length || 0,
        chatIdLength: this.chatId?.length || 0
      });
    }
  }

  private validateMessage(message: string): boolean {
    // Vérifier si le message contient des mots-clés suspects
    const suspiciousKeywords = [
      'casino', 'bonus', 'promo', 'jetacas', 'welcome', 'deposit',
      'withdrawal', 'gambling', 'bet', 'slot', 'poker', 'live',
      'launched', 'brand-new', 'online casino', 'generous launch',
      'credited instantly', 'promo code', 'no strings attached',
      'no id required', 'instant bonus', 'top-tier providers',
      '24/7 support', 'minimum deposit', 'licensed platform',
      'fair payouts', 'secure withdrawals', 'e-wallets'
    ];
    
    const lowerMessage = message.toLowerCase();
    for (const keyword of suspiciousKeywords) {
      if (lowerMessage.includes(keyword)) {
        console.warn(`🚨 Message suspect détecté avec mot-clé: ${keyword}`);
        return false;
      }
    }
    
    // Vérifier si le message contient au moins un mot-clé autorisé
    let hasWhitelistedContent = false;
    for (const whitelisted of this.messageWhitelist) {
      if (message.includes(whitelisted)) {
        hasWhitelistedContent = true;
        break;
      }
    }
    
    if (!hasWhitelistedContent) {
      console.warn('🚨 Message non autorisé détecté');
      return false;
    }
    
    return true;
  }

  async sendMessage(message: string): Promise<boolean> {
    // Validation de sécurité
    if (!this.validateMessage(message)) {
      console.error('❌ Message rejeté par le système de sécurité');
      return false;
    }

    if (!this.enabled || !this.botToken || !this.chatId) {
      console.log('📱 [TELEGRAM] ' + message);
      return false;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML'
      }, {
        timeout: 10000 // Timeout de 10 secondes
      });

      if (response.data.ok) {
        console.log('✅ Message Telegram envoyé');
        return true;
      } else {
        console.error('❌ Erreur Telegram:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur envoi Telegram:', error);
      // En cas d'erreur, afficher le message dans la console
      console.log('📱 [TELEGRAM] ' + message);
      return false;
    }
  }

  async sendNewListing(symbol: string, metadata?: any): Promise<boolean> {
    const exchange = metadata?.exchange || metadata?.source || 'Exchange inconnu';
    const price = metadata?.price || 'N/A';
    const volume = metadata?.volume || 'N/A';
    const url = metadata?.url || '';
    
    const message = `
Nouveau token détecté

Token: ${symbol}
Exchange: ${exchange}
Prix: ${price}
Volume: ${volume}
${url ? `Lien: ${url}` : ''}
    `.trim();

    return this.sendMessage(message);
  }

  async sendTradeExecution(symbol: string, platform: string, success: boolean, details?: any): Promise<boolean> {
    const status = success ? '✅' : '❌';
    const message = `
${status} <b>EXÉCUTION DE TRADE</b>

💰 <b>Symbole :</b> ${symbol}
🏢 <b>Platform :</b> ${platform}
📊 <b>Status :</b> ${success ? 'SUCCÈS' : 'ÉCHEC'}
${details ? `📋 <b>Détails :</b> ${details}` : ''}
⏰ <b>Heure :</b> ${new Date().toLocaleString()}
    `.trim();

    return this.sendMessage(message);
  }

  async sendBotStatus(status: string, details?: string): Promise<boolean> {
    const message = `
🤖 <b>STATUT DU BOT</b>

📊 <b>Status :</b> ${status}
${details ? `📋 <b>Détails :</b> ${details}` : ''}
⏰ <b>Heure :</b> ${new Date().toLocaleString()}
    `.trim();

    return this.sendMessage(message);
  }

  async sendError(error: string, context?: string): Promise<boolean> {
    const message = `
🚨 <b>ERREUR BOT</b>

❌ <b>Erreur :</b> ${error}
${context ? `📍 <b>Contexte :</b> ${context}` : ''}
⏰ <b>Heure :</b> ${new Date().toLocaleString()}
    `.trim();

    return this.sendMessage(message);
  }

  async sendBalanceUpdate(balance: { available: number; total: number }): Promise<boolean> {
    const message = `
💰 <b>MISE À JOUR BALANCE</b>

💵 <b>Disponible :</b> ${balance.available} USDT
💵 <b>Total :</b> ${balance.total} USDT
⏰ <b>Heure :</b> ${new Date().toLocaleString()}
    `.trim();

    return this.sendMessage(message);
  }

  async sendQueuedListing(symbol: string, metadata?: any, source?: string): Promise<boolean> {
    const sourceText = source === 'announcement' ? 'Annonce Bithumb' : 
                      source === 'websocket' ? 'WebSocket Bithumb' : 
                      'API REST';
    
    const maxWaitTime = source === 'announcement' ? '4h' : 
                       source === 'websocket' ? '2h' : 
                       '30min';

    const message = `
📋 <b>TOKEN AJOUTÉ À LA FILE D'ATTENTE</b>

📊 <b>Token:</b> ${symbol}
🏪 <b>Source:</b> ${sourceText}
⏰ <b>Détecté:</b> ${new Date().toLocaleString()}
⏳ <b>Surveillance:</b> ${maxWaitTime} maximum

🔄 <b>Le bot surveille Hyperliquid...</b>
📊 <b>Vérification toutes les 45-60 secondes</b>

🎯 <b>Objectif:</b> Frontrunning dès disponibilité
    `.trim();

    return this.sendMessage(message);
  }
} 