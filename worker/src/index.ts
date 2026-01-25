import { Hono } from 'hono'
import { cors } from '@hono/cors'
import { authRoutes } from './routes/auth'
import { generationRoutes } from './routes/generation'
import { userRoutes } from './routes/user'
import { adminRoutes } from './routes/admin'
import { paymentRoutes } from './routes/payment'
import { authMiddleware } from './middleware/auth'
import { adminMiddleware } from './middleware/admin'

// 定义环境变量类型
type Env = {
  DB: D1Database
  IMAGES: R2Bucket
  CACHE?: KVNamespace
  NANO_BANANA_API_KEY?: string
  JWT_SECRET: string
  PAYMENT_API_KEY?: string
  PAYMENT_API_URL?: string
}

// 创建Hono应用
const app = new Hono<{ Bindings: Env }>()

// 配置CORS
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 公开路由（不需要认证）
app.route('/api/auth', authRoutes)

// 需要认证的路由
app.use('/api/*', authMiddleware)
app.route('/api/generation', generationRoutes)
app.route('/api/user', userRoutes)
app.route('/api/payment', paymentRoutes)

// 管理员路由
app.use('/api/admin/*', adminMiddleware)
app.route('/api/admin', adminRoutes)

// 404处理
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// 错误处理
app.onError((err, c) => {
  console.error('Error:', err)
  return c.json({ error: 'Internal Server Error', message: err.message }, 500)
})

export default app

