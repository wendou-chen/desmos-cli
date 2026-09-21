const { chromium } = require('playwright-core');
const path = require('path');
const { findBrowserExecutable } = require('../src/browser');

async function test3DFullscreen() {
  const browser = await chromium.launch({
    executablePath: findBrowserExecutable(),
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 700 });

  await page.setContent('<div id="calc3d" style="width:100%;height:100%;"></div>');
  const apiPath = path.resolve(__dirname, '../../dsh-desmos-panel/assets/desmos_api.js');
  await page.addScriptTag({ path: apiPath });

  const res = await page.evaluate(() => {
    const elt = document.getElementById('calc3d');
    const calc = window.Desmos.Calculator3D(elt, {
      keypad: false,
      expressions: false, // 彻底不占位
      settingsMenu: true,
      zoomButtons: true,
      invertedColors: false
    });
    calc.setExpression({ id: 'saddle', latex: 'z=x^2-y^2', color: '#2563eb' });
    return { success: true };
  });

  console.log('Result 3D:', res);
  await page.waitForTimeout(500);

  const out = path.resolve(__dirname, 'pure_fullscreen_3d.png');
  await page.screenshot({ path: out });
  console.log('Saved to:', out);

  await browser.close();
}

test3DFullscreen().catch(console.error);
