FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @teaching-app/shared build \
  && pnpm --filter @teaching-app/web build:deploy

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIST=/app/apps/web/dist
ENV DATA_DIR=/app/data
ENV DB_PATH=/app/data/teaching-app.db
ENV UPLOAD_DIR=/app/data/uploads
ENV RESTORE_SEED_DATA=true

EXPOSE 3000

WORKDIR /app/apps/api

CMD ["node", "../../scripts/docker-entrypoint.mjs"]
