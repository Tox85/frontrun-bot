# 🚀 Guide de Déploiement Rapide - Système Unifié EventId

## ⚡ Déploiement en 5 minutes

### 1. Vérification pré-déploiement
```bash
# Compilation
npm run build

# Vérification des types
npm run typecheck

# Vérification des migrations
npm run migrate
```

### 2. Démarrage en production
```bash
# Mode production
npm run start:prod

# Ou mode développement
npm run dev
```

### 3. Validation rapide
```bash
# Test de santé
curl http://localhost:3001/health

# Test des métriques
curl http://localhost:3001/metrics

# Test de simulation
curl -X POST http://localhost:3001/simulate/notice \
  -H "Content-Type: application/json" \
  -d '{"base":"TEST","title":"Test","url":"https://test.com","markets":["KRW"]}'
```

## 🔍 Vérifications post-déploiement

### Logs attendus
```
✅ EventStore initialisé
✅ Database migrations completed
🌐 HTTP Server started on port 3001
🔍 Listing notice detected: "TOWNS 원화 마켓 추가"
⏭️ [DEDUP] DUPLICATE eventId... base=TOWNS — SKIP
```

### Métriques attendues
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

## 🚨 Dépannage rapide

### Problème : Serveur ne démarre pas
```bash
# Vérifier les logs
npm run dev

# Vérifier la base de données
npm run db:dump
```

### Problème : Erreurs de migration
```bash
# Réinitialiser les migrations
rm -rf data/bot.db
npm run migrate
```

### Problème : Déduplication ne fonctionne pas
```bash
# Tester manuellement
npm run test-dedup
```

## 📊 Monitoring en production

### Endpoints clés
- `/health` - Santé du système
- `/metrics` - Métriques unifiées
- `/status` - Statut détaillé
- `/baseline` - État de la baseline

### Alertes à configurer
- Serveur HTTP inaccessible
- Base de données corrompue
- Taux de déduplication anormal
- Latence de traitement élevée

## 🎯 Checklist de déploiement

- [ ] Compilation réussie (`npm run build`)
- [ ] Types validés (`npm run typecheck`)
- [ ] Migrations appliquées (`npm run migrate`)
- [ ] Serveur démarre (`npm run start:prod`)
- [ ] Endpoint `/health` répond
- [ ] Endpoint `/metrics` répond
- [ ] Logs de déduplication visibles
- [ ] Métriques unifiées exposées

## 🚀 Le système est prêt !

Le système unifié EventId est entièrement implémenté et validé. Il respecte toutes les spécifications :

✅ **EventId déterministe** (pas de Date.now())
✅ **Dédup idempotente** (INSERT OR IGNORE)
✅ **Gating timing** (live/future/stale)
✅ **Sources unifiées** (bithumb.notice/bithumb.ws)
✅ **Cross-source cooldown** (processed_bases)
✅ **Métriques exposées** (/metrics)
✅ **Logs clairs** (🆕 [NEW] / ⏭️ [DEDUP])

---

*Guide généré le : 2025-08-15*
*Version : 2.0.0*
*Statut : ✅ PRÊT POUR LA PRODUCTION*
