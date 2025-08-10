import { FoundPerp } from './perpFinder';

export interface SizingResult {
  success: boolean;
  qty?: number;
  notional?: number;
  riskUSDC?: number;
  leverage?: number;
  stopLossPrice?: number;
  error?: string;
}

export class PositionSizer {
  private riskPerTradeDefault: number;
  private riskPctOfBalance: number;
  private maxLeverageDefault: number;

  constructor() {
    this.riskPerTradeDefault = parseFloat(process.env.RISK_PER_TRADE_USDC_DEFAULT || '0.5');
    this.riskPctOfBalance = parseFloat(process.env.RISK_PCT_OF_BAL || '0.04');
    this.maxLeverageDefault = parseInt(process.env.MAX_LEVERAGE_DEFAULT || '25');
  }

  /**
   * Calcule le montant de risque en USDC selon la balance
   */
  computeRiskUSDC(balance: number): number {
    const riskFromBalance = balance * this.riskPctOfBalance;
    const finalRisk = Math.min(this.riskPerTradeDefault, riskFromBalance);
    
    console.log(`💰 Calcul risque: balance=${balance}, riskPct=${this.riskPctOfBalance}, riskFromBalance=${riskFromBalance}, finalRisk=${finalRisk}`);
    
    return finalRisk;
  }

  /**
   * Calcule le notional nécessaire pour un risque donné avec SL 5%
   */
  computeNotional(riskUSDC: number): number {
    const stopLossPercent = 0.05; // 5%
    const notional = riskUSDC / stopLossPercent;
    
    console.log(`📊 Calcul notional: riskUSDC=${riskUSDC}, SL%=${stopLossPercent}, notional=${notional}`);
    
    return notional;
  }

  /**
   * Calcule la quantité en arrondissant selon le lot size
   */
  computeQty(notional: number, price: number, lotSize: number = 0.001): number {
    const rawQty = notional / price;
    const roundedQty = Math.floor(rawQty / lotSize) * lotSize;
    
    console.log(`📈 Calcul quantité: notional=${notional}, price=${price}, lotSize=${lotSize}, rawQty=${rawQty}, roundedQty=${roundedQty}`);
    
    return roundedQty;
  }

  /**
   * Vérifie et ajuste selon les limites de l'exchange
   */
  enforceExchangeLimits(
    qty: number, 
    price: number, 
    limits: {
      minOrderSize?: number;
      minNotional?: number;
      maxLeverage?: number;
    }
  ): { ok: boolean; reason?: string; adjQty?: number } {
    const notional = qty * price;
    
    // Vérifier taille minimale
    if (limits.minOrderSize && qty < limits.minOrderSize) {
      return {
        ok: false,
        reason: `Quantité ${qty} < minOrderSize ${limits.minOrderSize}`
      };
    }
    
    // Vérifier notional minimal
    if (limits.minNotional && notional < limits.minNotional) {
      return {
        ok: false,
        reason: `Notional ${notional} < minNotional ${limits.minNotional}`
      };
    }
    
    // Vérifier levier maximal
    if (limits.maxLeverage && this.maxLeverageDefault > limits.maxLeverage) {
      console.log(`⚠️ Levier ajusté: ${this.maxLeverageDefault} → ${limits.maxLeverage}`);
      this.maxLeverageDefault = limits.maxLeverage;
    }
    
    return { ok: true, adjQty: qty };
  }

  /**
   * Calcule le sizing complet pour une position
   */
  async calculatePositionSizing(
    balance: number,
    foundPerp: FoundPerp
  ): Promise<SizingResult> {
    try {
      console.log(`🔧 Calcul sizing pour ${foundPerp.symbol} sur ${foundPerp.venue}`);
      console.log(`💰 Balance: ${balance} USDC`);
      console.log(`📊 Prix: ${foundPerp.meta.price}`);
      console.log(`⚙️ Limites:`, foundPerp.meta);

      // 1. Calculer le risque
      const riskUSDC = this.computeRiskUSDC(balance);
      
      // 2. Calculer le notional
      const notional = this.computeNotional(riskUSDC);
      
      // 3. Calculer la quantité
      const price = foundPerp.meta.price || 1;
      const lotSize = foundPerp.meta.lotSize || 0.001;
      const qty = this.computeQty(notional, price, lotSize);
      
      // 4. Vérifier les limites
      const limitCheck = this.enforceExchangeLimits(qty, price, foundPerp.meta);
      
      if (!limitCheck.ok) {
        return {
          success: false,
          error: limitCheck.reason
        };
      }
      
      // 5. Calculer le prix de stop loss
      const stopLossPrice = price * 0.95; // 5% sous l'entrée
      
      // 6. Déterminer le levier
      const leverage = Math.min(this.maxLeverageDefault, foundPerp.meta.maxLeverage || 25);
      
      console.log(`✅ Sizing calculé:`);
      console.log(`  - Quantité: ${qty}`);
      console.log(`  - Notional: ${notional} USDC`);
      console.log(`  - Risque: ${riskUSDC} USDC`);
      console.log(`  - Levier: ${leverage}x`);
      console.log(`  - Stop Loss: ${stopLossPrice}`);
      
      return {
        success: true,
        qty,
        notional,
        riskUSDC,
        leverage,
        stopLossPrice
      };
      
    } catch (error) {
      console.error(`❌ Erreur calcul sizing: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Valide si un trade est possible avec la balance actuelle
   */
  canTradeWithBalance(balance: number): boolean {
    const riskUSDC = this.computeRiskUSDC(balance);
    return riskUSDC >= 0.1; // Minimum 0.1 USDC de risque
  }
}
