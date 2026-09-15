const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { findBrowserExecutable } = require('./browser');
const { normalizeLatex, parseBounds } = require('./utils');

const DEFAULT_PORT = 9333;

/**
 * 检查调试端口是否正在运行
 * @param {number} port
 * @returns {Promise<boolean>}
 */
async function isPortOpen(port = DEFAULT_PORT) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * 启动常驻的 Desmos 前台浏览器窗口（带 CDP 端口）
 * @param {Object} options
 */
async function startLiveSession(options = {}) {
  const port = options.port || DEFAULT_PORT;
  const isOpen = await isPortOpen(port);

  if (isOpen) {
    return { port, newlyStarted: false };
  }

  const exePath = findBrowserExecutable();
  const userDataDir = path.join(process.env.TEMP || 'C:\\Temp', 'desmos_cdp_profile');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const targetUrl = options.online 
    ? 'https://www.desmos.com/calculator?lang=zh-CN'
    : `file:///${path.resolve(__dirname, '../assets/desmos_api.js').replace(/\\/g, '/')}`;

  // 构造启动参数
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--start-maximized',
    'https://www.desmos.com/calculator?lang=zh-CN'
  ];

  const child = spawn(exePath, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  // 等待 CDP 端口就绪
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    if (await isPortOpen(port)) {
      return { port, newlyStarted: true };
    }
  }

  throw new Error(`启动浏览器超时，未能连接到端口 ${port}`);
}

/**
 * 连接到运行中的 Desmos 标签页
 * @param {number} port
 * @returns {Promise<{browser: import('playwright-core').Browser, page: import('playwright-core').Page}>}
 */
async function connectToLiveSession(port = DEFAULT_PORT) {
  const isOpen = await isPortOpen(port);
  if (!isOpen) {
    throw new Error(`未检测到运行中的 Desmos 会话 (端口 ${port})。请先运行: desmos start`);
  }

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const contexts = browser.contexts();
  const pages = contexts.flatMap(c => c.pages());

  let targetPage = pages.find(p => p.url().includes('desmos.com/calculator'));
  if (!targetPage && pages.length > 0) {
    targetPage = pages[0];
  }

  if (!targetPage) {
    throw new Error('未找到 Desmos 计算器页面标签');
  }

  return { browser, page: targetPage };
}

/**
 * 向正在运行的前台 Desmos 发送/更新公式
 * @param {Array<string>} formulas
 * @param {Object} options
 */
async function sendToLive(formulas = [], options = {}) {
  const port = options.port || DEFAULT_PORT;
  const { browser, page } = await connectToLiveSession(port);

  await page.waitForFunction(() => window.Calc !== undefined);

  const formattedExprs = formulas.map((f, i) => ({
    id: options.append ? `expr_live_${Date.now()}_${i}` : `expr_${i + 1}`,
    latex: normalizeLatex(f)
  }));

  const bounds = parseBounds(options.bounds);

  await page.evaluate((params) => {
    if (!params.append) {
      window.Calc.setBlank();
    }
    if (params.dark !== undefined) {
      window.Calc.updateSettings({ invertedColors: params.dark, projectorMode: true });
    }
    params.exprs.forEach(e => window.Calc.setExpression(e));
    if (params.b) {
      window.Calc.setMathBounds(params.b);
    }
  }, {
    exprs: formattedExprs,
    append: !!options.append,
    dark: options.dark,
    b: bounds
  });

  await browser.close();
}

/**
 * 清空正在运行的前台 Desmos
 * @param {Object} options
 */
async function clearLive(options = {}) {
  const port = options.port || DEFAULT_PORT;
  const { browser, page } = await connectToLiveSession(port);

  await page.evaluate(() => {
    window.Calc.setBlank();
  });

  await browser.close();
}

module.exports = {
  isPortOpen,
  startLiveSession,
  connectToLiveSession,
  sendToLive,
  clearLive
};
