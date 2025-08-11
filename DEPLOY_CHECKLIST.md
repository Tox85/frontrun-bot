# 🚂 Guide de Déploiement Railway

Ce document contient la checklist complète pour déployer le Frontrun Bot sur Railway sans problèmes.

## ✅ Checklist Pré-Déploiement

### 1. Configuration Locale
- [ ] Le bot fonctionne localement avec `npm start`
- [ ] Le bot fonctionne en mode production simulé avec `npm run prod:local`
- [ ] Tous les tests passent avec `npm test`
- [ ] La construction fonctionne avec `npm run build`

### 2. Variables d'Environnement
- [ ] `HL_ENABLED=1` si Hyperliquid est requis
- [ ] `UPBIT_ENABLED=1` si Upbit est requis
- [ ] `BITHUMB_ENABLED=1` si Bithumb est requis
- [ ] `BINANCE_ENABLED=1` si Binance est requis
- [ ] `BYBIT_ENABLED=1` si Bybit est requis
- [ ] `TELEGRAM_ENABLED=1` si Telegram est requis
- [ ] `ENVZ_ENABLED=1` pour le diagnostic

### 3. Clés et Secrets
- [ ] `HYPERLIQUID_WALLET_ADDRESS` défini (si HL_ENABLED=1)
- [ ] `HYPERLIQUID_PRIVATE_KEY` défini (si HL_ENABLED=1)
- [ ] `BINANCE_API_KEY` et `BINANCE_SECRET` (si BINANCE_ENABLED=1)
- [ ] `BYBIT_API_KEY` et `BYBIT_SECRET` (si BYBIT_ENABLED=1)
- [ ] `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` (si TELEGRAM_ENABLED=1)

## 🚀 Déploiement Railway

### 1. Connexion et Création
```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Créer un nouveau projet (si nécessaire)
railway init

# Ou lier à un projet existant
railway link
```

### 2. Configuration des Variables
```bash
# Définir les variables d'environnement
railway variables set NODE_ENV=production
railway variables set RAILWAY_ENVIRONMENT=production
railway variables set HL_ENABLED=1
railway variables set UPBIT_ENABLED=1
railway variables set BITHUMB_ENABLED=1
railway variables set ENVZ_ENABLED=1

# Définir les secrets (clés API, etc.)
railway variables set HYPERLIQUID_WALLET_ADDRESS=0x...
railway variables set HYPERLIQUID_PRIVATE_KEY=0x...
```

### 3. Déploiement
```bash
# Déployer
railway up

# Ou déployer et ouvrir
railway up --open
```

## 🔍 Vérification Post-Déploiement

### 1. Vérification de la Santé
```bash
# Vérifier que le service répond
curl https://votre-app.railway.app/health

# Vérifier le statut des services
curl https://votre-app.railway.app/status

# Vérifier la configuration (si ENVZ_ENABLED=1)
curl https://votre-app.railway.app/envz
```

### 2. Logs Railway
```bash
# Voir les logs en temps réel
railway logs

# Voir les logs d'une instance spécifique
railway logs --instance <instance-id>
```

### 3. Vérification des Variables
```bash
# Lister toutes les variables
railway variables

# Vérifier une variable spécifique
railway variables get HL_ENABLED
```

## 🚨 Dépannage

### Problème : Variables non reconnues
**Symptômes :**
- Services désactivés malgré `*_ENABLED=1`
- Erreurs de configuration au démarrage

**Solutions :**
1. Vérifier l'orthographe exacte des variables
2. Utiliser les formats booléens supportés (`1`, `true`, `yes`, `on`)
3. Redémarrer le service après modification des variables
4. Vérifier avec l'endpoint `/envz`

### Problème : Port non accessible
**Symptômes :**
- Erreurs de connexion
- Health checks échouent

**Solutions :**
1. Vérifier que `PORT` est défini (Railway le définit automatiquement)
2. S'assurer que le service écoute sur `0.0.0.0:PORT`
3. Vérifier les logs Railway pour les erreurs de port

### Problème : Services désactivés
**Symptômes :**
- Messages "désactivé" dans les logs
- Pas de surveillance des exchanges

**Solutions :**
1. Vérifier `*_ENABLED=1` pour les services requis
2. S'assurer que les variables de configuration sont définies
3. Vérifier les clés API et secrets si nécessaire

### Problème : Logs confus
**Symptômes :**
- Messages d'erreur peu clairs
- Difficulté à diagnostiquer les problèmes

**Solutions :**
1. Activer `ENVZ_ENABLED=1`
2. Utiliser l'endpoint `/envz` pour voir la configuration
3. Vérifier les logs Railway en temps réel

## 📊 Monitoring et Maintenance

### 1. Surveillance Continue
```bash
# Vérifier la santé toutes les 5 minutes
watch -n 300 'curl -s https://votre-app.railway.app/health'

# Vérifier le statut des services
curl https://votre-app.railway.app/status
```

### 2. Logs et Alertes
- Surveiller les logs Railway pour les erreurs
- Configurer des alertes sur les échecs de déploiement
- Vérifier régulièrement l'endpoint `/envz`

### 3. Mises à Jour
```bash
# Mettre à jour le code
git push origin main

# Redéployer automatiquement
railway up

# Vérifier le déploiement
railway status
```

## 🧪 Test Local Avant Déploiement

### 1. Mode Production Simulé
```bash
# Tester le comportement Railway localement
npm run prod:local
```

**Ce script :**
- Simule l'environnement Railway
- Désactive le chargement du fichier .env
- Injecte toutes les variables nécessaires
- Construit et démarre le bot

### 2. Vérifications Locales
- [ ] Le bot démarre sans erreur
- [ ] Tous les services activés fonctionnent
- [ ] Les logs sont appropriés pour la production
- [ ] Le serveur de santé répond sur le bon port

### 3. Validation de la Configuration
```bash
# Vérifier que la configuration est valide
curl http://localhost:8080/envz
```

## 📋 Checklist Post-Déploiement

### 1. Vérification Immédiate
- [ ] Le service répond sur `/health`
- [ ] Le service répond sur `/ping`
- [ ] Le service répond sur `/ready`
- [ ] L'endpoint `/envz` fonctionne (si activé)

### 2. Vérification des Services
- [ ] Hyperliquid : `HL_ENABLED=true` et wallet configuré
- [ ] Upbit : `UPBIT_ENABLED=true`
- [ ] Bithumb : `BITHUMB_ENABLED=true`
- [ ] Telegram : `TELEGRAM_ENABLED=true` et token configuré

### 3. Vérification des Logs
- [ ] Pas d'erreurs de configuration critiques
- [ ] Tous les services activés sont démarrés
- [ ] Le port correct est utilisé
- [ ] Les logs sont appropriés pour la production

## 🔧 Commandes Utiles

### Railway CLI
```bash
# Statut du projet
railway status

# Logs en temps réel
railway logs

# Variables d'environnement
railway variables

# Redémarrer le service
railway service restart

# Ouvrir l'interface web
railway open
```

### Diagnostic
```bash
# Vérifier la santé
curl https://votre-app.railway.app/health

# Vérifier la configuration
curl https://votre-app.railway.app/envz

# Vérifier le statut des services
curl https://votre-app.railway.app/status
```

## 📚 Ressources

- [Documentation Railway](https://docs.railway.app/)
- [Variables d'Environnement](docs/ENVIRONMENT.md)
- [Configuration du Bot](src/config/env.ts)
- [Serveur de Santé](src/healthCheck.ts)

## 🆘 Support

En cas de problème :
1. Vérifier les logs Railway
2. Utiliser l'endpoint `/envz` pour diagnostiquer
3. Consulter la documentation des variables d'environnement
4. Tester localement avec `npm run prod:local`
5. Vérifier la checklist de déploiement
