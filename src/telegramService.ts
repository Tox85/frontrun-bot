import axios from 'axios';
import { TELEGRAM_CONFIG } from './config';

export class TelegramService {
  private botToken: string;
  private chatId: string;
  private enabled: boolean;
  private baseUrl: string;
  
  // Messages autorisés uniquement
  private readonly ALLOWED_MESSAGE_TYPES = {
    BOT_STATUS: 'BOT_STATUS',
    NEW_LISTING: 'NEW_LISTING'
  };

  constructor() {
    this.botToken = TELEGRAM_CONFIG.botToken;
    this.chatId = TELEGRAM_CONFIG.chatId;
    this.enabled = TELEGRAM_CONFIG.enabled;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    
    // Validation de la configuration
    if (!this.enabled || !this.botToken || !this.chatId) {
      console.log('⚠️ Telegram désactivé ou mal configuré - Mode console uniquement');
    } else {
      console.log('✅ Service Telegram sécurisé configuré');
    }
  }

  /**
   * Validation stricte des messages - seuls les messages autorisés sont acceptés
   */
  private validateMessage(message: string, messageType: string): boolean {
    // Vérifier que le type de message est autorisé
    if (!Object.values(this.ALLOWED_MESSAGE_TYPES).includes(messageType)) {
      console.error('❌ Type de message non autorisé:', messageType);
      return false;
    }

    // Liste de mots-clés interdits (casino, gambling, etc.)
    const forbiddenKeywords = [
      'casino', 'bonus', 'promo', 'jetacas', 'welcome', 'deposit',
      'withdrawal', 'gambling', 'bet', 'slot', 'poker', 'live',
      'launched', 'brand-new', 'online casino', 'generous launch',
      'credited instantly', 'promo code', 'no strings attached',
      'no id required', 'instant bonus', 'top-tier providers',
      '24/7 support', 'minimum deposit', 'licensed platform',
      'fair payouts', 'secure withdrawals', 'e-wallets', 'etacas'
    ];
    
    const lowerMessage = message.toLowerCase();
    for (const keyword of forbiddenKeywords) {
      if (lowerMessage.includes(keyword)) {
        console.error(`🚨 Message rejeté - mot-clé interdit détecté: ${keyword}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Envoi sécurisé de message
   */
  private async sendSecureMessage(message: string, messageType: string): Promise<boolean> {
    // Validation stricte
    if (!this.validateMessage(message, messageType)) {
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
        timeout: 10000
      });

      if (response.data.ok) {
        console.log('✅ Message Telegram sécurisé envoyé');
        return true;
      } else {
        console.error('❌ Erreur Telegram:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur envoi Telegram:', error);
      console.log('📱 [TELEGRAM] ' + message);
      return false;
    }
  }

  /**
   * Message de démarrage du bot
   */
  async sendBotReady(balance?: number): Promise<boolean> {
    const balanceText = balance ? `${balance} USDC` : 'N/A USDC';
    const message = `🤖 <b>Frontrun Bot</b> démarré avec succès!\n\n` +
                   `📊 Mode: ${process.env.DRY_RUN === '1' ? 'DRY RUN' : 'PRODUCTION'}\n` +
                   `💰 Balance HL: ${balanceText}\n` +
                   `⚙️ Risk/Trade: ${process.env.POSITION_SIZE_USDC || '400'} USDC`;
    
    return this.sendSecureMessage(message, this.ALLOWED_MESSAGE_TYPES.BOT_STATUS);
  }

  /**
   * Notification nouveau listing
   */
  async sendNewListing(symbol: string, price?: string, exchange?: string): Promise<boolean> {
    const message = `🆕 <b>Nouveau Listing Détecté!</b>\n\n` +
                   `📈 Symbole: <code>${symbol}</code>\n` +
                   `🏢 Exchange: ${exchange || 'N/A'}\n` +
                   `💰 Prix: ${price || 'N/A'}\n` +
                   `⏰ Heure: ${new Date().toLocaleString()}`;
    
    return this.sendSecureMessage(message, this.ALLOWED_MESSAGE_TYPES.NEW_LISTING);
  }

  /**
   * Notification de début de trade
   */
  async sendTradeStart(
    symbol: string,
    venue: string,
    price: number,
    qty: number,
    notional: number
  ): Promise<boolean> {
    const message = `🚀 <b>Trade Démarré</b>\n\n` +
                   `📈 Symbole: <code>${symbol}</code>\n` +
                   `🏢 Venue: ${venue}\n` +
                   `💰 Prix: $${price.toFixed(4)}\n` +
                   `📊 Quantité: ${qty.toFixed(4)}\n` +
                   `💵 Notional: $${notional.toFixed(2)}\n` +
                   `🛡️ SL: 5% sous l'entrée\n` +
                   `⏰ Fermeture: +3 minutes`;
    
    return this.sendSecureMessage(message, this.ALLOWED_MESSAGE_TYPES.NEW_LISTING);
  }

  /**
   * Notification de succès de trade
   */
  async sendTradeSuccess(
    symbol: string,
    venue: string,
    price: number,
    qty: number,
    notional: number,
    stopLossPrice: number
  ): Promise<boolean> {
    const message = `✅ <b>Trade Exécuté</b>\n\n` +
                   `📈 Symbole: <code>${symbol}</code>\n` +
                   `🏢 Venue: ${venue}\n` +
                   `💰 Prix d'entrée: $${price.toFixed(4)}\n` +
                   `📊 Quantité: ${qty.toFixed(4)}\n` +
                   `💵 Notional: $${notional.toFixed(2)}\n` +
                   `🛡️ Stop Loss: $${stopLossPrice.toFixed(4)}\n` +
                   `⏰ Fermeture automatique dans 3 minutes`;
    
    return this.sendSecureMessage(message, this.ALLOWED_MESSAGE_TYPES.NEW_LISTING);
  }

  /**
   * Notification de fermeture de position
   */
  async sendPositionClosed(
    symbol: string,
    venue: string,
    reason: 'SL_HIT' | 'TIMEOUT_3MIN' | 'MANUAL'
  ): Promise<boolean> {
    const reasonText = {
      'SL_HIT': '🛡️ Stop Loss touché',
      'TIMEOUT_3MIN': '⏰ Fermeture automatique (3min)',
      'MANUAL': '👤 Fermeture manuelle'
    };

    const message = `🔚 <b>Position Fermée</b>\n\n` +
                   `📈 Symbole: <code>${symbol}</code>\n` +
                   `🏢 Venue: ${venue}\n` +
                   `📋 Raison: ${reasonText[reason]}\n` +
                   `⏰ Heure: ${new Date().toLocaleString()}`;
    
    return this.sendSecureMessage(message, this.ALLOWED_MESSAGE_TYPES.NEW_LISTING);
  }

  /**
   * Notification d'erreur de trade
   */
  async sendTradeError(symbol: string, error: string): Promise<boolean> {
    const message = `❌ <b>Erreur Trade</b>\n\n` +
                   `📈 Symbole: <code>${symbol}</code>\n` +
                   `🚨 Erreur: ${error}\n` +
                   `⏰ Heure: ${new Date().toLocaleString()}`;
    
    return this.sendSecureMessage(message, this.ALLOWED_MESSAGE_TYPES.NEW_LISTING);
  }

  /**
   * Notification de balance insuffisante
   */
  async sendInsufficientBalance(symbol: string, balance: number): Promise<boolean> {
    const message = `💰 <b>Balance Insuffisante</b>\n\n` +
                   `📈 Symbole: <code>${symbol}</code>\n` +
                   `💵 Balance: ${balance.toFixed(2)} USDC\n` +
                   `⚠️ Trade annulé - balance trop faible`;
    
    return this.sendSecureMessage(message, this.ALLOWED_MESSAGE_TYPES.NEW_LISTING);
  }

  /**
   * Notification de perp non trouvé
   */
  async sendNoPerpFound(symbol: string): Promise<boolean> {
    const message = `🔍 <b>Perp Non Trouvé</b>\n\n` +
                   `📈 Symbole: <code>${symbol}</code>\n` +
                   `❌ Aucun perp disponible sur HL/Binance/Bybit\n` +
                   `⏰ Heure: ${new Date().toLocaleString()}`;
    
    return this.sendSecureMessage(message, this.ALLOWED_MESSAGE_TYPES.NEW_LISTING);
  }
} 
