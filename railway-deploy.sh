#!/bin/bash
echo "🚀 Déploiement Railway du frontrun-bot..."
npm run build
railway up
echo "✅ Déploiement terminé!"
