const path = require('path');
const fs = require('fs');
const { Command } = require('commander');
const { DesmosEngine } = require('./engine');
const { processVaultOutput, formatObsidianMarkdown } = require('./obsidian');
const { openInViewer, generateOutputFilename } = require('./utils');
const { findBrowserExecutable } = require('./browser');

function createCli() {
  const program = new Command();

  program
    .name('desmos')
    .description('Desmos 智能图形计算器与 Obsidian 数学公式可视化 CLI')
    .version('1.0.0');

  // ==========================================
  // 命令 1: render / plot (渲染与绘制数学图形)
  // ==========================================
  program
    .command('render [formulas...]')
    .alias('plot')
    .description('将单条或多条数学公式（LaTeX）渲染并导出为高分辨率图形图片')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-b, --bounds <bounds>', '视窗数学边界，格式: xmin,xmax,ymin,ymax (如 -10,10,-5,5 或 -2pi,2pi,-1,1)')
    .option('-o, --output <path>', '输出 PNG 图片文件路径')
    .option('-d, --dark', '使用深色模式（黑色背景，高对比亮色曲线，适配暗黑主题）', false)
    .option('-l, --light', '使用浅色模式（默认）', true)
    .option('-p, --projector', '开启投影粗线模式（文字更大、线条更粗清晰）', true)
    .option('--no-projector', '关闭投影模式')
    .option('--polar', '极坐标模式（启用极坐标同心圆与射线网格）', false)
    .option('--degree', '角度制（默认弧度制）', false)
    .option('--hide-grid', '隐藏网格线', false)
    .option('--hide-axes', '隐藏坐标轴', false)
    .option('--hide-numbers', '隐藏刻度数字', false)
    .option('--xlabel <label>', 'X 轴标签（如 "x", "时间 (t)" 等）', '')
    .option('--ylabel <label>', 'Y 轴标签（如 "y", "位移 s(t)" 等）', '')
    .option('--width <number>', '视窗基础宽度（像素）', (v) => parseInt(v, 10), 1200)
    .option('--height <number>', '视窗基础高度（像素）', (v) => parseInt(v, 10), 800)
    .option('--scale <number>', '像素缩放倍率 (DPR 2x = 高清 Retina)', (v) => parseInt(v, 10), 2)
    .option('-v, --view', '生成后立即在系统默认查看器中打开图片', false)
    .option('-j, --json', '以 JSON 结构化格式输出结果（供 Agent 和管道解析）', false)
    .action(async (formulas, options) => {
      try {
        const expressions = [...(formulas || []), ...(options.expr || [])];
        if (expressions.length === 0) {
          console.error('❌ 错误: 请至少提供一条数学公式，例如: desmos render "y=\\sin(x)"');
          process.exit(1);
        }

        const isDark = !!options.dark;
        const engine = new DesmosEngine();

        const result = await engine.render({
          expressions,
          bounds: options.bounds,
          dark: isDark,
          projector: options.projector !== false,
          polar: !!options.polar,
          degree: !!options.degree,
          showGrid: !options.hideGrid,
          showAxes: !options.hideAxes,
          showNumbers: !options.hideNumbers,
          xAxisLabel: options.xlabel,
          yAxisLabel: options.ylabel,
          width: options.width,
          height: options.height,
          scale: options.scale,
          output: options.output
        });

        await engine.close();

        if (options.view) {
          openInViewer(result.outputPath);
        }

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            outputPath: result.outputPath,
            width: result.width,
            height: result.height,
            expressions: result.expressions
          }, null, 2));
        } else {
          console.log(`✅ 图形渲染成功！`);
          console.log(`📁 输出文件: ${result.outputPath}`);
          console.log(`📐 分辨率: ${result.width} x ${result.height} px`);
          console.log(`📊 包含公式数: ${expressions.length}`);
          expressions.forEach((expr, i) => console.log(`   [${i + 1}] ${expr}`));
        }
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: err.message }));
        } else {
          console.error(`❌ 渲染失败: ${err.message}`);
        }
        process.exit(1);
      }
    });

  // ==========================================
  // 命令 2: obsidian (直接接入 Obsidian 笔记与 Vault)
  // ==========================================
  program
    .command('obsidian [formulas...]')
    .description('渲染数学图形并自动存入 Obsidian Vault，生成图文并茂的 Markdown 笔记嵌入代码')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-b, --bounds <bounds>', '视窗数学边界，格式: xmin,xmax,ymin,ymax')
    .option('--vault <path>', 'Obsidian Vault 的根目录路径')
    .option('--note <path>', '目标笔记文件相对路径或绝对路径（如 "高等数学/函数图像.md"），自动追加内容')
    .option('--attach <folder>', '附件子目录名称（默认 "attachments"）', 'attachments')
    .option('--title <title>', '公式图形标题（如 "正弦与余弦正交性"）', '')
    .option('--img-width <number>', 'Obsidian 预览图片宽度', (v) => parseInt(v, 10), 600)
    .option('-d, --dark', '深色模式（与 Obsidian 深色主题融为一体）', false)
    .option('-v, --view', '生成后在系统默认查看器中打开', false)
    .option('-j, --json', '输出 JSON 格式', false)
    .action(async (formulas, options) => {
      try {
        const expressions = [...(formulas || []), ...(options.expr || [])];
        if (expressions.length === 0) {
          console.error('❌ 错误: 请至少提供一条数学公式，例如: desmos obsidian "y=x^2"');
          process.exit(1);
        }

        const engine = new DesmosEngine();

        // 确定保存路径与 Vault 处理
        let targetOutputPath = null;
        let vaultInfo = null;

        if (options.vault) {
          const vaultAbs = path.resolve(options.vault);
          const attachDir = path.join(vaultAbs, options.attach);
          const imgName = generateOutputFilename('desmos_plot', 'png');
          targetOutputPath = path.join(attachDir, imgName);

          vaultInfo = processVaultOutput({
            vaultPath: options.vault,
            notePath: options.note,
            attachmentFolder: options.attach,
            customFilename: imgName,
            expressions,
            bounds: options.bounds,
            title: options.title,
            imageWidth: options.imgWidth,
            useWikiLink: true
          });
        }

        const result = await engine.render({
          expressions,
          bounds: options.bounds,
          dark: !!options.dark,
          output: targetOutputPath
        });

        await engine.close();

        if (options.view) {
          openInViewer(result.outputPath);
        }

        const imgFilename = path.basename(result.outputPath);
        const mdSnippet = vaultInfo ? vaultInfo.markdownSnippet : formatObsidianMarkdown({
          imageRelativePath: imgFilename,
          imageFilename: imgFilename,
          expressions,
          bounds: options.bounds,
          title: options.title,
          imageWidth: options.imgWidth,
          useWikiLink: true
        });

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            outputPath: result.outputPath,
            markdownSnippet: mdSnippet,
            noteUpdated: vaultInfo ? vaultInfo.noteUpdated : false,
            noteFile: vaultInfo ? vaultInfo.noteFile : null
          }, null, 2));
        } else {
          console.log('🎉 Obsidian 图形导出成功！');
          console.log(`📁 图片存储: ${result.outputPath}`);
          if (vaultInfo && vaultInfo.noteUpdated) {
            console.log(`📝 已自动写入笔记: ${vaultInfo.noteFile}`);
          }
          console.log('\n📋 Obsidian Markdown 嵌入代码（可直接复制粘贴）:');
          console.log('--------------------------------------------------');
          console.log(mdSnippet);
          console.log('--------------------------------------------------');
        }
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: err.message }));
        } else {
          console.error(`❌ 处理失败: ${err.message}`);
        }
        process.exit(1);
      }
    });

  // ==========================================
  // 命令 3: batch (从文件批量读取并绘制)
  // ==========================================
  program
    .command('batch')
    .description('从文本文件中批量读取多行数学公式并一次性绘制到同一图形')
    .requiredOption('-f, --file <path>', '公式文本文件路径（每行一条公式）')
    .option('-b, --bounds <bounds>', '视窗数学边界')
    .option('-o, --output <path>', '输出图片文件路径')
    .option('-d, --dark', '深色模式', false)
    .option('-v, --view', '生成后打开查看', false)
    .option('-j, --json', 'JSON 格式输出', false)
    .action(async (options) => {
      try {
        const filePath = path.resolve(options.file);
        if (!fs.existsSync(filePath)) {
          throw new Error(`文件不存在: ${filePath}`);
        }

        const lines = fs.readFileSync(filePath, 'utf-8')
          .split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#') && !l.startsWith('//'));

        if (lines.length === 0) {
          throw new Error('公式文件为空');
        }

        const engine = new DesmosEngine();
        const result = await engine.render({
          expressions: lines,
          bounds: options.bounds,
          dark: !!options.dark,
          output: options.output
        });

        await engine.close();

        if (options.view) {
          openInViewer(result.outputPath);
        }

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            outputPath: result.outputPath,
            count: lines.length,
            expressions: lines
          }, null, 2));
        } else {
          console.log(`✅ 批量绘制完成（共 ${lines.length} 条公式）！`);
          console.log(`📁 输出文件: ${result.outputPath}`);
        }
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: err.message }));
        } else {
          console.error(`❌ 批量绘制失败: ${err.message}`);
        }
        process.exit(1);
      }
    });

  // ==========================================
  // 命令 4: status (系统与引擎环境巡检)
  // ==========================================
  program
    .command('status')
    .description('巡检本地 Chrome/Edge 浏览器环境与 Desmos 离线引擎状态')
    .option('-j, --json', 'JSON 格式输出', false)
    .action(async (options) => {
      let browserPath = null;
      let browserOk = false;
      try {
        browserPath = findBrowserExecutable();
        browserOk = true;
      } catch {
        browserOk = false;
      }

      const apiJsPath = path.resolve(__dirname, '../assets/desmos_api.js');
      const apiOk = fs.existsSync(apiJsPath);
      let apiSizeKb = 0;
      if (apiOk) {
        apiSizeKb = Math.round(fs.statSync(apiJsPath).size / 1024);
      }

      const info = {
        browserAvailable: browserOk,
        browserPath: browserPath || '未检测到可用浏览器',
        offlineApiAvailable: apiOk,
        apiPath: apiJsPath,
        apiSizeKb: `${apiSizeKb} KB`,
        engineStatus: (browserOk && apiOk) ? 'READY' : 'INCOMPLETE'
      };

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
      } else {
        console.log('🩺 Desmos CLI 引擎状态巡检:');
        console.log(`  - 浏览器引擎: ${browserOk ? '✅ 已就绪 (' + browserPath + ')' : '❌ 未找到 Chrome/Edge'}`);
        console.log(`  - 离线计算核心: ${apiOk ? '✅ 已就绪 (' + apiSizeKb + ' KB)' : '❌ 离线资源缺失'}`);
        console.log(`  - 整体就绪状态: ${info.engineStatus === 'READY' ? '🟢 准备就绪 (Ready)' : '🔴 需修复'}`);
      }
    });

  return program;
}

module.exports = {
  createCli
};
