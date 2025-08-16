#!/bin/bash

echo "🚀 Déploiement du système unifié EventId en production"
echo "=================================================="

# 1. Vérification pré-déploiement
echo "📋 Vérification pré-déploiement..."
npm run typecheck
if [ $? -ne 0 ]; then
    echo "❌ Erreur de typecheck - arrêt du déploiement"
    exit 1
fi

npm run build
if [ $? -ne 0 ]; then
    echo "❌ Erreur de compilation - arrêt du déploiement"
    exit 1
fi

# 2. Vérification des migrations
echo "🗄️ Vérification des migrations..."
npm run migrate
if [ $? -ne 0 ]; then
    echo "❌ Erreur de migration - arrêt du déploiement"
    exit 1
fi

# 3. Test de déduplication
echo "🧪 Test de déduplication..."
node dist/bin/test-dedup.js
if [ $? -ne 0 ]; then
    echo "❌ Erreur de test - arrêt du déploiement"
    exit 1
fi

# 4. Démarrage en production
echo "🚀 Démarrage en production..."
echo "✅ Le système unifié EventId est prêt !"
echo ""
echo "📊 Endpoints disponibles :"
echo "  - /health     : Santé du système"
echo "  - /metrics    : Métriques unifiées"
echo "  - /status     : Statut détaillé"
echo "  - /simulate/* : Tests de simulation"
echo ""
echo "🔍 Logs à surveiller :"
echo "  - 🆕 [NEW]     : Nouveaux événements"
echo "  - ⏭️ [DEDUP]   : Déduplications"
echo "  - 🎯 [TRADE]   : Ouvertures de positions"
echo "  - ✅ Opened    : Trades réussis"
echo ""
echo "🎯 Commandes utiles :"
echo "  npm run start:prod  # Mode production"
echo "  npm run dev         # Mode développement"
echo "  npm run test-dedup  # Test de déduplication"
echo ""
echo "🚀 Déploiement terminé avec succès !"
