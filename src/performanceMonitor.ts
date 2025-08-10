// src/performanceMonitor.ts
import { TelegramService } from './telegramService';

interface PerformanceMetrics {
  detectionTime: number;
  tradeExecutionTime: number;
  successRate: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  averageProfit: number;
  uptime: number;
}

interface TradeRecord {
  symbol: string;
  exchange: string;
  timestamp: number;
  detectionTime: number;
  executionTime: number;
  success: boolean;
  profit?: number;
  error?: string;
}

export class PerformanceMonitor {
  private telegramService: TelegramService;
  private startTime: number;
  private trades: TradeRecord[] = [];
  private detectionTimes: number[] = [];
  private executionTimes: number[] = [];

  constructor(telegramService: TelegramService) {
    this.telegramService = telegramService;
    this.startTime = Date.now();
  }

  recordDetection(symbol: string, detectionTime: number) {
    this.detectionTimes.push(detectionTime);
    console.log(`⏱️ Détection ${symbol}: ${detectionTime}ms`);
  }

  recordTrade(
    symbol: string,
    exchange: string,
    detectionTime: number,
    executionTime: number,
    success: boolean,
    profit?: number,
    error?: string
  ) {
    const trade: TradeRecord = {
      symbol,
      exchange,
      timestamp: Date.now(),
      detectionTime,
      executionTime,
      success,
      profit,
      error
    };

    this.trades.push(trade);
    this.executionTimes.push(executionTime);

    console.log(`📊 Trade ${symbol}: ${success ? '✅' : '❌'} - ${executionTime}ms`);
    
    // Envoyer rapport de performance toutes les 10 trades
    if (this.trades.length % 10 === 0) {
      this.sendPerformanceReport();
    }
  }

  getMetrics(): PerformanceMetrics {
    const successfulTrades = this.trades.filter(t => t.success);
    const failedTrades = this.trades.filter(t => !t.success);
    
    const avgDetectionTime = this.detectionTimes.length > 0 
      ? this.detectionTimes.reduce((a, b) => a + b, 0) / this.detectionTimes.length 
      : 0;
    
    const avgExecutionTime = this.executionTimes.length > 0
      ? this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length
      : 0;

    const totalProfit = successfulTrades
      .filter(t => t.profit !== undefined)
      .reduce((sum, t) => sum + (t.profit || 0), 0);

    return {
      detectionTime: avgDetectionTime,
      tradeExecutionTime: avgExecutionTime,
      successRate: this.trades.length > 0 ? (successfulTrades.length / this.trades.length) * 100 : 0,
      totalTrades: this.trades.length,
      successfulTrades: successfulTrades.length,
      failedTrades: failedTrades.length,
      averageProfit: successfulTrades.length > 0 ? totalProfit / successfulTrades.length : 0,
      uptime: Date.now() - this.startTime
    };
  }

  async sendPerformanceReport() {
    const metrics = this.getMetrics();
    
    const report = `
📊 **Rapport de Performance**

⏱️ **Temps de réponse:**
• Détection: ${metrics.detectionTime.toFixed(0)}ms
• Exécution: ${metrics.tradeExecutionTime.toFixed(0)}ms

📈 **Trades:**
• Total: ${metrics.totalTrades}
• Réussis: ${metrics.successfulTrades} (${metrics.successRate.toFixed(1)}%)
• Échoués: ${metrics.failedTrades}

💰 **Profitabilité:**
• Profit moyen: ${metrics.averageProfit.toFixed(2)} USDC

⏰ **Uptime:** ${this.formatUptime(metrics.uptime)}
    `;

          console.log("📊 Rapport Performance:", report);
  }

  async sendDailyReport() {
    const metrics = this.getMetrics();
    
    const report = `
📅 **Rapport Quotidien**

🎯 **Performance:**
• Trades: ${metrics.totalTrades}
• Taux de réussite: ${metrics.successRate.toFixed(1)}%
• Profit total: ${(metrics.averageProfit * metrics.successfulTrades).toFixed(2)} USDC

⚡ **Vitesse:**
• Détection moyenne: ${metrics.detectionTime.toFixed(0)}ms
• Exécution moyenne: ${metrics.tradeExecutionTime.toFixed(0)}ms

🔧 **Fiabilité:**
• Uptime: ${this.formatUptime(metrics.uptime)}
• Erreurs: ${metrics.failedTrades}
    `;

          console.log("📊 Rapport Quotidien:", report);
  }

  private formatUptime(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  getRecentTrades(count: number = 5): TradeRecord[] {
    return this.trades.slice(-count);
  }

  getErrorAnalysis(): { [key: string]: number } {
    const errors: { [key: string]: number } = {};
    
    this.trades
      .filter(t => !t.success && t.error)
      .forEach(trade => {
        const errorType = this.categorizeError(trade.error!);
        errors[errorType] = (errors[errorType] || 0) + 1;
      });
    
    return errors;
  }

  private categorizeError(error: string): string {
    if (error.includes('insufficient')) return 'Fonds insuffisants';
    if (error.includes('market')) return 'Marché indisponible';
    if (error.includes('network')) return 'Erreur réseau';
    if (error.includes('timeout')) return 'Timeout';
    if (error.includes('authentication')) return 'Erreur auth';
    return 'Autre';
  }
} 