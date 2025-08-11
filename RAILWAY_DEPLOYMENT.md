# 🚂 Guide de Déploiement Railway - Frontrun Bot

## 📋 Variables d'Environnement Requises

### 🔧 Configuration de Base
```bash
RAILWAY_ENVIRONMENT=production
NODE_ENV=production
```

### 💱 Activation des Exchanges
```bash
# Au moins UN de ces exchanges doit être activé
HL_ENABLED=1                    # Hyperliquid
BINANCE_ENABLED=1               # Binance
BYBIT_ENABLED=1                 # Bybit

# Au moins UNE surveillance coréenne doit être activée
UPBIT_ENABLED=1                 # Upbit (polling)
BITHUMB_ENABLED=1              # Bithumb (WebSocket)
```

### 🔑 Clés API Hyperliquid
```bash
HL_API_KEY=your_api_key_here
HL_SECRET=your_secret_here
HL_WALLET=your_wallet_address
HL_TESTNET=false
```

### 🔑 Clés API Binance
```bash
BINANCE_API_KEY=your_api_key_here
BINANCE_SECRET=your_secret_here
IS_DEMO=false
```

### 🔑 Clés API Bybit
```bash
BYBIT_API_KEY=your_api_key_here
BYBIT_SECRET=your_secret_here
```

### 📱 Configuration Telegram
```bash
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 💰 Configuration Trading
```bash
TRADE_AMOUNT_USDT=400
LEVERAGE=20
STOP_LOSS_PERCENT=5
RISK_PER_TRADE_USDC_DEFAULT=0.5
RISK_PCT_OF_BAL=0.04
MAX_LEVERAGE_DEFAULT=25
ORDER_TIMEOUT_MS=15000
PERP_CHECK_TIMEOUT_MS=200
DRY_RUN=0
```

### 🌍 Surveillance Globale
```bash
ENABLE_GLOBAL_MONITORING=true
ENABLE_KOREAN_LOGS=false
```

## 🚀 Déploiement

1. **Connecter votre repo GitHub à Railway**
2. **Configurer toutes les variables d'environnement ci-dessus**
3. **Déployer automatiquement**

## 🔍 Vérification du Déploiement

Le bot affichera un résumé de configuration au démarrage :
```
🚂 Configuration Railway détectée:
  - Hyperliquid: ✅
  - Binance: ✅
  - Bybit: ✅
  - Upbit: ✅
  - Bithumb: ✅
  - Telegram: ✅
  - Monitoring Global: ✅
```

## ❌ Problèmes Courants

### "Aucun exchange activé"
- Vérifiez que `HL_ENABLED=1`, `BINANCE_ENABLED=1`, ou `BYBIT_ENABLED=1`

### "Aucune surveillance coréenne activée"
- Vérifiez que `UPBIT_ENABLED=1` ou `BITHUMB_ENABLED=1`

### "Mode surveillance uniquement"
- Le bot fonctionne mais ne peut pas trader sans clés API valides

## 📊 Logs Optimisés

En mode Railway, les logs sont automatiquement optimisés :
- Pas de logs de polling répétitifs
- Logs de surveillance réduits
- Focus sur les événements importants
