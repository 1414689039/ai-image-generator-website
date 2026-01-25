# AI生图网站

一个基于Cloudflare平台部署的AI图像生成网站，支持文生图和图生图功能，集成积分系统和支付接口。

## 技术栈

- **前端**: React + TypeScript + Vite + Tailwind CSS
- **后端**: Cloudflare Workers + Hono
- **数据库**: Cloudflare D1 (SQLite)
- **存储**: Cloudflare R2 (用于存储参考图)
- **部署**: Cloudflare Pages (前端) + Cloudflare Workers (后端)

## 功能特性

### 核心功能
- ✅ 集成Nano Banana等AI生图API
- ✅ 支持文生图和图生图
- ✅ 自定义图像分辨率、画质等级和生图数量
- ✅ 积分充值与消费系统
- ✅ 不同生图类型的差异化积分消耗规则

### 用户系统
- ✅ 用户注册、登录与身份验证
- ✅ 积分余额实时更新
- ✅ 生成历史记录
- ✅ 积分交易记录

### 管理员功能
- ✅ 用户管理
- ✅ 订单查询
- ✅ 积分调整
- ✅ API密钥配置
- ✅ 积分规则配置
- ✅ 系统统计信息

## 项目结构

```
.
├── frontend/              # 前端React应用
│   ├── src/
│   │   ├── components/   # React组件
│   │   ├── pages/        # 页面组件
│   │   ├── store/        # 状态管理
│   │   └── api/          # API客户端
│   └── package.json
├── worker/               # Cloudflare Worker后端
│   ├── src/
│   │   ├── routes/       # API路由
│   │   ├── middleware/   # 中间件
│   │   └── utils/        # 工具函数
│   ├── database/         # 数据库schema和迁移
│   └── wrangler.toml     # Worker配置
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd frontend
npm install

# 安装Worker依赖
cd ../worker
npm install
```

### 2. 配置Cloudflare

#### 创建D1数据库

```bash
cd worker
wrangler d1 create ai-image-db
```

将返回的`database_id`填入`wrangler.toml`中的`database_id`字段。

#### 运行数据库迁移

```bash
wrangler d1 migrations apply ai-image-db
```

#### 创建R2存储桶

在Cloudflare Dashboard中创建R2存储桶，命名为`ai-image-uploads`，然后在`wrangler.toml`中配置。

#### 创建KV命名空间（可选）

```bash
wrangler kv:namespace create "CACHE"
```

将返回的`id`填入`wrangler.toml`中的KV配置。

### 3. 配置环境变量

在Cloudflare Dashboard中为Worker设置以下环境变量：

- `JWT_SECRET`: JWT令牌密钥（用于用户认证）
- `NANO_BANANA_API_KEY`: Nano Banana API密钥（可选，如果使用其他API）
- `PAYMENT_API_KEY`: 支付接口密钥
- `PAYMENT_API_URL`: 支付接口URL

### 4. 本地开发

#### 启动前端开发服务器

```bash
cd frontend
npm run dev
```

前端将在 `http://localhost:3000` 运行。

#### 启动Worker开发服务器

```bash
cd worker
npm run dev
```

Worker将在 `http://localhost:8787` 运行。

### 5. 构建和部署

#### 构建前端

```bash
cd frontend
npm run build
```

#### 部署Worker

```bash
cd worker
npm run deploy
```

#### 部署前端到Cloudflare Pages

1. 在Cloudflare Dashboard中创建新的Pages项目
2. 连接GitHub仓库或直接上传`frontend/dist`目录
3. 设置构建命令：`npm run build`（如果需要）
4. 设置输出目录：`dist`

### 6. 配置默认管理员账户

默认管理员账户：
- 用户名: `admin`
- 密码: `admin`

**重要**: 首次登录后请立即修改密码！

可以通过数据库直接修改：

```sql
-- 生成新密码的hash（使用bcrypt）
-- 然后更新数据库
UPDATE users SET password_hash = '新的hash值' WHERE username = 'admin';
```

## API文档

### 认证相关

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录

### 生成相关

- `POST /api/generation/create` - 创建生成任务
- `GET /api/generation/history` - 获取生成历史

### 用户相关

- `GET /api/user/me` - 获取当前用户信息
- `GET /api/user/points/history` - 获取积分记录

### 支付相关

- `POST /api/payment/create-order` - 创建充值订单
- `GET /api/payment/orders` - 获取订单列表
- `POST /api/payment/callback` - 支付回调接口

### 管理员相关

- `GET /api/admin/users` - 获取用户列表
- `POST /api/admin/users/:userId/points` - 调整用户积分
- `GET /api/admin/orders` - 获取订单列表
- `GET /api/admin/generations` - 获取生成记录
- `GET /api/admin/api-keys` - 获取API密钥列表
- `POST /api/admin/api-keys` - 创建/更新API密钥
- `GET /api/admin/point-rules` - 获取积分规则
- `PUT /api/admin/point-rules/:id` - 更新积分规则
- `GET /api/admin/stats` - 获取系统统计

## 支付接口集成

需要根据实际使用的支付接口文档来实现`worker/src/routes/payment.ts`中的支付逻辑。

支付接口需要支持：
1. 创建支付订单
2. 支付回调通知
3. 订单状态查询

## AI生图API集成

当前代码中集成了Nano Banana API的示例。如果需要使用其他API，需要修改`worker/src/routes/generation.ts`中的`callNanoBananaAPI`函数。

## 注意事项

1. **安全性**: 
   - 生产环境必须修改默认管理员密码
   - JWT_SECRET应该使用强随机字符串
   - API密钥应该妥善保管

2. **R2存储**: 
   - 需要配置R2的公开访问或使用Worker代理访问
   - 参考图的URL生成需要根据实际配置调整

3. **支付接口**: 
   - 需要根据实际使用的支付接口实现回调逻辑
   - 确保回调接口的安全性（验证签名等）

4. **CORS配置**: 
   - 生产环境应该限制CORS来源
   - 当前配置允许所有来源，仅用于开发

## 许可证

MIT

