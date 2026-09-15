const path = require('path');
const fs = require('fs');
const { Command } = require('commander');
const { DesmosEngine } = require('./engine');
const { processVaultOutput, formatObsidianMarkdown } = require('./obsidian');
const { openInViewer, generateOutputFilename } = require('./utils');
const { findBrowserExecutable } = require('./browser');
const { openInteractiveWorkspace, openOnlineDesmos } = require('./web-launcher');
const { startLiveSession, sendToLive, clearLive, isPortOpen } = require('./daemon');

function createCli() {
  const program = new Command();

  program
    .name('desmos')
    .description('Desmos 智能图形计算器：支持前台 Web 交互直看、CDP 实时联动、无头高清出图与 Obsidian 笔记排版')
    .version('1.0.0');

  // ==========================================
  // 命令 1: open / web / view (前台有头 Web 端直看交互，用户主选)
  // ==========================================
  program
    .command('open [formulas...]')
    .alias('web')
    .alias('view')
    .description('在前台浏览器中直接打开全功能 Desmos 交互界面，公式自动填好，可自由看图、拖拽、改动')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-b, --bounds <bounds>', '视窗数学边界，格式: xmin,xmax,ymin,ymax')
    .option('-d, --dark', '深色模式（与暗黑主题契合）', false)
    .option('--online', '打开 Desmos 官网（默认打开本地零延迟全功能工作区）', false)
    .action(async (formulas, options) => {
      try {
        const expressions = [...(formulas || []), ...(options.expr || [])];
        if (options.online) {
          console.log('🌐 正在启动 Chrome 并导航至 Desmos 官方计算器...');
          await openOnlineDesmos(expressions, options);
          console.log('✅ Desmos 官方计算器已打开，公式已自动注入！');
        } else {
          console.log('🚀 正在打开 Desmos 本地极速交互工作区...');
          const htmlPath = openInteractiveWorkspace(expressions, options);
          console.log(`✅ 已在浏览器中打开全功能计算器！`);
          if (expressions.length > 0) {
            console.log(`📊 已自动注入公式: ${expressions.join(' , ')}`);
          }
        }
      } catch (err) {
        console.error(`❌ 打开失败: ${err.message}`);
        process.exit(1);
      }
    });

  // ==========================================
  // 命令 2: live 实时常驻会话模式 (像 gemini-cli 一样联动前台浏览器)
  // ==========================================
  const liveCmd = program
    .command('live')
    .description('CDP 实时常驻会话管理（向已打开的 Desmos 网页实时注入/增删公式）');

  liveCmd
    .command('start')
    .description('启动常驻的 Desmos 前台浏览器（启用 CDP 端口）')
    .option('-p, --port <port>', 'CDP 端口号', (v) => parseInt(v, 10), 9333)
    .action(async (options) => {
      try {
        console.log(`⏳ 正在启动常驻 Desmos 窗口 (端口 ${options.port})...`);
        const res = await startLiveSession(options);
        console.log(`🟢 常驻窗口已就绪！后续可通过 'desmos live send "y=x^2"' 实时更新前台图形。`);
      } catch (err) {
        console.error(`❌ 启动失败: ${err.message}`);
      }
    });

  liveCmd
    .command('send [formulas...]')
    .alias('set')
    .description('替换当前打开的 Desmos 网页中的公式并实时绘制')
    .option('-b, --bounds <bounds>', '视窗数学边界')
    .option('-d, --dark', '深色模式', false)
    .action(async (formulas, options) => {
      try {
        await sendToLive(formulas, { bounds: options.bounds, dark: options.dark, append: false });
        console.log(`✅ 前台 Desmos 已更新公式: ${formulas.join(' , ')}`);
      } catch (err) {
        console.error(`❌ 发送失败: ${err.message}`);
      }
    });

  liveCmd
    .command('add [formulas...]')
    .description('向当前打开的 Desmos 网页中追加新公式（不清除旧公式）')
    .action(async (formulas) => {
      try {
        await sendToLive(formulas, { append: true });
        console.log(`✅ 已追加公式到前台 Desmos: ${formulas.join(' , ')}`);
      } catch (err) {
        console.error(`❌ 追加失败: ${err.message}`);
      }
    });

  liveCmd
    .command('clear')
    .description('清空当前打开的 Desmos 网页画布')
    .action(async () => {
      try {
        await clearLive();
        console.log(`🧹 前台 Desmos 画布已清空！`);
      } catch (err) {
        console.error(`❌ 清空失败: ${err.message}`);
      }
    });

  // ==========================================
  // 命令 3: render / plot (无头快速导出图片)
  // ==========================================
  program
    .command('render [formulas...]')
    .alias('plot')
    .description('【无头模式】将单条或多条数学公式直接渲染导出为高分辨率 PNG 图片')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-b, --bounds <bounds>', '视窗数学边界，格式: xmin,xmax,ymin,ymax')
    .option('-o, --output <path>', '输出 PNG 图片文件路径')
    .option('-d, --dark', '使用深色模式（黑色背景）', false)
    .option('-l, --light', '使用浅色模式（默认）', true)
    .option('-p, --projector', '开启投影粗线模式', true)
    .option('--no-projector', '关闭投影模式')
    .option('--polar', '极坐标网格模式', false)
    .option('--degree', '角度制', false)
    .option('--hide-grid', '隐藏网格线', false)
    .option('--hide-axes', '隐藏坐标轴', false)
    .option('--hide-numbers', '隐藏刻度数字', false)
    .option('--xlabel <label>', 'X 轴标签', '')
    .option('--ylabel <label>', 'Y 轴标签', '')
    .option('--width <number>', '视窗基础宽度', (v) => parseInt(v, 10), 1200)
    .option('--height <number>', '视窗基础高度', (v) => parseInt(v, 10), 800)
    .option('--scale <number>', '像素缩放倍率 (DPR 2x = 高清 Retina)', (v) => parseInt(v, 10), 2)
    .option('-v, --view', '生成后立即用系统查看器打开', false)
    .option('-j, --json', '以 JSON 格式输出结果', false)
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
  // 命令 4: obsidian (接入 Obsidian 笔记与 Vault)
  // ==========================================
  program
    .command('obsidian [formulas...]')
    .description('渲染数学图形并自动存入 Obsidian Vault，生成图文并茂的 Markdown 笔记嵌入代码')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-b, --bounds <bounds>', '视窗数学边界，格式: xmin,xmax,ymin,ymax')
    .option('--vault <path>', 'Obsidian Vault 根目录')
    .option('--note <path>', '目标笔记相对路径（自动追加内容）')
    .option('--attach <folder>', '附件子目录名称', 'attachments')
    .option('--title <title>', '公式图形标题', '')
    .option('--img-width <number>', 'Obsidian 预览图片宽度', (v) => parseInt(v, 10), 600)
    .option('-d, --dark', '深色模式', false)
    .option('-v, --view', '生成后打开查看', false)
    .option('-j, --json', '输出 JSON 格式', false)
    .action(async (formulas, options) => {
      try {
        const expressions = [...(formulas || []), ...(options.expr || [])];
        if (expressions.length === 0) {
          console.error('❌ 错误: 请至少提供一条数学公式，例如: desmos obsidian "y=x^2"');
          process.exit(1);
        }

        const engine = new DesmosEngine();
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
  // 命令 5: status (环境巡检)
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
      let apiSizeKb = apiOk ? Math.round(fs.statSync(apiJsPath).size / 1024) : 0;
      const liveRunning = await isPortOpen(9333);

      const info = {
        browserAvailable: browserOk,
        browserPath: browserPath || '未检测到可用浏览器',
        offlineApiAvailable: apiOk,
        apiPath: apiJsPath,
        apiSizeKb: `${apiSizeKb} KB`,
        liveSessionRunning: liveRunning,
        engineStatus: (browserOk && apiOk) ? 'READY' : 'INCOMPLETE'
      };

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
      } else {
        console.log('🩺 Desmos CLI 引擎状态巡检:');
        console.log(`  - 浏览器引擎: ${browserOk ? '✅ 已就绪 (' + browserPath + ')' : '❌ 未找到 Chrome/Edge'}`);
        console.log(`  - 离线计算核心: ${apiOk ? '✅ 已就绪 (' + apiSizeKb + ' KB)' : '❌ 离线资源缺失'}`);
        console.log(`  - 前台 CDP 实时会话: ${liveRunning ? '🟢 正在运行 (端口 9333)' : '⚪ 未启动 (可运行 desmos live start)'}`);
        console.log(`  - 整体就绪状态: ${info.engineStatus === 'READY' ? '🟢 准备就绪 (Ready)' : '🔴 需修复'}`);
      }
    });

  return program;
}

module.exports = {
  createCli
};
