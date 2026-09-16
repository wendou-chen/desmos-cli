const http = require('http');
const { normalizeLatex } = require('./utils');

const DEFAULT_DSH_PORT = 3080;

/**
 * 探测 DSH Web 实例与 Desmos 插件路由是否在线
 * @param {number} port
 * @returns {Promise<boolean>}
 */
async function isDshOnline(port = DEFAULT_DSH_PORT) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/dsh-desmos/api/state`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * 向 DSH 内部 Desmos 画板推送公式 (支持 2D / 3D 自动或显式指定)
 * @param {Array<string>} formulas
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function sendToDsh(formulas = [], options = {}) {
  const port = options.port || DEFAULT_DSH_PORT;
  const isOnline = await isDshOnline(port);

  if (!isOnline) {
    throw new Error(`DSH 实例未在 http://127.0.0.1:${port} 运行，或 @dsh-external/dsh-desmos-panel 插件未注入`);
  }

  const formattedExprs = formulas.map((f, idx) => ({
    id: options.append ? `expr_live_${Date.now()}_${idx}` : `expr_${idx + 1}`,
    latex: normalizeLatex(f),
    color: options.color || undefined,
    lineWidth: 3.5
  }));

  const payload = JSON.stringify({
    action: options.append ? 'append' : 'plot',
    dimension: options.dimension || (options.threeD ? '3d' : (options.twoD ? '2d' : 'auto')),
    expressions: formattedExprs,
    bounds: options.bounds || null
  });

  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/dsh-desmos/api/plot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          resolve({ success: true, ...json, expressions: formattedExprs });
        } catch (err) {
          reject(new Error(`响应解析失败: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * 清空 DSH 内部 Desmos 画板
 * @param {Object} options
 */
async function clearDsh(options = {}) {
  const port = options.port || DEFAULT_DSH_PORT;
  const isOnline = await isDshOnline(port);

  if (!isOnline) {
    throw new Error(`DSH 实例未在 http://127.0.0.1:${port} 运行`);
  }

  const payload = JSON.stringify({ action: 'clear' });

  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/dsh-desmos/api/plot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      resolve({ success: true });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = {
  isDshOnline,
  sendToDsh,
  clearDsh
};
