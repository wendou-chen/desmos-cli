const { chromium } = require('playwright-core');
const path = require('path');
const { findBrowserExecutable } = require('../src/browser');

async function testSincContinuous() {
  const browser = await chromium.launch({
    executablePath: findBrowserExecutable(),
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 600 });

  await page.setContent('<div id="calc" style="width:100%;height:100%;"></div>');
  const apiPath = path.resolve(__dirname, '../../dsh-desmos-panel/assets/desmos_api.js');
  await page.addScriptTag({ path: apiPath });

  const res = await page.evaluate(() => {
    const elt = document.getElementById('calc');
    const calc = window.Desmos.GraphingCalculator(elt, {
      keypad: false,
      expressions: false,
      settingsMenu: true,
      zoomButtons: true,
      invertedColors: false
    });

    // 1. 周期方波
    calc.setExpression({
      id: 'expr_1',
      latex: 'y=\\operatorname{sign}(\\sin(\\frac{\\pi}{4}x))',
      color: '#2563eb',
      lineWidth: 3.5
    });

    // 2. 修复后的连续 sinc 曲线 (分段补齐 x=0 处的极限点 4)
    calc.setExpression({
      id: 'expr_2',
      latex: 'y=\\left\\{x=0:4,\\ \\frac{\\sin(4x)}{x}\\right\\}',
      color: '#16a34a',
      lineWidth: 3.5
    });

    // 3. 过零点
    calc.setExpression({
      id: 'expr_3',
      latex: '([\\pi/4, 2*\\pi/4, 3*\\pi/4, 4*\\pi/4, \\pi], [0, 0, 0, 0, 0])',
      color: '#9333ea',
      pointSize: 12
    });

    calc.setMathBounds({ left: -2, right: 8, bottom: -2, top: 5 });

    return { success: true };
  });

  console.log('Result:', res);
  await page.waitForTimeout(500);

  const out = path.resolve(__dirname, 'sinc_continuous_verified.png');
  await page.screenshot({ path: out });
  console.log('Saved to:', out);

  await browser.close();
}

testSincContinuous().catch(console.error);
