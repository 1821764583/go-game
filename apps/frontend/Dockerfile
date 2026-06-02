FROM node:20-alpine AS builder
WORKDIR /app

# 复制 workspace 配置
COPY package.json package-lock.json* ./
COPY packages/engine/package.json ./packages/engine/
COPY apps/frontend/package.json ./apps/frontend/

# 安装所有依赖
RUN npm ci

# 复制源代码
COPY packages/engine ./packages/engine
COPY apps/frontend ./apps/frontend

# 构建 engine 包和前端
RUN npm run build --workspace=packages/engine
RUN npm run build --workspace=apps/frontend

# 生产阶段
FROM node:20-alpine
WORKDIR /app

# 复制 standalone 构建产物
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
COPY --from=builder /app/packages/engine ./packages/engine

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "apps/frontend/server.js"]
