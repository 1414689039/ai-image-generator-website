# 部署指南

本文档提供详细的Cloudflare部署步骤。

## 前置要求

1. Cloudflare账户
2. 已安装Node.js和npm
3. 已安装Wrangler CLI: `npm install -g wrangler`
4. 已登录Wrangler: `wrangler login`

## 步骤1: 创建D1数据库

```bash
cd worker
wrangler d1 create ai-image-db
```

记录返回的`database_id`，然后更新`wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ai-image-db"
database_id = "你的database_id"
```

## 步骤2: 运行数据库迁移

```bash
wrangler d1 migrations apply ai-image-db
```

## 步骤3: 创建R2存储桶

1. 在Cloudflare Dashboard中进入R2
2. 创建新存储桶，命名为`ai-image-uploads`
3. 配置公开访问（可选，如果需要直接访问图片）

## 步骤4: 创建KV命名空间（可选）

```bash
wrangler kv:namespace create "CACHE"
```

将返回的`id`填入`wrangler.toml`。

## 步骤5: 配置环境变量

在Cloudflare Dashboard中为Worker设置环境变量：

1. 进入Workers & Pages
2. 选择你的Worker
3. 进入Settings > Variables
4. 添加以下变量：

- `JWT_SECRET`: 生成一个强随机字符串（可以使用`openssl rand -base64 32`）
- `NANO_BANANA_API_KEY`: 你的Nano Banana API密钥（如果使用）
- `PAYMENT_API_KEY`: 支付接口密钥
- `PAYMENT_API_URL`: 支付接口URL

## 步骤6: 创建默认管理员账户

### 方法1: 通过API注册

1. 部署Worker后，调用注册接口创建管理员账户
2. 然后通过数据库更新is_admin字段：

```sql
UPDATE users SET is_admin = 1 WHERE username = 'your-admin-username';
```

### 方法2: 直接插入数据库

1. 生成密码hash（需要实现一个临时脚本或使用在线工具）
2. 使用wrangler执行SQL：

```bash
wrangler d1 execute ai-image-db --command "INSERT INTO users (username, email, password_hash, is_admin, points) VALUES ('admin', 'admin@example.com', '生成的hash', 1, 1000.00);"
```

## 步骤7: 部署Worker

```bash
cd worker
npm run build  # 如果需要构建
wrangler deploy
```

## 步骤8: 部署前端

### 方法1: 使用Cloudflare Pages

1. 在Cloudflare Dashboard中创建新的Pages项目
2. 连接GitHub仓库或直接上传
3. 构建设置：
   - 构建命令: `cd frontend && npm install && npm run build`
   - 输出目录: `frontend/dist`
4. 环境变量：
   - `VITE_API_URL`: 你的Worker URL（例如: `https://your-worker.your-subdomain.workers.dev/api`）

### 方法2: 手动上传

```bash
cd frontend
npm install
npm run build
# 然后通过Cloudflare Dashboard上传dist目录
```

## 步骤9: 配置自定义域名（可选）

1. 在Cloudflare Dashboard中为Worker和Pages配置自定义域名
2. 更新前端环境变量中的API URL

## 步骤10: 配置CORS（生产环境）

在生产环境中，应该限制CORS来源。修改`worker/src/index.ts`:

```typescript
app.use('/*', cors({
  origin: 'https://your-domain.com', // 替换为实际域名
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))
```

## 验证部署

1. 访问前端URL
2. 尝试注册新用户
3. 尝试登录
4. 测试图片生成功能
5. 使用admin账户登录管理面板

## 常见问题

### 数据库迁移失败

确保`wrangler.toml`中的database_id正确，并且已创建数据库。

### Worker部署失败

检查环境变量是否都已设置，特别是`JWT_SECRET`。

### 前端无法连接API

检查`VITE_API_URL`环境变量是否正确，以及Worker是否已成功部署。

### R2图片无法访问

需要配置R2的公开访问，或者通过Worker代理访问图片。

## 安全建议

1. ✅ 修改默认管理员密码
2. ✅ 使用强随机字符串作为JWT_SECRET
3. ✅ 限制CORS来源
4. ✅ 定期更新依赖
5. ✅ 监控API使用情况
6. ✅ 配置速率限制（使用Cloudflare的Rate Limiting）

