const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

/**
 * 自动寻找本地安装的 Chromium / Chrome / Edge 浏览器可执行路径
 */
function findBrowserExecutable() {
  const candidatePaths = [
    // 环境变量优先
    process.env.CHROME_BIN,
    process.env.EDGE_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    // Google Chrome 常见 Windows 路径
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    // Microsoft Edge 常见 Windows 路径
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    // Brave / Chromium 常见路径
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
  ].filter(Boolean);

  for (const exePath of candidatePaths) {
    if (fs.existsSync(exePath)) {
      return exePath;
    }
  }

  throw new Error(
    '未在系统中找到 Chrome 或 Edge 浏览器可执行文件。请安装 Google Chrome 或 Microsoft Edge，或者设置环境变量 CHROME_BIN。'
  );
}

/**
 * 启动无头浏览器实例
 * @param {Object} options
 * @returns {Promise<import('playwright-core').Browser>}
 */
async function launchBrowser(options = {}) {
  const executablePath = options.executablePath || findBrowserExecutable();
  const headless = options.headless !== undefined ? options.headless : true;

  const browser = await chromium.launch({
    executablePath,
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--force-color-profile=srgb',
      ...(options.args || [])
    ]
  });

  return browser;
}

module.exports = {
  findBrowserExecutable,
  launchBrowser
};
