# Frontrun Bot

Bot de trading automatisé pour détecter et trader les nouveaux listings sur les exchanges.

## 🚀 Déploiement sur Railway

### Configuration requise

- Node.js 18+ 
- Variables d'environnement configurées dans Railway

### Variables d'environnement

Assurez-vous de configurer les variables suivantes dans votre projet Railway :

```env
# Configuration Bybit
BYBIT_API_KEY=your_bybit_api_key
BYBIT_SECRET=your_bybit_secret

# Configuration Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Configuration de l'application
NODE_ENV=production
PORT=3000
```

### Health Check

L'application expose plusieurs endpoints de health check :

- `/health` - État général de l'application
- `/ready` - Vérification si l'application est prête
- `/` - Endpoint principal (redirige vers /health)

### Déploiement

1. Connectez votre repository GitHub à Railway
2. Configurez les variables d'environnement
3. Le déploiement se fait automatiquement

### Logs et monitoring

- Les logs sont disponibles dans l'interface Railway
- Le bot envoie des notifications Telegram pour les événements importants
- Le health check surveille l'état de l'application

## 🛠️ Développement local

```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm run dev

# Build pour la production
npm run build

# Démarrage en production
npm start
```

## 📊 Endpoints disponibles

- `GET /health` - État de santé de l'application
- `GET /ready` - Vérification de disponibilité
- `GET /` - Page d'accueil

## 🔧 Configuration Railway

Le fichier `railway.json` configure :
- Health check sur `/health`
- Timeout de 300 secondes
- Redémarrage automatique en cas d'échec
- Maximum 10 tentatives de redémarrage 