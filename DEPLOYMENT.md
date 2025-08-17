# 🚀 Guide de Déploiement Production

## 📋 Prérequis

### **Système**
- Node.js 20+ 
- Docker & Docker Compose (optionnel)
- PM2 (optionnel)
- 2GB RAM minimum
- 10GB espace disque

### **Variables d'environnement**
```bash
# Configuration de base
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Base de données
DATABASE_PATH=./data/bot.db

# API Bithumb
BITHUMB_API_KEY=your_api_key
BITHUMB_SECRET_KEY=your_secret_key

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# Trading (Hyperliquid)
HYPERLIQUID_API_KEY=your_api_key
HYPERLIQUID_SECRET_KEY=your_secret_key

# Configuration
DEV_TOOLS=false
DRY_RUN=false
TRADING_ENABLED=true
MAX_NOTICE_AGE_MIN=180
```

## 🚀 Déploiement Rapide

### **1. Déploiement Direct (Recommandé)**
```bash
# Vérifier la configuration
npm run typecheck

# Lancer le déploiement automatisé
npm run deploy:prod
```

### **2. Déploiement Docker**
```bash
# Démarrer avec Docker Compose
npm run deploy:docker

# Voir les logs
npm run deploy:docker:logs

# Arrêter
npm run deploy:docker:stop
```

## 🔧 Déploiement Manuel

### **Étape 1: Préparation**
```bash
# Cloner le repository
git clone <repository-url>
cd frontrun-bot

# Installer les dépendances
npm ci --only=production

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos clés API
```

### **Étape 2: Build et Tests**
```bash
# Vérification des types
npm run typecheck

# Tests
npm test

# Build
npm run build
```

### **Étape 3: Base de données**
```bash
# Migrations
npm run migrate

# Vérification
npm run verify:deployment
```

### **Étape 4: Démarrage**
```bash
# Démarrage direct
npm start

# Ou avec PM2 (recommandé pour production)
pm2 start dist/main.js --name frontrun-bot
pm2 save
pm2 startup
```

## 🐳 Déploiement Docker Avancé

### **Configuration Docker**
```bash
# Build de l'image
docker build -f Dockerfile.prod -t frontrun-bot:latest .

# Démarrer le conteneur
docker run -d \
  --name frontrun-bot \
  --restart unless-stopped \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  frontrun-bot:latest
```

### **Docker Compose avec Monitoring**
```bash
# Démarrer tous les services
docker-compose -f docker-compose.prod.yml up -d

# Services inclus:
# - frontrun-bot (port 3001)
# - Prometheus (port 9090)
# - Grafana (port 3000)
# - Nginx (port 80/443)
```

## 📊 Monitoring et Observabilité

### **Endpoints de santé**
- **Health Check**: `GET /health`
- **Métriques**: `GET /metrics`
- **Dashboard**: `GET /dashboard`
- **Dashboard HTML**: `GET /dashboard/html`

### **Métriques Prometheus**
Le bot expose automatiquement des métriques au format Prometheus :
- Métriques système (CPU, mémoire)
- Métriques métier (détections, trades)
- Métriques de performance (latences, débits)

### **Grafana Dashboard**
Accédez à Grafana sur `http://localhost:3000` :
- Login: `admin`
- Password: `admin123`
- Dashboards pré-configurés inclus

## 🔒 Sécurité

### **Bonnes pratiques**
- ✅ Utilisateur non-root dans Docker
- ✅ Variables d'environnement sécurisées
- ✅ Validation des données d'entrée
- ✅ Rate limiting sur les API
- ✅ Logs structurés sans secrets

### **Firewall**
```bash
# Autoriser uniquement le port du bot
ufw allow 3001/tcp

# Si Nginx est utilisé
ufw allow 80/tcp
ufw allow 443/tcp
```

## 📈 Scaling et Performance

### **Ressources recommandées**
- **CPU**: 1-2 cœurs
- **RAM**: 2-4GB
- **Disque**: 20GB SSD
- **Réseau**: 100Mbps+

### **Optimisations**
- Base de données SQLite avec WAL
- Logs avec rotation automatique
- Métriques avec agrégation
- Circuit breakers pour les API externes

## 🚨 Troubleshooting

### **Problèmes courants**

#### **Bot ne démarre pas**
```bash
# Vérifier les logs
npm run deploy:docker:logs

# Vérifier la configuration
npm run typecheck

# Vérifier la base de données
npm run migrate
```

#### **Erreurs de connexion API**
```bash
# Vérifier les clés API
echo $BITHUMB_API_KEY

# Tester la connectivité
curl -I https://api.bithumb.com/public/notice
```

#### **Problèmes de performance**
```bash
# Vérifier les métriques
curl http://localhost:3001/metrics

# Tester la charge
npm run test:load:advanced
```

### **Logs et Debug**
```bash
# Logs en temps réel
tail -f logs/bot.log

# Logs structurés
grep "ERROR" logs/bot.log | jq

# Métriques système
curl http://localhost:3001/health | jq
```

## 🔄 Mise à jour

### **Processus de mise à jour**
```bash
# 1. Arrêter le bot
pm2 stop frontrun-bot
# ou
docker stop frontrun-bot

# 2. Mettre à jour le code
git pull origin main

# 3. Rebuild et redéployer
npm run deploy:prod
# ou
npm run deploy:docker
```

### **Rollback**
```bash
# Retour à la version précédente
git checkout HEAD~1
npm run deploy:prod
```

## 📞 Support

### **En cas de problème**
1. Vérifier les logs : `npm run deploy:docker:logs`
2. Vérifier la santé : `curl http://localhost:3001/health`
3. Tester les composants : `npm run test:dashboard`
4. Consulter la documentation

### **Métriques critiques à surveiller**
- Taux de succès des détections
- Latence des API externes
- Utilisation mémoire et CPU
- Nombre de trades exécutés
- État des circuit breakers

---

**🎉 Votre bot est maintenant prêt pour la production !**