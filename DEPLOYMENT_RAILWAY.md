# 🚀 Guide de Déploiement Railway - Migration 009

## 📋 Problème résolu

**Erreur sur Railway :**
```
💥 Uncaught Exception: [Error: SQLITE_ERROR: table perp_catalog has no column named leverage_max]
```

**Cause :** La colonne `leverage_max` était manquante dans la table `perp_catalog` après la migration 003.

## ✅ Solution appliquée

**Migration 009** : `migrations/009_add_leverage_max.sql`
- Ajoute la colonne `leverage_max REAL DEFAULT 100` à `perp_catalog`
- Met à jour les enregistrements existants avec la valeur par défaut

## 🚀 Étapes de déploiement

### 1. Vérifier que le code est poussé
```bash
git status
git log --oneline -5
```

### 2. Redémarrer le service Railway
- Aller sur [Railway Dashboard](https://railway.app/dashboard)
- Sélectionner le projet `frontrun-bot-bithumb`
- Cliquer sur "Deploy" ou redémarrer le service

### 3. Vérifier les logs
Après le redémarrage, vérifier que :
- ✅ La migration 009 s'applique correctement
- ✅ Plus d'erreur `leverage_max`
- ✅ Le bot traite les notices TOWNS normalement

## 🔍 Vérification post-déploiement

### Logs attendus
```
🔄 Running database migrations...
📁 9 fichiers de migration trouvés
✅ 8 migrations déjà appliquées
✅ Migration 009: add_leverage_max appliquée
✅ Aucune migration en attente
```

### Test de fonctionnement
Le bot devrait maintenant :
- ✅ Traiter les notices TOWNS sans planter
- ✅ Rafraîchir le catalogue des perpétuels sans erreur
- ✅ Continuer à fonctionner en mode OBSERVER_MODE

## 📊 Monitoring

### Endpoints à vérifier
- `/health` : Vérifier que `sanity: true`
- `/metrics` : Vérifier que `perp_catalog.refresh_errors: 0`

### Logs à surveiller
- ✅ "Refresh du catalogue Bybit... terminé"
- ✅ "Refresh du catalogue Hyperliquid... terminé"
- ✅ "Refresh du catalogue Binance... terminé"

## 🚨 En cas de problème

### Si la migration échoue
```bash
# Vérifier le schéma actuel
npm run db:dump

# Vérifier les migrations appliquées
npm run migrate
```

### Si l'erreur persiste
1. Vérifier que la migration 009 est bien appliquée
2. Vérifier que le code déployé contient bien la migration
3. Redémarrer le service Railway

## 📝 Notes techniques

- **Colonne ajoutée** : `leverage_max REAL DEFAULT 100`
- **Valeur par défaut** : 100 (leverage maximum par défaut)
- **Compatibilité** : Rétrocompatible avec les données existantes
- **Performance** : Impact minimal, juste une colonne ajoutée

## 🎯 Résultat attendu

Après le déploiement, le bot devrait :
- ✅ Traiter les notices TOWNS sans erreur
- ✅ Continuer à fonctionner normalement
- ✅ Avoir un schéma de base de données cohérent
