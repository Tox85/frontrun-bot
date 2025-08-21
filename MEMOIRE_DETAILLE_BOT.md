# MEMOIRE DÉTAILLÉ DU BOT FRONTRUNNING BITHUMB

## 🎯 VUE D'ENSEMBLE

Ce bot est conçu pour détecter et trader automatiquement les nouveaux listings coréens sur Bithumb en utilisant une architecture T0+T2 :
- **T0** : Détection via API publique notices (≥1100ms, KST→UTC)
- **T2** : Filet de sécurité WebSocket (debounce 10s/base)
- **Trading** : Hyperliquid testnet uniquement
- **Architecture** : Singleton avec leader actif + instances observatrices

---

## 🚀 PHASE 1: INITIALISATION ET BOOTSTRAP

### 1.1 Démarrage du processus principal (`src/main.ts`)

#### Configuration initiale
```typescript
const BOT_CONFIG = {
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  
  // Trading
  TRADING_ENABLED: process.env.TRADING_ENABLED === 'true',
  MAX_POSITION_SIZE_USD: parseFloat(process.env.MAX_POSITION_SIZE_USD || '100'),
  RISK_PERCENT: parseFloat(process.env.RISK_PERCENT || '2'),
  
  // T0 Polling (≥1100ms requis)
  T0_POLL_INTERVAL_MS: Math.max(1100, parseInt(process.env.T0_POLL_INTERVAL_MS || '1100')),
  T0_MAX_NOTICES_PER_POLL: parseInt(process.env.T0_MAX_NOTICES_PER_POLL || '10'),
  
  // WebSocket T2
  WS_ENABLED: process.env.WS_ENABLED !== 'false',
  WS_DEBOUNCE_MS: parseInt(process.env.WS_DEBOUNCE_MS || '10000'), // 10s
  WS_WARMUP_MS: parseInt(process.env.WS_WARMUP_MS || '5000'),     // 5s
};
```

#### Séquence d'initialisation
1. **Base de données** : SQLite avec migrations automatiques
2. **SingletonGuard** : Vérification du leadership
3. **BaselineManager** : Construction de la baseline KR au boot uniquement
4. **Composants de trading** : Hyperliquid, PositionSizer, ExitScheduler
5. **Watchers** : NoticeClient (T0) + BithumbWSWatcher (T2)
6. **Serveur HTTP** : Monitoring et contrôle

### 1.2 Gestion du leadership (`src/core/SingletonGuard.ts`)

#### Mécanisme de verrouillage
- **Table** : `instance_lock` avec heartbeat toutes les 30s
- **Timeout** : Récupération automatique après 5 minutes d'inactivité
- **UUID** : Instance unique générée au démarrage
- **Transaction** : Atomicité garantie pour l'acquisition

```typescript
// Vérification du leadership existant
const lockAge = Date.now() - new Date(row.acquired_at_utc).getTime();
if (lockAge > 5 * 60 * 1000) {
  // Lock expiré, récupération possible
  await this.recoverExpiredLock();
}
```

#### États possibles
- **LEADER** : Instance active avec trading et notifications
- **OBSERVER_MODE** : Instances passives, monitoring uniquement

### 1.3 Construction de la baseline KR (`src/core/BaselineManager.ts`)

#### Source de données
- **API REST** : `https://api.bithumb.com/public/ticker/ALL_KRW`
- **Exclusions** : USDT, USDC, DAI, TUSD, BUSD, FRAX
- **Timing** : Uniquement au boot, jamais pendant la détection

#### États de la baseline
```typescript
export type BaselineState = 'READY' | 'CACHED' | 'DEGRADED';

// READY: API REST fonctionne, baseline complète
// CACHED: Fallback au cache local, T2 actif, T0 en attente
// DEGRADED: Échec total, T2 uniquement, retry programmé
```

#### Circuit-breaker intégré
- **Erreurs 999** : Compteur sur 5 minutes
- **Retry automatique** : Backoff exponentiel avec jitter
- **Fallback** : Cache local si API indisponible

---

## 🔍 PHASE 2: DÉTECTION DES NOUVEAUX LISTINGS

### 2.1 Détection T0 - API Publique Notices (`src/watchers/NoticeClient.ts`)

#### Endpoint et configuration
```typescript
private readonly baseUrl = 'https://api.bithumb.com/v1/notices';
private readonly rateLimit = {
  requestsPerSecond: 1,
  minInterval: 1100, // ≥1100ms comme requis
  maxRetries: 3
};
```

#### Mots-clés de détection
```typescript
private readonly keywords = [
  // Coréen
  '상장', '원화', 'KRW', '거래지원', '신규', '추가', '원화마켓', 'KRW 마켓',
  // Anglais
  'listing', 'new market', 'add KRW', 'KRW market', 'trading support', 'new', 'added'
];
```

#### Protection contre les boucles infinies
- **WatermarkStore** : Timestamp de la dernière notice traitée
- **Initialisation au boot** : Timestamp = 0 pour traiter toutes les notices
- **Mise à jour incrémentale** : Watermark avance avec chaque batch

### 2.2 Détection T2 - WebSocket Bithumb (`src/watchers/BithumbWSWatcher.ts`)

#### Configuration WebSocket
```typescript
const wsConfig = {
  wsUrl: 'wss://pubwss.bithumb.com/pub/ws',
  debounceMs: 10000, // 10s par base
  warmupMs: 5000     // 5s de stabilisation
};
```

#### Debounce par base
- **Fenêtre de 10s** : Évite les notifications multiples pour la même base
- **Cache par base** : `Map<string, NodeJS.Timeout>`
- **Reset automatique** : À chaque nouveau message pour la même base

### 2.3 Déduplication centralisée (`src/core/EventStore.ts`)

#### Mécanisme de déduplication
```typescript
// EventId déterministe (pas de Date.now())
const eventId = buildEventId({
  source: 'bithumb.notice',
  base: listing.base,
  url: listing.url,
  markets: listing.markets || [],
  tradeTimeUtc: listing.publishedAtUtc
});

// INSERT OR IGNORE pour l'idempotence
const dedupResult = await eventStore.tryMarkProcessed({
  eventId,
  source: 'bithumb.notice',
  base: listing.base,
  // ... autres champs
});
```

#### Résultats possibles
- **INSERTED** : Nouvel événement, traitement autorisé
- **DUPLICATE** : Événement déjà traité, skip immédiat

#### Protection cross-sources
- **Table unique** : `processed_events` pour T0 et T2
- **EventId unique** : Hash déterministe basé sur le contenu
- **Cooldown global** : 24h par base, toutes sources confondues

---

## 💰 PHASE 3: EXÉCUTION DES TRADES

### 3.1 TradeExecutor (`src/trade/TradeExecutor.ts`)

#### Vérifications pré-trade
```typescript
async executeOpportunity(opportunity: TradeOpportunity): Promise<TradeResult | null> {
  // 1. Vérifier le cooldown (24h par base)
  if (this.isInCooldown(opportunity.token)) {
    return null;
  }

  // 2. Vérifier que le token n'est pas déjà dans la baseline
  const isNew = await this.baselineManager.isTokenNew(opportunity.token);
  if (!isNew) {
    return null;
  }

  // 3. Vérifier la disponibilité sur Hyperliquid
  const isAvailable = await this.hyperliquid.isSymbolTradable(opportunity.token);
  if (!isAvailable) {
    return null;
  }
}
```

#### Configuration de trading
```typescript
const tradeConfig = {
  riskPct: 0.02,        // 2% du solde
  leverageTarget: 5,     // Levier cible
  cooldownHours: 24,    // Cooldown entre trades
  dryRun: false         // Mode production
};
```

### 3.2 Hyperliquid Adapter (`src/exchanges/HyperliquidAdapter.ts`)

#### Configuration testnet
```typescript
const hlConfig = {
  testnet: true,                    // Testnet uniquement
  privateKey: process.env.HYPERLIQUID_API_KEY,
  walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS,
  baseUrl: 'https://api.hyperliquid-testnet.xyz',
  timeoutMs: 10000
};
```

#### Stratégie de trading
- **Position** : Long immédiat
- **Taille** : `balance * RISK_PCT * LEVERAGE_TARGET`
- **Exit** : +180s reduce-only automatique
- **Circuit-breaker** : ×3 erreurs → trading OFF

### 3.3 ExitScheduler (`src/core/ExitScheduler.ts`)

#### Planification des exits
```typescript
// Exit +180s après l'ouverture
const exitTime = new Date(Date.now() + 180 * 1000);
await this.scheduleExit({
  base: token,
  dueAt: exitTime,
  payload: JSON.stringify({
    positionId,
    symbol: token,
    side: 'LONG',
    size: positionSize
  })
});
```

#### Persistance en base
- **Table** : `scheduled_exits`
- **Status** : PENDING → EXECUTED/FAILED
- **Retry** : En cas d'échec d'exécution

---

## 📱 PHASE 4: NOTIFICATIONS TELEGRAM

### 4.1 TelegramService (`src/notify/TelegramService.ts`)

#### Configuration de rate limiting
```typescript
const telegramConfig = {
  queueDelayMs: 1000,        // 1 seconde entre messages
  maxRetries: 3,             // Retry en cas d'échec
  retryBackoffMs: 2000,      // Backoff exponentiel
  timeoutMs: 10000           // Timeout par message
};
```

#### Queue de messages
- **Priorités** : high, medium, low
- **Traitement séquentiel** : 1 message/seconde
- **Respect strict** : `retry_after` de l'API Telegram
- **Mode observateur** : Aucun envoi en OBSERVER_MODE

#### Messages automatiques
```typescript
// Détection de nouveau listing
const message = `🚨 **NEW LISTING DETECTED** 🚨\n\n` +
               `**Token:** \`${listing.base}\`\n` +
               `**Priority:** ${listing.priority.toUpperCase()}\n` +
               `**Status:** ${listing.status.toUpperCase()}\n\n` +
               `**Title:** ${listing.title}\n` +
               `**Source:** ${listing.source}\n\n` +
               `⚡ **T0 DETECTION** ⚡`;

// Trade exécuté
const tradeMessage = `💰 **TRADE EXECUTED** 💰\n\n` +
                     `**Token:** \`${token}\`\n` +
                     `**Action:** LONG\n` +
                     `**Size:** ${positionSize}\n` +
                     `**Leverage:** ${leverage}\n` +
                     `**Exit:** +180s (${exitTime})`;
```

---

## 🏥 PHASE 5: MONITORING ET SANTÉ

### 5.1 HealthMonitor (`src/core/HealthMonitor.ts`)

#### Métriques de performance
```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  instance: {
    id: string;
    isLeader: boolean;
    observerMode: boolean;
    uptime: number;
  };
  baseline: {
    krw_count: number;
    sanity: boolean;
    lastUpdated: string | null;
  };
  detection: {
    t0_active: boolean;
    t2_active: boolean;
    last_detection: string | null;
  };
  trading: {
    enabled: boolean;
    positions_open: number;
    exits_pending: number;
  };
  performance: {
    p95_detected_to_order: number;
    p95_order_to_ack: number;
    p95_notice_processing: number;
  };
}
```

#### Endpoints de monitoring
- **`/health`** : Statut global + p95 latences
- **`/metrics`** : Métriques détaillées (ws.reconnects, exit.pending)
- **`/status`** : État des composants
- **`/baseline`** : État de la baseline KR

### 5.2 Circuit-breaker et robustesse

#### BaselineManager
- **Erreurs 999** : Compteur sur 5 minutes
- **Fallback** : Cache local → dégradation progressive
- **Retry automatique** : Backoff avec jitter

#### NoticeClient
- **Timeout configurable** : `T0_HTTP_TIMEOUT_MS`
- **Retry avec backoff** : `T0_HTTP_RETRIES`
- **Circuit-breaker** : Désactivation automatique en cas d'erreurs répétées

---

## 🗄️ PHASE 6: STOCKAGE ET PERSISTANCE

### 6.1 Schéma de base de données

#### Tables principales
```sql
-- Baseline KR (construite au boot uniquement)
CREATE TABLE baseline_kr (
  base TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'bithumb.rest',
  listed_at_utc TEXT NOT NULL,
  created_at_utc TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Events traités (dédup cross-sources)
CREATE TABLE processed_events (
  event_id TEXT PRIMARY KEY,
  base TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  trade_time_utc TEXT,
  created_at_utc TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cooldowns (éviter retrade < 24h)
CREATE TABLE cooldowns (
  base TEXT PRIMARY KEY,
  expires_at_utc TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at_utc TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exits planifiés (exit +180s persistant)
CREATE TABLE scheduled_exits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base TEXT NOT NULL,
  due_at_utc TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
);

-- Singleton (1 leader)
CREATE TABLE instance_lock (
  id INTEGER PRIMARY KEY,
  instance_id TEXT NOT NULL,
  locked_at_utc TEXT NOT NULL,
  heartbeat_at_utc TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Watermarks (éviter boucles infinies T0)
CREATE TABLE watermarks (
  source TEXT PRIMARY KEY,
  last_published_at INTEGER NOT NULL DEFAULT 0,
  last_notice_uid TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

#### Migrations automatiques
- **Runner** : `MigrationRunner` au boot
- **Versioning** : `migrations.json` avec ordre d'application
- **Rollback** : Non supporté (base de production)

### 6.2 WatermarkStore (`src/store/WatermarkStore.ts`)

#### Protection contre les boucles infinies
```typescript
// Initialisation au boot
async initializeAtBoot(source: string): Promise<void> {
  // Timestamp = 0 pour traiter toutes les notices au boot
  await this.db.run(
    `INSERT OR REPLACE INTO watermarks (source, last_published_at, last_notice_uid, updated_at)
     VALUES (?, 0, '', ?)`,
    [source, Date.now()]
  );
}

// Vérification avant traitement
async shouldConsider(source: string, notice: Notice): Promise<boolean> {
  const watermark = await this.get(source);
  if (!watermark) return true;
  
  // Traiter si plus récent que le watermark
  return notice.published_at > watermark.last_published_at;
}
```

---

## 🔧 PHASE 7: CONTRÔLE ET ADMINISTRATION

### 7.1 Serveur HTTP (`src/api/HttpServer.ts`)

#### Endpoints de contrôle
```typescript
// Contrôle du trading
app.post('/trading/enable', async (req, res) => {
  // Activer le trading
});

app.post('/trading/disable', async (req, res) => {
  // Désactiver le trading
});

// Simulation pour les tests
app.post('/simulate/notice', async (req, res) => {
  // Simuler une notice
});

app.post('/simulate/ws', async (req, res) => {
  // Simuler un message WebSocket
});

// Statut et monitoring
app.get('/whoami', async (req, res) => {
  // Identité de l'instance
});

app.get('/status', async (req, res) => {
  // État des composants
});

app.get('/baseline', async (req, res) => {
  // État de la baseline KR
});
```

#### Dashboard en temps réel
- **Métriques unifiées** : T0, T2, trading, WebSocket
- **Graphiques** : Latences, erreurs, reconnections
- **Contrôles** : Enable/disable trading, simulation

---

## 🧪 PHASE 8: TESTS ET VALIDATION

### 8.1 Tests unitaires implémentés

#### Composants testés
- **`EventId.test.ts`** : Génération déterministe des IDs
- **`EventStore.test.ts`** : Déduplication et cooldowns
- **`BaselineManager.test.ts`** : Gestion de la baseline
- **`RateLimiter.test.ts`** : Rate limiting et circuit-breaker
- **`SymbolMapper.test.ts`** : Mapping des symboles
- **`PerpCatalog.test.ts`** : Catalogue des perpétuels

#### Tests E2E
- **`notice-e2e.test.ts`** : Détection T0 complète
- **Tests de charge** : `src/tests/load/`

### 8.2 Tests de simulation

#### Scripts de test
```bash
# Simulation de notices
npm run simulate:notice

# Simulation WebSocket
npm run simulate:ws

# Test de déduplication
npm run test:dedup-fix

# Validation runtime
npm run validate:runtime

# Test dashboard
npm run test:dashboard
```

---

## 🚨 POINTS D'ATTENTION ET DOUTES

### 8.1 Ce qui fonctionne et est testé

✅ **Fonctionnel et testé :**
- Architecture singleton avec leadership
- Déduplication centralisée cross-sources
- Baseline KR au boot uniquement
- Watermark protection T0
- Circuit-breaker et fallbacks
- Tests unitaires des composants core
- Migrations automatiques
- Rate limiting respecté (≥1100ms T0, 10s T2)

✅ **Robuste et sécurisé :**
- EventId déterministe (pas de Date.now())
- INSERT OR IGNORE pour l'idempotence
- Cooldown 24h par base
- Exit +180s persistant
- Circuit-breaker ×3 erreurs
- Mode observateur pour les instances non-leader

### 8.2 Ce qui n'a pas encore été testé

❌ **Tests manquants :**
- **Intégration Hyperliquid** : Connexion réelle au testnet
- **Trading end-to-end** : Ouverture → exit automatique
- **WebSocket T2** : Reconnexions et debounce
- **Telegram rate limiting** : Respect des `retry_after`
- **Baseline fallback** : Dégradation en cas d'échec API
- **Load testing** : Performance sous charge
- **Recovery** : Récupération après crash

❌ **Scénarios edge cases :**
- **Conflit de leadership** : Deux instances qui démarrent simultanément
- **Perte de connexion DB** : Comportement en cas de corruption
- **API Bithumb down** : Dégradation progressive
- **Hyperliquid maintenance** : Gestion des timeouts
- **Rate limit Telegram** : Queue overflow

### 8.3 Doutes et zones d'incertitude

⚠️ **Doutes techniques :**
- **Latence T0** : 1100ms suffisant pour la concurrence ?
- **Debounce T2** : 10s optimal ou trop conservateur ?
- **Watermark T0** : Risque de perte de notices en cas de crash ?
- **Cooldown 24h** : Suffisant pour éviter les faux positifs ?
- **Exit +180s** : Timing optimal pour le profit ?

⚠️ **Doutes opérationnels :**
- **Monitoring** : Alertes en cas de dégradation ?
- **Recovery** : Procédure de reprise après incident ?
- **Scaling** : Support de multiples instances leader ?
- **Backup** : Stratégie de sauvegarde de la base ?
- **Logs** : Rotation et rétention des logs ?

---

## 📊 MÉTRIQUES ET PERFORMANCE

### 8.1 Latences cibles

- **T0 Detection** : < 2s (1100ms polling + processing)
- **T2 WebSocket** : < 1s (debounce 10s max)
- **Trade Execution** : < 5s (ouverture + confirmation)
- **Exit Scheduling** : < 1s (planification + persistance)
- **Telegram Notification** : < 3s (queue + envoi)

### 8.2 Métriques de santé

- **Baseline KR** : > 100 tokens actifs
- **T0 Uptime** : > 99% (circuit-breaker protection)
- **T2 Uptime** : > 95% (reconnections automatiques)
- **Trading Success** : > 90% (circuit-breaker ×3)
- **DB Performance** : < 100ms queries (WAL mode)

---

## 🔮 ROADMAP ET AMÉLIORATIONS

### 8.1 Court terme (1-2 semaines)

- [ ] **Tests Hyperliquid** : Connexion testnet et trading
- [ ] **Tests WebSocket** : Reconnexions et debounce
- [ ] **Tests Telegram** : Rate limiting et retry
- [ ] **Monitoring** : Alertes automatiques
- [ ] **Recovery** : Procédures de reprise

### 8.2 Moyen terme (1-2 mois)

- [ ] **Load testing** : Performance sous charge
- [ ] **Chaos engineering** : Tests de résilience
- [ ] **Observabilité** : Traces distribuées
- [ ] **Backup** : Stratégie de sauvegarde
- [ ] **Documentation** : Runbooks opérationnels

### 8.3 Long terme (3-6 mois)

- [ ] **Multi-leader** : Support de plusieurs instances actives
- [ ] **Auto-scaling** : Adaptation automatique à la charge
- [ ] **Machine Learning** : Optimisation des paramètres
- [ ] **Multi-exchange** : Support d'autres exchanges
- [ ] **API publique** : Interface pour les utilisateurs

---

## 📝 CONCLUSION

Ce bot de frontrunning Bithumb présente une architecture robuste et bien pensée avec :

**Points forts :**
- Architecture singleton bien définie
- Déduplication centralisée efficace
- Protection contre les boucles infinies
- Circuit-breaker et fallbacks
- Tests unitaires des composants core
- Monitoring et métriques complets

**Zones d'amélioration :**
- Tests d'intégration manquants
- Validation en conditions réelles
- Procédures de recovery
- Monitoring proactif
- Documentation opérationnelle

**Recommandations :**
1. **Priorité 1** : Tests Hyperliquid testnet
2. **Priorité 2** : Tests WebSocket et Telegram
3. **Priorité 3** : Monitoring et alertes
4. **Priorité 4** : Procédures de recovery
5. **Priorité 5** : Load testing et optimisation

Le bot est prêt pour les tests en environnement de développement mais nécessite une validation complète avant la production.
