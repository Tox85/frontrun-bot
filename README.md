# Frontrun Bot

Bot de trading automatique pour Bybit.

## Déploiement sur Railway

### Prérequis
1. Compte GitHub avec votre code
2. Compte Railway (https://railway.app)

### Variables d'environnement requises

Copiez le contenu de `env.example` et configurez vos variables :

- `BYBIT_API_KEY` : Votre clé API Bybit
- `BYBIT_SECRET` : Votre secret Bybit  
- `IS_DEMO` : `true` pour le mode demo, `false` pour le mode réel
- `TRADE_AMOUNT_USDT` : Montant par trade en USDT
- `LEVERAGE` : Levier utilisé
- `STOP_LOSS_PERCENT` : Pourcentage de stop loss

### Déploiement

1. Connectez votre compte GitHub à Railway
2. Créez un nouveau projet sur Railway
3. Sélectionnez votre repository GitHub
4. Configurez les variables d'environnement dans l'onglet "Variables"
5. Déployez !

## Développement local

```bash
npm install
npm run dev
``` 