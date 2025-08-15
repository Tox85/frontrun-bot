FROM node:20-alpine

# Créer l'utilisateur non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bot -u 1001

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production && npm cache clean --force

# Copier le code source
COPY . .

# Créer le dossier data
RUN mkdir -p /app/data && chown -R bot:nodejs /app/data

# Compiler le projet
RUN npm run build

# Changer vers l'utilisateur non-root
USER bot

# Exposer le port (utiliser la variable d'environnement)
EXPOSE ${PORT:-3000}

# Volume pour les données persistantes
VOLUME ["/app/data"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Commande de démarrage (production)
CMD ["npm", "run", "start:prod"]
