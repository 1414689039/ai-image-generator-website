import { Hono } from 'hono'

export const proxyRoutes = new Hono()

proxyRoutes.get('/image', async (c) => {
  const url = c.req.query('url')
  if (!url) {
    return c.text('Missing url parameter', 400)
  }

  try {
    // 简单的 URL 验证
    new URL(url)
    
    // 发起请求
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    // 检查响应
    if (!response.ok) {
      return c.text(`Proxy failed: ${response.status}`, response.status)
    }

    // 复制响应头 (只复制必要的)
    const headers = new Headers()
    const contentType = response.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
    headers.set('cache-control', 'public, max-age=31536000') // 缓存一年
    headers.set('access-control-allow-origin', '*')

    return new Response(response.body, {
      status: response.status,
      headers
    })
  } catch (error: any) {
    return c.text(`Proxy error: ${error.message}`, 500)
  }
})
