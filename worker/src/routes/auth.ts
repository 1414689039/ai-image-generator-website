import { Hono } from 'hono'
import { signJWT } from '../utils/jwt'
import { hashPassword, verifyPassword } from '../utils/password'
import { queryOne, execute } from '../utils/db'

export const authRoutes = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()

/**
 * 用户注册
 * POST /api/auth/register
 */
authRoutes.post('/register', async (c) => {
  try {
    let { username, email, password } = await c.req.json()

    // 清理输入空格
    username = username?.trim()
    email = email?.trim()
    password = password?.trim()

    // 验证输入
    if (!username || !email || !password) {
      return c.json({ error: '用户名、邮箱和密码都是必填项' }, 400)
    }

    if (password.length < 6) {
      return c.json({ error: '密码长度至少为6位' }, 400)
    }

    const db = c.env.DB

    // 检查用户名是否已存在
    const existingUser = await queryOne(
      db,
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    )

    if (existingUser) {
      return c.json({ error: '用户名或邮箱已存在' }, 400)
    }

    // 生成密码哈希
    const passwordHash = await hashPassword(password)

    // 创建用户
    const result = await execute(
      db,
      'INSERT INTO users (username, email, password_hash, points) VALUES (?, ?, ?, 0)',
      [username, email, passwordHash]
    )

    if (!result.success) {
      return c.json({ error: '注册失败' }, 500)
    }

    return c.json({ 
      message: '注册成功',
      userId: result.meta.last_row_id 
    }, 201)
  } catch (error: any) {
    console.error('Register error:', error)
    return c.json({ error: '注册失败', message: error.message }, 500)
  }
})

/**
 * 用户登录
 * POST /api/auth/login
 */
authRoutes.post('/login', async (c) => {
  try {
    let { username, password } = await c.req.json()

    // 清理输入空格
    username = username?.trim()
    password = password?.trim()

    if (!username || !password) {
      return c.json({ error: '用户名和密码都是必填项' }, 400)
    }

    const db = c.env.DB
    const jwtSecret = c.env.JWT_SECRET

    // 查找用户
    const user = await queryOne<{
      id: number
      username: string
      email: string
      password_hash: string
      points: number
      is_admin: number
    }>(
      db,
      'SELECT id, username, email, password_hash, points, is_admin FROM users WHERE username = ? OR email = ?',
      [username, username]
    )

    if (!user) {
      return c.json({ error: '用户名或密码错误' }, 401)
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return c.json({ error: '用户名或密码错误' }, 401)
    }

    // 生成JWT令牌
    const token = await signJWT(
      {
        userId: user.id,
        username: user.username,
        isAdmin: user.is_admin === 1,
      },
      jwtSecret,
      '7d'
    )

    return c.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        points: parseFloat(user.points.toString()),
        isAdmin: user.is_admin === 1,
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return c.json({ error: '登录失败', message: error.message }, 500)
  }
})

