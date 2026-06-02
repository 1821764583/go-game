# Go 围棋游戏部署指南

## 方案一：使用 Docker Compose 快速部署（推荐）

### 前置要求
- 服务器安装 Docker 和 Docker Compose
- 配置域名（可选）

### 1. 修改环境变量配置

编辑 `docker-compose.yml`，修改以下环境变量：

```yaml
backend:
  environment:
    - PORT=3001
    - REDIS_URL=redis://redis:6379
    - FRONTEND_URL=https://yourdomain.com  # 替换为你的域名或公网 IP
    - ROOM_EXPIRE_SECONDS=7200

frontend:
  environment:
    - NEXT_PUBLIC_BACKEND_URL=https://yourdomain.com/api  # 或者 http://your-ip:3001
    - NEXT_PUBLIC_WS_URL=wss://yourdomain.com  # 或者 ws://your-ip:3001
```

### 2. 上传代码到服务器

```bash
# 在本地执行
git clone ... 你的代码仓库
# 或者直接打包上传项目文件夹
```

### 3. 在服务器上启动服务

```bash
cd /path/to/go-game
docker-compose up -d --build
```

### 4. 验证部署

- 访问 `http://your-server-ip:3000` 或你的域名
- 测试创建房间功能
- 检查 `docker-compose logs -f` 查看日志

---

## 方案二：使用云平台部署

### Vercel + Railway 部署

#### 前端部署到 Vercel

1. 将代码推送到 GitHub/GitLab
2. 在 Vercel 中导入仓库
3. 配置环境变量：
   - `NEXT_PUBLIC_BACKEND_URL`：你的后端地址
   - `NEXT_PUBLIC_WS_URL`：你的 WebSocket 地址

#### 后端部署到 Railway

1. 同样导入代码仓库
2. 在 Railway 中添加 Redis 服务
3. 配置环境变量：
   - `PORT`：3001
   - `REDIS_URL`：Railway 提供的 Redis 连接地址
   - `FRONTEND_URL`：Vercel 分配的前端地址
4. 配置部署设置，确保只部署 `apps/backend`

---

## 方案三：传统服务器部署（不使用 Docker）

### 1. 服务器要求
- Node.js 20+
- Redis 7+
- PM2（进程管理）

### 2. 部署步骤

```bash
# 1. 上传代码到服务器
cd /path/to/go-game

# 2. 安装依赖
npm install

# 3. 构建所有包
npm run build

# 4. 使用 PM2 启动服务

# 启动后端
cd apps/backend
pm2 start dist/main.js --name go-backend

# 启动前端
cd apps/frontend
pm2 start npm --name go-frontend -- start

# 5. 确保 Redis 正在运行
systemctl start redis  # 或你的 Redis 启动命令
```

### 3. 配置 Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 后端 API 和 WebSocket
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 支持
    location /socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 生产环境优化建议

1. **配置 HTTPS**：使用 Let's Encrypt 免费证书
2. **Redis 持久化**：确保 AOF 和 RDB 配置正确
3. **日志管理**：配置日志轮转和监控
4. **监控告警**：使用 Prometheus + Grafana
5. **备份策略**：定期备份 Redis 数据

---

## 常见问题

### WebSocket 连接失败
- 确保 Nginx 配置了正确的 Upgrade 头
- 检查防火墙设置
- 使用 WSS（WebSocket Secure）在生产环境

### 房间过期时间
- 在 `ROOM_EXPIRE_SECONDS` 环境变量中调整

### 性能优化
- 考虑使用 Redis Cluster 扩展
- 前端启用 CDN 缓存
