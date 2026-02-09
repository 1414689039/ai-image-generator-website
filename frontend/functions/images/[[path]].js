export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);
  
  // 获取图片路径，例如 /images/gen_123.png -> gen_123.png
  // 注意：params.path 是一个数组
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  
  if (!key) {
    return new Response('Missing key', { status: 400 });
  }

  // 目标 Worker URL
  const targetUrl = `https://ai-image-generator-worker.a1414689039.workers.dev/images/${key}`;

  try {
    // 发起请求到 Worker
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
    });

    // 创建新的 Response，透传 Worker 的响应
    const newResponse = new Response(response.body, response);
    
    // 确保设置 CORS 头
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    
    return newResponse;
  } catch (e) {
    return new Response(`Proxy Error: ${e.message}`, { status: 500 });
  }
}