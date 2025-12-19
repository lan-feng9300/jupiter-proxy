// 极简测试代码 - 仅确认Worker能运行
export default {
  async fetch(request, env, ctx) {
    // 立即返回一个简单响应，不进行任何外部调用或复杂操作
    return new Response('Worker is ALIVE. Basic test passed.', {
      headers: { 'content-type': 'text/plain' }
    });
  }
};