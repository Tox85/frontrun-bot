# 🚀 Système Unifié EventId - Implémentation Complète

## 📋 Vue d'ensemble

Ce document décrit l'implémentation complète du système unifié d'eventId avec déduplication idempotente et gating timing pour le bot de trading Bithumb.

## 🏗️ Architecture

### Composants principaux

1. **`src/core/EventId.ts`** - Builder centralisé d'eventId
2. **`src/core/Timing.ts`** - Classification timing (live/future/stale)
3. **`src/core/EventStore.ts`** - Gestion des événements et déduplication
4. **`src/watchers/NoticeHandler.ts`** - Handler principal des notices
5. **Migration 007** - Schéma unifié de la base de données

### Flux de données

```
T0 (Notice) → buildEventId() → tryMarkProcessed() → Gating → Trade/Notify
T2 (WebSocket) → buildEventId() → tryMarkProcessed() → Cross-source cooldown
```

## 🔑 EventId Unifié

### Format
```typescript
sha256(source|base|url|markets|tradeTimeUtc)
```

### Sources supportées
- `bithumb.notice` - Notices T0
- `bithumb.ws` - WebSocket T2

### Exemple
```typescript
const eventId = buildEventId({
  source: 'bithumb.notice',
  base: 'TOWNS',
  url: 'https://www.bithumb.com/notice/view/123',
  markets: ['KRW'],
  tradeTimeUtc: '2024-01-01T12:00:00Z'
});
```

## ⏰ Gating Timing

### Classification automatique
- **`future`** : `tradeTimeUtc > now` → Notify-only
- **`live`** : `|now - tradeTimeUtc| ≤ LIVE_WINDOW_MS` → Trade pipeline
- **`stale`** : Au-delà de la fenêtre live → Log only

### Configuration
```bash
LIVE_WINDOW_MS=120000  # 120 secondes par défaut
```

## 🚫 Déduplication Idempotente

### Mécanisme
- `INSERT OR IGNORE` atomique
- Vérification des changements de ligne
- Logs clairs : `🆕 [NEW]` / `⏭️ [DEDUP]`

### Exemple de log
```
T0 candidate base=TOWNS eventId=49d227e5...
🆕 [NEW] TOWNS (live) — 49d227e5...
🎯 [TRADE] Ouverture position long HL sur TOWNS
✅ Opened long HL on TOWNS

T0 candidate base=TOWNS eventId=49d227e5...
⏭️ [DEDUP] DUPLICATE 49d227e5... base=TOWNS — SKIP
```

## 🗄️ Schéma de base de données

### Table `processed_events`
```sql
CREATE TABLE processed_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('bithumb.notice', 'bithumb.ws')),
  base TEXT NOT NULL,
  url TEXT,
  markets TEXT, -- JSON stringifié
  trade_time_utc TEXT, -- ISO string
  raw_title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table `processed_bases`
```sql
CREATE TABLE processed_bases (
  base TEXT PRIMARY KEY,
  last_acted_at DATETIME NOT NULL,
  last_event_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔄 Cross-source Cooldown

### Principe
- Prévention des doubles trades entre T0 et T2
- Cooldown configurable (24h par défaut)
- Vérification avant exécution

### Utilisation
```typescript
// Vérifier si une base a été tradée récemment
const recentlyTraded = await eventStore.isBaseRecentlyTraded(base, 24);

// Marquer une base comme tradée
await eventStore.markBaseAsTraded(base, eventId);
```

## 📊 Métriques et Monitoring

### Endpoint `/metrics`
```json
{
  "unified": {
    "t0_live_new": 0,
    "t0_future": 0,
    "t0_stale": 0,
    "t0_dup_skips": 0,
    "trades_opened": 0,
    "ws_reconnects": 0
  }
}
```

### Endpoint `/health`
```json
{
  "status": "healthy",
  "baseline": {
    "krw_count": 0,
    "sanity": false
  },
  "detection": {
    "t0_active": true,
    "t2_active": true
  }
}
```

## 🧪 Tests et Validation

### Scripts de test
- `npm run test-dedup` - Test de déduplication
- `npm run db:dump` - Export des données
- `npm run simulate:notice` - Simulation de notices

### Validation automatique
- TypeScript compilation ✅
- Tests unitaires ✅
- Intégration complète ✅
- Cas limites validés ✅

## 🚀 Déploiement

### Prérequis
1. Base de données SQLite avec migrations appliquées
2. Variables d'environnement configurées
3. Services externes (Telegram, Hyperliquid) opérationnels

### Commandes
```bash
# Compilation
npm run build

# Démarrage en production
npm run start:prod

# Démarrage en développement
npm run dev

# Vérification des migrations
npm run migrate
```

## 🔧 Configuration

### Variables d'environnement
```bash
# Timing
LIVE_WINDOW_MS=120000

# Base de données
SQLITE_PATH=./data/bot.db

# API
HTTP_PORT=3001
```

### Fichiers de configuration
- `config.production.testnet.env` - Configuration production
- `migrations/` - Scripts de migration
- `src/config/` - Configuration TypeScript

## 📈 Monitoring et Maintenance

### Logs à surveiller
- `🆕 [NEW]` - Nouveaux événements
- `⏭️ [DEDUP]` - Déduplications
- `🎯 [TRADE]` - Ouvertures de positions
- `✅ Opened long HL` - Trades réussis

### Métriques clés
- Taux de déduplication
- Latence de traitement
- Nombre de trades ouverts
- Reconnections WebSocket

### Maintenance
- Vérification périodique des métriques
- Nettoyage des anciens événements si nécessaire
- Monitoring de la santé du système

## 🎉 Résumé des fonctionnalités

✅ **EventId déterministe et stable**
✅ **Classification timing automatique**
✅ **Déduplication idempotente**
✅ **Gating timing configurable**
✅ **Routing intelligent (trade/notify/log)**
✅ **Cross-source cooldown**
✅ **Schéma unifié**
✅ **Métriques et monitoring**
✅ **Logs clairs et structurés**
✅ **Tests complets et validation**

## 🚀 Statut : PRÊT POUR LA PRODUCTION

Le système unifié est entièrement implémenté, testé et validé. Il respecte toutes les spécifications demandées et est prêt pour le déploiement en production.

---

*Document généré le : 2025-08-15*
*Version : 2.0.0*
*Statut : ✅ COMPLÈTE*
