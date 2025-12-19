// Cloudflare Worker: Jupiter API 代理
// 部署后，所有 Jupiter 请求应发送到：https://您的Worker地址/jupiter/...
// 重要：需在Worker的环境变量中设置 JUPITER_ACCESS_KEY

export default {
  async fetch(request, env, ctx) {
    // 1. 处理跨域预检请求 (OPTIONS)
    // 允许前端网页直接从浏览器调用此代理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 2. 定义目标 Jupiter API 基地址
    const JUPITER_BASE_URL = 'https://api.jup.ag'; // 主API
    // 如需使用Lite API，请取消下一行注释并注释上一行
    // const JUPITER_BASE_URL = 'https://lite-api.jup.ag';

    // 3. 从环境变量获取 Jupiter API 密钥（必须已设置）
    const JUPITER_ACCESS_KEY = env.JUPITER_ACCESS_KEY;
    if (!JUPITER_ACCESS_KEY) {
      console.error('JUPITER_ACCESS_KEY 环境变量未设置。');
      return createErrorResponse('服务器配置错误：缺少API密钥。', 500);
    }

    // 4. 解析传入的请求URL，构建目标Jupiter URL
    const incomingUrl = new URL(request.url);
    // 从路径中移除 '/jupiter' 前缀以得到真实的API路径
    // 例如：/jupiter/v6/quote -> /v6/quote
    const apiPath = incomingUrl.pathname.replace(/^\/jupiter/, '');
    const targetUrl = `${JUPITER_BASE_URL}${apiPath}${incomingUrl.search}`;

    // （可选）控制台日志，便于在Cloudflare仪表板中调试
    console.log(`[Jupiter Proxy] ${request.method}: ${incomingUrl.pathname} -> ${targetUrl}`);

    try {
      // 5. 准备新的请求头，复制原始头并添加认证
      const newHeaders = new Headers(request.headers);
      // 移除可能存在的 Host 头，避免与目标服务器冲突
      newHeaders.delete('Host');
      // 添加 Jupiter API 认证头
      newHeaders.set('Authorization', `Bearer ${JUPITER_ACCESS_KEY}`);

      // 6. 构建转发到 Jupiter 的请求
      const modifiedRequest = new Request(targetUrl, {
        headers: newHeaders,
        method: request.method,
        body: request.body,
        // 设置请求超时（毫秒）
        cf: { fetchOptions: { timeout: 30000 } }, // 30秒超时
      });

      // 7. 发起请求并获取响应
      const response = await fetch(modifiedRequest);

      // 8. 复制响应，并添加允许跨域的头
      const responseBody = await response.text(); // 先读取body为文本
      const modifiedResponse = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
      modifiedResponse.headers.set('Cache-Control', 'no-store');

      // 9. 记录非成功响应用于调试
      if (!response.ok) {
        console.warn(`[Jupiter Proxy] 上游响应异常: ${response.status} ${response.statusText}`, responseBody.substring(0, 500));
      }

      return modifiedResponse;

    } catch (error) {
      // 10. 错误处理（网络错误、超时等）
      console.error(`[Jupiter Proxy Error] ${error.message}`);
      let status = 502;
      let message = '代理请求失败，请稍后重试。';

      if (error.message.includes('timeout')) {
        message = '连接到Jupiter服务超时。';
      } else if (error.message.includes('fetch')) {
        message = '无法连接到Jupiter服务。';
      }

      return createErrorResponse(message, status, { originalError: error.message });
    }
  },
};

// 辅助函数：创建统一的错误响应
function createErrorResponse(message, status = 500, extra = {}) {
  const errorBody = JSON.stringify({
    success: false,
    error: message,
    ...extra,
  });

  return new Response(errorBody, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}