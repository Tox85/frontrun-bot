/**
 * HyperliquidAdapter - Interface pour Hyperliquid testnet
 *
 * Conforme au super prompt Bithumb-only :
 * - Trading sur HL testnet uniquement
 * - Long immédiat + exit +180s
 * - Risk sizing: balance * RISK_PCT * LEVERAGE_TARGET
 */
export interface HLConfig {
    testnet: boolean;
    privateKey: string;
    walletAddress?: string;
    baseUrl: string;
    timeoutMs: number;
}
export interface HLPosition {
    symbol: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entryPrice: number;
    unrealizedPnl: number;
    leverage: number;
}
export interface HLOrder {
    id: string;
    positionId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
    timestamp: number;
}
export interface HLBalance {
    usd: number;
    available: number;
    locked: number;
}
export declare class HyperliquidAdapter {
    private config;
    private isConnected;
    private lastHeartbeat;
    constructor(config: HLConfig);
    /**
     * Initialise la connexion à Hyperliquid
     */
    initialize(): Promise<void>;
    /**
     * Vérifie la connectivité à l'API
     */
    private checkConnectivity;
    /**
     * Authentifie l'utilisateur
     */
    private authenticate;
    /**
     * Obtient le solde du compte
     */
    getBalance(): Promise<HLBalance>;
    /**
     * Obtient les positions ouvertes
     */
    getPositions(): Promise<HLPosition[]>;
    /**
     * Ouvre une position long
     */
    openLongPosition(symbol: string, notional: number, leverage?: number): Promise<HLOrder>;
    /**
     * Ferme une position (reduce-only)
     */
    closePosition(symbol: string, size: number): Promise<HLOrder>;
    /**
     * Obtient le statut d'un ordre
     */
    getOrderStatus(orderId: string): Promise<HLOrder['status']>;
    /**
     * Annule un ordre
     */
    cancelOrder(orderId: string): Promise<boolean>;
    /**
     * Obtient le prix actuel d'un symbole
     */
    getCurrentPrice(symbol: string): Promise<number>;
    /**
     * Vérifie si un symbole est disponible pour le trading
     */
    isSymbolTradable(symbol: string): Promise<boolean>;
    /**
     * Obtient les informations de levier pour un symbole
     */
    getLeverageInfo(symbol: string): Promise<{
        maxLeverage: number;
        minSize: number;
        maxSize: number;
    }>;
    /**
     * Récupère les métadonnées de l'univers (perps disponibles)
     */
    getMeta(): Promise<any>;
    /**
     * Récupère l'état utilisateur (balance, positions)
     */
    getUserState(): Promise<any>;
    /**
     * Vérifie la santé de la connexion
     */
    healthCheck(): Promise<{
        isConnected: boolean;
        lastHeartbeat: number;
        latency: number;
    }>;
    /**
     * Arrête l'adaptateur
     */
    stop(): Promise<void>;
    /**
     * Getters pour le monitoring
     */
    getStatus(): {
        isConnected: boolean;
        lastHeartbeat: number;
        config: Omit<HLConfig, 'privateKey'>;
    };
}
