# Configuration des Variables d'Environnement

Ce document décrit toutes les variables d'environnement nécessaires pour faire fonctionner le Frontrun Bot, avec un focus sur la compatibilité Railway.

## 🚂 Variables Railway vs Local

### Variables d'Environnement Railway
Dans Railway, définissez ces variables dans **Settings > Variables** :

```bash
# Environnement
NODE_ENV=production
RAILWAY_ENVIRONMENT=production

# Port (Railway définit automatiquement PORT)
PORT=8080

# Hyperliquid
HL_ENABLED=1
HL_TESTNET=1
HYPERLIQUID_WALLET_ADDRESS=0x...
HYPERLIQUID_PRIVATE_KEY=0x...

# Exchanges
UPBIT_ENABLED=1
BITHUMB_ENABLED=1
BINANCE_ENABLED=0
BYBIT_ENABLED=0

# Telegram
TELEGRAM_ENABLED=1
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Debug
ENVZ_ENABLED=1
```

### Variables d'Environnement Local (.env)
```bash
# Environnement
NODE_ENV=development

# Port
PORT=3000

# Hyperliquid
HL_ENABLED=1
HL_TESTNET=1
HYPERLIQUID_WALLET_ADDRESS=0x...
HYPERLIQUID_PRIVATE_KEY=0x...

# Exchanges
UPBIT_ENABLED=1
BITHUMB_ENABLED=1
BINANCE_ENABLED=0
BYBIT_ENABLED=0

# Telegram
TELEGRAM_ENABLED=1
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Debug
ENVZ_ENABLED=0
```

## 📋 Tableau Complet des Variables

| Variable | Type | Valeurs Acceptées | Défaut | Description |
|----------|------|-------------------|---------|-------------|
| **Environnement** |
| `NODE_ENV` | string | `development`, `production` | `development` | Environnement d'exécution |
| `RAILWAY_ENVIRONMENT` | string | `production` | - | Détecte automatiquement Railway |
| `PORT` | number | 1-65535 | `3000` | Port du serveur de santé |
| **Hyperliquid** |
| `HL_ENABLED` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Active le trading Hyperliquid |
| `HL_TESTNET` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Utilise le testnet Hyperliquid |
| `HYPERLIQUID_WALLET_ADDRESS` | string | Adresse Ethereum | - | Adresse du wallet Hyperliquid |
| `HYPERLIQUID_PRIVATE_KEY` | string | Clé privée hex | - | Clé privée du wallet |
| `HL_API_URL` | string | URL API | Auto | URL de l'API Hyperliquid |
| `HL_WS_URL` | string | URL WebSocket | Auto | URL WebSocket Hyperliquid |
| **Exchanges** |
| `UPBIT_ENABLED` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Active la surveillance Upbit |
| `BITHUMB_ENABLED` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Active la surveillance Bithumb |
| `BINANCE_ENABLED` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Active le trading Binance |
| `BYBIT_ENABLED` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Active le trading Bybit |
| **Binance** |
| `BINANCE_API_KEY` | string | Clé API | - | Clé API Binance |
| `BINANCE_SECRET` | string | Secret API | - | Secret API Binance |
| **Bybit** |
| `BYBIT_API_KEY` | string | Clé API | - | Clé API Bybit |
| `BYBIT_SECRET` | string | Secret API | - | Secret API Bybit |
| **Telegram** |
| `TELEGRAM_ENABLED` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Active les notifications Telegram |
| `TELEGRAM_BOT_TOKEN` | string | Token bot | - | Token du bot Telegram |
| `TELEGRAM_CHAT_ID` | string | ID chat | - | ID du chat Telegram |
| **Trading** |
| `TRADE_AMOUNT_USDT` | number | > 0 | `400` | Montant USDT par trade |
| `LEVERAGE` | number | 1-100 | `20` | Levier par défaut |
| `STOP_LOSS_PERCENT` | number | 1-100 | `5` | Stop loss en pourcentage |
| `POSITION_SIZE_USDC` | number | > 0 | `400` | Taille de position en USDC |
| **Risk Management** |
| `RISK_PER_TRADE_USDC_DEFAULT` | number | > 0 | `0.5` | Risque par trade en USDC |
| `RISK_PCT_OF_BAL` | number | 0-1 | `0.04` | Pourcentage de risque du solde |
| `MAX_LEVERAGE_DEFAULT` | number | > 0 | `25` | Levier maximum autorisé |
| `ORDER_TIMEOUT_MS` | number | > 0 | `15000` | Timeout des ordres en ms |
| `PERP_CHECK_TIMEOUT_MS` | number | > 0 | `200` | Timeout des vérifications en ms |
| `DRY_RUN` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Mode simulation (pas de vrais trades) |
| **Monitoring** |
| `ENABLE_GLOBAL_MONITORING` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Active la surveillance globale |
| `ENABLE_KOREAN_LOGS` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Active les logs détaillés coréens |
| `ENABLE_VERBOSE_LOGS` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Active les logs verbeux |
| **Debug** |
| `ENVZ_ENABLED` | boolean | `1`, `0`, `true`, `false`, `yes`, `no`, `on`, `off` | `false` | Active l'endpoint /envz |

## 🔧 Formats Booléens Supportés

Le bot accepte plusieurs formats pour les variables booléennes :

- **Vrai** : `1`, `true`, `yes`, `on` (insensible à la casse)
- **Faux** : `0`, `false`, `no`, `off` (insensible à la casse)

**Exemples valides :**
```bash
HL_ENABLED=1          # ✅ Activé
HL_ENABLED=true       # ✅ Activé
HL_ENABLED=YES        # ✅ Activé
HL_ENABLED=On         # ✅ Activé

HL_ENABLED=0          # ✅ Désactivé
HL_ENABLED=false      # ✅ Désactivé
HL_ENABLED=NO         # ✅ Désactivé
HL_ENABLED=Off        # ✅ Désactivé
```

## 🚨 Validation et Erreurs

### Variables Critiques
Si ces variables sont manquantes avec leurs services activés, le bot s'arrêtera :

- `HYPERLIQUID_WALLET_ADDRESS` si `HL_ENABLED=1`
- `BINANCE_API_KEY` et `BINANCE_SECRET` si `BINANCE_ENABLED=1`
- `BYBIT_API_KEY` et `BYBIT_SECRET` si `BYBIT_ENABLED=1`
- `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` si `TELEGRAM_ENABLED=1`

### Messages d'Erreur
Le bot affichera des messages clairs :
```
❌ Erreurs de configuration critiques:
  - HL_ENABLED=true mais HYPERLIQUID_WALLET_ADDRESS manquant
  - BINANCE_ENABLED=true mais clés API manquantes
```

## 🧪 Test Local Mode Railway

Pour tester le comportement Railway localement :

```bash
npm run prod:local
```

Ce script :
1. Simule l'environnement Railway
2. Désactive le chargement du fichier .env
3. Injecte toutes les variables nécessaires
4. Construit et démarre le bot

## 📊 Endpoints de Diagnostic

### Serveur de Santé
- `GET /health` - Statut de santé général
- `GET /ready` - Prêt à recevoir du trafic
- `GET /ping` - Ping pour Railway
- `GET /status` - Statut des services
- `GET /envz` - Configuration (si `ENVZ_ENABLED=1`)

### Endpoint /envz
```bash
# Activer
ENVZ_ENABLED=1

# Utilisation
curl https://votre-app.railway.app/envz
```

**Réponse :**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "isRailway": true,
  "config": {
    "HL_ENABLED": true,
    "UPBIT_ENABLED": true,
    "BITHUMB_ENABLED": true,
    "PORT": 8080,
    // ... autres variables (sans secrets)
  }
}
```

## 🔍 Dépannage Railway

### Problèmes Courants

1. **Variables non reconnues**
   - Vérifiez l'orthographe exacte
   - Utilisez les formats booléens supportés
   - Redémarrez le service après modification

2. **Port non accessible**
   - Railway définit automatiquement `PORT`
   - Vérifiez que le service écoute sur `0.0.0.0:PORT`

3. **Services désactivés**
   - Vérifiez `*_ENABLED=1`
   - Assurez-vous que les variables requises sont définies

4. **Logs confus**
   - Activez `ENVZ_ENABLED=1`
   - Vérifiez l'endpoint `/envz`
   - Consultez les logs Railway

### Vérification Rapide
```bash
# 1. Vérifier la configuration
curl https://votre-app.railway.app/envz

# 2. Vérifier la santé
curl https://votre-app.railway.app/health

# 3. Vérifier le statut des services
curl https://votre-app.railway.app/status
```

## 📝 Migration depuis l'Ancien Système

### Avant (ancien config.ts)
```typescript
// ❌ Ancien système
hlEnabled: process.env.HL_ENABLED === '1',
binanceEnabled: process.env.BINANCE_ENABLED === '1',
```

### Après (nouveau config/env.ts)
```typescript
// ✅ Nouveau système centralisé
import { CONFIG } from './config/env';

if (CONFIG.HL_ENABLED) { ... }
if (CONFIG.BINANCE_ENABLED) { ... }
```

### Avantages
- ✅ Validation centralisée
- ✅ Formats booléens multiples
- ✅ Détection automatique Railway
- ✅ Messages d'erreur clairs
- ✅ Endpoint de diagnostic
- ✅ Pas de chargement .env en production
