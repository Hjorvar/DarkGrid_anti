# Darkgrid RPG — Cloud Run Production Container (Node.js 24 LTS with built-in node:sqlite)
FROM node:24-slim

WORKDIR /app

# Copy package manifests and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source, database migrations/seeds, views, and static assets
COPY src ./src
COPY db ./db
COPY public ./public
COPY images ./images
COPY scripts ./scripts

# Default Cloud Run environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV FIREBASE_PROJECT_ID=darkgrid-rpg
ENV ENABLE_FIRESTORE_SYNC=true
ENV DB_PATH=/tmp/darkgrid.sqlite
ENV DURABLE_SNAPSHOT_PATH=/tmp/darkgrid-durable-snapshot.json

EXPOSE 8080

CMD ["node", "src/server.js"]
