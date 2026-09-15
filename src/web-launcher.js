const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { chromium } = require('playwright-core');
const { normalizeLatex, parseBounds, openInViewer } = require('./utils');
const { findBrowserExecutable } = require('./browser');

/**
 * 在本地生成全功能交互式 Desmos Web 页面并用系统浏览器打开
 * @param {Array<string>} rawFormulas
 * @param {Object} options
 * @returns {string} 生成的 HTML 路径
 */
function openInteractiveWorkspace(rawFormulas = [], options = {}) {
  const isDark = !!options.dark;
  const bounds = parseBounds(options.bounds);
  const apiJsPath = path.resolve(__dirname, '../assets/desmos_api.js').replace(/\\/g, '/');

  const formattedExprs = rawFormulas.map((f, i) => ({
    id: `expr_${i + 1}`,
    latex: normalizeLatex(f)
  }));

  const exprJson = JSON.stringify(formattedExprs);
  const boundsJson = bounds ? JSON.stringify(bounds) : 'null';

  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Desmos 数学图形工作区</title>
  <script src="file:///${apiJsPath}"></script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: ${isDark ? '#1e1e1e' : '#f8f9fa'};
    }
    #calculator {
      width: 100%;
      height: 100%;
    }
    #top-bar {
      position: absolute;
      top: 12px;
      right: 65px;
      z-index: 100;
      display: flex;
      gap: 10px;
      background: ${isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.92)'};
      padding: 8px 14px;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      backdrop-filter: blur(10px);
      border: 1px solid ${isDark ? '#333' : '#e5e5e5'};
    }
    .btn {
      background: #2d70b3;
      color: #fff;
      border: none;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn:hover {
      background: #1b538c;
      transform: translateY(-1px);
    }
    .btn.secondary {
      background: ${isDark ? '#3a3a3c' : '#f2f2f7'};
      color: ${isDark ? '#fff' : '#1c1c1e'};
      border: 1px solid ${isDark ? '#48484a' : '#d1d1d6'};
    }
    .btn.secondary:hover {
      background: ${isDark ? '#48484a' : '#e5e5ea'};
    }
  </style>
</head>
<body>
  <div id="top-bar">
    <button class="btn" onclick="exportPng()">📷 导出高清图片</button>
    <button class="btn secondary" onclick="toggleTheme()">🌓 切换深浅主题</button>
    <button class="btn secondary" onclick="copyObsidianMarkdown()">📋 复制 Obsidian 代码</button>
  </div>
  <div id="calculator"></div>
  <script>
    let isDark = ${isDark};
    const elt = document.getElementById('calculator');
    const calc = Desmos.GraphingCalculator(elt, {
      keypad: true,
      expressions: true,
      settingsMenu: true,
      zoomButtons: true,
      border: false,
      invertedColors: isDark,
      projectorMode: true
    });

    const initialExprs = ${exprJson};
    const initialBounds = ${boundsJson};

    initialExprs.forEach(e => calc.setExpression(e));
    if (initialBounds) {
      calc.setMathBounds(initialBounds);
    }

    function toggleTheme() {
      isDark = !isDark;
      calc.updateSettings({ invertedColors: isDark });
      document.body.style.background = isDark ? '#1e1e1e' : '#f8f9fa';
    }

    function exportPng() {
      calc.asyncScreenshot({
        width: 1600,
        height: 1000,
        targetPixelRatio: 2
      }, (dataUri) => {
        const a = document.createElement('a');
        a.download = 'desmos_graph_' + Date.now() + '.png';
        a.href = dataUri;
        a.click();
      });
    }

    function copyObsidianMarkdown() {
      const exprs = calc.getExpressions().filter(e => e.type === 'expression' && e.latex);
      let latexBlock = '';
      if (exprs.length === 1) {
        latexBlock = '$$\\n' + exprs[0].latex + '\\n$$';
      } else if (exprs.length > 1) {
        latexBlock = '$$\\n\\\\begin{aligned}\\n' + exprs.map((e, idx) => {
          const aligned = e.latex.replace(/(=|<=|>=|<|>|\\\\le|\\\\ge)/, '&$1');
          return '  ' + aligned + (idx < exprs.length - 1 ? ' \\\\\\\\' : '');
        }).join('\\n') + '\\n\\\\end{aligned}\\n$$';
      }
      
      const snippet = latexBlock + '\\n\\n![[desmos_graph.png|600]]';
      navigator.clipboard.writeText(snippet);
      alert('已将 Obsidian LaTeX 与图片嵌入代码复制到剪贴板！');
    }
  </script>
</body>
</html>`;

  // 保存到系统临时目录
  const tempHtmlPath = path.join(os.tmpdir(), 'desmos_interactive_workspace.html');
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

  // 用系统浏览器打开
  openInViewer(tempHtmlPath);
  return tempHtmlPath;
}

/**
 * 启动有头浏览器，直接打开 Desmos 官网并注入公式
 * @param {Array<string>} rawFormulas
 * @param {Object} options
 */
async function openOnlineDesmos(rawFormulas = [], options = {}) {
  const exePath = findBrowserExecutable();
  const bounds = parseBounds(options.bounds);
  const isDark = !!options.dark;

  const formattedExprs = rawFormulas.map((f, i) => ({
    id: `expr_${i + 1}`,
    latex: normalizeLatex(f)
  }));

  const browser = await chromium.launch({
    executablePath: exePath,
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  await page.goto('https://www.desmos.com/calculator?lang=zh-CN', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Calc !== undefined);

  await page.evaluate((params) => {
    window.Calc.setBlank();
    if (params.dark) {
      window.Calc.updateSettings({ invertedColors: true, projectorMode: true });
    }
    params.exprs.forEach((e) => {
      window.Calc.setExpression(e);
    });
    if (params.b) {
      window.Calc.setMathBounds(params.b);
    }
  }, {
    exprs: formattedExprs,
    b: bounds,
    dark: isDark
  });

  return { browser, page };
}

module.exports = {
  openInteractiveWorkspace,
  openOnlineDesmos
};
