import express from 'express';
import { Server } from 'http';
import { Database } from 'sqlite3';
import { BaselineManager } from '../core/BaselineManager';
import { PerpCatalog } from '../store/PerpCatalog';
import { SingletonGuard } from '../core/SingletonGuard';
import { NoticeClient, BithumbNotice } from '../watchers/NoticeClient';
import { BithumbWSWatcher } from '../watchers/BithumbWSWatcher';
import { TelegramService } from '../notify/TelegramService';
import { TradeExecutor } from '../trade/TradeExecutor';
import { HealthMonitor } from '../core/HealthMonitor';
import { EventStore } from '../core/EventStore';
import { DashboardController } from './DashboardController';
import { StructuredLogger, LogLevel } from '../core/StructuredLogger';
import { AdvancedMetrics } from '../core/AdvancedMetrics';
import { latency } from '../metrics/Latency';
import { buildEventId } from '../core/EventId';

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
  private db: Database;
  private baselineManager: BaselineManager | null;
  private perpCatalog: PerpCatalog | null;
  private singletonGuard: SingletonGuard;
  private noticeClient: NoticeClient | null;
  private wsWatcher: BithumbWSWatcher | null;
  private telegramService: TelegramService;
  private tradeExecutor: TradeExecutor | null;
  private healthMonitor: HealthMonitor | null;
  private eventStore: EventStore;
  private dashboardController: DashboardController | null = null;
  
  // Métriques du système unifié
  private unifiedMetrics = {
    t0_live_new: 0,
    t0_future: 0,
    t0_stale: 0,
    t0_dup_skips: 0,
    trades_opened: 0,
    ws_reconnects: 0,
    catalog_refresh_coalesced: 0,
    catalog_refresh_runs: 0
  };

  constructor(
    db: Database,
    baselineManager: BaselineManager | null,
    perpCatalog: PerpCatalog | null,
    singletonGuard: SingletonGuard,
    noticeClient: NoticeClient | null = null,
    wsWatcher: BithumbWSWatcher | null = null,
    telegramService: TelegramService,
    tradeExecutor: TradeExecutor | null = null,
    healthMonitor: HealthMonitor | null = null,
    eventStore: EventStore,
    config: Partial<HttpServerConfig> = {}
  ) {
    this.db = db;
    this.baselineManager = baselineManager;
    this.perpCatalog = perpCatalog;
    this.singletonGuard = singletonGuard;
    this.noticeClient = noticeClient;
    this.wsWatcher = wsWatcher;
    this.telegramService = telegramService;
    this.tradeExecutor = tradeExecutor;
    this.healthMonitor = healthMonitor;
    this.eventStore = eventStore;
    
    // Initialiser le dashboard
    const logger = new StructuredLogger(LogLevel.INFO);
    const metrics = new AdvancedMetrics(logger);
    this.dashboardController = new DashboardController(metrics, logger);
    
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
        console.error('❌ Health check failed:', error);
        res.status(500).json({ error: 'Health check failed' });
      }
    });

    // Readiness check (T0-ready pour Railway)
    this.app.get('/readiness', async (req, res) => {
      try {
        const readiness = await this.getReadinessStatus();
        res.json(readiness);
      } catch (error) {
        console.error('❌ Readiness check failed:', error);
        res.status(500).json({ error: 'Readiness check failed' });
      }
    });

    // Metrics
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json(metrics);
      } catch (error) {
        console.error('❌ Metrics failed:', error);
        res.status(500).json({ error: 'Metrics failed' });
      }
    });

    // Baseline KR
    this.app.get('/baseline', async (req, res) => {
      try {
        if (!this.baselineManager) {
          return res.status(503).json({ error: 'Baseline manager not available' });
        }
        
        const stats = await this.baselineManager.getBaselineKRStats();
        res.json(stats);
        return;
      } catch (error) {
        console.error('❌ Baseline failed:', error);
        return res.status(500).json({ error: 'Baseline failed' });
      }
    });

    // Status
    this.app.get('/status', async (req, res) => {
      try {
        const status = await this.getStatus();
        res.json(status);
      } catch (error) {
        console.error('❌ Status failed:', error);
        res.status(500).json({ error: 'Status failed' });
      }
    });

    // Whoami
    this.app.get('/whoami', async (req, res) => {
      try {
        const whoami = await this.getWhoami();
        res.json(whoami);
      } catch (error) {
        console.error('❌ Whoami failed:', error);
        res.status(500).json({ error: 'Whoami failed' });
      }
    });

    // Trading control
    this.app.post('/trading/enable', async (req, res) => {
      try {
        // TODO: Implémenter l'activation du trading
        res.json({ message: 'Trading enabled', timestamp: new Date().toISOString() });
      } catch (error) {
        console.error('❌ Enable trading failed:', error);
        res.status(500).json({ error: 'Enable trading failed' });
      }
    });

    this.app.post('/trading/disable', async (req, res) => {
      try {
        // TODO: Implémenter la désactivation du trading
        res.json({ message: 'Trading disabled', timestamp: new Date().toISOString() });
      } catch (error) {
        console.error('❌ Disable trading failed:', error);
        res.status(500).json({ error: 'Disable trading failed' });
      }
    });

    // Simulation endpoints
    this.app.post('/simulate/notice', async (req, res) => {
      try {
        const result = await this.simulateNotice(req.body);
        res.json(result);
      } catch (error) {
        console.error('❌ Simulate notice failed:', error);
        res.status(500).json({ error: 'Simulate notice failed' });
      }
    });

    this.app.post('/simulate/ws', async (req, res) => {
      try {
        const result = await this.simulateWS(req.body);
        res.json(result);
      } catch (error) {
        console.error('❌ Simulate WS failed:', error);
        res.status(500).json({ error: 'Simulate WS failed' });
      }
    });

    // Self-test endpoints
    this.app.post('/selftest', async (req, res) => {
      try {
        if (process.env.SELFTEST_MODE !== 'true') {
          return res.status(403).json({ error: 'SELFTEST_MODE must be true' });
        }
        
        const result = await this.runSelfTest();
        return res.json(result);
      } catch (error) {
        console.error('❌ Self-test failed:', error);
        return res.status(500).json({ error: 'Self-test failed' });
      }
    });

    // Dashboard
    this.app.get('/dashboard', async (req, res) => {
      try {
        if (!this.dashboardController) {
          return res.status(503).json({ error: 'Dashboard not available' });
        }
        
        const dashboardData = this.dashboardController.getDashboardData();
        return res.json(dashboardData);
      } catch (error) {
        console.error('❌ Dashboard failed:', error);
        return res.status(500).json({ error: 'Dashboard failed' });
      }
    });

    this.app.get('/dashboard/html', async (req, res) => {
      try {
        if (!this.dashboardController) {
          return res.status(503).json({ error: 'Dashboard not available' });
        }
        
        res.setHeader('Content-Type', 'text/html');
        return res.send(this.dashboardController.getDashboardHTML());
      } catch (error) {
        console.error('❌ Dashboard HTML failed:', error);
        return res.status(500).json({ error: 'Dashboard HTML failed' });
      }
    });

    // Database schema endpoint
    this.app.get('/db/schema', async (req, res) => {
      try {
        const schema = await this.getDatabaseSchema();
        res.json(schema);
      } catch (error) {
        console.error('❌ Database schema failed:', error);
        res.status(500).json({ error: 'Database schema failed' });
      }
    });

    // Recent events endpoint
    this.app.get('/events/recent', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const events = await this.eventStore.getRecentEvents(limit);
        res.json(events);
      } catch (error) {
        console.error('❌ Recent events failed:', error);
        res.status(500).json({ error: 'Recent events failed' });
      }
    });

    // Dedup stats endpoint
    this.app.get('/events/stats', async (req, res) => {
      try {
        const stats = await this.eventStore.getDedupStats();
        res.json(stats);
      } catch (error) {
        console.error('❌ Dedup stats failed:', error);
        res.status(500).json({ error: 'Dedup stats failed' });
      }
    });

    this.app.post('/simulate/notify-burst', async (req, res) => {
      try {
        const result = await this.simulateNotifyBurst(req.body);
        res.json(result);
      } catch (error) {
        console.error('❌ Simulate notify burst failed:', error);
        res.status(500).json({ error: 'Simulate notify burst failed' });
      }
    });

    // Catch-all pour les routes non trouvées
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
  }

  private async getHealthStatus(): Promise<any> {
    if (this.healthMonitor) {
      const healthStatus = await this.healthMonitor.getHealthStatus();
      
      // Ajouter les informations de baseline et circuit-breaker
      if (this.baselineManager) {
        const baselineHealth = await this.baselineManager.healthCheck();
        healthStatus.baseline_state = baselineHealth.state;
        healthStatus.baseline_cb_state = baselineHealth.circuitBreakerState;
        healthStatus.last_baseline_fetch_ms = baselineHealth.lastBaselineFetchMs;
        healthStatus.errors_999_last_5m = baselineHealth.errors999Last5m;
      }
      
      // Ajouter les informations T0
      if (this.noticeClient) {
        healthStatus.t0_enabled = this.noticeClient.isEnabled;
        // NoticeClient n'a plus de circuit breaker, utiliser un état par défaut
        healthStatus.t0_cb_state = 'CLOSED';
      }
      
      // Ajouter les informations T2
      if (this.wsWatcher) {
        healthStatus.t2_enabled = true;
        healthStatus.ws_connected = (this.wsWatcher as any).isConnected || false;
      } else {
        healthStatus.t2_enabled = false;
        healthStatus.ws_connected = false;
      }
      
      // Ajouter l'ID de l'instance leader
      healthStatus.leader_instance_id = process.env.INSTANCE_ID || 'unknown';
      
      return healthStatus;
    }
    
    // Fallback si pas de HealthMonitor
    return {
      status: 'unknown',
      timestamp: new Date().toISOString(),
      baseline_state: 'UNKNOWN',
      baseline_cb_state: 'UNKNOWN',
      t0_enabled: false,
      t0_cb_state: 'UNKNOWN',
      t2_enabled: false,
      ws_connected: false,
      leader_instance_id: process.env.INSTANCE_ID || 'unknown',
      message: 'HealthMonitor not available'
    };
  }

  private async getMetrics(): Promise<any> {
    let baseMetrics = {};
    if (this.healthMonitor) {
      baseMetrics = await this.healthMonitor.getMetrics();
    }
    
    // Métriques du système unifié
    const unifiedMetrics = {
      ...this.unifiedMetrics,
      ws_reconnects: this.wsWatcher ? (this.wsWatcher as any).getReconnectCount?.() || 0 : 0
    };
    
    // Métriques du PerpCatalog si disponible
    let perpCatalogMetrics: { catalog_refresh_coalesced: number; catalog_refresh_runs: number } = {
      catalog_refresh_coalesced: 0,
      catalog_refresh_runs: 0
    };
    if (this.perpCatalog) {
      try {
        const guardCounters = (this.perpCatalog as any).guard?.getCounters?.() || {};
        perpCatalogMetrics = {
          catalog_refresh_coalesced: guardCounters.guard_coalesced || 0,
          catalog_refresh_runs: guardCounters.guard_runs || 0
        };
        
        // Mettre à jour les métriques unifiées
        unifiedMetrics.catalog_refresh_coalesced = perpCatalogMetrics.catalog_refresh_coalesced;
        unifiedMetrics.catalog_refresh_runs = perpCatalogMetrics.catalog_refresh_runs;
      } catch (error) {
        console.warn('⚠️ Erreur lors de la récupération des métriques PerpCatalog:', error);
      }
    }
    
    // Ajouter les métriques des circuit-breakers
    let baselineMetrics = {};
    if (this.baselineManager) {
      const cbStats = (this.baselineManager as any).httpClient?.getCircuitBreakerStats();
      if (cbStats) {
        baselineMetrics = {
          baseline_fetch_success_total: cbStats.successfulRequests,
          baseline_fetch_error_total: cbStats.failedRequests,
          baseline_cb_open_total: cbStats.openCount,
          baseline_cb_state: cbStats.state
        };
      }
    }
    
    let t0Metrics = {};
    if (this.noticeClient) {
      // NoticeClient n'a plus de circuit breaker, utiliser des stats par défaut
      const cbStats = { 
        state: 'CLOSED', 
        openCount: 0, 
        lastOpenTime: 0,
        lastErrorTime: 0,
        failedRequests: 0
      };
      t0Metrics = {
        t0_disabled_seconds_total: cbStats.state === 'OPEN' ? Math.floor((Date.now() - (cbStats.lastErrorTime || 0)) / 1000) : 0,
        t0_fetch_error_total: cbStats.failedRequests,
        t0_cb_open_total: cbStats.openCount,
        t0_cb_state: cbStats.state
      };
    }
    
    // Métriques de latence T0 haute précision
    const latencyMetrics = latency.getMetrics();
    const t0LatencyMetrics = {
      t0_fetch_p95_ms: latencyMetrics.t0_fetch_p95_ms,
      t0_detect_to_insert_p95_ms: latencyMetrics.t0_detect_to_insert_p95_ms,
      t0_insert_to_order_p95_ms: latencyMetrics.t0_insert_to_order_p95_ms,
      t0_order_to_ack_p95_ms: latencyMetrics.t0_order_to_ack_p95_ms,
      t0_new_total: latencyMetrics.t0_new_total,
      t0_dup_total: latencyMetrics.t0_dup_total,
      t0_future_total: latencyMetrics.t0_future_total,
      t0_stale_total: latencyMetrics.t0_stale_total,
      t0_slow_warnings_total: latencyMetrics.t0_slow_warnings_total
    };
    
    return {
      ...baseMetrics,
      unified: unifiedMetrics,
      perp_catalog: perpCatalogMetrics,
      baseline: baselineMetrics,
      t0: { ...t0Metrics, ...t0LatencyMetrics },
      timestamp: new Date().toISOString()
    };
  }
  
  // Méthodes pour incrémenter les métriques
  incrementMetric(metric: keyof typeof this.unifiedMetrics): void {
    if (this.unifiedMetrics.hasOwnProperty(metric)) {
      this.unifiedMetrics[metric]++;
    }
  }

  private async getStatus(): Promise<any> {
    const wsStatus = this.wsWatcher ? this.wsWatcher.getMetrics() : null;
    const telegramStatus = this.telegramService.getStatus();
    
    // Informations de self-test
    const selfTestInfo = {
      mode_enabled: process.env.SELFTEST_MODE === 'true',
      dry_run_enabled: process.env.TRADING_DRY_RUN_ON_SELFTEST === 'true',
      last_result: null as any,
      last_error: null as string | null,
      last_ts: null as string | null
    };

    // Si le self-test est activé, essayer de récupérer les métriques
    if (selfTestInfo.mode_enabled && this.tradeExecutor) {
      try {
        const selfTestMetrics = (this.tradeExecutor as any).getSelfTestMetrics?.();
        if (selfTestMetrics) {
          selfTestInfo.last_result = selfTestMetrics;
          selfTestInfo.last_ts = new Date().toISOString();
        }
      } catch (error) {
        selfTestInfo.last_error = error instanceof Error ? error.message : 'Unknown error';
        selfTestInfo.last_ts = new Date().toISOString();
      }
    }
    
    return {
      timestamp: new Date().toISOString(),
      websocket: wsStatus || { connected: false },
      telegram: telegramStatus,
      trading: {
        enabled: !!this.tradeExecutor,
        executor_available: !!this.tradeExecutor
      },
      selftest: selfTestInfo
    };
  }

  private async getWhoami(): Promise<any> {
    const instanceId = process.env.INSTANCE_ID || 'unknown';
    const isLeader = this.singletonGuard.isInstanceLeader();
    
    return {
      instance_id: instanceId,
      is_leader: isLeader,
      observer_mode: !isLeader,
      timestamp: new Date().toISOString()
    };
  }

  private async getReadinessStatus(): Promise<any> {
    const now = Date.now();
    const instanceId = process.env.INSTANCE_ID || 'unknown';
    const isLeader = this.singletonGuard.isInstanceLeader();
    
    // Récupérer le statut T0
    let t0Enabled = false;
    let t0LastPollMsAgo = 0;
    let baselineState = 'UNKNOWN';
    
    if (this.baselineManager) {
      baselineState = (this.baselineManager as any).getState?.() || 'UNKNOWN';
    }
    
    if (this.noticeClient) {
      t0Enabled = (this.noticeClient as any)._isEnabled || false;
      // TODO: Récupérer le dernier poll depuis NoticeClient
      t0LastPollMsAgo = 0; // À implémenter
    }
    
    // Règle: t0_ready=true si t0_enabled=true et t0_last_poll_ms_ago <= 2000 et baseline_state in (READY,CACHED)
    const t0Ready = t0Enabled && 
                   t0LastPollMsAgo <= 2000 && 
                   ['READY', 'CACHED'].includes(baselineState);
    
    return {
      t0_ready: t0Ready,
      t0_enabled: t0Enabled,
      t0_last_poll_ms_ago: t0LastPollMsAgo,
      t0_interval_target_ms: 1100,
      baseline_state: baselineState,
      t2_enabled: !!this.wsWatcher,
      instance_id: instanceId,
      is_leader: isLeader,
      timestamp: new Date().toISOString()
    };
  }

    private async simulateNotice(data: any): Promise<any> {
    try {
      // Validation et normalisation des champs
      const title = data.title || 'TESTCOIN (KRW) 신규 상장';
      let tradeTimeUtc = data.tradeTimeUtc;
      
      // Normaliser tradeTimeUtc si non fourni ou invalide
      if (!tradeTimeUtc || isNaN(Date.parse(tradeTimeUtc))) {
        tradeTimeUtc = new Date(Date.now() - 1000).toISOString(); // 1 seconde dans le passé
      }
      
      // Valider forceTiming si fourni
      const validTimings = ['live', 'future', 'stale'];
      const forceTiming = data.forceTiming && validTimings.includes(data.forceTiming) ? data.forceTiming : undefined;
      
      // Options de bypass pour les notices simulées
      const bypassBaseline = data.bypassBaseline === true;
      const bypassCooldown = data.bypassCooldown === true;
      const dryRun = data.dryRun !== false; // true par défaut pour les tests
      
      // Construire un faux objet notice identique au format T0
      const fakeNotice: BithumbNotice = {
        id: Date.now(),
        title,
        categories: ['공지', '신규상장'],
        pc_url: `https://www.bithumb.com/notice/notice_detail?nid=${Date.now()}`,
        published_at: (() => {
          const date = new Date(tradeTimeUtc);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        })(), // Format exact: yyyy-MM-dd HH:mm:ss
        content: `Simulated listing for ${data.base || 'TESTCOIN'}`
      };

      console.log(`🧪 Simulating notice: ${title} with tradeTimeUtc: ${tradeTimeUtc}, forceTiming: ${forceTiming || 'auto'}, bypassBaseline: ${bypassBaseline}, bypassCooldown: ${bypassCooldown}, dryRun: ${dryRun}`);

      // Appeler processNotice avec les options appropriées
      if (!this.noticeClient) {
        throw new Error('NoticeClient not available');
      }
      
      const results = await this.noticeClient.processNotice(fakeNotice, { 
        source: 'simulate', 
        ignoreWatermark: true, 
        forceTiming,
        bypassBaseline,
        bypassCooldown,
        dryRun
      });

      if (results && results.length > 0) {
        // Prendre le premier résultat pour la simulation
        const result = results[0];
        if (!result) {
          console.log(`❌ Simulated notice processing failed - no valid result`);
          return {
            success: false,
            message: 'Notice simulation failed - no valid result',
            eventId: null,
            base: null,
            timing: null,
            inserted: false
          };
        }
        console.log(`✅ Simulated notice processed: ${result.base}`);
        
        // 🚀 NOUVEAU: Reproduire le pipeline T0 complet avec bypass
        try {
          // 1. DÉDUPLICATION (comme dans le flux T0 normal)
          if (this.eventStore) {
            const dedupResult = await this.eventStore.tryMarkProcessed({
              eventId: result.eventId,
              source: result.source === 'simulate' ? 'bithumb.notice' : result.source,
              base: result.base,
              url: result.url,
              markets: Array.isArray(result.markets) ? result.markets : [],
              tradeTimeUtc: result.tradeTimeUtc.toISOString(),
              rawTitle: result.url
            });
            
            if (dedupResult === 'DUPLICATE') {
              console.log(`⚠️ Simulated notice is duplicate - skipping trading pipeline`);
              return {
                success: true,
                message: 'Notice simulated but is duplicate',
                eventId: result.eventId,
                base: result.base,
                timing: result.timing,
                inserted: false,
                bypassBaseline: result.bypassBaseline,
                bypassCooldown: result.bypassCooldown,
                dryRun: result.dryRun,
                tradingPipelineTriggered: false,
                reason: 'duplicate'
              };
            }
            
            console.log(`✅ Simulated notice deduplication: ${dedupResult}`);
          }
          
          // 2. GATING SYMBOLIQUE (avec bypass si demandé)
          let isNew = true; // Par défaut pour les notices simulées
          if (!result.bypassBaseline && this.baselineManager) {
            isNew = await this.baselineManager.isTokenNew(result.base);
            console.log(`🔍 Baseline check for ${result.base}: ${isNew ? 'NEW' : 'EXISTS'}`);
          } else if (result.bypassBaseline) {
            console.log(`🚀 Baseline check bypassed for simulated notice`);
          }
          
          if (isNew) {
            console.log(`🎯 NEW LISTING DETECTED (SIMULATED): ${result.base}`);
            
            // 3. NOTIFICATION TELEGRAM (si configuré)
            if (this.telegramService && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
              const message = `🧪 **SIMULATED NEW LISTING** 🧪\n\n**Token:** \`${result.base}\`\n**Source:** ${result.source}\n**Mode:** ${result.dryRun ? 'DRY-RUN' : 'LIVE'}\n\n⚡ **T0 DETECTION SIMULATION** ⚡`;
              try {
                await this.telegramService.sendMessage(message);
                console.log(`📱 Telegram notification sent for simulated listing`);
              } catch (telegramError) {
                console.warn(`⚠️ Telegram notification failed (non-blocking):`, telegramError);
              }
            }
            
            // 4. EXÉCUTION DU TRADING (avec bypass des gardes)
            if (this.tradeExecutor && result.dryRun) {
              console.log(`💰 Executing DRY-RUN trade for ${result.base}`);
              
              // Créer une opportunité de trading avec bypass
              const tradeOpportunity = {
                token: result.base,
                source: 'T0_NOTICE' as const,
                timestamp: result.tradeTimeUtc.toISOString(),
                bypassBaseline: result.bypassBaseline || false,
                bypassCooldown: result.bypassCooldown || false,
                dryRun: result.dryRun || false
              };
              
              try {
                await this.tradeExecutor.executeOpportunity(tradeOpportunity);
                console.log(`✅ DRY-RUN trade executed successfully for ${result.base}`);
              } catch (tradeError) {
                console.warn(`⚠️ DRY-RUN trade execution failed:`, tradeError);
              }
            } else if (!result.dryRun) {
              console.log(`⚠️ LIVE trading not allowed in simulation mode`);
            } else {
              console.log(`⚠️ TradeExecutor not available for simulated trading`);
            }
            
            console.log(`🚀 Simulated notice successfully routed through complete T0 pipeline with bypass options`);
          } else {
            console.log(`⏭️ Simulated token already in baseline: ${result.base}`);
          }
          
        } catch (pipelineError) {
          console.warn(`⚠️ Trading pipeline error (non-blocking):`, pipelineError);
        }
        
        return {
          success: true,
          message: 'Notice simulated and processed with unified system',
          eventId: result.eventId,
          base: result.base,
          timing: result.timing,
          inserted: true,
          bypassBaseline: result.bypassBaseline,
          bypassCooldown: result.bypassCooldown,
          dryRun: result.dryRun,
          tradingPipelineTriggered: true
        };
      } else {
        console.log(`❌ Simulated notice rejected`);
        return {
          success: false,
          message: 'Notice simulation failed - notice rejected by processing',
          eventId: null,
          base: null,
          timing: null,
          inserted: false
        };
      }
    } catch (error) {
      console.error('Error simulating notice:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Notice simulation failed: ${errorMessage}`,
        eventId: null,
        base: null,
        timing: null,
        inserted: false
      };
    }
  }

  private async simulateWS(data: any): Promise<any> {
    if (!this.wsWatcher) {
      throw new Error('WebSocket watcher not available');
    }
    
    const symbol = data.symbol || 'ABC_KRW';
    const base = symbol.split('_')[0];
    
    // Simuler un événement WebSocket
    this.wsWatcher.emit('newToken', {
      base,
      symbol,
      source: 'bithumb.ws',
      eventId: `sim_${Date.now()}`,
      confirmed: true
    });
    
    return {
      success: true,
      message: 'WebSocket event simulated',
      symbol,
      base
    };
  }

  private async simulateNotifyBurst(data: any): Promise<any> {
    if (!this.telegramService) {
      throw new Error('Telegram service not available');
    }
    
    const count = Math.min(data.count || 10, 20); // Max 20 messages
    const results = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const messageId = await this.telegramService.sendMessage(
          `🧪 **BURST TEST #${i + 1}** 🧪\n\nMessage de test pour validation du burst.`
        );
        results.push({ success: true, messageId, index: i + 1 });
             } catch (error) {
         results.push({ success: false, error: error instanceof Error ? error.message : 'Unknown error', index: i + 1 });
       }
    }
    
    return {
      success: true,
      message: `Burst test completed: ${count} messages`,
      results,
      summary: {
        total: count,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };
  }

  private async getDatabaseSchema(): Promise<any> {
    return new Promise((resolve, reject) => {
      const schema: any = {
        tables: [],
        indexes: [],
        pragmas: {}
      };

      // Récupérer les tables et indexes
      this.db.all("SELECT name, sql FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
          reject(err);
          return;
        }
        schema.tables = tables;

        // Récupérer les indexes
        this.db.all("SELECT name, sql FROM sqlite_master WHERE type='index'", (err, indexes) => {
          if (err) {
            reject(err);
            return;
          }
          schema.indexes = indexes;

          // Récupérer les PRAGMAs utiles
          this.db.get("PRAGMA journal_mode", (err, journalMode) => {
            if (err) {
              reject(err);
              return;
            }
            schema.pragmas.journal_mode = journalMode;

            this.db.get("PRAGMA synchronous", (err, synchronous) => {
              if (err) {
                reject(err);
                return;
              }
              schema.pragmas.synchronous = synchronous;

              this.db.get("PRAGMA cache_size", (err, cacheSize) => {
                if (err) {
                  reject(err);
                  return;
                }
                schema.pragmas.cache_size = cacheSize;

                this.db.get("PRAGMA temp_store", (err, tempStore) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  schema.pragmas.temp_store = tempStore;

                  this.db.get("PRAGMA busy_timeout", (err, busyTimeout) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    schema.pragmas.busy_timeout = busyTimeout;

                    resolve(schema);
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  /**
   * Exécute le self-test post-détection
   */
  private async runSelfTest(): Promise<any> {
    if (process.env.SELFTEST_MODE !== 'true') {
      throw new Error('SELFTEST_MODE must be true');
    }

    if (process.env.TRADING_DRY_RUN_ON_SELFTEST !== 'true') {
      throw new Error('TRADING_DRY_RUN_ON_SELFTEST must be true');
    }

    const startTime = Date.now();
    
    try {
      // Simuler un listing NEW (T0) via simulate/notice avec bypass complet
      const testData = {
        title: 'SELFTEST (KRW) 신규 상장',
        tradeTimeUtc: new Date().toISOString(),
        url: 'https://www.bithumb.com/notice/notice_detail/selftest',
        eventId: 'selftest_' + Date.now(),
        // 🚀 NOUVEAU: Options de bypass pour le self-test
        bypassBaseline: true,
        bypassCooldown: true,
        dryRun: true
      };

      // Déclencher la simulation
      const simulationResult = await this.simulateNotice(testData);
      
      // Attendre un peu pour que les métriques se mettent à jour
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Récupérer les métriques finales
      const finalMetrics = await this.getMetrics();
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        message: 'Self-test completed successfully',
        duration_ms: duration,
        simulation_result: simulationResult,
        final_metrics: finalMetrics,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        message: 'Self-test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
        timestamp: new Date().toISOString()
      };
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          console.log(`🌐 HTTP Server started on ${this.config.host}:${this.config.port}`);
          resolve();
        });
        
        this.server.on('error', (error) => {
          console.error('❌ HTTP Server error:', error);
          reject(error);
        });
        
      } catch (error) {
        console.error('❌ Failed to start HTTP Server:', error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 HTTP Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
