import { Hono } from 'hono'
import { AuthContext } from '../middleware/auth'
import { query, queryOne, execute } from '../utils/db'
import { addPoints } from '../utils/points'

export const adminRoutes = new Hono<{ 
  Bindings: { DB: D1Database }
  Variables: {
    user: { userId: number; username: string; isAdmin: boolean }
  }
}>()

/**
 * 获取用户列表
 * GET /api/admin/users
 */
adminRoutes.get('/users', async (c: AuthContext) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit
    const search = c.req.query('search') || ''

    const db = c.env.DB

    let sql = 'SELECT id, username, email, points, is_admin, created_at FROM users WHERE 1=1'
    const params: any[] = []

    if (search) {
      sql += ' AND (username LIKE ? OR email LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const users = await query<{
      id: number
      username: string
      email: string
      points: number
      is_admin: number
      created_at: string
    }>(db, sql, params)

    // 获取总数
    const totalResult = await queryOne<{ count: number }>(
      db,
      search
        ? 'SELECT COUNT(*) as count FROM users WHERE username LIKE ? OR email LIKE ?'
        : 'SELECT COUNT(*) as count FROM users',
      search ? [`%${search}%`, `%${search}%`] : []
    )

    return c.json({
      users: users.map((u) => ({
        ...u,
        points: parseFloat(u.points.toString()),
        isAdmin: u.is_admin === 1,
      })),
      total: totalResult?.count || 0,
      page,
      limit,
    })
  } catch (error: any) {
    console.error('Get users error:', error)
    return c.json({ error: '获取用户列表失败', message: error.message }, 500)
  }
})

/**
 * 调整用户积分
 * POST /api/admin/users/:userId/points
 */
adminRoutes.post('/users/:userId/points', async (c: AuthContext) => {
  try {
    const userId = parseInt(c.req.param('userId'))
    const { amount, description } = await c.req.json()

    if (!amount || amount === 0) {
      return c.json({ error: '积分调整数量不能为0' }, 400)
    }

    const db = c.env.DB

    // 检查用户是否存在
    const user = await queryOne<{ id: number }>(
      db,
      'SELECT id FROM users WHERE id = ?',
      [userId]
    )

    if (!user) {
      return c.json({ error: '用户不存在' }, 404)
    }

    // 调整积分
    const result = await addPoints(
      db,
      userId,
      amount,
      description || `管理员调整积分: ${amount > 0 ? '+' : ''}${amount}`,
      undefined
    )

    if (!result.success) {
      return c.json({ error: '积分调整失败' }, 500)
    }

    return c.json({
      success: true,
      newBalance: result.newBalance,
      message: '积分调整成功',
    })
  } catch (error: any) {
    console.error('Adjust points error:', error)
    return c.json({ error: '积分调整失败', message: error.message }, 500)
  }
})

/**
 * 获取订单列表
 * GET /api/admin/orders
 */
adminRoutes.get('/orders', async (c: AuthContext) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    const db = c.env.DB

    const orders = await query<{
      id: number
      user_id: number
      username: string
      order_no: string
      amount: number
      points: number
      payment_status: string
      created_at: string
      paid_at: string | null
    }>(
      db,
      `SELECT o.id, o.user_id, u.username, o.order_no, o.amount, o.points, 
              o.payment_status, o.created_at, o.paid_at 
       FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id 
       ORDER BY o.created_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    )

    // 获取总数
    const totalResult = await queryOne<{ count: number }>(
      db,
      'SELECT COUNT(*) as count FROM orders'
    )

    return c.json({
      orders: orders.map((o) => ({
        id: o.id,
        userId: o.user_id,
        username: o.username,
        orderNo: o.order_no,
        amount: parseFloat(o.amount.toString()),
        points: parseFloat(o.points.toString()),
        paymentStatus: o.payment_status,
        createdAt: o.created_at,
        paidAt: o.paid_at,
      })),
      total: totalResult?.count || 0,
      page,
      limit,
    })
  } catch (error: any) {
    console.error('Get orders error:', error)
    return c.json({ error: '获取订单列表失败', message: error.message }, 500)
  }
})

/**
 * 获取生成记录列表
 * GET /api/admin/generations
 */
adminRoutes.get('/generations', async (c: AuthContext) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const userId = c.req.query('userId')
    const offset = (page - 1) * limit

    const db = c.env.DB

    let sql = `SELECT g.id, g.user_id, u.username, g.type, g.prompt, g.model, 
              g.points_cost, g.status, g.created_at, g.result_urls
       FROM generations g 
       LEFT JOIN users u ON g.user_id = u.id 
       WHERE 1=1`
    
    const params: any[] = []

    if (userId) {
      sql += ' AND g.user_id = ?'
      params.push(parseInt(userId))
    }

    sql += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const generations = await query<{
      id: number
      user_id: number
      username: string
      type: string
      prompt: string
      model: string
      points_cost: number
      status: string
      created_at: string
      result_urls: string
    }>(db, sql, params)

    // 获取总数
    let countSql = 'SELECT COUNT(*) as count FROM generations WHERE 1=1'
    const countParams: any[] = []

    if (userId) {
      countSql += ' AND user_id = ?'
      countParams.push(parseInt(userId))
    }

    const totalResult = await queryOne<{ count: number }>(db, countSql, countParams)

    return c.json({
      generations: generations.map((g) => ({
        ...g,
        points_cost: parseFloat(g.points_cost.toString()),
        result_urls: g.result_urls ? JSON.parse(g.result_urls) : []
      })),
      total: totalResult?.count || 0,
      page,
      limit,
    })
  } catch (error: any) {
    console.error('Get generations error:', error)
    return c.json({ error: '获取生成记录失败', message: error.message }, 500)
  }
})

/**
 * 获取API密钥列表
 * GET /api/admin/api-keys
 */
adminRoutes.get('/api-keys', async (c: AuthContext) => {
  try {
    const db = c.env.DB

    const apiKeys = await query<{
      id: number
      provider: string
      api_key: string
      is_active: number
      created_at: string
      updated_at: string
    }>(
      db,
      'SELECT id, provider, api_key, is_active, created_at, updated_at FROM api_keys ORDER BY created_at DESC'
    )

    return c.json({
      apiKeys: apiKeys.map((k) => ({
        id: k.id,
        provider: k.provider,
        // 只显示部分密钥（安全考虑）
        apiKey: k.api_key.substring(0, 8) + '***',
        isActive: k.is_active === 1,
        createdAt: k.created_at,
        updatedAt: k.updated_at,
      })),
    })
  } catch (error: any) {
    console.error('Get API keys error:', error)
    return c.json({ error: '获取API密钥失败', message: error.message }, 500)
  }
})

/**
 * 创建或更新API密钥
 * POST /api/admin/api-keys
 */
adminRoutes.post('/api-keys', async (c: AuthContext) => {
  try {
    const { provider, apiKey } = await c.req.json()

    if (!provider || !apiKey) {
      return c.json({ error: '提供商和API密钥都是必填项' }, 400)
    }

    const db = c.env.DB

    // 检查是否已存在该提供商的密钥
    const existing = await queryOne<{ id: number }>(
      db,
      'SELECT id FROM api_keys WHERE provider = ?',
      [provider]
    )

    if (existing) {
      // 更新现有密钥
      await execute(
        db,
        'UPDATE api_keys SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [apiKey, existing.id]
      )
      return c.json({ success: true, message: 'API密钥更新成功' })
    } else {
      // 创建新密钥
      await execute(
        db,
        'INSERT INTO api_keys (provider, api_key) VALUES (?, ?)',
        [provider, apiKey]
      )
      return c.json({ success: true, message: 'API密钥创建成功' })
    }
  } catch (error: any) {
    console.error('Save API key error:', error)
    return c.json({ error: '保存API密钥失败', message: error.message }, 500)
  }
})

/**
 * 获取积分规则列表
 * GET /api/admin/point-rules
 */
adminRoutes.get('/point-rules', async (c: AuthContext) => {
  try {
    const db = c.env.DB

    const rules = await query<{
      id: number
      generation_type: string
      quality: string
      base_points: number
      points_per_image: number
      is_active: number
    }>(
      db,
      'SELECT id, generation_type, quality, base_points, points_per_image, is_active FROM point_rules ORDER BY generation_type, quality'
    )

    return c.json({
      rules: rules.map((r) => ({
        ...r,
        base_points: parseFloat(r.base_points.toString()),
        points_per_image: parseFloat(r.points_per_image.toString()),
        isActive: r.is_active === 1,
      })),
    })
  } catch (error: any) {
    console.error('Get point rules error:', error)
    return c.json({ error: '获取积分规则失败', message: error.message }, 500)
  }
})

/**
 * 更新积分规则
 * PUT /api/admin/point-rules/:id
 */
adminRoutes.put('/point-rules/:id', async (c: AuthContext) => {
  try {
    const id = parseInt(c.req.param('id'))
    const { basePoints, pointsPerImage, isActive } = await c.req.json()

    const db = c.env.DB

    await execute(
      db,
      `UPDATE point_rules 
       SET base_points = ?, points_per_image = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [basePoints, pointsPerImage, isActive ? 1 : 0, id]
    )

    return c.json({ success: true, message: '积分规则更新成功' })
  } catch (error: any) {
    console.error('Update point rule error:', error)
    return c.json({ error: '更新积分规则失败', message: error.message }, 500)
  }
})

/**
 * 获取系统配置 (定价)
 * GET /api/admin/config
 */
adminRoutes.get('/config', async (c: AuthContext) => {
    const db = c.env.DB
    try {
        const configs = await query<{key: string, value: string}>(
            db, 
            "SELECT key, value FROM system_configs"
        )
        // 转换为对象格式
        const configMap: Record<string, any> = {}
        configs.forEach(cfg => {
            configMap[cfg.key] = cfg.value
        })
        return c.json({ config: configMap }) // 统一包装在 config 字段中
    } catch (e: any) {
        return c.json({ error: '获取配置失败', message: e.message }, 500)
    }
})

/**
 * 更新系统配置
 * POST /api/admin/config
 */
adminRoutes.post('/config', async (c: AuthContext) => {
    const db = c.env.DB
    const body = await c.req.json()
    
    try {
        // 遍历更新
        const keys = Object.keys(body)
        for (const key of keys) {
            // UPSERT
            await execute(
                db, 
                `INSERT INTO system_configs (key, value) VALUES (?, ?) 
                 ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
                [key, body[key].toString(), body[key].toString()]
            )
        }
        return c.json({ success: true })
    } catch (e: any) {
        return c.json({ error: '更新配置失败', message: e.message }, 500)
    }
})

/**
 * 获取系统统计信息
 * GET /api/admin/stats
 */
adminRoutes.get('/stats', async (c: AuthContext) => {
  try {
    const db = c.env.DB

    // 1. 用户总数
    const userResult = await queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM users')
    
    // 2. 总收入 (orders 表已支付总额)
    const revenueResult = await queryOne<{ total: number }>(
        db, 
        "SELECT SUM(amount) as total FROM orders WHERE payment_status = 'paid'"
    )

    // 3. 总 API 成本 (generations 表 api_cost 总和)
    // 确保 api_cost 列存在 (已通过 migration 添加)
    let costResult = { total: 0 }
    try {
        costResult = await queryOne<{ total: number }>(
            db, 
            "SELECT SUM(api_cost) as total FROM generations WHERE status = 'completed'"
        ) || { total: 0 }
    } catch (e) {
        // 如果列不存在忽略
    }

    // 4. 总积分消耗
    const pointsResult = await queryOne<{ total: number }>(
        db,
        "SELECT SUM(points_cost) as total FROM generations WHERE status = 'completed'"
    )
    
    // 5. 总订单数
    const ordersResult = await queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM orders WHERE payment_status = 'paid'")
    
    // 6. 总生成数
    const genResult = await queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM generations WHERE status = 'completed'")

    return c.json({
      totalUsers: userResult?.count || 0,
      totalOrders: ordersResult?.count || 0,
      totalGenerations: genResult?.count || 0,
      totalRevenue: revenueResult?.total || 0, // CNY
      totalCost: costResult?.total || 0,       // USD
      totalPointsConsumed: pointsResult?.total || 0
    })
  } catch (error: any) {
    console.error('Get stats error:', error)
    return c.json({ error: '获取统计信息失败', message: error.message }, 500)
  }
})

/**
 * 删除用户
 * DELETE /api/admin/users/:id
 */
adminRoutes.delete('/users/:id', async (c: AuthContext) => {
  try {
    const userId = parseInt(c.req.param('id'))
    const db = c.env.DB

    // 1. 删除用户相关数据 (级联删除逻辑)
    // 注意：实际生产中可能需要软删除，或者更复杂的清理逻辑
    // 这里简化处理：删除关联表数据，最后删除用户
    
    // 删除关联的分享点赞
    await execute(db, 'DELETE FROM gallery_likes WHERE user_id = ?', [userId])
    // 删除关联的分享解锁
    await execute(db, 'DELETE FROM gallery_unlocks WHERE user_id = ?', [userId])
    // 删除积分流水
    await execute(db, 'DELETE FROM point_transactions WHERE user_id = ?', [userId])
    // 删除订单
    await execute(db, 'DELETE FROM orders WHERE user_id = ?', [userId])
    // 删除生成记录
    await execute(db, 'DELETE FROM generations WHERE user_id = ?', [userId])
    
    // 2. 删除用户
    await execute(db, 'DELETE FROM users WHERE id = ?', [userId])

    return c.json({ success: true, message: '用户已删除' })
  } catch (error: any) {
    console.error('Delete user error:', error)
    return c.json({ error: '删除用户失败', message: error.message }, 500)
  }
})

/**
 * 删除生成记录 (下架/删除)
 * DELETE /api/admin/generations/:id
 */
adminRoutes.delete('/generations/:id', async (c: AuthContext) => {
  try {
    const genId = parseInt(c.req.param('id'))
    const db = c.env.DB

    // 物理删除
    await execute(db, 'DELETE FROM gallery_likes WHERE generation_id = ?', [genId])
    await execute(db, 'DELETE FROM gallery_unlocks WHERE generation_id = ?', [genId])
    await execute(db, 'DELETE FROM generations WHERE id = ?', [genId])

    return c.json({ success: true, message: '记录已删除' })
  } catch (error: any) {
    console.error('Delete generation error:', error)
    return c.json({ error: '删除记录失败', message: error.message }, 500)
  }
})


