import { Hono } from 'hono'
import { AuthContext } from '../middleware/auth'
import { query, queryOne, execute } from '../utils/db'
import { calculatePointsCost, deductPoints } from '../utils/points'

export const generationRoutes = new Hono<{ 
  Bindings: { 
    DB: D1Database
    IMAGES: R2Bucket
    NANO_BANANA_API_KEY?: string
  }
  Variables: {
    user: { userId: number; username: string; isAdmin: boolean }
  }
}>()

/**
 * 生成图片
 * POST /api/generation/create
 */
generationRoutes.post('/create', async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const {
      type, // 'text_to_image' 或 'image_to_image'
      prompt,
      referenceImage, // base64编码的图片（图生图时使用）
      model,
      width,
      height,
      quality, // 'standard', 'hd', 'ultra_hd'
      quantity,
    } = await c.req.json()

    // 验证输入
    if (!type || !prompt || !model || !width || !height || !quality || !quantity) {
      return c.json({ error: '缺少必填参数' }, 400)
    }

    if (type === 'image_to_image' && !referenceImage) {
      return c.json({ error: '图生图需要提供参考图' }, 400)
    }

    const db = c.env.DB
    const imagesBucket = c.env.IMAGES

    let referenceImageUrl: string | null = null

    // 如果是图生图，上传参考图到R2
    if (type === 'image_to_image' && referenceImage) {
      try {
        // 将base64转换为Buffer
        const base64Data = referenceImage.replace(/^data:image\/\w+;base64,/, '')
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        
        // 生成唯一文件名
        const fileName = `ref_${user.userId}_${Date.now()}.jpg`
        
        // 上传到R2
        await imagesBucket.put(fileName, imageBuffer, {
          httpMetadata: {
            contentType: 'image/jpeg',
          },
        })

        // 生成公开URL（需要配置R2的公开访问）
        referenceImageUrl = `/images/${fileName}`
      } catch (error) {
        console.error('Upload reference image error:', error)
        return c.json({ error: '参考图上传失败' }, 500)
      }
    }

    // 计算所需积分
    const pointsCost = await calculatePointsCost(db, type, quality, quantity)

    // 检查用户积分是否足够
    const userInfo = await queryOne<{ points: number }>(
      db,
      'SELECT points FROM users WHERE id = ?',
      [user.userId]
    )

    if (!userInfo || parseFloat(userInfo.points.toString()) < pointsCost) {
      return c.json({ error: '积分不足' }, 400)
    }

    // 创建生成记录
    const genResult = await execute(
      db,
      `INSERT INTO generations 
       (user_id, type, prompt, reference_image_url, model, width, height, quality, quantity, points_cost, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [user.userId, type, prompt, referenceImageUrl, model, width, height, quality, quantity, pointsCost]
    )

    if (!genResult.success) {
      return c.json({ error: '创建生成任务失败' }, 500)
    }

    const generationId = genResult.meta.last_row_id

    // 扣除积分
    const deductResult = await deductPoints(
      db,
      user.userId,
      pointsCost,
      `生成${quantity}张${quality}质量图片`,
      generationId
    )

    if (!deductResult.success) {
      // 如果扣分失败，删除生成记录
      await execute(db, 'DELETE FROM generations WHERE id = ?', [generationId])
      return c.json({ error: '积分扣除失败' }, 500)
    }

    // 调用AI生图API（这里使用Nano Banana作为示例）
    try {
      const apiKey = c.env.NANO_BANANA_API_KEY
      if (!apiKey) {
        throw new Error('API密钥未配置')
      }

      // 调用Nano Banana API
      const apiResponse = await callNanoBananaAPI({
        apiKey,
        type,
        prompt,
        referenceImageUrl,
        model,
        width,
        height,
        quality,
        quantity,
      })

      // 更新生成记录
      await execute(
        db,
        `UPDATE generations 
         SET status = 'completed', result_urls = ? 
         WHERE id = ?`,
        [JSON.stringify(apiResponse.images), generationId]
      )

      return c.json({
        success: true,
        generationId,
        images: apiResponse.images,
        pointsCost,
        newBalance: deductResult.newBalance,
      })
    } catch (apiError: any) {
      // API调用失败，更新状态
      await execute(
        db,
        `UPDATE generations 
         SET status = 'failed', error_message = ? 
         WHERE id = ?`,
        [apiError.message, generationId]
      )

      // 退还积分
      // TODO: 实现积分退还逻辑

      return c.json({ 
        error: '生成失败', 
        message: apiError.message 
      }, 500)
    }
  } catch (error: any) {
    console.error('Generation error:', error)
    return c.json({ error: '生成失败', message: error.message }, 500)
  }
})

/**
 * 获取生成历史
 * GET /api/generation/history
 */
generationRoutes.get('/history', async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    const db = c.env.DB

    const generations = await query<{
      id: number
      type: string
      prompt: string
      model: string
      width: number
      height: number
      quality: string
      quantity: number
      points_cost: number
      status: string
      result_urls: string | null
      created_at: string
    }>(
      db,
      `SELECT id, type, prompt, model, width, height, quality, quantity, 
              points_cost, status, result_urls, created_at 
       FROM generations 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [user.userId, limit, offset]
    )

    // 获取总数
    const totalResult = await queryOne<{ count: number }>(
      db,
      'SELECT COUNT(*) as count FROM generations WHERE user_id = ?',
      [user.userId]
    )

    return c.json({
      generations: generations.map((g) => ({
        ...g,
        result_urls: g.result_urls ? JSON.parse(g.result_urls) : [],
        points_cost: parseFloat(g.points_cost.toString()),
      })),
      total: totalResult?.count || 0,
      page,
      limit,
    })
  } catch (error: any) {
    console.error('Get history error:', error)
    return c.json({ error: '获取历史失败', message: error.message }, 500)
  }
})

/**
 * 调用Nano Banana API的辅助函数
 */
async function callNanoBananaAPI(params: {
  apiKey: string
  type: string
  prompt: string
  referenceImageUrl?: string | null
  model: string
  width: number
  height: number
  quality: string
  quantity: number
}): Promise<{ images: string[] }> {
  // 这里需要根据Nano Banana的实际API文档来实现
  // 以下是示例代码，需要根据实际API调整
  
  const apiUrl = 'https://api.nanobanana.com/v1/generate' // 示例URL，需要替换为实际URL
  
  const requestBody: any = {
    model: params.model,
    prompt: params.prompt,
    width: params.width,
    height: params.height,
    num_images: params.quantity,
  }

  if (params.type === 'image_to_image' && params.referenceImageUrl) {
    requestBody.reference_image = params.referenceImageUrl
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API调用失败: ${error}`)
  }

  const data = await response.json()
  
  // 根据实际API响应格式调整
  return {
    images: data.images || data.urls || [],
  }
}

