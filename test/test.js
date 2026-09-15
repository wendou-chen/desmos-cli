const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { DesmosEngine } = require('../src/engine');
const { formatObsidianMarkdown, normalizeLatex, parseBounds } = require('../src');

async function runTests() {
  console.log('🚀 开始 Desmos CLI 全面自动化测试...\n');
  const tempDir = path.join(__dirname, 'temp_output');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 1. 测试工具函数
  console.log('1️⃣ 测试 LaTeX 规范化与 Bounds 解析:');
  const latex1 = normalizeLatex('y=sin(x) + cos(2*x)');
  console.log('  - normalizeLatex("y=sin(x) + cos(2*x)") ->', latex1);
  assert(latex1.includes('\\sin') && latex1.includes('\\cos'), 'LaTeX 替换失败');

  const bounds1 = parseBounds('-10,10,-5,5');
  assert.deepStrictEqual(bounds1, { left: -10, right: 10, bottom: -5, top: 5 }, 'Bounds 解析失败');
  console.log('  - parseBounds("-10,10,-5,5") ->', bounds1);
  console.log('  ✅ 工具函数测试通过！\n');

  // 2. 测试 Obsidian Markdown 格式化
  console.log('2️⃣ 测试 Obsidian Markdown 格式化生成:');
  const md = formatObsidianMarkdown({
    imageRelativePath: 'attachments/plot.png',
    imageFilename: 'plot.png',
    expressions: ['y=\\sin(x)', 'y=\\cos(x)'],
    bounds: '-2pi,2pi,-1,1',
    title: '三角函数对照',
    imageWidth: 500,
    useWikiLink: true
  });
  console.log('  生成的 Markdown:\n' + md);
  assert(md.includes('![[plot.png|500]]'), 'WikiLink 生成错误');
  assert(md.includes('\\begin{aligned}'), 'LaTeX aligned 块生成错误');
  console.log('  ✅ Obsidian 格式化测试通过！\n');

  // 3. 测试引擎渲染能力
  console.log('3️⃣ 测试 Desmos 渲染引擎:');
  const engine = new DesmosEngine();

  // 3.1 浅色多项式与隐函数
  const out1 = path.join(tempDir, 'test_poly.png');
  console.log('  - 渲染用例 1: 笛卡尔叶形线与抛物线 (浅色)...');
  const res1 = await engine.render({
    expressions: [
      { latex: 'x^3+y^3-3xy=0', color: '#c74440', lineWidth: 4 },
      { latex: 'y=x^2-2', color: '#2d70b3', lineWidth: 3 }
    ],
    bounds: '-4,4,-4,4',
    dark: false,
    output: out1
  });
  assert(fs.existsSync(out1) && fs.statSync(out1).size > 1000, '用例 1 文件生成失败');
  console.log('    ✅ 用例 1 通过，文件大小:', fs.statSync(out1).size, 'bytes');

  // 3.2 深色极坐标玫瑰线
  const out2 = path.join(tempDir, 'test_rose_dark.png');
  console.log('  - 渲染用例 2: 极坐标四叶玫瑰线 (深色模式)...');
  const res2 = await engine.render({
    expressions: [
      { latex: 'r=2\\sin(2\\theta)', color: '#1dd1a1', lineWidth: 4 }
    ],
    bounds: '-3,3,-3,3',
    polar: true,
    dark: true,
    output: out2
  });
  assert(fs.existsSync(out2) && fs.statSync(out2).size > 1000, '用例 2 文件生成失败');
  console.log('    ✅ 用例 2 通过，文件大小:', fs.statSync(out2).size, 'bytes');

  await engine.close();
  console.log('\n🎉 全部自动化测试顺利通过 (All Tests Passed)！');
}

runTests().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
