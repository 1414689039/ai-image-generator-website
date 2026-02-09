import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRoutes } from './routes/auth'
import { generationRoutes } from './routes/generation'
import { galleryRoutes } from './routes/gallery'
import { userRoutes } from './routes/user'
import { adminRoutes } from './routes/admin'
import { paymentRoutes } from './routes/payment'
import { messageRoutes } from './routes/message'
import { proxyRoutes } from './routes/proxy'
import { imagesRoutes } from './routes/images'
import { authMiddleware } from './middleware/auth'
import { adminMiddleware } from './middleware/admin'
import { query, queryOne } from './utils/db'

// 定义环境变量类型
type Env = {
  DB: D1Database
  IMAGES: R2Bucket
  IMAGES_OLD?: R2Bucket
  CACHE?: KVNamespace
  NANO_BANANA_API_KEY?: string
  NANO_BANANA_API_URL?: string
  JWT_SECRET: string
  PAYMENT_API_KEY?: string
  PAYMENT_API_URL?: string
  ZPAY_PID?: string
  ZPAY_KEY?: string
  FRONTEND_URL?: string
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

// 获取公共配置（如客服信息、定价）
app.get('/api/config', async (c) => {
  const key = c.req.query('key')
  try {
    const db = c.env.DB
    
    // 使用新的 system_configs 表
    let sql = 'SELECT "key", "value" FROM system_configs'
    const params: string[] = []
    
    if (key) {
      sql += ' WHERE "key" = ?'
      params.push(key)
    }
    
    const configs = await query<{ key: string; value: string }>(db, sql, params)
    
    const configObj: Record<string, string> = {}
    configs.forEach(cfg => {
      configObj[cfg.key] = cfg.value
    })

    return c.json({ config: configObj })
  } catch (error: any) {
    // 尝试兼容旧表（如果迁移未完全完成）
    try {
        const db = c.env.DB
        let sql = 'SELECT config_key, config_value FROM system_config'
        const params: string[] = []
        if (key) {
            sql += ' WHERE config_key = ?'
            params.push(key)
        }
        const configs = await query<{ config_key: string; config_value: string }>(db, sql, params)
        const configObj: Record<string, string> = {}
        configs.forEach(cfg => {
            configObj[cfg.config_key] = cfg.config_value
        })
        return c.json({ config: configObj })
    } catch (e: any) {
        console.error('Config Error:', error, e)
        return c.json({ error: '获取配置失败' }, 500)
    }
  }
})

// 需要认证的路由
app.use('/api/*', async (c, next) => {
  // 排除不需要认证的路由
  const publicPaths = [
    '/api/auth', 
    '/api/payment/notify', 
    '/api/payment/callback',
    '/api/payment/order', // 允许未登录查询订单状态（用于支付结果页）
    '/api/config',        // 允许获取配置
    '/api/proxy'          // 允许图片代理（用于前端展示 HTTP 图片）
  ]
  
  // 允许未登录查看留言板（仅GET请求）
  if (c.req.path.startsWith('/api/message') && c.req.method === 'GET') {
    await next()
    return
  }

  if (publicPaths.some(path => c.req.path.startsWith(path))) {
    await next()
    return
  }
  
  // 执行认证
  return authMiddleware(c, async () => {
      // 认证通过后，检查维护模式
      const user = c.get('user')
      // 如果已登录且不是管理员，检查维护状态
      if (user && !user.isAdmin) {
          try {
            const db = c.env.DB
            const config = await queryOne<{ value: string }>(
                db, 
                "SELECT \"value\" FROM system_configs WHERE \"key\" = 'maintenance_mode'"
            )
            
            if (config?.value === 'true') {
                return c.json({ error: '系统维护中，请稍后访问', maintenance: true }, 503)
            }
          } catch (e) {
            console.error('Maintenance check error:', e)
          }
      }
      await next()
  })
})
app.route('/api/generation', generationRoutes)
app.route('/api/gallery', galleryRoutes)
app.route('/api/user', userRoutes)
app.route('/api/payment', paymentRoutes)
app.route('/api/message', messageRoutes)
app.route('/api/proxy', proxyRoutes)
app.route('/images', imagesRoutes)

// 管理员路由
app.use('/api/admin/*', adminMiddleware)
app.route('/api/admin', adminRoutes)

// 404处理
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

import { logSystem } from './utils/logger'

// 错误处理
app.onError(async (err, c) => {
  console.error('Error:', err)
  try {
      if (c.env && c.env.DB) {
          // 尝试记录到数据库，不等待
          c.executionCtx.waitUntil(
              logSystem(c.env.DB, 'ERROR', 'GLOBAL_ERROR', 'Unhandled Exception', err.message || err)
          )
      }
  } catch (e) {
      console.error('Failed to log global error:', e)
  }
  return c.json({ error: 'Internal Server Error', message: err.message }, 500)
})

export default app

