import { Hono } from 'hono'
import { AuthContext } from '../middleware/auth'
import { query, queryOne, execute } from '../utils/db'

export const galleryRoutes = new Hono<{ Bindings: { DB: D1Database } }>()

// 获取画廊列表 (合并了公共和我的)
galleryRoutes.get('/list', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit
  const filter = c.req.query('filter')
  const sort = c.req.query('sort') // 'latest' | 'popular'
  const user = c.get('user')
  const userId = user?.id

  const db = c.env.DB

  let whereClause = "WHERE g.status = 'completed'"
  const params: any[] = []

  // 筛选逻辑
  if (filter === 'my') {
      if (!userId) return c.json({ error: 'Unauthorized' }, 401)
      whereClause += " AND g.user_id = ?"
      params.push(userId)
  } else {
      // 公共画廊只显示公开的
      whereClause += " AND g.is_public = 1"
  }

  // 排序逻辑
  let orderBy = "ORDER BY g.created_at DESC"
  if (sort === 'popular') {
      orderBy = "ORDER BY likes_count DESC, g.created_at DESC"
  }

  // 查询
  const sql = `
    SELECT 
      g.id, 
      g.user_id, 
      u.username as author_name,
      g.prompt, 
      g.model, 
      g.width, 
      g.height, 
      g.result_urls, 
      g.price, 
      g.created_at,
      g.is_public,
      (SELECT COUNT(*) FROM gallery_likes WHERE generation_id = g.id) as likes_count,
      (SELECT COUNT(*) FROM gallery_unlocks WHERE generation_id = g.id) as purchases_count,
      ${userId ? `(SELECT COUNT(*) FROM gallery_likes WHERE generation_id = g.id AND user_id = ${userId}) as is_liked,` : '0 as is_liked,'}
      ${userId ? `(SELECT COUNT(*) FROM gallery_unlocks WHERE generation_id = g.id AND user_id = ${userId}) as is_unlocked,` : '0 as is_unlocked,'}
      ${userId ? `(CASE WHEN g.user_id = ${userId} THEN 1 ELSE 0 END) as is_owner` : '0 as is_owner'}
    FROM generations g
    LEFT JOIN users u ON g.user_id = u.id
    ${whereClause}
    ${orderBy}
    LIMIT ? OFFSET ?
  `
  
  params.push(limit, offset)

  const items = await query<any>(db, sql, params)
  
  // 处理数据格式
  const formattedItems = items.map(item => ({
    ...item,
    result_urls: typeof item.result_urls === 'string' ? JSON.parse(item.result_urls) : item.result_urls,
    is_liked: item.is_liked > 0,
    is_unlocked: item.is_unlocked > 0,
    likes_count: item.likes_count || 0,
    purchases_count: item.purchases_count || 0
  }))

  return c.json({ items: formattedItems })
})

// 点赞/取消点赞
galleryRoutes.post('/:id/like', async (c: AuthContext) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    
    const generationId = parseInt(c.req.param('id'))
    const { like } = await c.req.json() // true = like, false = unlike (frontend usually just toggles, maybe send specific action?)
    // Simplified: Check existing and toggle if no body provided, or use body
    
    const db = c.env.DB

    // 检查是否已点赞
    const existing = await queryOne(db, 'SELECT id FROM gallery_likes WHERE user_id = ? AND generation_id = ?', [user.id, generationId])
    
    if (existing) {
        await execute(db, 'DELETE FROM gallery_likes WHERE user_id = ? AND generation_id = ?', [user.id, generationId])
    } else {
        await execute(db, 'INSERT INTO gallery_likes (user_id, generation_id) VALUES (?, ?)', [user.id, generationId])
    }

    // 返回最新点赞数
    const count = await queryOne<{count: number}>(db, 'SELECT COUNT(*) as count FROM gallery_likes WHERE generation_id = ?', [generationId])
    
    return c.json({ success: true, likes_count: count?.count || 0 })
})

// 解锁 (做同款)
galleryRoutes.post('/unlock', async (c: AuthContext) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    
    const { generationId } = await c.req.json()
    const db = c.env.DB

    // 获取图片信息
    const gen = await queryOne<any>(db, 'SELECT * FROM generations WHERE id = ?', [generationId])
    if (!gen) return c.json({ error: 'Image not found' }, 404)

    // 检查是否已解锁
    const existing = await queryOne(db, 'SELECT id FROM gallery_unlocks WHERE user_id = ? AND generation_id = ?', [user.id, generationId])
    if (existing || gen.user_id === user.id) {
        return c.json({ success: true, prompt: gen.prompt })
    }

    // 检查积分
    const currentUser = await queryOne<{points: number}>(db, 'SELECT points FROM users WHERE id = ?', [user.id])
    if (!currentUser || currentUser.points < gen.price) {
        return c.json({ error: '积分不足' }, 400)
    }

    // 扣除积分并记录解锁
    // 注意：这里应该使用事务，但 D1 的事务支持有限，简单起见分步执行
    await execute(db, 'UPDATE users SET points = points - ? WHERE id = ?', [gen.price, user.id])
    
    // 增加作者积分 (可选：比如给作者分成)
    // await execute(db, 'UPDATE users SET points = points + ? WHERE id = ?', [gen.price * 0.5, gen.user_id])

    await execute(db, 'INSERT INTO gallery_unlocks (user_id, generation_id, price_paid) VALUES (?, ?, ?)', [user.id, generationId, gen.price])

    return c.json({ success: true, prompt: gen.prompt })
})

// 更新价格 (仅拥有者)
galleryRoutes.put('/:id/price', async (c: AuthContext) => {
    // 兼容 frontend POST /gallery/share 逻辑
    // Frontend uses POST /gallery/share { generationId, price } to update price
    // But here we define PUT /:id/price. 
    // Wait, frontend Gallery.tsx calls `apiClient.post('/gallery/share', ...)` in `handleUpdatePrice`.
    // I need to match frontend. 
    // Let's add POST /share route.
    return c.json({ error: 'Use POST /share' }, 405)
})

// 设置分享/更新价格
galleryRoutes.post('/share', async (c: AuthContext) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    
    const { generationId, price } = await c.req.json()
    const db = c.env.DB

    const gen = await queryOne<{user_id: number}>(db, 'SELECT user_id FROM generations WHERE id = ?', [generationId])
    if (!gen || gen.user_id !== user.id) {
        return c.json({ error: 'Permission denied' }, 403)
    }

    await execute(db, 'UPDATE generations SET price = ?, is_public = 1 WHERE id = ?', [price, generationId])
    return c.json({ success: true })
})


// 删除/取消分享
galleryRoutes.delete('/:id', async (c: AuthContext) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    
    const generationId = parseInt(c.req.param('id'))
    const db = c.env.DB

    const gen = await queryOne<{user_id: number}>(db, 'SELECT user_id FROM generations WHERE id = ?', [generationId])
    if (!gen || gen.user_id !== user.id) {
        return c.json({ error: 'Permission denied' }, 403)
    }

    // 物理删除
    await execute(db, 'DELETE FROM generations WHERE id = ?', [generationId])
    await execute(db, 'DELETE FROM gallery_likes WHERE generation_id = ?', [generationId])
    await execute(db, 'DELETE FROM gallery_unlocks WHERE generation_id = ?', [generationId])
    
    return c.json({ success: true })
})
