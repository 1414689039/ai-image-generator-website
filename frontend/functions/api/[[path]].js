export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // 目标 Worker 地址
  const TARGET_HOST = 'https://ai-image-generator-worker.a1414689039.workers.dev';
  
  // 构建新 URL
  // url.pathname 包含 /api/xxx
  // 我们直接将其拼接到 TARGET_HOST 后面
  const newUrl = TARGET_HOST + url.pathname + url.search;
  
  // 复制请求，但修改 URL
  // 注意：需要创建一个新的 Request 对象，因为原始 request 的属性可能是只读的
  const newRequest = new Request(newUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow'
  });

  // 发送请求并返回响应
  try {
    const response = await fetch(newRequest);
    return response;
  } catch (e) {
    return new Response('Proxy Error: ' + e.message, { status: 500 });
  }
}