# AI LeetCode Coach — 部署指南

## 快速开始

### 1. 环境要求

- Ubuntu 22.04+ / Debian 12+
- Docker Engine 24+ 和 Docker Compose v2
- Git
- 域名（生产环境，可选但推荐）
- SSL 证书（生产环境）

### 2. 安装 Docker

```bash
# Ubuntu / Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# 退出并重新登录使 group 生效
```

### 3. 克隆代码

```bash
sudo mkdir -p /opt
sudo git clone <your-repo-url> /opt/aitoearn
sudo chown -R $USER:$USER /opt/aitoearn
cd /opt/aitoearn
```

### 4. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入真实配置
nano .env
```

**重要环境变量：**

| 变量 | 说明 | 来源 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | 自行配置 |
| `NEXTAUTH_SECRET` | JWT 签名密钥 | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 应用公网地址 | `https://yourdomain.com` |
| `WECHAT_APP_ID` | 微信开放平台 AppID | [微信开放平台](https://open.weixin.qq.com/) |
| `WECHAT_APP_SECRET` | 微信开放平台 AppSecret | 同上 |
| `STRIPE_SECRET_KEY` | Stripe 密钥 | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 签名 | [Stripe Webhooks](https://dashboard.stripe.com/webhooks) |
| `STRIPE_PRICE_ID` | Stripe 订阅价格 ID | [Stripe Products](https://dashboard.stripe.com/products) |

### 5. 部署

```bash
# 一键部署
./deploy/deploy.sh

# 仅迁移数据库
./deploy/deploy.sh --skip-migrations

# 仅运行健康检查
./deploy/deploy.sh --smoke-only

# 回滚
./deploy/deploy.sh --rollback
```

### 6. 配置 HTTPS（Let's Encrypt）

```bash
# 安装 certbot
sudo apt install -y certbot

# 获取证书（确保 DNS 已指向服务器且端口 80 已开放）
sudo certbot certonly --standalone -d yourdomain.com --email admin@yourdomain.com --agree-tos --no-eff-email

# 复制证书到 nginx 目录
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/aitoearn/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/aitoearn/nginx/ssl/

# 重启 nginx
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## 架构说明

```
                        ┌─────────────┐
                        │   Nginx     │  (443/80)
                        │  (反向代理)  │
                        └──────┬──────┘
                               │
                    ┌──────────┴──────────┐
                    │   Next.js App       │  (3000)
                    │   (生产构建)         │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
     ┌────────┴────────┐              ┌─────────┴────────┐
     │   PostgreSQL    │              │     Redis        │
     │   (数据库)       │              │   (缓存/队列)     │
     └─────────────────┘              └──────────────────┘

     ┌──────────────────────────────────────────────────┐
     │   Scheduler (Python)                             │
     │   每日推送引擎 · 端口 8000                         │
     └──────────────────────────────────────────────────┘
```

## 服务管理

```bash
# 查看所有服务状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f scheduler

# 重启单个服务
docker compose -f docker-compose.prod.yml restart app

# 停止所有服务
docker compose -f docker-compose.prod.yml down

# 更新（拉取最新代码后）
git pull
./deploy/deploy.sh
```

## 数据库维护

```bash
# 连接数据库
docker exec -it aitoearn-postgres psql -U aitoearn

# 备份数据库
docker exec -t aitoearn-postgres pg_dump -U aitoearn aitoearn > backup_$(date +%Y%m%d).sql

# 恢复数据库
cat backup.sql | docker exec -i aitoearn-postgres psql -U aitoearn

# Prisma 迁移（如果 schema 变更）
docker compose -f docker-compose.prod.yml run --rm app npx prisma db push
```

## 监控

推荐监控方案：
- **Uptime**: [UptimeRobot](https://uptimerobot.com/) (免费，5 个监控点)
- **错误追踪**: [Sentry](https://sentry.io/) (配置 `SENTRY_DSN`)
- **服务器**: `htop`, `docker stats`, `df -h`

## 故障排除

### 502 Bad Gateway

```bash
# 检查 app 是否正常运行
docker compose -f docker-compose.prod.yml logs app

# 重启 app
docker compose -f docker-compose.prod.yml restart app
```

### 数据库连接失败

```bash
# 检查 postgres 是否健康
docker compose -f docker-compose.prod.yml ps postgres

# 检查 DATABASE_URL 配置
docker compose -f docker-compose.prod.yml exec app env | grep DATABASE_URL
```

### 微信登录失败

1. 检查 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` 是否正确
2. 确认微信开放平台回调 URL 已设置为 `{NEXTAUTH_URL}/api/auth/callback/wechat`
3. 查看日志：`docker compose -f docker-compose.prod.yml logs app | grep -i wechat`

## 生产环境 Checklist

- [ ] `.env` 已配置所有必需变量
- [ ] `NEXTAUTH_SECRET` 已使用 `openssl rand -base64 32` 生成
- [ ] SSL 证书已配置，HTTPS 已启用
- [ ] 数据库已配置定期备份（crontab）
- [ ] Redis 已设置密码（生产环境）
- [ ] Stripe Webhook 端点已配置
- [ ] Docker 日志轮转已配置（默认 10MB × 3 文件）
- [ ] 防火墙已配置（仅开放 80, 443, SSH）
- [ ] 服务器时间已同步（NTP）
- [ ] `SENTRY_DSN` 已配置（可选但推荐）
