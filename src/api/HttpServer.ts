import express from 'express';
import { Server } from 'http';
import { TokenRegistry } from '../store/TokenRegistry';
import { PerpCatalog } from '../store/PerpCatalog';
import { SingletonGuard } from '../core/SingletonGuard';
import { BithumbNoticePoller } from '../watchers/BithumbNoticePoller';
import { BithumbWSWatcher } from '../watchers/BithumbWSWatcher';
import { TelegramService } from '../notify/TelegramService';
import { TradeExecutor } from '../trade/TradeExecutor';

export interface HttpServerConfig {
  port: number;
  host: string;
  enableCors: boolean;
  enableLogging: boolean;
}

export class HttpServer {
  private app: express.Application;
  private server: Server | null = null;
  private config: HttpServerConfig;
  private tokenRegistry: TokenRegistry;
  private perpCatalog: PerpCatalog;
  private singletonGuard: SingletonGuard;
  private noticePoller: BithumbNoticePoller | null;
  private wsWatcher: BithumbWSWatcher | null;
  private telegramService: TelegramService;
  private tradeExecutor: TradeExecutor | null;

  constructor(
    tokenRegistry: TokenRegistry,
    perpCatalog: PerpCatalog,
    singletonGuard: SingletonGuard,
    noticePoller: BithumbNoticePoller | null = null,
    wsWatcher: BithumbWSWatcher | null = null,
    telegramService: TelegramService,
    tradeExecutor: TradeExecutor | null = null,
    config: Partial<HttpServerConfig> = {}
  ) {
    this.tokenRegistry = tokenRegistry;
    this.perpCatalog = perpCatalog;
    this.singletonGuard = singletonGuard;
    this.noticePoller = noticePoller;
    this.wsWatcher = wsWatcher;
    this.telegramService = telegramService;
    this.tradeExecutor = tradeExecutor;
    
    this.config = {
      port: 3030,
      host: '0.0.0.0',
      enableCors: true,
      enableLogging: true,
      ...config
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parsing du JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // CORS
    if (this.config.enableCors) {
      this.app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }

    // Logging
    if (this.config.enableLogging) {
      this.app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
          const duration = Date.now() - start;
          console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
        });
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.getHealthStatus();
        res.json(health);
      } catch (error) {
        console.error('❌ Erreur lors du health check:', error);
        res.status(500).json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Metrics
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json(metrics);
      } catch (error) {
        console.error('❌ Erreur lors de la récupération des métriques:', error);
        res.status(500).json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Trading status
    this.app.get('/trading', (req, res) => {
      try {
        if (!this.tradeExecutor) {
          res.json({
            status: 'success',
            data: {
              enabled: false,
              message: 'TradeExecutor non disponible'
            }
          });
          return;
        }

        const tradingStatus = {
          enabled: true,
          activeTrades: Array.from(this.tradeExecutor.getActiveTrades().entries()),
          cooldowns: this.tradeExecutor.getCooldownStatus(),
          timestamp: new Date().toISOString()
        };
        
        res.json({
          status: 'success',
          data: tradingStatus
        });
      } catch (error) {
        console.error('❌ Erreur lors de la récupération du statut trading:', error);
        res.status(500).json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Baseline KR
    this.app.get('/baseline', async (req, res) => {
      try {
        const baseline = await this.tokenRegistry.getBaselineKRStats();
        res.json({
          status: 'success',
          data: baseline
        });
      } catch (error) {
        console.error('❌ Erreur lors de la récupération de la baseline:', error);
        res.status(500).json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Whoami (instance info)
    this.app.get('/whoami', async (req, res) => {
      try {
        const leaderInfo = this.singletonGuard.getLeaderInfo();
        const currentLeader = await this.singletonGuard.getCurrentLeader();
        
        res.json({
          status: 'success',
          data: {
            instance: leaderInfo.instanceId,
            isLeader: leaderInfo.isLeader,
            currentLeader: currentLeader ? {
              instanceId: currentLeader.instanceId,
              acquiredAt: currentLeader.acquiredAtUtc
            } : null
          }
        });
      } catch (error) {
        console.error('❌ Erreur lors de la récupération des infos instance:', error);
        res.status(500).json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Status des watchers
    this.app.get('/status', (req, res) => {
      try {
        const status = {
          noticePoller: this.noticePoller?.getStatus(),
          wsWatcher: this.wsWatcher?.getStatus(),
          telegram: this.telegramService.getStatus(),
          perpCatalog: this.perpCatalog.getStatus()
        };
        
        res.json({
          status: 'success',
          data: status
        });
      } catch (error) {
        console.error('❌ Erreur lors de la récupération du statut:', error);
        res.status(500).json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Endpoint de test
    this.app.get('/ping', (req, res) => {
      res.json({
        status: 'success',
        message: 'pong',
        timestamp: new Date().toISOString()
      });
    });

    // Gestion des erreurs 404
    this.app.use('*', (req, res) => {
      res.status(404).json({
        status: 'error',
        error: 'Endpoint not found',
        availableEndpoints: [
                  'GET /health',
        'GET /metrics',
        'GET /trading',
        'GET /baseline',
        'GET /whoami',
        'GET /status',
        'GET /ping'
        ]
      });
    });

    // Gestion globale des erreurs
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('❌ Erreur serveur HTTP:', error);
      res.status(500).json({
        status: 'error',
        error: 'Internal server error',
        message: error.message
      });
    });
  }

  private async getHealthStatus(): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Vérifications de base
      const baselineStats = await this.tokenRegistry.getBaselineKRStats();
      const perpStats = await this.perpCatalog.getCatalogStats();
      const leaderHealth = await this.singletonGuard.checkLeadershipHealth();
      
      // Vérifier la santé de la base de données
      const dbHealth = await this.checkDatabaseHealth();
      
      // Calculer les latences p95 (simplifié pour l'instant)
      const latencies = this.calculateLatencies();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        
        // Baseline KR
        bithumb_krw_tokens: baselineStats.bySource['bithumb'] || 0,
        sanity: baselineStats.total > 100, // Au moins 100 tokens
        
        // Instance
        leader_instance_id: this.singletonGuard.getInstanceId(),
        OBSERVER_MODE: !this.singletonGuard.isInstanceLeader(),
        
        // Leadership
        leadership: {
          isLeader: this.singletonGuard.isInstanceLeader(),
          healthy: leaderHealth.healthy,
          reason: leaderHealth.reason
        },
        
        // Base de données
        database: dbHealth,
        
        // Perpétuels
        perp_catalog: {
          total: perpStats.total,
          byExchange: perpStats.byExchange
        },
        
        // Latences p95
        latencies: {
          detected_to_order_sent_ms: latencies.detectedToOrder,
          order_sent_to_ack_ms: latencies.orderToAck
        },
        
        // Temps de réponse
        response_time_ms: Date.now() - startTime
      };

      // Déterminer le statut global
      if (!health.sanity || !health.leadership.healthy || !health.database.healthy) {
        health.status = 'degraded';
      }

      return health;

    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: Date.now() - startTime
      };
    }
  }

  private async getMetrics(): Promise<any> {
    try {
      const baselineStats = await this.tokenRegistry.getBaselineKRStats();
      const processedStats = await this.tokenRegistry.getProcessedEventsStats();
      const perpStats = await this.perpCatalog.getCatalogStats();
      const telegramStats = this.telegramService.getQueueStats();
      
      return {
        timestamp: new Date().toISOString(),
        
        // Compteurs d'événements
        detected: processedStats.total,
        by_source: processedStats.bySource,
        by_base: processedStats.byBase,
        
        // WebSocket
        ws_reconnects: this.wsWatcher?.getStatus().reconnectAttempts || 0,
        
        // Exits
        exit_pending: 0, // TODO: Implémenter le compteur des exits en attente
        
        // Telegram
        telegram_queue_len: telegramStats.total,
        telegram_by_priority: telegramStats.byPriority,
        telegram_next_retry: telegramStats.nextRetryCount,
        
        // Perpétuels
        perps_total: perpStats.total,
        perps_bybit: perpStats.byExchange.find(e => e.exchange === 'BYBIT')?.count || 0,
        perps_hl: perpStats.byExchange.find(e => e.exchange === 'HYPERLIQUID')?.count || 0,
        perps_binance: perpStats.byExchange.find(e => e.exchange === 'BINANCE')?.count || 0,
        
        // Baseline
        baseline_kr_total: baselineStats.total,
        baseline_last_updated: baselineStats.lastUpdated
      };

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des métriques:', error);
      throw error;
    }
  }

  private async checkDatabaseHealth(): Promise<{ healthy: boolean; tables: string[]; error?: string }> {
    try {
      const tables = ['baseline_kr', 'processed_events', 'cooldowns', 'perp_catalog', 'instance_lock'];
      const existingTables: string[] = [];
      
      for (const table of tables) {
        const exists = await this.tokenRegistry['tableExists'](table);
        if (exists) {
          existingTables.push(table);
        }
      }
      
      return {
        healthy: existingTables.length === tables.length,
        tables: existingTables
      };
      
    } catch (error) {
      return {
        healthy: false,
        tables: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private calculateLatencies(): { detectedToOrder: number; orderToAck: number } {
    // TODO: Implémenter un vrai calcul de latences p95
    // Pour l'instant, retourner des valeurs factices
    return {
      detectedToOrder: 150, // 150ms p95
      orderToAck: 250       // 250ms p95
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          console.log(`🌐 Serveur HTTP démarré sur ${this.config.host}:${this.config.port}`);
          console.log(`📊 Endpoints disponibles:`);
          console.log(`  GET /health - Statut de santé`);
          console.log(`  GET /metrics - Métriques du bot`);
          console.log(`  GET /baseline - Baseline KR`);
          console.log(`  GET /whoami - Informations instance`);
          console.log(`  GET /status - Statut des composants`);
          console.log(`  GET /ping - Test de connectivité`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('❌ Erreur serveur HTTP:', error);
          reject(error);
        });

      } catch (error) {
        console.error('❌ Erreur lors du démarrage du serveur HTTP:', error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 Serveur HTTP arrêté');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Getters pour le monitoring
  getStatus(): {
    isRunning: boolean;
    port: number;
    host: string;
    endpoints: string[];
  } {
    return {
      isRunning: !!this.server,
      port: this.config.port,
      host: this.config.host,
      endpoints: ['/health', '/metrics', '/baseline', '/whoami', '/status', '/ping']
    };
  }
}
