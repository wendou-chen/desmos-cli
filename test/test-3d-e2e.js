const { chromium } = require('playwright-core');
const path = require('path');
const { findBrowserExecutable } = require('../src/browser');

async function testRender3D() {
  console.log('🚀 正在启动真实浏览器进行 Desmos 3D 端到端渲染测试...');
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
      <title>Desmos 3D Test</title>
      <style>
        html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: #131314; }
        #calculator { width: 100%; height: 100%; }
      </style>
    </head>
    <body>
      <div id="calculator"></div>
    </body>
    </html>
  `;
  await page.setContent(html);

  const apiPath = path.resolve(__dirname, '../assets/desmos_api.js');
  console.log('注入离线脚本:', apiPath);
  await page.addScriptTag({ path: apiPath });

  console.log('执行 Desmos.Calculator3D 实例化...');
  const res = await page.evaluate(() => {
    try {
      const elt = document.getElementById('calculator');
      if (!window.Desmos || typeof window.Desmos.Calculator3D !== 'function') {
        return { success: false, error: 'window.Desmos.Calculator3D is not a function' };
      }

      const calc = window.Desmos.Calculator3D(elt, {
        keypad: true,
        expressions: true,
        settingsMenu: true,
        invertedColors: true
      });

      calc.setExpression({ id: 'saddle', latex: 'z=x^2-y^2', color: '#3b82f6' });
      calc.setExpression({ id: 'plane', latex: 'z=0', color: '#10b981' });

      return {
        success: true,
        canvasCount: elt.querySelectorAll('canvas').length,
        hasWebgl: !!elt.querySelector('canvas.dcg-grapher-canvas, canvas'),
        childCount: elt.children.length
      };
    } catch (err) {
      return { success: false, error: err.stack || err.message };
    }
  });

  console.log('实例化评估结果:', res);

  // 等待渲染稳定
  await page.waitForTimeout(1500);

  const outImg = path.resolve(__dirname, '3d_verification_actual.png');
  await page.screenshot({ path: outImg });
  console.log('✅ 真实 3D 截图已保存至:', outImg);

  await browser.close();
  return res;
}

testRender3D().catch(console.error);
