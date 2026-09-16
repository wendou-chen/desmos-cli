const { chromium } = require('playwright-core');
const path = require('path');
const { findBrowserExecutable } = require('../src/browser');

async function testDshGui() {
  console.log('🚀 正在启动浏览器连接真实 DSH Web 实例 (http://127.0.0.1:3080)...');
  const browser = await chromium.launch({
    executablePath: findBrowserExecutable(),
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('GUI Console:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('GUI Error:', err));

  await page.goto('http://127.0.0.1:3080', { waitUntil: 'networkidle' });
  console.log('✅ DSH 页面已加载');

  // 等待会话和右侧边栏加载
  await page.waitForTimeout(2000);

  // 1. 寻找顶部的 "Desmos 画板" 按钮并点击
  const headerBtn = await page.locator('button:has-text("Desmos 画板")').first();
  const hasBtn = await headerBtn.isVisible().catch(() => false);
  console.log('顶栏是否有 Desmos 画板快捷按钮:', hasBtn);

  if (hasBtn) {
    console.log('点击顶栏 Desmos 画板按钮呼出右侧面板...');
    await headerBtn.click();
    await page.waitForTimeout(2000);
  } else {
    // 尝试在右侧边栏找卡片
    console.log('寻找右侧边栏中的卡片...');
    const card = page.locator('text=Desmos 数学画板').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(2000);
    }
  }

  // 检查 Desmos Canvas 是否存在
  const canvasLocator = page.locator('[data-dsh-desmos-canvas]');
  const isCanvasVisible = await canvasLocator.isVisible().catch(() => false);
  console.log('Desmos 画布容器是否可见:', isCanvasVisible);

  // 截取当前界面
  const imgPath1 = path.resolve(__dirname, 'e2e_gui_snapshot_initial.png');
  await page.screenshot({ path: imgPath1 });
  console.log('📸 截取初始状态:', imgPath1);

  // 2. 点击工具栏上的 [ 🌐 3D ] 按钮测试切换
  const btn3D = page.locator('button:has-text("3D")').first();
  if (await btn3D.isVisible().catch(() => false)) {
    console.log('点击 [ 🌐 3D ] 切换按钮...');
    await btn3D.click();
    await page.waitForTimeout(2000);

    const imgPath2 = path.resolve(__dirname, 'e2e_gui_snapshot_3d_switched.png');
    await page.screenshot({ path: imgPath2 });
    console.log('📸 截取点击 3D 后的状态:', imgPath2);
  } else {
    console.warn('未找到 [ 🌐 3D ] 按钮！');
  }

  await browser.close();
}

testDshGui().catch(console.error);
