# Basis-Image für Build-Stage
FROM node:18-alpine AS builder

# Arbeitsverzeichnis im Container setzen
WORKDIR /app

# Abhängigkeiten installieren
COPY package.json package-lock.json ./
RUN npm ci

# Anwendungscode kopieren
COPY . .

# Erstelle ein leeres public-Verzeichnis, falls es nicht existiert
RUN mkdir -p public

# Anwendung bauen
RUN npm run build

# Produktions-Image
FROM node:18-alpine AS runner

# Arbeitsverzeichnis setzen
WORKDIR /app

# Umgebungsvariablen für Produktion
ENV NODE_ENV production

# Non-root Benutzer für Sicherheit
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Build-Artefakte und notwendige Dateien kopieren
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js

# Port freigeben
EXPOSE 3000

# Anwendung starten
CMD ["npm", "start"] 