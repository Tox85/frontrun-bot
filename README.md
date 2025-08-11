# 🚀 Frontrun Bot - Configuration Railway

Ce bot de trading automatique est maintenant **100% compatible Railway** avec une configuration centralisée et robuste.

## 🎯 Problème Résolu

**Avant** : Variables d'environnement désactivées en production Railway malgré `*_ENABLED=1`  
**Maintenant** : Configuration centralisée avec validation robuste et détection automatique Railway ✅

## 🚂 Utilisation Rapide

### 1. Démarrage Local (Mode Développement)
```bash
npm install
npm start
```

### 2. Test Mode Railway Localement
```bash
npm run prod:local
```
Ce script simule l'environnement Railway sans affecter votre configuration locale.

### 3. Déploiement Railway
```bash
npm run build
railway up
```

## 🔧 Configuration

### Variables d'Environnement Principales

| Variable | Description | Exemple |
|----------|-------------|---------|
| `HL_ENABLED` | Active Hyperliquid | `1`, `true`, `yes` |
| `UPBIT_ENABLED` | Active Upbit | `1`, `true`, `yes` |
| `BITHUMB_ENABLED` | Active Bithumb | `1`, `true`, `yes` |
| `TELEGRAM_ENABLED` | Active Telegram | `1`, `true`, `yes` |
| `ENVZ_ENABLED` | Active endpoint diagnostic | `1`, `true`, `yes` |

### Formats Booléens Supportés
- **Vrai** : `1`, `true`, `yes`, `on` (insensible à la casse)
- **Faux** : `0`, `false`, `no`, `off` (insensible à la casse)

## 📊 Endpoints de Diagnostic

Le bot expose un serveur de santé sur le port configuré (défaut: 3000, Railway: 8080) :

- `GET /health` - Statut de santé général
- `GET /ready` - Prêt à recevoir du trafic
- `GET /ping` - Ping pour Railway
- `GET /status` - Statut des services
- `GET /envz` - Configuration complète (si `ENVZ_ENABLED=1`)

### Test des Endpoints
```bash
# Avec curl (Linux/Mac)
curl http://localhost:8080/health
curl http://localhost:8080/envz

# Avec PowerShell (Windows)
Invoke-WebRequest http://localhost:8080/health
Invoke-WebRequest http://localhost:8080/envz
```

## 🧪 Test Local Mode Railway

Le script `npm run prod:local` :
1. **Simule l'environnement Railway** (`NODE_ENV=production`, `RAILWAY_ENVIRONMENT=production`)
2. **Désactive le fichier .env** (`DOTENV_DISABLE=true`)
3. **Injecte toutes les variables nécessaires** via `set` commands
4. **Construit et démarre le bot** avec la configuration Railway

**Résultat attendu** :
```
🔧 Configuration Railway simulée:
  NODE_ENV: production
  RAILWAY_ENVIRONMENT: production
  PORT: 8080
  HL_ENABLED: 1
  UPBIT_ENABLED: 1
  BITHUMB_ENABLED: 1
  ENVZ_ENABLED: 1

🏥 Serveur de santé démarré sur le port 8080
   📍 Endpoints disponibles:
      - GET /health - Statut de santé
      - GET /ready - Prêt à recevoir du trafic
      - GET /ping - Ping pour Railway
      - GET /envz - Configuration (si ENVZ_ENABLED=true)
      - GET /status - Statut des services
```

## 🚨 Validation de Configuration

Le bot valide automatiquement la configuration au démarrage :

### Variables Critiques
- Si `HL_ENABLED=true` → `HYPERLIQUID_WALLET_ADDRESS` requis
- Si `BINANCE_ENABLED=true` → `BINANCE_API_KEY` et `BINANCE_SECRET` requis
- Si `TELEGRAM_ENABLED=true` → `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` requis

### Messages d'Erreur Clairs
```
❌ Erreurs de configuration critiques:
  - HL_ENABLED=true mais HYPERLIQUID_WALLET_ADDRESS manquant
  - BINANCE_ENABLED=true mais clés API manquantes

🚨 Arrêt du bot en production à cause d'erreurs de configuration
```

## 📁 Structure des Fichiers

```
frontrun-bot/
├── src/
│   ├── config/
│   │   └── env.ts          # Configuration centralisée
│   ├── healthCheck.ts      # Serveur de santé
│   ├── main.ts            # Point d'entrée principal
│   └── ...                # Autres modules
├── scripts/
│   └── prod-local.bat     # Script de test Railway
├── docs/
│   ├── ENVIRONMENT.md     # Documentation des variables
│   └── DEPLOY_CHECKLIST.md # Guide de déploiement
└── package.json
```

## 🔍 Dépannage

### Problème : Variables non reconnues
**Solution** : Vérifiez l'orthographe et utilisez les formats booléens supportés

### Problème : Services désactivés
**Solution** : Vérifiez `*_ENABLED=1` et les variables requises

### Problème : Port non accessible
**Solution** : Le bot écoute automatiquement sur `0.0.0.0:PORT`

### Problème : Logs confus
**Solution** : Activez `ENVZ_ENABLED=1` et utilisez l'endpoint `/envz`

## 📚 Documentation Complète

- **[Variables d'Environnement](docs/ENVIRONMENT.md)** - Guide complet des variables
- **[Guide de Déploiement](docs/DEPLOY_CHECKLIST.md)** - Checklist Railway étape par étape
- **[Configuration](src/config/env.ts)** - Code source de la configuration

## 🎉 Résultat Final

**Votre bot est maintenant :**
- ✅ **100% compatible Railway** avec détection automatique
- ✅ **Configuration centralisée** et validation robuste
- ✅ **Endpoints de diagnostic** pour le debugging
- ✅ **Script de test local** pour valider avant déploiement
- ✅ **Messages d'erreur clairs** en cas de problème
- ✅ **Documentation complète** pour le déploiement

**Plus de problèmes de variables désactivées en production !** 🚀

## 🚀 Prochaines Étapes

1. **Testez localement** avec `npm run prod:local`
2. **Vérifiez les endpoints** de diagnostic
3. **Déployez sur Railway** avec `railway up`
4. **Surveillez les logs** pour confirmer le bon fonctionnement

Votre bot est maintenant prêt pour la production Railway ! 🎯
