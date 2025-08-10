import { UpbitWatcher, UpbitListing } from './upbitWatcher';
import { BithumbWatcher, BithumbListing } from './bithumbWatcher';

export type KoreanListingEvent = UpbitListing | BithumbListing;

export class ListingSurveillance {
  private upbitWatcher: UpbitWatcher | null = null;
  private bithumbWatcher: BithumbWatcher | null = null;
  private isRunning: boolean = false;
  private onNewListing: (listing: KoreanListingEvent) => void;

  constructor(onNewListing: (listing: KoreanListingEvent) => void) {
    this.onNewListing = onNewListing;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ ListingSurveillance déjà en cours d\'exécution');
      return;
    }

    console.log('🚀 Démarrage de la surveillance des listings coréens...');
    
    try {
      // Démarrer Upbit (polling 2s)
      if (process.env.UPBIT_ENABLED === '1') {
        console.log('🔍 Activation surveillance Upbit...');
        this.upbitWatcher = new UpbitWatcher(this.onNewListing);
        await this.upbitWatcher.start();
      } else {
        console.log('⏸️ Surveillance Upbit désactivée (UPBIT_ENABLED != 1)');
      }

      // Démarrer Bithumb (WebSocket temps réel)
      if (process.env.BITHUMB_ENABLED === '1') {
        console.log('🔍 Activation surveillance Bithumb...');
        this.bithumbWatcher = new BithumbWatcher(this.onNewListing);
        await this.bithumbWatcher.start();
      } else {
        console.log('⏸️ Surveillance Bithumb désactivée (BITHUMB_ENABLED != 1)');
      }

      this.isRunning = true;
      console.log('✅ Surveillance des listings coréens démarrée avec succès');
      
    } catch (error) {
      console.error('❌ Erreur démarrage ListingSurveillance:', error);
      throw error;
    }
  }

  stop(): void {
    this.isRunning = false;
    
    if (this.upbitWatcher) {
      this.upbitWatcher.stop();
      this.upbitWatcher = null;
    }
    
    if (this.bithumbWatcher) {
      this.bithumbWatcher.stop();
      this.bithumbWatcher = null;
    }
    
    console.log('🛑 Surveillance des listings coréens arrêtée');
  }

  getStatus(): {
    isRunning: boolean;
    upbit: { isRunning: boolean; tokenCount: number } | null;
    bithumb: { isRunning: boolean; tokenCount: number; wsState: string } | null;
  } {
    return {
      isRunning: this.isRunning,
      upbit: this.upbitWatcher ? this.upbitWatcher.getStatus() : null,
      bithumb: this.bithumbWatcher ? this.bithumbWatcher.getStatus() : null
    };
  }
}
