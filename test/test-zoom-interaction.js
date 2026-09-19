const { chromium } = require('playwright-core');
const path = require('path');
const { findBrowserExecutable } = require('../src/browser');

async function testZoomControls() {
  const browser = await chromium.launch({
    executablePath: findBrowserExecutable(),
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1000, height: 800 });

  await page.setContent('<div id="calc" style="width:100%;height:100%;"></div>');
  const apiPath = path.resolve(__dirname, '../../dsh-desmos-panel/assets/desmos_api.js');
  await page.addScriptTag({ path: apiPath });

  const res = await page.evaluate(() => {
    const elt = document.getElementById('calc');
    const calc = window.Desmos.Calculator3D(elt, {
      keypad: false,
      expressions: true,
      zoomButtons: true,
      settingsMenu: true,
      invertedColors: false
    });
    calc.setExpression({ id: 'saddle', latex: 'z=x^2-y^2', color: '#2563eb' });

    // 测试放大调用
    function zoomIn() {
      const btn = elt.querySelector('.dcg-action-zoomin');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }

    function zoomOut() {
      const btn = elt.querySelector('.dcg-action-zoomout');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }

    const z1 = zoomIn();
    const z2 = zoomIn();

    return { success: true, z1, z2 };
  });

  console.log('Zoom in clicked twice:', res);
  await page.waitForTimeout(1000);

  const outImg = path.resolve(__dirname, 'zoom_test_success.png');
  await page.screenshot({ path: outImg });
  console.log('Saved to:', outImg);

  await browser.close();
}

testZoomControls().catch(console.error);
