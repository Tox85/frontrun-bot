# Frontrun Bot

Bot de trading automatique pour détecter et trader les nouveaux listings sur Hyperliquid.

## 🚀 Déploiement sur Railway

### Variables d'environnement requises

Créez un fichier `.env` basé sur `env.example` avec les variables suivantes :

#### Configuration Hyperliquid (optionnel)
```env
HYPERLIQUID_ENABLED=false
HYPERLIQUID_WALLET_ADDRESS=
HYPERLIQUID_PRIVATE_KEY=
IS_DEMO=true
```

#### Configuration Telegram (optionnel)
```env
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

#### Configuration Trading
```env
TRADE_AMOUNT_USDT=400
LEVERAGE=20
STOP_LOSS_PERCENT=5
```

### Modes de fonctionnement

#### Mode Surveillance (recommandé pour débuter)
- `HYPERLIQUID_ENABLED=false`
- Le bot détecte les nouveaux listings mais ne trade pas
- Parfait pour tester et surveiller

#### Mode Trading
- `HYPERLIQUID_ENABLED=true`
- `HYPERLIQUID_WALLET_ADDRESS` et `HYPERLIQUID_PRIVATE_KEY` configurés
- Le bot trade automatiquement les nouveaux listings

### Résolution du problème de crash

Le bot a été modifié pour être plus robuste :

1. **Gestion des erreurs améliorée** : Le bot ne plante plus si Hyperliquid n'est pas configuré
2. **Mode dégradé** : Le bot continue en mode surveillance même si le trading échoue
3. **Redémarrage automatique** : En cas d'erreur, le bot redémarre automatiquement
4. **Logs améliorés** : Messages plus clairs pour diagnostiquer les problèmes

### Commandes utiles

```bash
# Installation
npm install

# Build
npm run build

# Démarrage
npm start

# Développement
npm run dev
```

### Monitoring

Le bot inclut :
- Health check pour Railway
- Logs détaillés
- Notifications Telegram (si configuré)
- Monitoring des performances
- Gestion des risques

## 🔧 Configuration Railway

1. Connectez votre repo GitHub à Railway
2. Configurez les variables d'environnement dans l'interface Railway
3. Le bot se déploiera automatiquement

## 📊 Logs

Les logs sont disponibles dans l'interface Railway et incluent :
- Statut d'initialisation
- Détection de nouveaux listings
- Erreurs et avertissements
- Performances du bot 