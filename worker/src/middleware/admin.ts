import { Context, Next } from 'hono'
import { AuthContext } from './auth'

/**
 * 管理员权限中间件
 * 确保只有管理员可以访问
 */
export async function adminMiddleware(c: AuthContext, next: Next) {
  const user = c.get('user')

  if (!user || !user.isAdmin) {
    return c.json({ error: '需要管理员权限' }, 403)
  }

  await next()
}

