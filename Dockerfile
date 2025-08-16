# Dockerfile optimisé pour Railway
FROM node:20-alpine AS builder

# Installer les dépendances de build
RUN apk add --no-cache python3 make g++

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer toutes les dépendances (dev + prod)
RUN npm ci

# Copier le code source
COPY . .

# Construire l'application
RUN npm run build

# Étape de production
FROM node:20-alpine AS production

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bot -u 1001

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer uniquement les dépendances de production
RUN npm ci --only=production && npm cache clean --force

# Copier les fichiers construits
COPY --from=builder /app/dist ./dist

# Copier le dossier migrations (nécessaire pour le runtime)
COPY --from=builder /app/migrations ./migrations

# Créer le répertoire de données et définir les permissions
RUN mkdir -p /app/data && chown -R bot:nodejs /app/data

# Changer vers l'utilisateur non-root
USER bot

# Exposer le port
EXPOSE 3001

# Commande de démarrage
CMD ["npm", "start"]