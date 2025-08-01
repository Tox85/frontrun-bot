import axios from 'axios';
import { TELEGRAM_CONFIG } from './config';

export class TelegramService {
  private botToken: string;
  private chatId: string;
  private enabled: boolean;
  private baseUrl: string;

  constructor() {
    this.botToken = TELEGRAM_CONFIG.botToken;
    this.chatId = TELEGRAM_CONFIG.chatId;
    this.enabled = TELEGRAM_CONFIG.enabled;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(message: string): Promise<boolean> {
    if (!this.enabled || !this.botToken || !this.chatId) {
      console.log('⚠️ Telegram désactivé ou mal configuré');
      return false;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML'
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
      return false;
    }
  }

  async sendNewListing(symbol: string, metadata?: any): Promise<boolean> {
    const message = `
🆕 <b>NOUVEAU LISTING DÉTECTÉ !</b>

💰 <b>Symbole :</b> ${symbol}
📰 <b>Titre :</b> ${metadata?.title || 'N/A'}
🔗 <b>URL :</b> ${metadata?.url || 'N/A'}
⏰ <b>Heure :</b> ${new Date().toLocaleString()}

🚀 <b>Bot en cours de vérification des exchanges...</b>
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
} 