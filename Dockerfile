# App bauen
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Laufzeit: nur Server + gebaute App, keine Abhängigkeiten nötig.
# Datenbank: Railway-Volume (RAILWAY_VOLUME_MOUNT_PATH, z. B. /data) oder DATA_DIR.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/lib/missions.ts src/lib/types.ts ./src/lib/
COPY package.json ./
EXPOSE 8787
CMD ["node", "server/index.ts"]
