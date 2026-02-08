import { Hono } from 'hono'
import { AuthContext } from '../middleware/auth'
import { query, queryOne, execute } from '../utils/db'
import { calculatePointsCost, deductPoints, addPoints } from '../utils/points'
import { logSystem } from '../utils/logger'

export const generationRoutes = new Hono<{ 
  Bindings: { 
    DB: D1Database
    IMAGES?: R2Bucket // IMAGES 设为可选
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
      referenceImage, // 兼容旧版单图
      referenceImages, // 新增：多图数组
      model,
      width,
      height,
      quality, // 'standard', 'hd', 'ultra_hd'
      quantity: reqQuantity,
      size, // 新增：比例 (如 "1:1")
      resolution, // 新增：分辨率 (如 "1K")
    } = await c.req.json()

    let quantity = reqQuantity || 1

    // 验证输入
    // 兼容两种参数模式：旧版(width/height/quality) 或 新版(size/resolution)
    // 注意：JS中空字符串或0会被当做false，需要严格检查undefined
    const hasOldParams = (width !== undefined) && (height !== undefined)
    const hasNewParams = (size !== undefined)
    
    if (!type || !prompt || !model || !quantity) {
         return c.json({ error: '缺少必填参数: type, prompt, model, quantity' }, 400)
    }

    // 特殊处理：Gemini 3 Pro 系列模型限制单次只能生成 1 张
    // 但用户希望并发请求来实现多张，所以这里不重置 quantity，而在后台任务中处理
    // if (model.includes('gemini-3-pro')) {
    //     quantity = 1
    // }

    if (!hasOldParams && !hasNewParams) {
        return c.json({ error: '缺少必填参数: 需提供 (width, height) 或 (size)' }, 400)
    }

    // 确定用于数据库记录的参数
    let dbWidth = width || 1024
    let dbHeight = height || 1024
    let dbQuality = quality || resolution || 'standard'
    
    // 如果使用新参数，尝试估算宽高以便存库（仅作记录）
    if (hasNewParams && !width) {
        // 简单映射，不影响实际生成
        if (resolution === '1K') { dbWidth = 1024; dbHeight = 1024 }
        else if (resolution === '2K') { dbWidth = 2048; dbHeight = 2048 }
        else if (resolution === '4K') { dbWidth = 4096; dbHeight = 4096 }
        
        // 解析比例简单调整
        if (size && size.includes(':')) {
            const [w, h] = size.split(':').map(Number)
            if (w > h) dbHeight = Math.floor(dbWidth * (h/w))
            else dbWidth = Math.floor(dbHeight * (w/h))
        }
    }

    if (type === 'image_to_image' && !referenceImage && (!referenceImages || referenceImages.length === 0)) {
      return c.json({ error: '图生图需要提供参考图' }, 400)
    }

    const db = c.env.DB
    const imagesBucket = c.env.IMAGES

    // 整合所有参考图
    let allRefImages: string[] = []
    if (referenceImages && Array.isArray(referenceImages)) {
        allRefImages = referenceImages
    } else if (referenceImage) {
        allRefImages = [referenceImage]
    }

    // 上传所有参考图到R2（如果配置了），并生成URL列表
    // 同时保留 Base64 列表备用 (用于本地调试或 R2 不可用)
    let referenceImageUrls: string[] = []
    let referenceImageBase64s: string[] = []

    for (const base64Img of allRefImages) {
        referenceImageBase64s.push(base64Img) // 始终保留 Base64
        
        if (imagesBucket) {
            try {
                // 将base64转换为Buffer
                const base64Data = base64Img.replace(/^data:image\/\w+;base64,/, '')
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
                
                // 生成唯一文件名
                const fileName = `ref_${user.userId}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`
                
                // 上传到R2
                await imagesBucket.put(fileName, imageBuffer, {
                    httpMetadata: { contentType: 'image/jpeg' },
                })

                // 生成公开URL
                referenceImageUrls.push(`/images/${fileName}`)
            } catch (error) {
                console.error('Upload reference image error:', error)
            }
        }
    }
    
    // 为了兼容数据库字段 reference_image_url (TEXT)，我们只存第一张图的 URL
    // 或者如果后续需要支持多图回显，可以存 JSON，但目前 schema 是 TEXT
    const mainReferenceImageUrl = referenceImageUrls.length > 0 ? referenceImageUrls[0] : null

    // 动态获取定价配置和API配置
    // 默认值：1K=2, 2K=4, 4K=6
    let price1k = 2
    let price2k = 4
    let price4k = 6
    
    // API配置
    let dynamicApiUrl = ''
    let dynamicApiKey = ''
    let providerType = 'nano-banana' // 默认保持原有行为

    try {
        const configs = await query<{key: string, value: string}>(
            db, 
            "SELECT key, value FROM system_configs WHERE key IN ('price_1k', 'price_2k', 'price_4k', 'api_gateway_url', 'api_gateway_key', 'provider_type')"
        )
        configs.forEach(cfg => {
            if (cfg.key === 'price_1k') price1k = parseFloat(cfg.value)
            if (cfg.key === 'price_2k') price2k = parseFloat(cfg.value)
            if (cfg.key === 'price_4k') price4k = parseFloat(cfg.value)
            if (cfg.key === 'api_gateway_url' && cfg.value) dynamicApiUrl = cfg.value
            if (cfg.key === 'api_gateway_key' && cfg.value) dynamicApiKey = cfg.value
            if (cfg.key === 'provider_type' && cfg.value) providerType = cfg.value
        })
    } catch (e) {
        // 如果表不存在（尚未迁移），使用默认值，不报错
        console.warn('Failed to load system_configs, using defaults', e)
    }

    // 计算所需积分
    // 这里不再使用 utils/points.ts 中的 calculatePointsCost，而是直接在此计算以支持动态配置
    // 或者应该重构 calculatePointsCost 接收价格参数
    let pointsCost = 0
    const totalQuantity = quantity
    
    // 基础价格根据分辨率
    let basePrice = price1k // 默认 1K
    if (resolution === '2K') basePrice = price2k
    if (resolution === '4K') basePrice = price4k
    
    // 兼容旧版 width/height 判断
    if (!resolution && (width || height)) {
        const maxDim = Math.max(width || 0, height || 0)
        if (maxDim > 2048) basePrice = price4k
        else if (maxDim > 1024) basePrice = price2k
        else basePrice = price1k
    }

    // 总分 = 单价 * 数量
    pointsCost = basePrice * totalQuantity

    // 检查用户积分是否足够
    const userInfo = await queryOne<{ points: number }>(
      db,
      'SELECT points FROM users WHERE id = ?',
      [user.userId]
    )

    if (!userInfo || parseFloat(userInfo.points.toString()) < pointsCost) {
      return c.json({ error: '积分不足' }, 400)
    }

    // 循环创建多条生成记录 (每张图一条记录)
    const generationIds: number[] = []
    
    // 如果是 Gemini 3 Pro 且 quantity > 1，我们需要拆分
    // 其实为了统一逻辑，所有模型的批量生成都拆分为单条记录管理更好
    // 这样每张图都有独立的状态和结果
    
    for (let i = 0; i < quantity; i++) {
        const genResult = await execute(
          db,
          `INSERT INTO generations 
           (user_id, type, prompt, reference_image_url, model, width, height, quality, quantity, points_cost, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            user.userId, 
            type, 
            prompt, 
            mainReferenceImageUrl, 
            model, 
            dbWidth, 
            dbHeight, 
            dbQuality, 
            1, // 拆分后每条记录 quantity 为 1
            pointsCost / quantity // 拆分积分成本
          ]
        )

        if (genResult.success) {
            generationIds.push(genResult.meta.last_row_id as number)
        }
    }

    if (generationIds.length === 0) {
      return c.json({ error: '创建生成任务失败' }, 500)
    }

    // 扣除积分 (总额)
    const deductResult = await deductPoints(
      db,
      user.userId,
      pointsCost,
      `生成${quantity}张${quality}质量图片`,
      generationIds[0] // 关联第一条记录
    )

    if (!deductResult.success) {
      // 如果扣分失败，删除所有生成记录
      for (const id of generationIds) {
          await execute(db, 'DELETE FROM generations WHERE id = ?', [id])
      }
      return c.json({ error: '积分扣除失败' }, 500)
    }

    // 异步执行生成任务 (并发)
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const apiKey = dynamicApiKey
          if (!apiKey) throw new Error('API密钥未配置')

          // 并发执行每个任务
          const promises = generationIds.map(async (generationId) => {
              try {
                  const apiResponse = await callNanoBananaAPI({
                    db, // 传递 db 实例
                    apiKey,
                    apiUrl: dynamicApiUrl,
                    providerType, // 传递 providerType
                    type,
                    prompt,
                    referenceImageUrl: mainReferenceImageUrl, // 兼容旧接口
                    referenceImageUrls: referenceImageUrls,   // 新增：多图URL
                    referenceImageBase64: referenceImageBase64s.length > 0 ? referenceImageBase64s[0] : undefined, // 兼容旧接口
                    referenceImageBase64s: referenceImageBase64s, // 新增：多图Base64
                    model,
                    width: dbWidth,
                    height: dbHeight,
                    quality: dbQuality,
                    quantity: 1, // 强制单次只请求1张
                    size,
                    resolution,
                  })

                  // 如果返回了 taskId，先更新到数据库
                  if (apiResponse.taskId) {
                       await execute(db, 'UPDATE generations SET api_task_id = ? WHERE id = ?', [apiResponse.taskId, generationId])
                  }

                  if (apiResponse.status === 'pending') {
                       console.log(`Task ${generationId} pending (API Task: ${apiResponse.taskId}). Waiting for manual check.`)
                       return 
                  }

                  if (!apiResponse.images || apiResponse.images.length === 0) {
                     throw new Error('API返回的图片列表为空')
                  }

                  // 更新生成记录
                  // 计算 API 成本 (USD)
                  // Gemini 3 Pro: 1K/2K=$0.05, 4K=$0.10
                  let apiCost = 0
                  if (model.includes('gemini-3-pro')) {
                      if (dbWidth > 2048 || dbHeight > 2048 || resolution === '4K') {
                          apiCost = 0.10
                      } else {
                          apiCost = 0.05
                      }
                  }

                  await execute(
                    db,
                    `UPDATE generations 
                     SET status = 'completed', result_urls = ?, api_cost = ?
                     WHERE id = ?`,
                    [JSON.stringify(apiResponse.images), apiCost, generationId]
                  )
              } catch (apiError: any) {
                  console.error(`Generation failed for ID ${generationId}:`, apiError)
                  const errorMessage = apiError.message || JSON.stringify(apiError)
                  
                  // 记录系统日志
                  await logSystem(db, 'ERROR', 'GENERATION_FAIL', `Task ${generationId} failed`, errorMessage)

                  // 更新失败状态
                  // 使用 CAS (Compare And Swap) 机制防止并发重复退款
                  const updateResult = await execute(
                    db,
                    `UPDATE generations SET status = 'failed', error_message = ? WHERE id = ? AND status = 'pending'`,
                    [errorMessage.substring(0, 255), generationId]
                  )
                  
                  // 只有成功更新状态（意味着抢到了锁）才执行退款
                  if (updateResult.success && updateResult.meta.changes > 0) {
                      // 单个任务失败退款 (退还单张成本)
                      const singleCost = pointsCost / quantity
                      await addPoints(
                        db,
                        user.userId,
                        singleCost,
                        `生成失败退款: ${generationId}`,
                        undefined,
                        generationId,
                        'refund'
                      )
                  }
              }
          })
          
          await Promise.all(promises)

        } catch (error: any) {
            console.error('Background generation fatal error:', error)
            await logSystem(db, 'ERROR', 'BG_TASK_FATAL', 'Background generation fatal error', error.message || error)
        }
      })()
    )

    return c.json({
      success: true,
      generationIds, // 返回ID列表
      generationId: generationIds[0], // 兼容旧版
      status: 'pending',
      pointsCost,
      newBalance: deductResult.newBalance,
    })

  } catch (error: any) {
    console.error('Generation error:', error)
    // 尝试记录日志 (如果 c.env.DB 可用)
    try {
        if (c.env.DB) await logSystem(c.env.DB, 'ERROR', 'CREATE_GEN_ERROR', 'Generation request failed', error.message || error)
    } catch (e) { console.error('Failed to log error', e) }
    
    return c.json({ error: '生成失败', message: error.message }, 500)
  }
})

/**
 * 主动检查任务状态
 * GET /api/generation/check/:id
 */
generationRoutes.get('/check/:id', async (c: AuthContext) => {
    try {
        const user = c.get('user')
        const generationId = c.req.param('id')
        const db = c.env.DB
        
        // 动态获取 API 配置
        let apiKey = ''
        let baseUrl = 'https://api.apimart.ai'

        try {
            const configs = await query<{key: string, value: string}>(
                db, 
                "SELECT key, value FROM system_configs WHERE key IN ('api_gateway_url', 'api_gateway_key')"
            )
            configs.forEach(cfg => {
                if (cfg.key === 'api_gateway_url' && cfg.value) baseUrl = cfg.value
                if (cfg.key === 'api_gateway_key' && cfg.value) apiKey = cfg.value
            })
        } catch (e) {
            console.warn('Failed to load system_configs in check route', e)
        }
        
        // 1. 获取任务信息
        const task = await queryOne<{ 
            id: number, 
            status: string, 
            api_task_id: string,
            result_urls: string,
            created_at: string,
            points_cost: number
        }>(
            db,
            'SELECT id, status, api_task_id, result_urls, created_at, points_cost FROM generations WHERE id = ? AND user_id = ?',
            [generationId, user.userId]
        )

        if (!task) {
            return c.json({ error: '任务不存在' }, 404)
        }

        // 检查是否超时（例如 30 分钟）
        // SQLite CURRENT_TIMESTAMP 是 UTC 时间 (YYYY-MM-DD HH:MM:SS)
        const createdAtStr = task.created_at.endsWith('Z') ? task.created_at : task.created_at + 'Z'
        const createdAt = new Date(createdAtStr)
        const now = new Date()
        const diffMs = now.getTime() - createdAt.getTime()
        const TIMEOUT_MS = 30 * 60 * 1000 // 30分钟超时

        if (task.status === 'pending' && diffMs > TIMEOUT_MS) {
             console.log(`Task ${generationId} timed out. Created at: ${task.created_at}, Now: ${now.toISOString()}`)
             
             // 标记为失败 (CAS)
             const updateResult = await execute(
                 db, 
                 `UPDATE generations SET status = 'failed', error_message = ? WHERE id = ? AND status = 'pending'`,
                 ['任务执行超时', generationId]
             )
             
             // 退款 (仅当成功更新状态时)
             if (updateResult.success && updateResult.meta.changes > 0 && task.points_cost > 0) {
                 try {
                    await addPoints(
                        db,
                        user.userId,
                        task.points_cost,
                        `超时退款: ${generationId}`,
                        undefined,
                        Number(generationId),
                        'refund'
                    )
                 } catch (refundError) {
                     console.error('Timeout refund failed:', refundError)
                 }
             }
             
             return c.json({ status: 'failed', error: '任务执行超时' })
        }

        // 如果已经完成或失败，直接返回
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'success') {
             return c.json({ 
                 status: task.status, 
                 progress: 100, 
                 result_urls: task.result_urls ? JSON.parse(task.result_urls) : [] 
             })
        }

        if (!task.api_task_id) {
             // 还没有 api_task_id，可能是刚提交还没写入，或者提交失败了
             return c.json({ status: task.status, progress: 0 })
        }

        // 2. 调用 API 查询状态
        // 假设是 Gemini 3 Pro 格式 (Apimart)
        const cleanBaseUrl = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '')
        
        // 检查是否是 ZX2 异步任务
        // 由于 providerType 没有存在 generations 表里，我们这里通过 api_task_id 格式简单判断
        // 或者需要从 system_configs 再读一次 providerType (不准确，可能变了)
        // 最好的办法是查询时再读一次配置
        
        let currentProviderType = 'nano-banana'
        try {
            const configs = await query<{key: string, value: string}>(
                db, 
                "SELECT key, value FROM system_configs WHERE key = 'provider_type'"
            )
            if (configs.length > 0) currentProviderType = configs[0].value
        } catch (e) {
            console.warn('Failed to load provider_type in check route', e)
        }

        const isZx2Async = currentProviderType === 'zx2-async'
        
        let taskIds: string[] = []
        try {
            if (task.api_task_id.startsWith('[')) {
                taskIds = JSON.parse(task.api_task_id)
            } else {
                taskIds = [task.api_task_id]
            }
        } catch (e) {
            taskIds = [task.api_task_id]
        }

        const checkPromises = taskIds.map(async (tid) => {
            // ZX2 异步查询逻辑
            if (isZx2Async) {
                // 同样处理 Base URL，去除末尾可能存在的 /api
                const zx2BaseUrl = cleanBaseUrl.replace(/\/api$/, '')
                const queryUrl = `${zx2BaseUrl}/api/result`
                
                try {
                    const res = await fetch(queryUrl, {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ id: tid })
                    })
                    
                    if (!res.ok) {
                         const errorText = await res.text()
                         console.error(`Check status failed for ${tid}: ${res.status} ${errorText}`)
                         if (res.status >= 400 && res.status < 500) {
                             return { status: 'failed', error: `API Error ${res.status}` }
                         }
                         return null
                    }
                    
                    const data: any = await res.json()
                    // ZX2 响应格式未知，假设 data.data.status 或 data.data.url
                    // 根据文档: "生成的图片 务必及时保存"
                    // 猜测成功时返回 { code: 0, data: { status: "success", url: "..." } } 
                    // 或者直接 { code: 0, data: { url: "..." } }
                    
                    if (data.code !== 0) {
                        // 可能是还在处理中? 文档没说 code!=0 是处理中还是失败
                        // 通常 code != 0 是错误
                        // 但如果正在处理，可能返回特定 code
                        // 暂时假设 code != 0 且 msg 包含 "processing" 是处理中
                        // 修正：增加中文关键词支持 "生成中", "稍后"
                        const msg = (data.msg || '').toLowerCase()
                        if (msg.includes('processing') || msg.includes('pending') || msg.includes('queue') || msg.includes('生成中') || msg.includes('稍后')) {
                            return { status: 'pending', progress: 50 }
                        }
                        return { status: 'failed', error: data.msg || 'Unknown error' }
                    }
                    
                    // 成功
                    // 修正：ZX2 成功时直接在根对象返回 url，或者在 data.url
                    const imgUrl = data.url || data.data?.url || data.data?.image_url || data.data?.images?.[0]
                    if (imgUrl) {
                        return { status: 'success', progress: 100, images: [imgUrl] }
                    }
                    
                    // 如果没有 url，可能是还在处理?
                    // 这是一个不确定的地方，先假设没有 url 就是 pending
                    return { status: 'pending', progress: 50 }
                    
                } catch (e) {
                    console.error(`ZX2 Check error for ${tid}:`, e)
                    return null
                }
            }

            const queryUrl = `${cleanBaseUrl}/v1/tasks/${tid}`
            try {
                const res = await fetch(queryUrl, {
                    headers: { 
                        'Authorization': `Bearer ${apiKey}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                })

                if (!res.ok) {
                    console.error(`Check status failed for ${tid}: ${res.status}`)
                    // 记录日志
                    await logSystem(db, 'WARN', 'CHECK_STATUS', `Check HTTP ${res.status} for ${tid}`, queryUrl)

                    // 客户端错误返回 failed，其他返回 pending (null)
                    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
                        return { status: 'failed', error: `API Error ${res.status}` }
                    }
                    return null 
                }

                const data: any = await res.json()
                const status = data.status || data.data?.[0]?.status || data.data?.status
                const progress = data.progress || data.data?.[0]?.progress || data.data?.progress || 0
                
                let images: string[] = []
                if (status === 'succeeded' || status === 'completed' || status === 'success') {
                    const resultObj = data.result || data.data?.result || data.data
                    if (resultObj?.images) {
                        images = resultObj.images.map((img: any) => {
                            if (Array.isArray(img.url)) return img.url[0]
                            return img.url || img
                        })
                    } else if (Array.isArray(data.data)) {
                        images = data.data.map((item: any) => item.url || item.b64_json || item.image_url)
                    }
                }

                let errorMessage = undefined
                if (status === 'failed') {
                    const rawError = data.error || data.data?.error || 'Unknown error'
                    if (typeof rawError === 'string') errorMessage = rawError
                    else if (rawError?.message) errorMessage = rawError.message
                    else if (rawError?.error?.message) errorMessage = rawError.error.message
                    else errorMessage = JSON.stringify(rawError)
                }

                return { status, progress, images, error: errorMessage }

            } catch (e) {
                console.error(`Fetch error for ${tid}:`, e)
                await logSystem(db, 'ERROR', 'CHECK_STATUS', `Check fetch error for ${tid}`, e)
                return null
            }
        })

        const results = await Promise.all(checkPromises)

        // 聚合结果
        const allImages: string[] = []
        let totalProgress = 0
        let completedCount = 0
        let failedCount = 0
        let pendingCount = 0
        let firstError = ''

        for (const res of results) {
            if (!res) {
                pendingCount++
                continue
            }
            
            if (res.status === 'succeeded' || res.status === 'completed' || res.status === 'success') {
                completedCount++
                totalProgress += 100
                if (res.images) allImages.push(...res.images)
            } else if (res.status === 'failed') {
                failedCount++
                totalProgress += 100 // 失败也算结束
                if (!firstError) firstError = res.error || 'Unknown error'
            } else {
                pendingCount++
                totalProgress += (res.progress || 0)
            }
        }

        const avgProgress = Math.floor(totalProgress / taskIds.length)

        // 只要有一个成功，就算成功（部分成功也算）
        // 或者全部失败才算失败
        // 如果还有 pending，则整体 pending
        
        if (pendingCount > 0) {
             // 更新进度
             await execute(
                 db,
                 `UPDATE generations SET progress = ? WHERE id = ?`,
                 [avgProgress, generationId]
             )
             return c.json({ status: 'pending', progress: avgProgress })
        }
        
        if (completedCount > 0) {
             // 完成
             await execute(
                 db,
                 `UPDATE generations SET status = 'completed', result_urls = ?, progress = 100 WHERE id = ?`,
                 [JSON.stringify(allImages), generationId]
             )
             return c.json({ status: 'completed', progress: 100, result_urls: allImages })
        }
        
        if (failedCount === taskIds.length) {
             // 全部失败 (CAS)
             const updateResult = await execute(
                 db, 
                 `UPDATE generations SET status = 'failed', error_message = ? WHERE id = ? AND status = 'pending'`,
                 [JSON.stringify(firstError).substring(0, 255), generationId]
             )
             // 触发退款 (仅当成功更新状态时)
             if (updateResult.success && updateResult.meta.changes > 0) {
                 try {
                    const taskInfo = await queryOne<{ points_cost: number }>(
                        db,
                        'SELECT points_cost FROM generations WHERE id = ?',
                        [generationId]
                    )
                    if (taskInfo && taskInfo.points_cost > 0) {
                        await addPoints(
                            db,
                            user.userId,
                            taskInfo.points_cost,
                            `生成失败退款: ${generationId}`,
                            undefined,
                            Number(generationId),
                            'refund'
                        )
                    }
                 } catch (refundError) {
                     console.error('Refund failed during check:', refundError)
                 }
             }
             return c.json({ status: 'failed', error: firstError })
        }

        // 理论上不会走到这里，默认 pending
        return c.json({ status: 'pending', progress: avgProgress })

    } catch (e: any) {
        console.error('Check generation error:', e)
        try {
            if (c.env.DB) await logSystem(c.env.DB, 'ERROR', 'CHECK_STATUS_ERROR', 'Check status failed', e.message || e)
        } catch (err) { console.error('Failed to log check error', err) }
        return c.json({ error: '查询状态失败' }, 500)
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
      error_message?: string
    }>(
      db,
      `SELECT id, type, prompt, model, width, height, quality, quantity, 
              points_cost, status, result_urls, created_at, progress, error_message 
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
    try {
        if (c.env.DB) await logSystem(c.env.DB, 'ERROR', 'GET_HISTORY_ERROR', 'Get history failed', error.message || error)
    } catch (err) { console.error('Failed to log history error', err) }
    return c.json({ error: '获取历史失败', message: error.message }, 500)
    }
  })
  
  /**
   * 删除生成记录
   * DELETE /api/generation/:id
   */
  generationRoutes.delete('/:id', async (c: AuthContext) => {
    try {
      const user = c.get('user')
      const generationId = c.req.param('id')
      const db = c.env.DB
  
      // 1. 检查记录是否存在且属于当前用户
      const generation = await queryOne<{ id: number; status: string }>(
        db,
        'SELECT id, status FROM generations WHERE id = ? AND user_id = ?',
        [generationId, user.userId]
      )
  
      if (!generation) {
        return c.json({ error: '记录不存在或无权删除' }, 404)
      }
  
      // 保护正在进行的任务，避免后台更新失败或状态不一致
      if (generation.status === 'pending' || generation.status === 'processing') {
          return c.json({ error: '任务正在进行中，无法删除' }, 400)
      }
  
      // 2. 解除积分记录关联 (避免外键约束错误)
      // 我们将 related_generation_id 置为 NULL，这样可以保留扣分记录供用户查询，但断开与已删除记录的连接
      await execute(
        db,
        'UPDATE point_transactions SET related_generation_id = NULL WHERE related_generation_id = ?',
        [generationId]
      )
  
      // 3. 删除生成记录
      await execute(
        db,
        'DELETE FROM generations WHERE id = ?',
        [generationId]
      )
  
      return c.json({ success: true, id: generationId })
  
    } catch (error: any) {
      console.error('Delete generation error:', error)
      try {
        if (c.env.DB) await logSystem(c.env.DB, 'ERROR', 'DELETE_GEN_ERROR', 'Delete generation failed', error.message || error)
      } catch (err) { console.error('Failed to log delete error', err) }
      return c.json({ error: '删除失败', message: error.message }, 500)
    }
  })
  
  /**
   * 调用Nano Banana API的辅助函数
   */
async function callNanoBananaAPI(params: {
  db?: D1Database // 可选，用于记录日志
  apiKey: string
  apiUrl?: string
  providerType?: string // 新增
  type: string
  prompt: string
  referenceImageUrl?: string | null
  referenceImageBase64?: string
  model: string
  width: number
  height: number
  quality: string
  quantity: number
  size?: string
  resolution?: string
}): Promise<{ images: string[]; taskId?: string; status?: string }> {
  const baseUrl = params.apiUrl || 'https://api.apimart.ai'
  // 智能处理 Base URL：去除末尾斜杠，并去除末尾的 /v1 (防止重复拼接)
  const cleanBaseUrl = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '')
  const providerType = params.providerType || 'nano-banana'

  // 处理 API Key：去除首尾空格，去除可能的 "Bearer " 前缀（防止用户误填）
  let finalApiKey = params.apiKey.trim()
  if (finalApiKey.toLowerCase().startsWith('bearer ')) {
      finalApiKey = finalApiKey.substring(7).trim()
  }
  
  // 判断是否使用 Gemini 2.5 系列模型（需走 Chat Completions 接口）
  // 仅在 providerType 为 nano-banana 时生效
  // 新增：如果 providerType 为 'openai-chat'，强制走 Chat 逻辑
  const isGeminiChatModel = 
      providerType === 'openai-chat' || 
      (providerType === 'nano-banana' && (params.model.startsWith('gemini-2.5') || params.model.includes('nano-banana')))

  // 判断是否使用 Gemini 3 Pro (需走新的自定义 Images 接口)
  // 仅在 providerType 为 nano-banana 时生效 (Apimart 专用)
  const isGemini3Pro = providerType === 'nano-banana' && params.model.includes('gemini-3-pro')
  
  // 3. ZX2 异步轮询处理逻辑 (新增)
  const isZx2Async = providerType === 'zx2-async'
  if (isZx2Async) {
    // 针对 ZX2，确保 BaseURL 不包含 /api 或 /v1，避免拼接错误
    // 用户可能填 http://zx2.52youxi.cc/api 或 http://zx2.52youxi.cc/v1
    const zx2BaseUrl = cleanBaseUrl.replace(/\/api$/, '')
    const endpoint = `${zx2BaseUrl}/api/generate`

    // 优先使用传入的 size 参数，否则通过宽高计算
    let aspectRatio = params.size
    
    if (!aspectRatio || !aspectRatio.includes(':')) {
        // 计算宽高比字符串
        const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
        const divisor = gcd(params.width, params.height)
        aspectRatio = `${params.width / divisor}:${params.height / divisor}`
    }
    
    // 映射到标准比例 (保持原有逻辑)
    const ratioMap: Record<string, string> = {
      '1:1': '1:1', '4:3': '4:3', '3:4': '3:4', '16:9': '16:9', '9:16': '9:16',
      '2:3': '2:3', '3:2': '3:2', '4:5': '4:5', '5:4': '5:4', '21:9': '21:9',
      '1024:768': '4:3', '768:1024': '3:4', '1920:1080': '16:9', '1080:1920': '9:16'
    }
    if (ratioMap[aspectRatio]) {
      aspectRatio = ratioMap[aspectRatio]
    }

    // 分辨率处理 (文档要求必须大写: 1K, 2K, 4K)
    let imageSize = (params.resolution || '1K').toUpperCase()
    
    const requestBody: any = {
      model: 'nano-banana-pro', // 固定值
      prompt: params.prompt,
      aspectRatio: aspectRatio,
      imageSize: imageSize,
      urls: []
    }

    // 处理参考图
    if (params.referenceImageBase64) {
        // 优先使用 Base64
        let imageUrl = params.referenceImageBase64
        if (!imageUrl.startsWith('data:image')) {
            imageUrl = `data:image/jpeg;base64,${imageUrl}`
        }
        // ZX2 可能不支持 Base64 URL，但既然是 urls 字段，我们尝试放进去
        // 建议：如果ZX2只支持http链接，这里可能需要上传到 R2 后给公开链接
        // 目前先兼容 Base64
        requestBody.urls = [imageUrl]
    } else if (params.referenceImageUrl && params.referenceImageUrl.startsWith('http')) {
        requestBody.urls = [params.referenceImageUrl]
    }

    if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Calling ${endpoint}`, { model: params.model, body: requestBody })

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
        const errorText = await response.text()
        if (params.db) await logSystem(params.db, 'ERROR', 'API_DEBUG', `API Submit Failed: ${response.status}`, { error: errorText, keyPrefix: params.apiKey.substring(0, 5) + '...' })
        
        // 针对 ZX2 404 错误的专门提示
        if (response.status === 404 && errorText.includes('Invalid URL')) {
             throw new Error(`API路径不支持 (/api/generate)。检测到您使用的是 NewAPI/OneAPI 站点 (如 zx2.52youxi.cc)，请在后台将供应商类型修改为 "Nano Banana" 或 "OpenAI"，它们使用标准的 /v1 接口。`)
        }

        throw new Error(`API提交失败: ${response.status} ${errorText.substring(0, 100)}`)
    }

    const data: any = await response.json()
    if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Submit Response`, data)
    
    if (data.code !== 0) {
        throw new Error(`API错误: ${data.msg || JSON.stringify(data)}`)
    }

    const taskId = data.data?.id
    if (!taskId) {
        throw new Error('未返回任务ID')
    }

    if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Task ID: ${taskId}, initial submit success.`)
    
    return { images: [], taskId, status: 'pending' }
  }

  // 1. Gemini 3 Pro 处理逻辑 (新接口，异步轮询)
  if (isGemini3Pro) {
    const endpoint = `${cleanBaseUrl}/v1/images/generations`

    // 优先使用传入的 size 参数，否则通过宽高计算
    let aspectRatio = params.size
    
    if (!aspectRatio || !aspectRatio.includes(':')) {
        // 计算宽高比字符串
        const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
        const divisor = gcd(params.width, params.height)
        aspectRatio = `${params.width / divisor}:${params.height / divisor}`
        
        // 映射到标准比例 (保持原有逻辑)
        const ratioMap: Record<string, string> = {
          '1:1': '1:1', '4:3': '4:3', '3:4': '3:4', '16:9': '16:9', '9:16': '9:16',
          '2:3': '2:3', '3:2': '3:2', '4:5': '4:5', '5:4': '5:4', '21:9': '21:9',
          '1024:768': '4:3', '768:1024': '3:4', '1920:1080': '16:9', '1080:1920': '9:16'
        }
        if (ratioMap[aspectRatio]) {
          aspectRatio = ratioMap[aspectRatio]
        }
    }

    // 优先使用传入的 resolution 参数，否则通过宽高估算
    let resolution = params.resolution
    
    if (!resolution) {
        // 分辨率映射
        resolution = '1K'
        const maxDim = Math.max(params.width, params.height)
        if (maxDim >= 3000) resolution = '4K'
        else if (maxDim >= 2000) resolution = '2K'
    }

    const requestBody: any = {
      model: params.model,
      prompt: params.prompt,
      size: aspectRatio, // "1:1"
      n: 1, // 强制为 1，API 文档限制
      resolution: resolution // "1K", "2K", "4K"
    }

    // 处理参考图 (图生图)
    if (params.referenceImageBase64) {
        // 优先使用 Base64，确保包含 data:image 前缀
        let imageUrl = params.referenceImageBase64
        if (!imageUrl.startsWith('data:image')) {
            imageUrl = `data:image/jpeg;base64,${imageUrl}`
        }
        requestBody.image_urls = [imageUrl]
    } else if (params.referenceImageUrl && params.referenceImageUrl.startsWith('http')) {
        // 其次使用公开 URL
        requestBody.image_urls = [params.referenceImageUrl]
    }

    // console.log(`[API Debug] Calling ${endpoint} with model ${params.model}`)
    // console.log(`[API Debug] Request Body:`, JSON.stringify(requestBody, null, 2))
    if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Calling ${endpoint}`, { model: params.model, body: requestBody })

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000) // 提交任务超时较短
    })

    if (!response.ok) {
        const errorText = await response.text()
        if (params.db) await logSystem(params.db, 'ERROR', 'API_DEBUG', `API Submit Failed: ${response.status}`, errorText)
        throw new Error(`API提交失败: ${response.status} ${errorText.substring(0, 100)}`)
    }

    const data: any = await response.json()
    // console.log(`[API Debug] Submit Response:`, JSON.stringify(data, null, 2))
    if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Submit Response`, data)
    
    // 优先检查是否直接返回了图片 (同步模式兼容)
    if (data.data && Array.isArray(data.data) && data.data.length > 0 && (data.data[0].url || data.data[0].image_url)) {
        const images = data.data.map((item: any) => item.url || item.image_url).filter((url: string) => !!url)
        if (images.length > 0) {
             if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Sync response received`, { images })
             return { images, status: 'completed' }
        }
    }

    // 获取 Task ID
    // 兼容两种格式：直接在 data.data[0].task_id 或直接在 data.task_id
    const taskId = data.data?.[0]?.task_id || data.task_id

    if (!taskId) {
        // 如果没有 task_id 也没有图片，抛出详细错误
        throw new Error(`API返回格式无法识别: 未找到 task_id 或 images。响应数据: ${JSON.stringify(data).substring(0, 200)}`)
    }

    // 开始轮询
    // 优化：移除提交时的忙等轮询，直接返回 TaskID，交由前端接力轮询
    // 这对于耗时较长（如 >15s）的任务能显著减少 Worker 资源占用
    if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Task ID: ${taskId}, initial submit success. Returning to client for polling.`)
    
    return { images: [], taskId, status: 'pending' }
  }

  // 2. Gemini 2.5 / Nano Banana 处理逻辑 (Chat Completions 接口)
  if (isGeminiChatModel) {
    // ... Gemini 处理逻辑不变 ...
    const endpoint = `${cleanBaseUrl}/v1/chat/completions`
    
    // 计算宽高比字符串
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
    const divisor = gcd(params.width, params.height)
    // 优先使用 params.size，否则通过宽高计算
    let aspectRatio = params.size
    
    // 如果没有 size，或者 size 是旧版默认的 "1024x1024" 这种格式（不含冒号），则重新计算
    if (!aspectRatio || !aspectRatio.includes(':')) {
         aspectRatio = `${params.width / divisor}:${params.height / divisor}`
    }
    
    // 映射到标准比例 (保持原有逻辑)
    // 根据 API 文档，OpenAI 格式下的 imageConfig 需要标准比例字符串
    const ratioMap: Record<string, string> = {
      '1:1': '1:1',
      '4:3': '4:3',
      '3:4': '3:4',
      '16:9': '16:9',
      '9:16': '9:16',
      // 部分模型可能不支持非标比例，这里尽量归一化
      '2:3': '2:3', '3:2': '3:2', '4:5': '4:5', '5:4': '5:4', '21:9': '21:9',
      '1024:768': '4:3', '768:1024': '3:4', '1920:1080': '16:9', '1080:1920': '9:16'
    }
    if (ratioMap[aspectRatio]) {
      aspectRatio = ratioMap[aspectRatio]
    }

    // 构建消息体
    const messages: any[] = []
    
    // 关键修正：对于 NewAPI/OneAPI 转接的 Google Gemini 格式，
    // 需要通过 system prompt 传递 imageConfig (aspectRatio)
    // 同时也对 openai-chat 类型启用此功能
    messages.push({
        role: 'system',
        content: JSON.stringify({ imageConfig: { aspectRatio: aspectRatio } })
    })
    
    // 构建用户消息
    const userContent: any[] = []
    
    // 处理参考图
    if (params.type === 'image_to_image' && (params.referenceImageUrl || params.referenceImageBase64)) {
      let imageUrl = params.referenceImageUrl
      
      // 优先使用 Base64 (兼容本地调试和无公网 R2 场景)
      if (params.referenceImageBase64) {
          imageUrl = params.referenceImageBase64
      } else if (imageUrl && imageUrl.startsWith('/')) {
          // 只有在没有 Base64 且 URL 是相对路径时尝试补全
          // 但在本地调试时，这通常依然无效，所以 Base64 是首选
          const frontendUrl = 'https://ai-image-generator-frontend.pages.dev' 
          imageUrl = `${frontendUrl}${imageUrl}`
      }

      userContent.push({
        type: 'text',
        text: params.prompt
      })
      
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageUrl
        }
      })
    } else {
        // 文生图
        userContent.push({
            type: 'text',
            text: params.prompt
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
      max_tokens: 1500, 
      temperature: 0.7
    }
    
    // gemini-2.5-flash-image 支持 extra_body 配置宽高比
    // 根据 NewAPI 文档，这部分也是需要的，双重保险
    if (params.model === 'gemini-2.5-flash-image' || params.model.includes('nano-banana') || params.model.includes('gemini-3-pro') || providerType === 'openai-chat') {
      requestBody.extra_body = {
        imageConfig: {
          aspectRatio: aspectRatio
        }
      }
    }
    
    // console.log(`[API Debug] Calling ${endpoint} with model ${params.model}`)
    // console.log(`[API Debug] Request Body:`, JSON.stringify(requestBody, null, 2))
    if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Calling ${endpoint}`, { model: params.model, body: requestBody })
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(180000) // 180秒超时
    })
    
    // console.log(`[API Debug] Response Status: ${response.status}`)

    if (!response.ok) {
        const errorText = await response.text()
        // console.log(`[API Debug] Error Response: ${errorText}`)
        if (params.db) await logSystem(params.db, 'ERROR', 'API_DEBUG', `API Submit Failed: ${response.status}`, errorText)
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
        throw new Error(`API调用失败: ${errorMessage.substring(0, 200)}`) // 截断错误信息
    }

    const data: any = await response.json()
    // console.log(`[API Debug] Success Response:`, JSON.stringify(data, null, 2))
    if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Submit Response`, data)
    // 解析 Chat Completion 响应中的图片链接
    // 假设图片链接在 content 中，可能是 markdown 格式 ![image](url) 或直接是 url
    const content = data.choices?.[0]?.message?.content || ''
    
    // 尝试匹配 Base64 数据
    const base64Match = content.match(/\((data:image\/[^;]+;base64,[^\)]+)\)/) || content.match(/(data:image\/[^;]+;base64,[^\s\)]+)/)
    
    // 尝试匹配 URL
    const urlMatch = content.match(/\((https?:\/\/[^\)]+)\)/) || content.match(/(https?:\/\/[^\s]+)/)
    
    if (base64Match) {
       // 如果是 Base64，直接返回作为图片源
       return { images: [base64Match[1] || base64Match[0]] }
    } else if (urlMatch) {
      return { images: [urlMatch[1] || urlMatch[0]] }
    } else if (content.length > 10 && content.startsWith('http')) {
       return { images: [content] }
    } else {
       console.warn('No image URL found in response:', content)
       if (content) return { images: [] } // 避免前端崩溃，但实际上是失败了
       throw new Error('未在响应中找到图片链接')
    }
    
  } else {
    // 默认走 OpenAI Image API (兼容 Nano Banana)
    const endpoint = `${cleanBaseUrl}/v1/images/generations`
    
    const requestBody: any = {
        model: params.model,
        prompt: params.prompt,
        n: params.quantity,
        size: `${params.width}x${params.height}`,
        response_format: 'url',
        // Nano Banana 可能不需要 quality 参数，或者需要特定的
        // quality: params.quality === 'ultra_hd' ? 'hd' : 'standard', 
    }

    // Nano Banana 参数调整：如果是 Nano Banana 系列，可能需要调整 size 格式或移除 quality
    if (params.model.includes('nano-banana')) {
       // 移除 response_format，使用默认值
       delete requestBody.response_format
       // 确保 quality 被移除
       delete requestBody.quality
    } else if (params.model.includes('dall-e')) {
       // 只有 DALL-E 模型才明确需要 quality
       requestBody.quality = params.quality === 'ultra_hd' ? 'hd' : 'standard'
    } else {
       // 对于其他模型（如 gemini-3-pro, flux, midjourney 等走标准 OpenAI 格式的），
       // 通常不需要 quality 参数，甚至可能因为传了这个参数而报错
       // 所以默认移除 quality
       delete requestBody.quality
    }

    if (params.type === 'image_to_image' && params.referenceImageUrl) {
        if (params.referenceImageUrl.startsWith('http')) {
           // 部分模型支持在 prompt 中加入图片 URL
           requestBody.prompt = `${params.referenceImageUrl} ${params.prompt}`
        }
    }

    // console.log(`[API Debug] Calling ${endpoint} with model ${params.model}`)
    // console.log(`[API Debug] Request Body:`, JSON.stringify(requestBody, null, 2))
    if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Calling ${endpoint}`, { model: params.model, body: requestBody })

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(180000) // 180秒超时
    })

    if (!response.ok) {
        const errorText = await response.text()
        if (params.db) await logSystem(params.db, 'ERROR', 'API_DEBUG', `API Submit Failed: ${response.status}`, errorText)
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
        throw new Error(`API调用失败: ${errorMessage.substring(0, 200)}`) // 截断错误信息
    }

    const data: any = await response.json()
    // console.log(`[API Debug] Submit Response:`, JSON.stringify(data, null, 2))
    if (params.db) await logSystem(params.db, 'INFO', 'API_DEBUG', `Submit Response`, data)
    
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

