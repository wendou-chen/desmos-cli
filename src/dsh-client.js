const http = require('http');
const { normalizeLatex, formatLabel } = require('./utils');

const DEFAULT_DSH_PORT = 3080;
const DEFAULT_ANTI_PORT = 8325;

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
 * 探测 Antigravity Web 增强套件与 Desmos 画板服务是否在线
 * @param {number} port
 * @returns {Promise<boolean>}
 */
async function isAntiOnline(port = DEFAULT_ANTI_PORT) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/state`, (res) => {
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
 * 并发探测所有可用端点 (DSH 与 Antigravity)
 * @param {Object} options
 * @returns {Promise<{ dsh: boolean, antigravity: boolean }>}
 */
async function probeActiveTargets(options = {}) {
  const dshPort = options.dshPort || options.port || DEFAULT_DSH_PORT;
  const antiPort = options.antiPort || DEFAULT_ANTI_PORT;

  const [dsh, antigravity] = await Promise.all([
    isDshOnline(dshPort),
    isAntiOnline(antiPort)
  ]);

  return { dsh, antigravity };
}

/**
 * 底层 HTTP POST 发送辅助函数
 */
function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          resolve(json);
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`请求超时: ${url}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 向多端（DSH / Antigravity）内部 Desmos 画板推送公式 (支持 2D / 3D 自动或显式指定)
 * @param {Array<string|Object>} formulas
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function sendToDsh(formulas = [], options = {}) {
  const dshPort = options.dshPort || options.port || DEFAULT_DSH_PORT;
  const antiPort = options.antiPort || DEFAULT_ANTI_PORT;

  // 1. 并发探测多端在线状态
  const status = await probeActiveTargets({ dshPort, antiPort });

  const activeTargets = [];
  if (options.target === 'antigravity') {
    if (!status.antigravity) throw new Error(`Antigravity Desmos 服务未在 http://127.0.0.1:${antiPort} 运行`);
    activeTargets.push('antigravity');
  } else if (options.target === 'dsh') {
    if (!status.dsh) throw new Error(`DSH 实例未在 http://127.0.0.1:${dshPort} 运行，或插件未注入`);
    activeTargets.push('dsh');
  } else {
    // 默认自适应模式：哪端在线就推哪端，两端都在则多端广播！
    if (status.antigravity) activeTargets.push('antigravity');
    if (status.dsh) activeTargets.push('dsh');
  }

  if (activeTargets.length === 0) {
    throw new Error(`未检测到在线的数学画板实例 (DSH: http://127.0.0.1:${dshPort} / Antigravity: http://127.0.0.1:${antiPort} 均未运行)`);
  }

  // 2. 格式化表达式
  const formattedExprs = formulas.map((f, idx) => {
    if (typeof f === 'object' && f !== null) {
      const rawLabel = f.label || '';
      return {
        id: f.id || (options.append ? `expr_live_${Date.now()}_${idx}` : `expr_${idx + 1}`),
        latex: normalizeLatex(f.latex || f.expr || ''),
        label: rawLabel ? formatLabel(rawLabel) : undefined,
        showLabel: f.showLabel !== undefined ? f.showLabel : !!rawLabel,
        color: f.color || options.color || undefined,
        lineWidth: f.lineWidth || 3.5,
        hidden: f.hidden !== undefined ? f.hidden : false,
        pointStyle: f.pointStyle || undefined
      };
    }

    let latex = String(f);
    let label = undefined;
    if (latex.includes('#')) {
      const parts = latex.split('#');
      latex = parts[0].trim();
      label = formatLabel(parts.slice(1).join('#').trim());
    }

    return {
      id: options.append ? `expr_live_${Date.now()}_${idx}` : `expr_${idx + 1}`,
      latex: normalizeLatex(latex),
      label: label,
      showLabel: !!label,
      color: options.color || undefined,
      lineWidth: 3.5
    };
  });

  let targetDim = options.dimension || (options.threeD ? '3d' : (options.twoD ? '2d' : 'auto'));
  if (targetDim === 'auto') {
    const has3D = formattedExprs.some(e => {
      const s = (e.latex || '').replace(/\s+/g, '');
      return /\bz\b|[zZ]=|=[zZ]|\+z\^|\+z_|\([a-zA-Z0-9+\-*/.]+,[a-zA-Z0-9+\-*/.]+,[a-zA-Z0-9+\-*/.]+\)/.test(s);
    });
    targetDim = has3D ? '3d' : '2d';
  }

  const payload = {
    action: options.append ? 'append' : 'plot',
    dimension: targetDim,
    expressions: formattedExprs,
    bounds: options.bounds || null
  };

  // 3. 并发推送到所有活跃端点
  const sendPromises = activeTargets.map(async (t) => {
    if (t === 'antigravity') {
      const res = await postJson(`http://127.0.0.1:${antiPort}/api/plot`, payload);
      return { target: 'antigravity', res };
    } else {
      const res = await postJson(`http://127.0.0.1:${dshPort}/dsh-desmos/api/plot`, payload);
      return { target: 'dsh', res };
    }
  });

  const results = await Promise.all(sendPromises);

  return {
    success: true,
    targets: activeTargets,
    dimension: targetDim,
    expressions: formattedExprs,
    results
  };
}

/**
 * 清空内部 Desmos 画板 (多端广播)
 * @param {Object} options
 */
async function clearDsh(options = {}) {
  const dshPort = options.dshPort || options.port || DEFAULT_DSH_PORT;
  const antiPort = options.antiPort || DEFAULT_ANTI_PORT;

  const status = await probeActiveTargets({ dshPort, antiPort });
  const activeTargets = [];
  if (status.antigravity) activeTargets.push('antigravity');
  if (status.dsh) activeTargets.push('dsh');

  if (activeTargets.length === 0) {
    throw new Error('未检测到在线的数学画板实例');
  }

  const payload = { action: 'clear' };
  const tasks = activeTargets.map(t => {
    const url = t === 'antigravity'
      ? `http://127.0.0.1:${antiPort}/api/plot`
      : `http://127.0.0.1:${dshPort}/dsh-desmos/api/plot`;
    return postJson(url, payload);
  });

  await Promise.all(tasks);
  return { success: true, targets: activeTargets };
}

module.exports = {
  DEFAULT_DSH_PORT,
  DEFAULT_ANTI_PORT,
  isDshOnline,
  isAntiOnline,
  probeActiveTargets,
  sendToDsh,
  clearDsh
};
