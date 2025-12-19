// Cloudflare Worker: Jupiter API 代理
// 部署后，您所有的 Jupiter 请求都应发送到：https://您的Worker地址/jupiter/...

export default {
  async fetch(request, env, ctx) {
    // 1. 处理跨域预检请求 (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // 2. 定义要代理的目标 Jupiter API 基地址
    // 默认使用主 API，如需 Lite API，请将下一行注释并取消下下行的注释
    const JUPITER_BASE_URL = 'https://api.jup.ag';
    // const JUPITER_BASE_URL = 'https://lite-api.jup.ag'; // 备用选项

    // 3. 解析传入的请求URL
    const incomingUrl = new URL(request.url);
    // 从路径中移除 '/jupiter' 前缀以得到真实的API路径
    const apiPath = incomingUrl.pathname.replace('/jupiter', '');
    // 构建目标 URL
    const targetUrl = `${JUPITER_BASE_URL}${apiPath}${incomingUrl.search}`;

    // 4. (可选) 控制台日志，便于在Cloudflare仪表板中调试
    console.log(`[Jupiter Proxy] ${request.method}: ${incomingUrl.pathname} -> ${targetUrl}`);

    // 5. 复制原始请求，构造新的转发请求
    const modifiedRequest = new Request(targetUrl, {
      headers: request.headers,
      method: request.method,
      body: request.body,
    });

    try {
      // 6. 向 Jupiter API 发起请求
      const response = await fetch(modifiedRequest);

      // 7. 复制响应，并添加允许跨域的头
      const modifiedResponse = new Response(response.body, response);
      modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
      // 可选：确保内容类型正确
      modifiedResponse.headers.set('Content-Type', response.headers.get('Content-Type') || 'application/json');

      return modifiedResponse;

    } catch (error) {
      // 8. 错误处理
      console.error(`[Jupiter Proxy Error] ${error.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Proxy request failed',
          message: error.message,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};