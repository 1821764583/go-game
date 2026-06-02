FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/engine/package*.json ./packages/engine/
COPY apps/backend/package*.json ./apps/backend/

RUN npm ci

COPY packages/engine ./packages/engine
COPY apps/backend ./apps/backend

RUN npm run build --workspace=packages/engine
RUN npm run build --workspace=apps/backend

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/engine/package*.json ./packages/engine/
COPY apps/backend/package*.json ./apps/backend/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

WORKDIR /app/apps/backend

ENV NODE_ENV=production

CMD ["node", "dist/main"]
