const { chromium } = require('playwright-core');
const path = require('path');
const { findBrowserExecutable } = require('../src/browser');

async function testOptions() {
  const browser = await chromium.launch({
    executablePath: findBrowserExecutable(),
    headless: true
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('浏览器控制台:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('页面错误:', err.message));
  
  await page.setContent('<div id="calc" style="width:800px;height:600px;"></div>');
  const apiPath = path.resolve(__dirname, '../../dsh-desmos-panel/assets/desmos_api.js');
  await page.addScriptTag({ path: apiPath });
  
  const res = await page.evaluate(() => {
    try {
      const elt = document.getElementById('calc');
      const options = {
        keypad: true,
        expressions: true,
        settingsMenu: true,
        invertedColors: true,
        fontSize: 14,
        border: false
      };
      console.log('window.Desmos keys:', Object.keys(window.Desmos || {}));
      console.log('window.Desmos.Calculator3D type:', typeof window.Desmos.Calculator3D);
      const calc = window.Desmos.Calculator3D(elt, options);
      return {
        success: true,
        calcType: typeof calc,
        hasSetExpression: typeof calc.setExpression,
        is3DCanvas: !!elt.querySelector('.dcg-3d-container, .dcg-grapher-3d, canvas')
      };
    } catch (err) {
      return { success: false, error: err.stack };
    }
  });
  
  console.log('Test Result:', res);
  await page.screenshot({ path: path.resolve(__dirname, 'test_calc3d_res.png') });
  await browser.close();
}

testOptions().catch(console.error);
