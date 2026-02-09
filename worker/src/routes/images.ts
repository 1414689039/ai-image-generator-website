import { Hono } from 'hono'

export const imagesRoutes = new Hono<{ Bindings: { IMAGES: R2Bucket; IMAGES_OLD?: R2Bucket } }>()

imagesRoutes.get('/:key', async (c) => {
  const key = c.req.param('key')
  if (!key) return c.json({ error: 'Missing key' }, 400)
  try {
    console.log(`[R2 Debug] Requesting key: ${key}`)
    
    // 优先从新桶 (APAC) 读取
    let obj = await c.env.IMAGES.get(key)
    
    // 如果新桶没有，尝试从旧桶 (WNAM) 读取 (兼容旧图片)
    if (!obj && c.env.IMAGES_OLD) {
        console.warn(`[R2 Debug] Not found in APAC bucket, checking WNAM bucket: ${key}`)
        obj = await c.env.IMAGES_OLD.get(key)
    }
    
    if (!obj) {
        console.warn(`[R2 Debug] Object not found in any bucket: ${key}`)
        return c.json({ error: 'Not Found' }, 404)
    }

    const ct = obj.httpMetadata?.contentType || 'image/jpeg'
    const size = obj.size
    console.log(`[R2 Debug] Object found. Type: ${ct}, Size: ${size}`)

    const headers = new Headers()
    headers.set('content-type', ct)
    headers.set('content-length', String(size))
    headers.set('cache-control', 'public, max-age=31536000')
    headers.set('access-control-allow-origin', '*')
    
    // 关键修正：对于空体，返回特定错误
    if (!obj.body) {
         console.error(`[R2 Debug] Object body is empty: ${key}`)
         return c.json({ error: 'Image content is empty' }, 500)
    }

    return new Response(obj.body, { status: 200, headers })
  } catch (e: any) {
    console.error(`[R2 Debug] Read error:`, e)
    return c.json({ error: 'Read error', message: e.message || String(e) }, 500)
  }
})
