# Bot Frontrun Bithumb-only 🚀

Bot de frontrunning spécialisé dans la détection des nouveaux listings coréens via Bithumb, avec architecture T0 (annonce) + T2 (ouverture) et exécution Hyperliquid testnet.

## 🎯 Objectif

Détecter en temps réel les nouveaux listings KRW sur Bithumb et exécuter des trades automatiques sur Hyperliquid testnet avec sortie automatique après 3 minutes.

## 🏗️ Architecture

### Sources de Détection
- **T0 (Annonce)**: Bithumb NoticePoller HTTP (500-800ms, ETag/If-Modified-Since)
- **T2 (Ouverture)**: Bithumb WebSocket KRW avec double-check REST anti-faux positifs

### Composants Principaux
- **SingletonGuard**: Instance unique leader/observateur
- **TokenRegistry**: Gestion baseline KR et événements
- **PerpCatalog**: Catalogue perpétuels Bybit→HL→Binance
- **TelegramService**: Notifications avec queue et retry_after
- **HttpServer**: Endpoints /health, /metrics, /baseline, /whoami

## 🚀 Installation

### Prérequis
- Node.js 20+
- npm 9+

### Installation
```bash
git clone <repo>
cd frontrun-bot
npm install
```

### Configuration
```bash
cp env.example .env
# Éditer .env avec vos clés
```

## ⚙️ Configuration

### Variables d'Environnement
```bash
NODE_ENV=development
PORT=3030
SQLITE_PATH=./data/bot.db

# Sources de détection (exactement)
DETECTION_SOURCES=BITHUMB_WS,NOTICE_POLLER

# Trading
TRADING_ENABLED=false
DRY_RUN=true
COOLDOWN_HOURS=24

# Risk Management
RISK_PCT=0.10
LEVERAGE_TARGET=5

# Hyperliquid
HL_TESTNET=true
HL_PRIVATE_KEY=your_key

# Telegram
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 🏃‍♂️ Utilisation

### Démarrage
```bash
# Développement
npm run dev

# Production
npm run build
npm start
```

### Scripts Disponibles
```bash
npm run typecheck    # Vérification TypeScript
npm run build        # Compilation
npm run test         # Tests unitaires
npm run test:integration  # Tests d'intégration
npm run migrate      # Exécution des migrations
npm run simulate:notice    # Simulation notice T0
npm run simulate:ws        # Simulation WebSocket T2
```

## 📊 Endpoints API

### Health Check
```bash
GET /health
```
Retourne le statut de santé avec p95 latences et compteurs KR.

### Métriques
```bash
GET /metrics
```
Métriques détaillées: détections, WebSocket reconnects, exits en attente, perpétuels.

### Baseline KR
```bash
GET /baseline
```
Statistiques de la baseline KR Bithumb.

### Instance Info
```bash
GET /whoami
```
Informations sur l'instance (leader/observateur).

### Statut Composants
```bash
GET /status
```
Statut détaillé de tous les composants.

## 🔍 Détection T0 (Notice)

Le `BithumbNoticePoller` surveille le feed officiel Bithumb :
- Polling HTTP 500-800ms avec ETag/If-Modified-Since
- Parsing coréen (추가, 상장, 원화, 마켓, 거래지원, 공지)
- Extraction base, marchés, temps trading
- Conversion KST→UTC
- Gating baseline KR

## 🔌 Détection T2 (WebSocket)

Le `BithumbWSWatcher` surveille les nouveaux marchés KRW :
- Abonnement WebSocket ALL_KRW
- Double-check REST anti-faux positifs (3-5s)
- Debounce 10s par base
- Warm-up 5s après reconnect
- Mutex par base

## 💰 Exécution Trading

### Hyperliquid Testnet
- Ouverture long immédiate
- Sizing: `target_notional = balance * RISK_PCT * LEVERAGE_TARGET`
- Exit automatique +180s (persistant)
- Reduce-only sur close

### Circuit Breaker
- 3 erreurs d'ordre consécutives → `TRADING_ENABLED=false`
- Alerte Telegram automatique

## 📱 Notifications Telegram

### Queue Unique
- 1 message / ~1s
- Priorités: high/medium/low
- Retry avec backoff exponentiel
- Respect strict `retry_after` (429)

### Messages
- Détection nouveau listing
- Trade exécuté
- Exit planifié/exécuté
- Erreurs de trading

## 🗄️ Base de Données

### Migrations SQLite
```bash
migrations/
├── 001_init.sql          # Schéma de base
└── 002_add_perp_catalog.sql  # Catalogue perpétuels
```

### Tables Principales
- `baseline_kr`: Tokens KR Bithumb
- `processed_events`: Événements traités (dédup)
- `cooldowns`: Anti-retrade 24h
- `scheduled_exits`: Exits planifiés
- `perp_catalog`: Catalogue perpétuels
- `instance_lock`: Singleton leader

## 🧪 Tests

### Tests Unitaires
```bash
npm run test:unit
```

### Tests d'Intégration
```bash
npm run test:integration
```

### Simulation
```bash
npm run simulate:notice  # Simule détection T0
npm run simulate:ws      # Simule détection T2
```

## 🚢 Déploiement Railway

### Configuration
```bash
# railway.json
{
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Variables d'Environnement
- `RAILWAY_ENVIRONMENT=production`
- `PORT=3030`
- Toutes les clés API et tokens

## 📈 Monitoring

### Métriques Clés
- **Latences p95**: detected→order_sent, order_sent→ack
- **WebSocket**: reconnects, warm-up time
- **Exits**: pending, executed, failed
- **Perpétuels**: bybit, hl, binance, total

### Alertes
- Baseline KR < 100 tokens
- Leadership unhealthy
- Base de données inaccessible
- Trop d'erreurs consécutives

## 🔒 Sécurité

### Singleton Pattern
- 1 seule instance leader
- Mode observateur pour les autres
- Heartbeat et récupération automatique

### Anti-Spam
- Cooldown 24h par base
- Debounce WebSocket
- Double-check REST
- Mutex par base

### Validation
- EventId déterministe (SHA256)
- Pas de timestamp courant
- Validation ENV stricte
- Fail fast sur erreurs critiques

## 🐛 Dépannage

### Problèmes Courants
1. **Baseline KR vide**: Vérifier connectivité Bithumb
2. **Leadership perdu**: Vérifier instance_lock en DB
3. **WebSocket déconnecté**: Vérifier logs reconnect
4. **Migrations échouées**: Vérifier permissions DB

### Logs Importants
- `=== BOT DÉMARRÉ AVEC SUCCÈS ===`
- `Leadership acquis avec succès`
- `Baseline KR construite: X tokens`
- `Nouveau listing détecté via X`

## 📝 Changelog

### v2.0.0 - Bithumb-only
- Architecture T0+T2 complète
- SingletonGuard avec leader/observateur
- Migrations SQLite versionnées
- PerpCatalog multi-exchange
- TelegramService avec queue
- Endpoints /health et /metrics
- Suppression Upbit et legacy

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature
3. Suivre les règles de codage
4. Tests unitaires et intégration
5. Pull request avec description

## 📄 Licence

ISC License

---

**⚠️ Avertissement**: Ce bot est destiné à des fins éducatives et de recherche. Le trading automatique comporte des risques financiers importants.
