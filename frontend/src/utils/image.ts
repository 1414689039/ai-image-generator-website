/**
 * 处理图片 URL
 * 如果是 HTTP 协议，且当前页面是 HTTPS，则走后端代理
 */
export function getOptimizedImageSrc(url: string | undefined | null): string {
    if (!url) return ''
    
    // 如果是 data URI，直接返回
    if (url.startsWith('data:')) return url
    
    // 如果是 HTTPS，直接返回
    if (url.startsWith('https://')) return url
    
    // 如果是 HTTP，则走代理
    if (url.startsWith('http://')) {
        // 使用环境变量中的 API URL，如果未定义则回退到相对路径
        const apiBase = import.meta.env.VITE_API_URL || '/api'
        return `${apiBase}/proxy/image?url=${encodeURIComponent(url)}`
    }
    
    return url
}
