FROM node:20-alpine AS builder
WORKDIR /app

# 复制 workspace 配置
COPY package.json package-lock.json* ./
COPY packages/engine/package.json ./packages/engine/
COPY apps/backend/package.json ./apps/backend/

# 安装所有依赖
RUN npm ci

# 复制源代码
COPY packages/engine ./packages/engine
COPY apps/backend ./apps/backend

# 构建
RUN npm run build --workspace=packages/engine
RUN npm run build --workspace=apps/backend

# 生产阶段
FROM node:20-alpine
WORKDIR /app

# 复制构建产物和必要文件
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/engine/package.json ./packages/engine/
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/

WORKDIR /app/apps/backend
EXPOSE 3001
CMD ["node", "dist/main"]
