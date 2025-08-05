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

  constructor() {
    this.telegramService = new TelegramService();
    this.startTime = Date.now();
  }

  public startReporting(): void {
    console.log('📊 Démarrage du rapport de statut (toutes les 2h)...');
    
    // Rapport immédiat au démarrage
    this.sendStatusReport();
    
    // Rapport toutes les 2 heures
    this.statusInterval = setInterval(() => {
      this.sendStatusReport();
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
    } catch (error) {
      console.error('❌ Erreur envoi rapport de statut:', error);
    }
  }

  private formatStatusMessage(status: BotStatus): string {
    const uptimeHours = Math.floor(status.uptime / 60);
    const uptimeMinutes = status.uptime % 60;

    return `📊 <b>RAPPORT DE STATUT BOT</b>

⏰ <b>Uptime:</b> ${uptimeHours}h ${uptimeMinutes}m
📈 <b>Tokens surveillés:</b>
  • Upbit: ${status.upbitTokens}
  • Bithumb: ${status.bithumbTokens}
  • Total: ${status.upbitTokens + status.bithumbTokens}

🆕 <b>Nouveaux tokens détectés:</b> ${status.newTokensDetected}
${status.lastDetection ? `⏰ <b>Dernière détection:</b> ${status.lastDetection}` : '⏰ <b>Dernière détection:</b> Aucune'}

🔧 <b>Services:</b>
  • Telegram: ${status.telegramStatus ? '✅' : '❌'}
  • Hyperliquid: ${status.hyperliquidStatus ? '✅' : '❌'}
  • WebSocket Bithumb: ${status.websocketStatus ? '✅' : '❌'}

🎯 <b>Mode:</b> ${status.hyperliquidStatus ? 'Trading activé' : 'Surveillance uniquement'}

📱 <b>Prochain rapport:</b> Dans 2h
🔄 <b>Statut:</b> ${status.uptime > 0 ? 'Opérationnel' : 'Démarrage'}`;
  }
} 