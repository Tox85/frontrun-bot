/**
 * PositionSizer - Calcul du sizing des positions
 *
 * Conforme au super prompt Bithumb-only :
 * - target_notional = balance * RISK_PCT * LEVERAGE_TARGET
 * - Gestion des limites de levier par exchange
 * - Validation des tailles minimales/maximales
 */
export interface PositionSizingConfig {
    riskPercentage: number;
    leverageTarget: number;
    maxRiskPerTrade: number;
    minPositionSize: number;
    maxPositionSize: number;
    balanceBuffer: number;
}
export interface PositionSize {
    notional: number;
    leverage: number;
    positionSize: number;
    marginRequired: number;
    riskAmount: number;
    isValid: boolean;
    errors: string[];
}
export interface ExchangeLimits {
    maxLeverage: number;
    minSize: number;
    maxSize: number;
    minNotional: number;
    maxNotional: number;
}
export declare class PositionSizer {
    private static instance;
    private config;
    private exchangeLimits;
    private constructor();
    static getInstance(config?: Partial<PositionSizingConfig>): PositionSizer;
    /**
     * Configure les limites par défaut des exchanges
     */
    private setupDefaultLimits;
    /**
     * Met à jour les limites d'un exchange
     */
    updateExchangeLimits(exchange: string, limits: Partial<ExchangeLimits>): void;
    /**
     * Calcule la taille de position optimale
     */
    calculatePositionSize(balance: number, exchange: string, symbol: string, currentPrice: number, customRiskPercentage?: number): PositionSize;
    /**
     * Valide les paramètres d'entrée
     */
    private validateInputs;
    /**
     * Valide la position calculée
     */
    private validatePosition;
    /**
     * Crée une position d'erreur
     */
    private createErrorPosition;
    /**
     * Calcule la taille de position pour un montant spécifique
     */
    calculatePositionSizeForAmount(targetAmount: number, exchange: string, currentPrice: number): PositionSize;
    /**
     * Ajuste la taille de position pour respecter les limites
     */
    adjustPositionSize(originalSize: PositionSize, exchange: string): PositionSize;
    /**
     * Obtient les recommandations de sizing
     */
    getSizingRecommendations(balance: number, exchange: string): {
        conservative: PositionSize;
        moderate: PositionSize;
        aggressive: PositionSize;
    };
    /**
     * Obtient la configuration actuelle
     */
    getConfig(): PositionSizingConfig;
    /**
     * Met à jour la configuration
     */
    updateConfig(updates: Partial<PositionSizingConfig>): void;
    /**
     * Obtient les limites d'un exchange
     */
    getExchangeLimits(exchange: string): ExchangeLimits | null;
    /**
     * Statistiques des limites configurées
     */
    getLimitsStats(): {
        totalExchanges: number;
        exchanges: string[];
        averageMaxLeverage: number;
        averageMinNotional: number;
    };
}
export declare const positionSizer: PositionSizer;
