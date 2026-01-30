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
  apiUrl?: string
  type: string
  prompt: string
  referenceImageUrl?: string | null
  model: string
  width: number
  height: number
  quality: string
  quantity: number
}): Promise<{ images: string[] }> {
  const baseUrl = params.apiUrl || 'https://newapi.pockgo.com'
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  
  // 判断是否使用 Gemini 系列模型（需走 Chat Completions 接口）
  const isGeminiModel = params.model.startsWith('gemini')
  
  if (isGeminiModel) {
    const endpoint = `${cleanBaseUrl}/v1/chat/completions`
    
    // 计算宽高比字符串
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
    const divisor = gcd(params.width, params.height)
    let aspectRatio = `${params.width / divisor}:${params.height / divisor}`
    
    // 映射到标准比例
    const ratioMap: Record<string, string> = {
      '1:1': '1:1',
      '4:3': '4:3',
      '3:4': '3:4',
      '16:9': '16:9',
      '9:16': '9:16',
      // 近似值映射
      '1024:768': '4:3',
      '768:1024': '3:4'
    }
    // 如果不在标准列表中，默认使用最接近的或保持原样
    if (ratioMap[aspectRatio]) {
      aspectRatio = ratioMap[aspectRatio]
    }
    
    // 构建消息体
    const messages: any[] = []
    
    // 如果是 gemini-2.5-flash-image，支持通过 system message 设置宽高比
    if (params.model === 'gemini-2.5-flash-image') {
       messages.push({
         role: 'system',
         content: JSON.stringify({ imageConfig: { aspectRatio } })
       })
    }
    
    const userContent: any[] = [
      {
        type: 'text',
        text: params.prompt
      }
    ]
    
    // 处理参考图
    if (params.type === 'image_to_image' && params.referenceImageUrl) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: params.referenceImageUrl
        }
      })
    }
    
    messages.push({
      role: 'user',
      content: userContent
    })
    
    const requestBody: any = {
      model: params.model,
      messages: messages,
      // Gemini 图片生成通常不需要 max_tokens 很大，但为了避免截断给一个合理值
      max_tokens: 1000, 
    }
    
    // gemini-2.5-flash-image 支持 extra_body 配置宽高比
    if (params.model === 'gemini-2.5-flash-image') {
      requestBody.extra_body = {
        imageConfig: {
          aspectRatio
        }
      }
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `API Status: ${response.status}`
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error && errorJson.error.message) {
            errorMessage = errorJson.error.message
          } else {
            errorMessage = errorText
          }
        } catch (e) {
          errorMessage = errorText
        }
        throw new Error(`API调用失败: ${errorMessage}`)
    }

    const data: any = await response.json()
    // 解析 Chat Completion 响应中的图片链接
    // 假设图片链接在 content 中，可能是 markdown 格式 ![image](url) 或直接是 url
    const content = data.choices?.[0]?.message?.content || ''
    const urlMatch = content.match(/\((https?:\/\/[^\)]+)\)/) || content.match(/(https?:\/\/[^\s]+)/)
    
    if (urlMatch) {
      return { images: [urlMatch[1] || urlMatch[0]] }
    } else if (content.length > 10 && content.startsWith('http')) {
       return { images: [content] }
    } else {
       // 如果没有找到 URL，返回 content 作为错误提示（或者假设生成失败）
       // 但为了接口兼容，如果真的没找到 URL，可能需要抛出错误或记录日志
       console.warn('No image URL found in response:', content)
       // 尝试检查是否有 tool_calls 或其他字段（视具体 API 实现而定）
       // 这里暂时假设一定会有 URL
       if (content) return { images: [] } // 避免前端崩溃，但实际上是失败了
       throw new Error('未在响应中找到图片链接')
    }
    
  } else {
    // 原有的 DALL-E 3 或其他兼容 OpenAI Image API 的模型
    const endpoint = `${cleanBaseUrl}/v1/images/generations`
    
    const requestBody: any = {
        model: params.model,
        prompt: params.prompt,
        n: params.quantity,
        size: `${params.width}x${params.height}`,
        response_format: 'url',
        quality: params.quality === 'ultra_hd' ? 'hd' : 'standard', 
    }

    if (params.type === 'image_to_image' && params.referenceImageUrl) {
        if (params.referenceImageUrl.startsWith('http')) {
           requestBody.prompt = `${params.referenceImageUrl} ${params.prompt}`
        }
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `API Status: ${response.status}`
        try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error && errorJson.error.message) {
            errorMessage = errorJson.error.message
        } else {
            errorMessage = errorText
        }
        } catch (e) {
        errorMessage = errorText
        }
        throw new Error(`API调用失败: ${errorMessage}`)
    }

    const data: any = await response.json()
    
    if (data.data && Array.isArray(data.data)) {
        return {
        images: data.data.map((item: any) => item.url).filter((url: string) => !!url)
        }
    }
    
    return {
        images: data.images || data.urls || [],
    }
  }
}

