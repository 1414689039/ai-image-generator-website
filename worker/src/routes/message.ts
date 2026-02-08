import { Hono } from 'hono'
import { AuthContext } from '../middleware/auth'
import { query, queryOne, execute } from '../utils/db'

export const messageRoutes = new Hono<{ Bindings: { DB: D1Database } }>()

// 获取留言列表
messageRoutes.get('/', async (c) => {
  const db = c.env.DB
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit

  // 获取主留言
  const sql = `
    SELECT 
      m.id, 
      m.user_id, 
      m.title, 
      m.content, 
      m.created_at, 
      u.username as author_name,
      (SELECT COUNT(*) FROM replies WHERE message_id = m.id) as reply_count,
      (SELECT created_at FROM replies WHERE message_id = m.id ORDER BY created_at DESC LIMIT 1) as last_reply_at
    FROM messages m
    LEFT JOIN users u ON m.user_id = u.id
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `
  const messages = await query<any>(db, sql, [limit, offset])

  return c.json({ items: messages })
})

// 获取单条留言详情及回复
messageRoutes.get('/:id', async (c) => {
    const db = c.env.DB
    const id = parseInt(c.req.param('id'))

    // 获取留言详情
    const message = await queryOne<any>(
        db,
        `SELECT m.*, u.username as author_name 
         FROM messages m 
         LEFT JOIN users u ON m.user_id = u.id 
         WHERE m.id = ?`,
        [id]
    )

    if (!message) {
        return c.json({ error: 'Message not found' }, 404)
    }

    // 获取回复
    const replies = await query<any>(
        db,
        `SELECT r.id, r.user_id, r.content, r.created_at, r.is_admin_reply, u.username as author_name
         FROM replies r
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.message_id = ?
         ORDER BY r.created_at ASC`,
        [id]
    )

    return c.json({ ...message, replies })
})

// 发布留言
messageRoutes.post('/', async (c: AuthContext) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { title, content } = await c.req.json()
  const db = c.env.DB

  await execute(db, 'INSERT INTO messages (user_id, title, content) VALUES (?, ?, ?)', [user.userId, title, content])
  
  return c.json({ success: true })
})

// 回复留言
messageRoutes.post('/:id/reply', async (c: AuthContext) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
    const messageId = parseInt(c.req.param('id'))
    const { content } = await c.req.json()
    const db = c.env.DB
  
    await execute(
        db, 
        'INSERT INTO replies (message_id, user_id, content, is_admin_reply) VALUES (?, ?, ?, ?)', 
        [messageId, user.userId, content, user.isAdmin ? 1 : 0]
    )
    
    return c.json({ success: true })
})

// 删除留言 (管理员或本人)
messageRoutes.delete('/:id', async (c: AuthContext) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    
    const id = parseInt(c.req.param('id'))
    const db = c.env.DB

    const msg = await queryOne<{user_id: number}>(db, 'SELECT user_id FROM messages WHERE id = ?', [id])
    if (!msg) return c.json({ error: 'Not found' }, 404)

    if (msg.user_id !== user.userId && !user.isAdmin) {
        return c.json({ error: 'Permission denied' }, 403)
    }

    await execute(db, 'DELETE FROM messages WHERE id = ?', [id])
    await execute(db, 'DELETE FROM replies WHERE message_id = ?', [id])

    return c.json({ success: true })
})

// 删除回复
messageRoutes.delete('/reply/:id', async (c: AuthContext) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    
    const id = parseInt(c.req.param('id'))
    const db = c.env.DB

    const reply = await queryOne<{user_id: number}>(db, 'SELECT user_id FROM replies WHERE id = ?', [id])
    if (!reply) return c.json({ error: 'Not found' }, 404)

    if (reply.user_id !== user.userId && !user.isAdmin) {
        return c.json({ error: 'Permission denied' }, 403)
    }

    await execute(db, 'DELETE FROM replies WHERE id = ?', [id])

    return c.json({ success: true })
})
