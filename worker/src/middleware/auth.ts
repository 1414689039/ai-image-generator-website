import { Context, Next } from 'hono'
import { verifyJWT } from '../utils/jwt'

// 用户信息类型
export interface UserPayload {
  userId: number
  username: string
  isAdmin: boolean
}

// 扩展Context类型以包含用户信息
export type AuthContext = Context<{
  Variables: {
    user: UserPayload
  }
}>

/**
 * 身份验证中间件
 * 验证JWT令牌并将用户信息添加到context中
 */
export async function authMiddleware(c: Context, next: Next) {
  try {
    const authHeader = c.req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: '未提供认证令牌' }, 401)
    }

    const token = authHeader.substring(7) // 移除 "Bearer " 前缀
    const jwtSecret = c.env.JWT_SECRET

    if (!jwtSecret) {
      return c.json({ error: '服务器配置错误' }, 500)
    }

    // 验证JWT令牌
    const decoded = await verifyJWT(token, jwtSecret)

    // 将用户信息添加到context
    c.set('user', {
      userId: decoded.userId,
      username: decoded.username,
      isAdmin: decoded.isAdmin,
    })

    await next()
  } catch (error: any) {
    if (error.message === 'Invalid JWT format' || error.message === 'Invalid JWT signature' || error.message === 'JWT expired') {
      return c.json({ error: '无效的认证令牌' }, 401)
    }
    return c.json({ error: '认证失败' }, 401)
  }
}

