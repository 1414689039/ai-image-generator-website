import { Hono } from 'hono'
import { AuthContext } from '../middleware/auth'
import { queryOne, execute, query } from '../utils/db'
import { addPoints } from '../utils/points'

export const paymentRoutes = new Hono<{ 
  Bindings: { 
    DB: D1Database
    PAYMENT_API_KEY?: string
    PAYMENT_API_URL?: string
  }
  Variables: {
    user: { userId: number; username: string; isAdmin: boolean }
  }
}>()

/**
 * 创建充值订单
 * POST /api/payment/create-order
 */
paymentRoutes.post('/create-order', async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const { amount, paymentMethod } = await c.req.json()

    // 验证输入
    if (!amount || amount <= 0) {
      return c.json({ error: '充值金额必须大于0' }, 400)
    }

    // 计算积分（1元 = 10积分，可根据需要调整）
    const points = amount * 10

    const db = c.env.DB

    // 生成订单号
    const orderNo = `ORDER_${user.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 创建订单
    const orderResult = await execute(
      db,
      `INSERT INTO orders (user_id, order_no, amount, points, payment_method, payment_status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [user.userId, orderNo, amount, points, paymentMethod || 'unknown']
    )

    if (!orderResult.success) {
      return c.json({ error: '创建订单失败' }, 500)
    }

    // 调用第三方支付接口创建支付订单
    // 这里需要根据实际的支付接口文档来实现
    const paymentApiUrl = c.env.PAYMENT_API_URL
    const paymentApiKey = c.env.PAYMENT_API_KEY

    if (!paymentApiUrl || !paymentApiKey) {
      return c.json({ error: '支付接口未配置' }, 500)
    }

    try {
      const paymentResponse = await fetch(paymentApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${paymentApiKey}`,
        },
        body: JSON.stringify({
          order_no: orderNo,
          amount: amount,
          user_id: user.userId,
          callback_url: `${c.req.url.split('/api')[0]}/api/payment/callback`,
        }),
      })

      if (!paymentResponse.ok) {
        throw new Error('支付接口调用失败')
      }

      const paymentData = await paymentResponse.json()

      // 更新订单，保存支付交易ID
      await execute(
        db,
        'UPDATE orders SET payment_transaction_id = ? WHERE id = ?',
        [paymentData.transaction_id, orderResult.meta.last_row_id]
      )

      return c.json({
        orderNo,
        amount,
        points,
        paymentUrl: paymentData.payment_url, // 支付跳转URL
        qrCode: paymentData.qr_code, // 支付二维码（如果需要）
      })
    } catch (paymentError: any) {
      // 支付接口调用失败，删除订单
      await execute(db, 'DELETE FROM orders WHERE id = ?', [orderResult.meta.last_row_id])
      return c.json({ error: '创建支付订单失败', message: paymentError.message }, 500)
    }
  } catch (error: any) {
    console.error('Create order error:', error)
    return c.json({ error: '创建订单失败', message: error.message }, 500)
  }
})

/**
 * 支付回调接口（由支付平台调用）
 * POST /api/payment/callback
 */
paymentRoutes.post('/callback', async (c) => {
  try {
    // 这里需要根据实际支付接口的回调格式来处理
    const callbackData = await c.req.json()
    const { order_no, status, transaction_id } = callbackData

    if (!order_no) {
      return c.json({ error: '订单号缺失' }, 400)
    }

    const db = c.env.DB

    // 查找订单
    const order = await queryOne<{
      id: number
      user_id: number
      points: number
      payment_status: string
    }>(
      db,
      'SELECT id, user_id, points, payment_status FROM orders WHERE order_no = ?',
      [order_no]
    )

    if (!order) {
      return c.json({ error: '订单不存在' }, 404)
    }

    // 如果订单已经处理过，直接返回成功
    if (order.payment_status === 'paid') {
      return c.json({ success: true, message: '订单已处理' })
    }

    // 如果支付成功，增加用户积分
    if (status === 'paid' || status === 'success') {
      // 更新订单状态
      await execute(
        db,
        `UPDATE orders 
         SET payment_status = 'paid', payment_transaction_id = ?, paid_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [transaction_id, order.id]
      )

      // 增加用户积分
      await addPoints(
        db,
        order.user_id,
        parseFloat(order.points.toString()),
        `充值订单: ${order_no}`,
        order.id
      )

      return c.json({ success: true, message: '支付成功' })
    } else {
      // 支付失败
      await execute(
        db,
        "UPDATE orders SET payment_status = 'failed' WHERE id = ?",
        [order.id]
      )

      return c.json({ success: false, message: '支付失败' })
    }
  } catch (error: any) {
    console.error('Payment callback error:', error)
    return c.json({ error: '处理支付回调失败', message: error.message }, 500)
  }
})

/**
 * 查询订单状态
 * GET /api/payment/order/:orderNo
 */
paymentRoutes.get('/order/:orderNo', async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const orderNo = c.req.param('orderNo')

    const db = c.env.DB

    const order = await queryOne<{
      id: number
      user_id: number
      order_no: string
      amount: number
      points: number
      payment_status: string
      created_at: string
      paid_at: string | null
    }>(
      db,
      `SELECT id, user_id, order_no, amount, points, payment_status, created_at, paid_at 
       FROM orders 
       WHERE order_no = ?`,
      [orderNo]
    )

    if (!order) {
      return c.json({ error: '订单不存在' }, 404)
    }

    // 检查订单是否属于当前用户
    if (order.user_id !== user.userId && !user.isAdmin) {
      return c.json({ error: '无权访问此订单' }, 403)
    }

    return c.json({
      orderNo: order.order_no,
      amount: parseFloat(order.amount.toString()),
      points: parseFloat(order.points.toString()),
      paymentStatus: order.payment_status,
      createdAt: order.created_at,
      paidAt: order.paid_at,
    })
  } catch (error: any) {
    console.error('Get order error:', error)
    return c.json({ error: '查询订单失败', message: error.message }, 500)
  }
})

/**
 * 获取订单列表
 * GET /api/payment/orders
 */
paymentRoutes.get('/orders', async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    const db = c.env.DB

    const orders = await query<{
      id: number
      order_no: string
      amount: number
      points: number
      payment_status: string
      created_at: string
      paid_at: string | null
    }>(
      db,
      `SELECT id, order_no, amount, points, payment_status, created_at, paid_at 
       FROM orders 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [user.userId, limit, offset]
    )

    // 获取总数
    const totalResult = await queryOne<{ count: number }>(
      db,
      'SELECT COUNT(*) as count FROM orders WHERE user_id = ?',
      [user.userId]
    )

    return c.json({
      orders: orders.map((o) => ({
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

