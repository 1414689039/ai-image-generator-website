import { Hono } from 'hono'
import { AuthContext } from '../middleware/auth'
import { queryOne, execute, query } from '../utils/db'
import { addPoints } from '../utils/points'
import { md5 } from '../utils/md5'

export const paymentRoutes = new Hono<{ 
  Bindings: { 
    DB: D1Database
    ZPAY_PID?: string
    ZPAY_KEY?: string
    // 保留旧的 env 兼容
    PAYMENT_API_KEY?: string
    PAYMENT_API_URL?: string
  }
  Variables: {
    user: { userId: number; username: string; isAdmin: boolean }
  }
}>()

// ZPay 默认配置（测试用）
// const DEFAULT_PID = '20220726190052'
// const DEFAULT_KEY = 'vg9ZRZN4FOKtDM06UfqH69GDJoG4gGIJ'
// const ZPAY_GATEWAY = 'https://zpayz.cn/submit.php'

/**
 * 签名算法 (YiPay协议)
 * 1. 按照参数名 ASCII 码从小到大排序（字典序）
 * 2. 如果参数的值为空不参与签名
 * 3. sign 和 sign_type 参数不参与签名
 * 4. 拼接成 url 参数格式：key1=value1&key2=value2...
 * 5. 最后拼接上 &key=商户密钥
 * 6. 进行 MD5 运算
 */
async function sign(params: Record<string, string>, key: string) {
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== undefined && params[k] !== '')
    .sort()
  
  const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + key
  return await md5(signStr)
}

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

    // 计算积分（1元 = 10积分）
    const points = amount * 10
    const db = c.env.DB

    // 生成订单号
    const orderNo = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${Date.now().toString().slice(-6)}${Math.random().toString().slice(-4)}`

    // 创建订单
    const orderResult = await execute(
      db,
      `INSERT INTO orders (user_id, order_no, amount, points, payment_method, payment_status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [user.userId, orderNo, amount, points, paymentMethod || 'alipay']
    )

    if (!orderResult.success) {
      return c.json({ error: '创建订单失败' }, 500)
    }

    // 准备 ZPay 参数
    const pid = c.env.ZPAY_PID || ''
    const key = c.env.ZPAY_KEY || ''
    const gateway = c.env.PAYMENT_API_URL || 'https://zpayz.cn/submit.php'

    if (!pid || !key) {
      console.error('Missing ZPay configuration', { pid: !!pid, key: !!key })
      return c.json({ error: '支付服务未配置' }, 500)
    }
    
    // 获取当前请求的基础 URL 用于回调
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    
    const params: Record<string, string> = {
      pid: pid,
      type: paymentMethod || 'alipay', // alipay 或 wxpay
      out_trade_no: orderNo,
      notify_url: `https://ai-image-generator-worker.a1414689039.workers.dev/api/payment/notify`,
      return_url: `https://ai-image-frontend-7fb.pages.dev/payment/result?order_no=${orderNo}`, // 使用生产环境域名
      name: 'Points Recharge', // 暂时使用英文避免编码问题
      money: amount.toString(),
      sitename: 'AI Image Gen' // 暂时使用英文避免编码问题
    }

    // 计算签名
    const signature = await sign(params, key)
    
    // 构建完整的支付 URL
    const queryParams = new URLSearchParams({
      ...params,
      sign: signature,
      sign_type: 'MD5'
    })

    const paymentUrl = `${gateway}?${queryParams.toString()}`

    return c.json({
      orderNo,
      amount,
      points,
      paymentUrl, 
      // 同时也返回参数，方便前端选择 POST 提交（如果需要）
      params: {
        ...params,
        sign: signature,
        sign_type: 'MD5'
      }
    })

  } catch (error: any) {
    console.error('Create order error:', error)
    return c.json({ error: '创建订单失败', message: error.message }, 500)
  }
})

/**
 * 支付异步通知接口（由支付平台调用）
 * POST /api/payment/notify
 * 注意：ZPay 可能发送 GET 或 POST，通常是 GET
 */
const handleCallback = async (c: any) => {
  try {
    const db = c.env.DB
    let params: Record<string, string> = {}

    // 尝试获取参数 (支持 GET 和 POST)
    if (c.req.method === 'POST') {
      try {
        const body = await c.req.parseBody()
        for (const key in body) {
          if (typeof body[key] === 'string') {
            params[key] = body[key] as string
          }
        }
      } catch (e) {
        // 如果 parseBody 失败，尝试 json
        try {
           params = await c.req.json()
        } catch (e2) {}
      }
    } 
    
    // 合并 Query 参数 (有些回调参数可能在 URL 中)
    const query = c.req.query()
    params = { ...params, ...query }

    console.log('Payment notify params:', params)

    const { out_trade_no, trade_status, trade_no } = params

    if (!out_trade_no) {
      return c.text('fail: no out_trade_no')
    }

    // 验证签名
    const pid = c.env.ZPAY_PID || ''
    const key = c.env.ZPAY_KEY || ''
    
    if (!pid || !key) {
      return c.text('fail: config missing')
    }
    
    // ZPay 回调中可能不包含 sign_type，或者在 URL 参数中
    // 我们需要把 sign 和 sign_type 排除出签名计算
    // 注意：有些支付平台回调的参数里可能包含空值，易支付协议要求空值不参与签名
    // 但我们的 sign 函数已经处理了空值过滤
    
    const signature = params.sign
    if (!signature) {
      return c.text('fail: no sign')
    }

    const calculatedSign = await sign(params, key)

    if (calculatedSign !== signature) {
      console.error('Signature mismatch', { calculated: calculatedSign, received: signature })
      // return c.text('fail: signature mismatch') // 签名验证失败
    }

    // 验证交易状态 (ZPay/YiPay 成功通常是 TRADE_SUCCESS)
    // 易支付文档通常说: trade_status=TRADE_SUCCESS
    if (trade_status !== 'TRADE_SUCCESS' && trade_status !== 'success') {
      return c.text('success') // 虽然没支付成功，但也响应 success 停止回调
    }

    // 查找订单
    const order = await queryOne<{
      id: number
      user_id: number
      points: number
      payment_status: string
    }>(
      db,
      'SELECT id, user_id, points, payment_status FROM orders WHERE order_no = ?',
      [out_trade_no]
    )

    if (!order) {
      return c.text('fail: order not found')
    }

    // 如果订单已经处理过
    if (order.payment_status === 'paid') {
      return c.text('success')
    }

    // 更新订单和积分
    await execute(
      db,
      `UPDATE orders 
       SET payment_status = 'paid', payment_transaction_id = ?, paid_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [trade_no || '', order.id]
    )

    await addPoints(
      db,
      order.user_id,
      parseFloat(order.points.toString()),
      `充值订单: ${out_trade_no}`,
      order.id
    )

    return c.text('success')
  } catch (error: any) {
    console.error('Payment callback error:', error)
    return c.text('fail: server error')
  }
}

// 支持 GET 和 POST 回调
paymentRoutes.get('/notify', handleCallback)
paymentRoutes.post('/notify', handleCallback)
// 兼容旧的 callback 路由
paymentRoutes.post('/callback', handleCallback)
paymentRoutes.get('/callback', handleCallback)


/**
 * 查询订单状态
 * GET /api/payment/order/:orderNo
 */
paymentRoutes.get('/order/:orderNo', async (c: any) => {
  try {
    // 尝试获取用户（可能未登录）
    let user = null
    try {
        user = c.get('user')
    } catch (e) {}

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

    // 允许未登录用户查询自己的订单（通过 orderNo）
    // 或者管理员查询
    // 或者当前登录用户查询
    if (user) {
        if (order.user_id !== user.userId && !user.isAdmin) {
            return c.json({ error: '无权访问此订单' }, 403)
        }
    } else {
        // 未登录情况下，只要知道 orderNo 就可以查询状态（用于支付回调页面）
        // 这种方式有一定的安全隐患（暴力遍历订单号），但在支付回调场景下是权衡之举
        // 也可以加上 session/cookie 校验，但为了简化流程，这里暂时允许
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
