const { chromium } = require('playwright-core');
const path = require('path');
const { findBrowserExecutable } = require('../src/browser');

async function testFullCanvas() {
  const browser = await chromium.launch({
    executablePath: findBrowserExecutable(),
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1000, height: 800 });

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        html, body, #calc { width: 100%; height: 100%; margin: 0; padding: 0; background: #ffffff; }
        /* 当收起模式时，彻底隐藏左侧列表，使 3D 画布 100% 满屏 */
        .dsh-hide-expressions .dcg-exppanel-outer__wrapper,
        .dsh-hide-expressions .dcg-expression-tray,
        .dsh-hide-expressions .dcg-exppanel-container {
          display: none !important;
        }
        .dsh-hide-expressions .dcg-graph-outer {
          left: 0 !important;
          width: 100% !important;
        }
      </style>
    </head>
    <body>
      <div id="calc" class="dsh-hide-expressions"></div>
    </body>
    </html>
  `);

  const apiPath = path.resolve(__dirname, '../../dsh-desmos-panel/assets/desmos_api.js');
  await page.addScriptTag({ path: apiPath });

  const res = await page.evaluate(() => {
    const elt = document.getElementById('calc');
    const calc = window.Desmos.Calculator3D(elt, {
      keypad: false,
      expressions: true,
      settingsMenu: true,
      invertedColors: false
    });
    calc.setExpression({ id: 'saddle', latex: 'z=x^2-y^2', color: '#2563eb' });
    calc.resize();
    return { success: true };
  });

  console.log('Result:', res);
  await page.waitForTimeout(1000);

  const outImg = path.resolve(__dirname, 'full_canvas_verification.png');
  await page.screenshot({ path: outImg });
  console.log('Saved to:', outImg);

  await browser.close();
}

testFullCanvas().catch(console.error);
