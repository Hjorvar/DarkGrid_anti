# Darkgrid RPG — Cloud Run Production Container (Node.js 24 LTS with built-in node:sqlite)
FROM node:24-slim

WORKDIR /app

# Copy package manifests and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source, main game modules, database migrations/seeds, and static assets
COPY index.js ./
COPY src ./src
COPY action-ui-lab ./action-ui-lab
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
