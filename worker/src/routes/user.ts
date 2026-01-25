import { Hono } from 'hono'
import { AuthContext } from '../middleware/auth'
import { queryOne, query } from '../utils/db'

export const userRoutes = new Hono<{ 
  Bindings: { DB: D1Database }
  Variables: {
    user: { userId: number; username: string; isAdmin: boolean }
  }
}>()

/**
 * 获取当前用户信息
 * GET /api/user/me
 */
userRoutes.get('/me', async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const db = c.env.DB

    const userInfo = await queryOne<{
      id: number
      username: string
      email: string
      points: number
      is_admin: number
      created_at: string
    }>(
      db,
      'SELECT id, username, email, points, is_admin, created_at FROM users WHERE id = ?',
      [user.userId]
    )

    if (!userInfo) {
      return c.json({ error: '用户不存在' }, 404)
    }

    return c.json({
      id: userInfo.id,
      username: userInfo.username,
      email: userInfo.email,
      points: parseFloat(userInfo.points.toString()),
      isAdmin: userInfo.is_admin === 1,
      createdAt: userInfo.created_at,
    })
  } catch (error: any) {
    console.error('Get user info error:', error)
    return c.json({ error: '获取用户信息失败', message: error.message }, 500)
  }
})

/**
 * 获取积分记录
 * GET /api/user/points/history
 */
userRoutes.get('/points/history', async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    const db = c.env.DB

    const transactions = await query<{
      id: number
      type: string
      amount: number
      balance_after: number
      description: string | null
      created_at: string
    }>(
      db,
      `SELECT id, type, amount, balance_after, description, created_at 
       FROM point_transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [user.userId, limit, offset]
    )

    // 获取总数
    const totalResult = await queryOne<{ count: number }>(
      db,
      'SELECT COUNT(*) as count FROM point_transactions WHERE user_id = ?',
      [user.userId]
    )

    return c.json({
      transactions: transactions.map((t) => ({
        ...t,
        amount: parseFloat(t.amount.toString()),
        balance_after: parseFloat(t.balance_after.toString()),
      })),
      total: totalResult?.count || 0,
      page,
      limit,
    })
  } catch (error: any) {
    console.error('Get points history error:', error)
    return c.json({ error: '获取积分记录失败', message: error.message }, 500)
  }
})

