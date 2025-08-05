// src/retryManager.ts
import { TelegramService } from './telegramService';

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class RetryManager {
  private telegramService: TelegramService;
  private config: RetryConfig;

  constructor(telegramService: TelegramService, config?: Partial<RetryConfig>) {
    this.telegramService = telegramService;
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      ...config
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        console.log(`🔄 ${operationName} - Tentative ${attempt}/${this.config.maxAttempts}`);
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.error(`❌ ${operationName} - Tentative ${attempt} échouée:`, lastError.message);
        
        if (attempt === this.config.maxAttempts) {
          await this.telegramService.sendError(
            `Échec ${operationName}`,
            `${lastError.message} (${attempt} tentatives)`
          );
          throw lastError;
        }
        
        // Calculer le délai avec backoff exponentiel
        const delay = Math.min(
          this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
          this.config.maxDelay
        );
        
        console.log(`⏳ Attente ${delay}ms avant nouvelle tentative...`);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await this.executeWithRetry(primaryOperation, `${operationName} (Principal)`);
    } catch (error) {
      console.log(`🔄 Basculement vers fallback pour ${operationName}`);
      await this.telegramService.sendBotStatus(
        "Fallback activé",
        `${operationName} - Utilisation du système de secours`
      );
      
      return await this.executeWithRetry(fallbackOperation, `${operationName} (Fallback)`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Gestionnaire spécialisé pour les trades
export class TradeRetryManager extends RetryManager {
  constructor(telegramService: TelegramService) {
    super(telegramService, {
      maxAttempts: 2, // Moins de tentatives pour les trades
      baseDelay: 500, // Délai plus court
      maxDelay: 5000
    });
  }

  async executeTradeWithRetry<T>(
    tradeOperation: () => Promise<T>,
    symbol: string,
    exchange: string
  ): Promise<T> {
    return this.executeWithRetry(
      tradeOperation,
      `Trade ${symbol} sur ${exchange}`,
      `Trading ${symbol}`
    );
  }
} 