// src/riskManager.ts
import { TelegramService } from './telegramService';

interface RiskConfig {
  maxDailyTrades: number;
  maxDailyLoss: number;
  maxPositionSize: number;
  stopLossPercent: number;
  maxConcurrentPositions: number;
}

export class RiskManager {
  private telegramService: TelegramService;
  private config: RiskConfig;
  private dailyTrades: number = 0;
  private dailyLoss: number = 0;
  private activePositions: Set<string> = new Set();
  private lastResetDate: string;

  constructor(telegramService: TelegramService, config?: Partial<RiskConfig>) {
    this.telegramService = telegramService;
    this.config = {
      maxDailyTrades: 10,
      maxDailyLoss: 100, // USDC
      maxPositionSize: 400, // USDC
      stopLossPercent: 5,
      maxConcurrentPositions: 3,
      ...config
    };
    this.lastResetDate = this.getCurrentDate();
  }

  async canTrade(symbol: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
    // Vérifier la date et reset si nécessaire
    this.checkAndResetDaily();
    
    // Vérification 1: Nombre de trades quotidien
    if (this.dailyTrades >= this.config.maxDailyTrades) {
      return { allowed: false, reason: `Limite quotidienne atteinte (${this.config.maxDailyTrades} trades)` };
    }
    
    // Vérification 2: Perte quotidienne
    if (this.dailyLoss >= this.config.maxDailyLoss) {
      return { allowed: false, reason: `Perte quotidienne maximale atteinte (${this.config.maxDailyLoss} USDC)` };
    }
    
    // Vérification 3: Taille de position
    if (amount > this.config.maxPositionSize) {
      return { allowed: false, reason: `Position trop importante (max: ${this.config.maxPositionSize} USDC)` };
    }
    
    // Vérification 4: Positions concurrentes
    if (this.activePositions.size >= this.config.maxConcurrentPositions) {
      return { allowed: false, reason: `Trop de positions ouvertes (max: ${this.config.maxConcurrentPositions})` };
    }
    
    // Vérification 5: Position déjà ouverte
    if (this.activePositions.has(symbol)) {
      return { allowed: false, reason: `Position déjà ouverte sur ${symbol}` };
    }
    
    return { allowed: true };
  }

  async recordTrade(symbol: string, amount: number, profit?: number) {
    this.dailyTrades++;
    
    if (profit !== undefined) {
      this.dailyLoss += Math.max(0, -profit); // Seulement les pertes
    }
    
    this.activePositions.add(symbol);
    
    // Notification
    console.log(`📊 Trade enregistré: ${symbol}: ${amount} USDC (${this.dailyTrades}/${this.config.maxDailyTrades} trades)`);
    
    console.log(`📊 Trade enregistré: ${symbol} - Daily: ${this.dailyTrades}/${this.config.maxDailyTrades}`);
  }

  async closePosition(symbol: string, profit?: number) {
    this.activePositions.delete(symbol);
    
    if (profit !== undefined) {
      this.dailyLoss += Math.max(0, -profit);
    }
    
    console.log(`📊 Position fermée: ${symbol} - Positions actives: ${this.activePositions.size}`);
  }

  async getRiskReport(): Promise<string> {
    const report = `
🛡️ **Rapport de Risque**

📊 **Aujourd'hui:**
• Trades: ${this.dailyTrades}/${this.config.maxDailyTrades}
• Perte: ${this.dailyLoss.toFixed(2)}/${this.config.maxDailyLoss} USDC
• Positions actives: ${this.activePositions.size}/${this.config.maxConcurrentPositions}

⚙️ **Limites:**
• Taille max position: ${this.config.maxPositionSize} USDC
• Stop-loss: ${this.config.stopLossPercent}%
• Positions concurrentes: ${this.config.maxConcurrentPositions}

${this.getRiskLevel()}
    `;
    
    return report;
  }

  private getRiskLevel(): string {
    const tradeRatio = this.dailyTrades / this.config.maxDailyTrades;
    const lossRatio = this.dailyLoss / this.config.maxDailyLoss;
    
    if (tradeRatio > 0.8 || lossRatio > 0.8) {
      return "🔴 **NIVEAU DE RISQUE ÉLEVÉ**";
    } else if (tradeRatio > 0.5 || lossRatio > 0.5) {
      return "🟡 **NIVEAU DE RISQUE MODÉRÉ**";
    } else {
      return "🟢 **NIVEAU DE RISQUE FAIBLE**";
    }
  }

  private checkAndResetDaily() {
    const currentDate = this.getCurrentDate();
    if (currentDate !== this.lastResetDate) {
      this.dailyTrades = 0;
      this.dailyLoss = 0;
      this.activePositions.clear();
      this.lastResetDate = currentDate;
      console.log('🔄 Reset quotidien des métriques de risque');
    }
  }

  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  async sendDailyRiskReport() {
    const report = await this.getRiskReport();
    console.log("📊 Rapport Risque Quotidien:", report);
  }
} 