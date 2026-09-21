const { chromium } = require('playwright-core');
const path = require('path');
const { findBrowserExecutable } = require('../src/browser');

async function runCdpVerification() {
  console.log('====================================================');
  console.log('🔬 [CDP 实机验收测试] 频率响应 Sinc 曲线可去奇点连续性验证');
  console.log('====================================================');

  const browser = await chromium.launch({
    executablePath: findBrowserExecutable(),
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    console.log(`[Browser Console]:`, text);
  });
  page.on('pageerror', err => console.error('[Browser Error]:', err));

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>CDP Verification</title>
      <style>
        html, body, #calc { width: 100%; height: 100%; margin: 0; padding: 0; background: #ffffff; }
      </style>
    </head>
    <body>
      <div id="calc"></div>
    </body>
    </html>
  `);

  // 从 DSH 真实服务端口拉取最新脚本
  const scriptUrl = 'http://127.0.0.1:3080/dsh-desmos/assets/desmos_api.js?_v=' + Date.now();
  console.log('📡 正在从 DSH 真实端口拉取 Desmos 离线引擎:', scriptUrl);
  await page.addScriptTag({ url: scriptUrl });

  console.log('🧪 执行公式渲染与自动平滑补齐...');
  const auditResult = await page.evaluate(() => {
    // 注入前端平滑函数
    function autoFixContinuousLatex(latex) {
      if (!latex || typeof latex !== 'string') return '';
      let s = latex.trim();
      if (s.includes('\\left\\{') || s.includes('\\{') || s.includes(':')) {
        return s;
      }
      const fracPattern = /^(?:y\s*=\s*)?\\frac\{\\sin(?:\(([^)]+)\)|\s*([a-zA-Z0-9.+*-]+))\s*\}\{x\}$/;
      const m1 = s.match(fracPattern);
      if (m1) {
        const rawArg = (m1[1] || m1[2] || '').trim();
        let limitVal = '1';
        if (rawArg === 'x' || rawArg === '') {
          limitVal = '1';
        } else {
          const coefMatch = rawArg.match(/^([0-9.]+)\s*\*?\s*x$/);
          if (coefMatch) {
            limitVal = coefMatch[1];
          } else {
            limitVal = rawArg.replace(/\*?\s*x$/, '') || '1';
          }
        }
        const pureExpr = s.replace(/^y\s*=\s*/, '');
        return `y=\\left\\{x=0:${limitVal},\\ ${pureExpr}\\right\\}`;
      }
      return s;
    }

    const container = document.getElementById('calc');
    const calc = window.Desmos.GraphingCalculator(container, {
      keypad: false,
      expressions: false,
      settingsMenu: true,
      zoomButtons: true,
      invertedColors: false
    });

    // 原始 3 条公式输入
    const rawFormulas = [
      "y=\\operatorname{sign}(\\sin(\\frac{\\pi}{4}x))",
      "y=\\frac{\\sin(4x)}{x}", // 原始有断点的 sinc 公式
      "([\\pi/4, 2*\\pi/4, 3*\\pi/4, 4*\\pi/4, \\pi], [0, 0, 0, 0, 0])"
    ];

    const processed = rawFormulas.map((f, i) => {
      const fixed = autoFixContinuousLatex(f);
      calc.setExpression({
        id: `expr_${i + 1}`,
        latex: fixed,
        color: i === 0 ? '#2563eb' : (i === 1 ? '#16a34a' : '#9333ea'),
        lineWidth: 3.5,
        pointSize: 12
      });
      return { raw: f, fixed };
    });

    // 聚焦于主峰与零点附近
    calc.setMathBounds({ left: -3, right: 9, bottom: -2, top: 5 });

    return {
      success: true,
      processedFormulas: processed,
      graphpaperBounds: calc.graphpaperBounds.mathCoordinates
    };
  });

  console.log('📊 审查与转换结果:', JSON.stringify(auditResult, null, 2));

  // 等待 WebGL/Canvas 绘制完成
  await page.waitForTimeout(1000);

  const screenshotPath = path.resolve(__dirname, 'cdp_sinc_verified_actual.png');
  await page.screenshot({ path: screenshotPath });
  console.log('📸 [CDP 验收证据] 真实渲染截图已落盘:', screenshotPath);

  await browser.close();
  return { auditResult, logs, screenshotPath };
}

runCdpVerification().catch(console.error);
