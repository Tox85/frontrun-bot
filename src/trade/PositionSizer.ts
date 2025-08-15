/**
 * PositionSizer - Calcul du sizing des positions
 * 
 * Conforme au super prompt Bithumb-only :
 * - target_notional = balance * RISK_PCT * LEVERAGE_TARGET
 * - Gestion des limites de levier par exchange
 * - Validation des tailles minimales/maximales
 */

export interface PositionSizingConfig {
  riskPercentage: number;      // Pourcentage de risque (0.01 = 1%)
  leverageTarget: number;      // Levier cible
  maxRiskPerTrade: number;     // Risque max par trade (0.05 = 5%)
  minPositionSize: number;     // Taille minimale en USD
  maxPositionSize: number;     // Taille maximale en USD
  balanceBuffer: number;       // Buffer de sécurité (0.1 = 10%)
}

export interface PositionSize {
  notional: number;            // Taille nominale en USD
  leverage: number;            // Levier effectif
  positionSize: number;        // Taille de la position en unités
  marginRequired: number;      // Marge requise
  riskAmount: number;          // Montant en risque
  isValid: boolean;            // Si la position est valide
  errors: string[];            // Erreurs de validation
}

export interface ExchangeLimits {
  maxLeverage: number;
  minSize: number;
  maxSize: number;
  minNotional: number;
  maxNotional: number;
}

export class PositionSizer {
  private static instance: PositionSizer;
  private config: PositionSizingConfig;
  private exchangeLimits: Map<string, ExchangeLimits>;

  private constructor(config?: Partial<PositionSizingConfig>) {
    this.config = {
      riskPercentage: 0.02,    // 2% par défaut
      leverageTarget: 10,       // 10x par défaut
      maxRiskPerTrade: 0.05,   // 5% max par trade
      minPositionSize: 10,      // $10 minimum
      maxPositionSize: 100000,  // $100k maximum
      balanceBuffer: 0.1,       // 10% de buffer
      ...config
    };

    this.exchangeLimits = new Map();
    this.setupDefaultLimits();
  }

  static getInstance(config?: Partial<PositionSizingConfig>): PositionSizer {
    if (!PositionSizer.instance) {
      PositionSizer.instance = new PositionSizer(config);
    }
    return PositionSizer.instance;
  }

  /**
   * Configure les limites par défaut des exchanges
   */
  private setupDefaultLimits(): void {
    // Hyperliquid testnet
    this.exchangeLimits.set('HYPERLIQUID', {
      maxLeverage: 100,
      minSize: 1,
      maxSize: 1000000,
      minNotional: 1,
      maxNotional: 10000000
    });

    // Bybit
    this.exchangeLimits.set('BYBIT', {
      maxLeverage: 125,
      minSize: 1,
      maxSize: 1000000,
      minNotional: 5,
      maxNotional: 5000000
    });

    // Binance
    this.exchangeLimits.set('BINANCE', {
      maxLeverage: 125,
      minSize: 1,
      maxSize: 1000000,
      minNotional: 5,
      maxNotional: 5000000
    });
  }

  /**
   * Met à jour les limites d'un exchange
   */
  updateExchangeLimits(exchange: string, limits: Partial<ExchangeLimits>): void {
    const current = this.exchangeLimits.get(exchange.toUpperCase()) || {
      maxLeverage: 100,
      minSize: 1,
      maxSize: 1000000,
      minNotional: 1,
      maxNotional: 10000000
    };

    this.exchangeLimits.set(exchange.toUpperCase(), { ...current, ...limits });
    console.log(`🔧 Limites mises à jour pour ${exchange}`);
  }

  /**
   * Calcule la taille de position optimale
   */
  calculatePositionSize(
    balance: number,
    exchange: string,
    symbol: string,
    currentPrice: number,
    customRiskPercentage?: number
  ): PositionSize {
    const upperExchange = exchange.toUpperCase();
    const limits = this.exchangeLimits.get(upperExchange);
    
    if (!limits) {
      return this.createErrorPosition(`Limites non trouvées pour ${exchange}`);
    }

    // Utiliser le pourcentage de risque personnalisé ou par défaut
    const riskPct = customRiskPercentage || this.config.riskPercentage;
    
    // Validation des paramètres
    const validationErrors = this.validateInputs(balance, riskPct, limits);
    if (validationErrors.length > 0) {
      return this.createErrorPosition(...validationErrors);
    }

    try {
      // Calcul de la taille nominale selon le super prompt
      const targetNotional = balance * riskPct * this.config.leverageTarget;
      
      // Appliquer les limites de l'exchange
      const clampedNotional = Math.max(
        limits.minNotional,
        Math.min(limits.maxNotional, targetNotional)
      );

      // Calculer le levier effectif
      const effectiveLeverage = Math.min(
        this.config.leverageTarget,
        limits.maxLeverage
      );

      // Calculer la taille de la position
      const positionSize = clampedNotional / effectiveLeverage;
      
      // Calculer la marge requise
      const marginRequired = clampedNotional / effectiveLeverage;
      
      // Calculer le montant en risque
      const riskAmount = balance * riskPct;

      // Validation finale
      const finalValidation = this.validatePosition(
        clampedNotional,
        positionSize,
        effectiveLeverage,
        limits
      );

      return {
        notional: clampedNotional,
        leverage: effectiveLeverage,
        positionSize,
        marginRequired,
        riskAmount,
        isValid: finalValidation.isValid,
        errors: finalValidation.errors
      };

    } catch (error) {
      return this.createErrorPosition(`Erreur de calcul: ${error}`);
    }
  }

  /**
   * Valide les paramètres d'entrée
   */
  private validateInputs(
    balance: number, 
    riskPct: number, 
    limits: ExchangeLimits
  ): string[] {
    const errors: string[] = [];

    if (balance <= 0) {
      errors.push('Le solde doit être positif');
    }

    if (riskPct <= 0 || riskPct > this.config.maxRiskPerTrade) {
      errors.push(`Le pourcentage de risque doit être entre 0 et ${this.config.maxRiskPerTrade * 100}%`);
    }

    if (balance * this.config.balanceBuffer < limits.minNotional) {
      errors.push(`Solde insuffisant pour respecter la taille minimale (${limits.minNotional})`);
    }

    return errors;
  }

  /**
   * Valide la position calculée
   */
  private validatePosition(
    notional: number,
    positionSize: number,
    leverage: number,
    limits: ExchangeLimits
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (notional < limits.minNotional) {
      errors.push(`Taille nominale trop petite (${notional} < ${limits.minNotional})`);
    }

    if (notional > limits.maxNotional) {
      errors.push(`Taille nominale trop grande (${notional} > ${limits.maxNotional})`);
    }

    if (positionSize < limits.minSize) {
      errors.push(`Taille de position trop petite (${positionSize} < ${limits.minSize})`);
    }

    if (positionSize > limits.maxSize) {
      errors.push(`Taille de position trop grande (${positionSize} > ${limits.maxSize})`);
    }

    if (leverage > limits.maxLeverage) {
      errors.push(`Levier trop élevé (${leverage} > ${limits.maxLeverage})`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Crée une position d'erreur
   */
  private createErrorPosition(...errors: string[]): PositionSize {
    return {
      notional: 0,
      leverage: 0,
      positionSize: 0,
      marginRequired: 0,
      riskAmount: 0,
      isValid: false,
      errors
    };
  }

  /**
   * Calcule la taille de position pour un montant spécifique
   */
  calculatePositionSizeForAmount(
    targetAmount: number,
    exchange: string,
    currentPrice: number
  ): PositionSize {
    const upperExchange = exchange.toUpperCase();
    const limits = this.exchangeLimits.get(upperExchange);
    
    if (!limits) {
      return this.createErrorPosition(`Limites non trouvées pour ${exchange}`);
    }

    try {
      // Valider le montant cible
      if (targetAmount < limits.minNotional || targetAmount > limits.maxNotional) {
        return this.createErrorPosition(
          `Montant cible hors limites (${limits.minNotional} - ${limits.maxNotional})`
        );
      }

      // Calculer le levier optimal
      const optimalLeverage = Math.min(
        this.config.leverageTarget,
        limits.maxLeverage
      );

      // Calculer la taille de position
      const positionSize = targetAmount / optimalLeverage;
      
      // Validation
      const validation = this.validatePosition(
        targetAmount,
        positionSize,
        optimalLeverage,
        limits
      );

      return {
        notional: targetAmount,
        leverage: optimalLeverage,
        positionSize,
        marginRequired: targetAmount / optimalLeverage,
        riskAmount: targetAmount / optimalLeverage,
        isValid: validation.isValid,
        errors: validation.errors
      };

    } catch (error) {
      return this.createErrorPosition(`Erreur de calcul: ${error}`);
    }
  }

  /**
   * Ajuste la taille de position pour respecter les limites
   */
  adjustPositionSize(
    originalSize: PositionSize,
    exchange: string
  ): PositionSize {
    const upperExchange = exchange.toUpperCase();
    const limits = this.exchangeLimits.get(upperExchange);
    
    if (!limits) {
      return this.createErrorPosition(`Limites non trouvées pour ${exchange}`);
    }

    try {
      let adjustedNotional = originalSize.notional;
      let adjustedLeverage = originalSize.leverage;

      // Ajuster le levier si nécessaire
      if (adjustedLeverage > limits.maxLeverage) {
        adjustedLeverage = limits.maxLeverage;
        adjustedNotional = originalSize.marginRequired * adjustedLeverage;
      }

      // Ajuster la taille nominale
      if (adjustedNotional < limits.minNotional) {
        adjustedNotional = limits.minNotional;
      } else if (adjustedNotional > limits.maxNotional) {
        adjustedNotional = limits.maxNotional;
      }

      // Recalculer la position
      const positionSize = adjustedNotional / adjustedLeverage;
      const marginRequired = adjustedNotional / adjustedLeverage;

      // Validation finale
      const validation = this.validatePosition(
        adjustedNotional,
        positionSize,
        adjustedLeverage,
        limits
      );

      return {
        notional: adjustedNotional,
        leverage: adjustedLeverage,
        positionSize,
        marginRequired,
        riskAmount: originalSize.riskAmount,
        isValid: validation.isValid,
        errors: validation.errors
      };

    } catch (error) {
      return this.createErrorPosition(`Erreur d'ajustement: ${error}`);
    }
  }

  /**
   * Obtient les recommandations de sizing
   */
  getSizingRecommendations(
    balance: number,
    exchange: string
  ): {
    conservative: PositionSize;
    moderate: PositionSize;
    aggressive: PositionSize;
  } {
    const conservative = this.calculatePositionSize(
      balance, 
      exchange, 
      'BTCUSD', 
      50000, 
      0.01  // 1%
    );

    const moderate = this.calculatePositionSize(
      balance, 
      exchange, 
      'BTCUSD', 
      50000, 
      0.02  // 2%
    );

    const aggressive = this.calculatePositionSize(
      balance, 
      exchange, 
      'BTCUSD', 
      50000, 
      0.05  // 5%
    );

    return { conservative, moderate, aggressive };
  }

  /**
   * Obtient la configuration actuelle
   */
  getConfig(): PositionSizingConfig {
    return { ...this.config };
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(updates: Partial<PositionSizingConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('🔧 Configuration du PositionSizer mise à jour');
  }

  /**
   * Obtient les limites d'un exchange
   */
  getExchangeLimits(exchange: string): ExchangeLimits | null {
    return this.exchangeLimits.get(exchange.toUpperCase()) || null;
  }

  /**
   * Statistiques des limites configurées
   */
  getLimitsStats(): {
    totalExchanges: number;
    exchanges: string[];
    averageMaxLeverage: number;
    averageMinNotional: number;
  } {
    const exchanges = Array.from(this.exchangeLimits.keys());
    let totalLeverage = 0;
    let totalMinNotional = 0;

    for (const limits of this.exchangeLimits.values()) {
      totalLeverage += limits.maxLeverage;
      totalMinNotional += limits.minNotional;
    }

    return {
      totalExchanges: exchanges.length,
      exchanges,
      averageMaxLeverage: exchanges.length > 0 ? totalLeverage / exchanges.length : 0,
      averageMinNotional: exchanges.length > 0 ? totalMinNotional / exchanges.length : 0
    };
  }
}

// Export de l'instance singleton
export const positionSizer = PositionSizer.getInstance();
