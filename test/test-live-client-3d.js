const { chromium } = require('playwright-core');
const path = require('path');
const { findBrowserExecutable } = require('../src/browser');

async function testLiveClient() {
  console.log('🚀 正在启动真实浏览器测试客户端组件与 3D 实例化...');
  const browser = await chromium.launch({
    executablePath: findBrowserExecutable(),
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });

  page.on('console', msg => console.log('浏览器控制台:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('浏览器报错:', err));

  // 构造模拟 DSH 环境
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Client 3D Verification</title>
      <style>
        html, body, #mount { width: 100%; height: 100%; margin: 0; padding: 0; background: #131314; }
      </style>
    </head>
    <body>
      <div id="mount"></div>
    </body>
    </html>
  `;
  await page.setContent(html);

  // 加载带防强缓存 URL 的脚本
  const scriptUrl = 'http://127.0.0.1:3080/dsh-desmos/assets/desmos_api.js?_v=' + Date.now();
  console.log('加载脚本:', scriptUrl);
  await page.addScriptTag({ url: scriptUrl });

  const res = await page.evaluate(() => {
    try {
      const container = document.getElementById('mount');
      if (!window.Desmos || typeof window.Desmos.Calculator3D !== 'function') {
        return { success: false, error: 'window.Desmos.Calculator3D 不存在！' };
      }

      const calc = window.Desmos.Calculator3D(container, {
        keypad: true,
        expressions: true,
        settingsMenu: true,
        invertedColors: true
      });

      calc.setExpression({ id: 'saddle', latex: 'z=x^2-y^2', color: '#3b82f6' });
      calc.setExpression({ id: 'plane', latex: 'z=0', color: '#10b981' });

      return {
        success: true,
        canvasCount: container.querySelectorAll('canvas').length,
        hasWebgl: !!container.querySelector('canvas')
      };
    } catch (e) {
      return { success: false, error: e.stack };
    }
  });

  console.log('实例化测试结果:', res);
  await page.waitForTimeout(1500);

  const outPath = path.resolve(__dirname, 'client_3d_verified.png');
  await page.screenshot({ path: outPath });
  console.log('截图已保存至:', outPath);

  await browser.close();
}

testLiveClient().catch(console.error);
