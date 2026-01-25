/**
 * JWT工具函数
 * 使用Web Crypto API实现，兼容Cloudflare Workers
 */

interface JwtPayload {
  userId: number
  username: string
  isAdmin: boolean
  exp?: number
  iat?: number
}

// Base64 URL编码
function base64UrlEncode(data: Uint8Array | string): string {
  let base64: string
  if (typeof data === 'string') {
    base64 = btoa(unescape(encodeURIComponent(data)))
  } else {
    base64 = btoa(String.fromCharCode(...data))
  }
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Base64 URL解码
function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) {
    str += '='
  }
  try {
    return decodeURIComponent(escape(atob(str)))
  } catch {
    return atob(str)
  }
}

// 生成HMAC签名
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  return base64UrlEncode(new Uint8Array(signature))
}

// 验证HMAC签名
async function verify(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await sign(data, secret)
  return signature === expectedSignature
}

/**
 * 生成JWT令牌
 */
export async function signJWT(payload: JwtPayload, secret: string, expiresIn: string = '7d'): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }
  
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (expiresIn === '7d' ? 7 * 24 * 60 * 60 : 60 * 60) // 默认7天或1小时
  
  const jwtPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: exp,
  }
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload))
  const data = `${encodedHeader}.${encodedPayload}`
  
  const signature = await sign(data, secret)
  
  return `${data}.${signature}`
}

/**
 * 验证JWT令牌
 */
export async function verifyJWT(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }
  
  const [encodedHeader, encodedPayload, signature] = parts
  const data = `${encodedHeader}.${encodedPayload}`
  
  // 验证签名
  const isValid = await verify(data, signature, secret)
  if (!isValid) {
    throw new Error('Invalid JWT signature')
  }
  
  // 解析payload
  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload
  
  // 检查过期时间
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT expired')
  }
  
  return payload
}

