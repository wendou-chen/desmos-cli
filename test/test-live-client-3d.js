const { chromium } = require('playwright-core');
const path = require('path');
const { findBrowserExecutable } = require('../src/browser');

async function testLiveClientWhite() {
  console.log('🚀 正在启动真实浏览器测试白色明亮主题下的 Desmos 3D 渲染...');
  const browser = await chromium.launch({
    executablePath: findBrowserExecutable(),
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });

  page.on('console', msg => console.log('浏览器控制台:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('浏览器报错:', err));

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>White Theme 3D Verification</title>
      <style>
        html, body, #mount { width: 100%; height: 100%; margin: 0; padding: 0; background: #ffffff; }
      </style>
    </head>
    <body>
      <div id="mount"></div>
    </body>
    </html>
  `;
  await page.setContent(html);

  const scriptUrl = 'http://127.0.0.1:3080/dsh-desmos/assets/desmos_api.js?_v=' + Date.now();
  await page.addScriptTag({ url: scriptUrl });

  const res = await page.evaluate(() => {
    try {
      const container = document.getElementById('mount');
      const calc = window.Desmos.Calculator3D(container, {
        keypad: true,
        expressions: true,
        settingsMenu: true,
        invertedColors: false // 默认纯白浅色模式！
      });

      calc.setExpression({ id: 'saddle', latex: 'z=x^2-y^2', color: '#2563eb' });
      calc.setExpression({ id: 'plane', latex: 'z=0', color: '#059669' });

      return {
        success: true,
        canvasCount: container.querySelectorAll('canvas').length
      };
    } catch (e) {
      return { success: false, error: e.stack };
    }
  });

  console.log('白色主题 3D 实例化结果:', res);
  await page.waitForTimeout(1500);

  const outPath = path.resolve(__dirname, 'client_3d_white_verified.png');
  await page.screenshot({ path: outPath });
  console.log('截图已保存至:', outPath);

  await browser.close();
}

testLiveClientWhite().catch(console.error);
