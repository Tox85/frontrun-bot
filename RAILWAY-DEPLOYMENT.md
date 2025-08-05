# 🚀 Déploiement Railway - Mise à Jour

## 📋 Variables d'Environnement Requises

### **🔐 Hyperliquid (Principal)**
```env
HYPERLIQUID_ENABLED=true
HYPERLIQUID_WALLET_ADDRESS=0xVOTRE_WALLET
HYPERLIQUID_PRIVATE_KEY=VOTRE_CLE_PRIVEE
IS_DEMO=false
```

### **📱 Telegram (Notifications)**
```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=VOTRE_TOKEN
TELEGRAM_CHAT_ID=VOTRE_CHAT_ID
```

### **💰 Trading (Configuration)**
```env
TRADE_AMOUNT_USDT=400
LEVERAGE=20
STOP_LOSS_PERCENT=5
AUTO_CLOSE_MINUTES=3
```

### **⚙️ Application**
```env
NODE_ENV=production
PORT=3000
```

## 🔄 Processus de Mise à Jour

### **1. Vérifier Railway Dashboard**
- Aller sur [railway.app](https://railway.app)
- Sélectionner votre projet existant
- Vérifier que le repo GitHub est connecté

### **2. Mettre à Jour les Variables**
- Aller dans l'onglet "Variables"
- Vérifier/corriger toutes les variables ci-dessus
- **Important :** `IS_DEMO=false` pour le trading réel

### **3. Déclencher le Redéploiement**
- Aller dans l'onglet "Deployments"
- Cliquer sur "Deploy Now" ou faire un push sur GitHub
- Le bot se mettra à jour automatiquement

### **4. Vérifier les Logs**
- Aller dans l'onglet "Logs"
- Vérifier que le bot démarre correctement
- Attendre les notifications Telegram

## ✅ Vérifications Post-Déploiement

### **📱 Notifications Telegram**
```
🤖 Bot opérationnel
📊 Initialisation des modules avancés...
🛡️ RiskManager activé
📰 Surveillance articles Bithumb désactivée
✅ Bot opérationnel - Surveillance active
```

### **🌐 Health Check**
- Vérifier : `https://votre-app.railway.app/health`
- Doit retourner : `{"status":"ok","timestamp":"..."}`

### **📊 Monitoring**
- Recevoir le rapport de risque initial
- Vérifier les notifications de démarrage
- Surveiller les premiers listings détectés

## 🚨 Points d'Attention

### **⚠️ Avant le Déploiement**
1. **Vérifier les clés** Hyperliquid
2. **Confirmer** `IS_DEMO=false`
3. **Tester** les notifications Telegram
4. **Vérifier** la balance USDC

### **🛡️ Après le Déploiement**
1. **Surveiller** les logs Railway
2. **Vérifier** les notifications Telegram
3. **Tester** avec un petit montant
4. **Monitorer** les premiers trades

## 🔧 Dépannage

### **❌ Erreurs Communes**
- **Authentification échouée** → Vérifier clés Hyperliquid
- **Telegram non reçu** → Vérifier token et chat ID
- **Bot ne démarre pas** → Vérifier variables d'environnement

### **📞 Support**
- Logs Railway pour diagnostics
- Notifications Telegram pour status
- Health check pour monitoring 