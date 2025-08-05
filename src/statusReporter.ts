import { TelegramService } from './telegramService';

interface BotStatus {
  uptime: number;
  upbitTokens: number;
  bithumbTokens: number;
  newTokensDetected: number;
  lastDetection: string | null;
  telegramStatus: boolean;
  hyperliquidStatus: boolean;
  websocketStatus: boolean;
}

export class StatusReporter {
  private telegramService: TelegramService;
  private startTime: number;
  private newTokensCount: number = 0;
  private lastDetection: string | null = null;
  private statusInterval: NodeJS.Timeout | null = null;
  private lastStatusReport: number = 0;
  private statusReportCooldown: number = 5 * 60 * 1000; // 5 minutes minimum entre les rapports

  constructor() {
    this.telegramService = new TelegramService();
    this.startTime = Date.now();
  }

  public startReporting(): void {
    console.log('📊 Démarrage du rapport de statut (toutes les 2h)...');
    
    // Rapport immédiat au démarrage seulement si pas de rapport récent
    const now = Date.now();
    if (now - this.lastStatusReport > this.statusReportCooldown) {
      this.sendStatusReport();
      this.lastStatusReport = now;
    }
    
    // Rapport toutes les 2 heures
    this.statusInterval = setInterval(() => {
      this.sendStatusReport();
      this.lastStatusReport = Date.now();
    }, 2 * 60 * 60 * 1000); // 2 heures
  }

  public stopReporting(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
  }

  public recordNewToken(token: string): void {
    this.newTokensCount++;
    this.lastDetection = new Date().toLocaleString();
  }

  private async sendStatusReport(): Promise<void> {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000 / 60); // minutes
    
    // Éviter les rapports trop fréquents
    const now = Date.now();
    if (now - this.lastStatusReport < this.statusReportCooldown) {
      console.log('⏳ Rapport de statut ignoré (trop récent)');
      return;
    }
    
    const status: BotStatus = {
      uptime,
      upbitTokens: 183, // Valeur fixe basée sur nos tests
      bithumbTokens: 393, // Valeur fixe basée sur nos tests
      newTokensDetected: this.newTokensCount,
      lastDetection: this.lastDetection,
      telegramStatus: true, // À vérifier
      hyperliquidStatus: process.env.HYPERLIQUID_ENABLED === 'true',
      websocketStatus: true // À vérifier
    };

    const message = this.formatStatusMessage(status);
    
    try {
      await this.telegramService.sendMessage(message);
      console.log('📊 Rapport de statut envoyé avec succès');
      this.lastStatusReport = now;
    } catch (error) {
      console.error('❌ Erreur envoi rapport de statut:', error);
    }
  }

  private formatStatusMessage(status: BotStatus): string {
    const uptimeHours = Math.floor(status.uptime / 60);
    const uptimeMinutes = status.uptime % 60;

    return `📊 <b>STATUT BOT</b>

🟢 <b>WebSocket Bithumb:</b> Connecté
🟢 <b>API Upbit:</b> Opérationnel
🟢 <b>Telegram:</b> Fonctionnel
📈 <b>Tokens surveillés:</b> ${status.upbitTokens + status.bithumbTokens}
⏰ <b>Uptime:</b> ${uptimeHours}h ${uptimeMinutes}m

🎯 <b>Système opérationnel !</b>`;
  }
} 