const path = require('path');
const fs = require('fs');
const { Command } = require('commander');
const { DesmosEngine } = require('./engine');
const { processVaultOutput, formatObsidianMarkdown } = require('./obsidian');
const { openInViewer, generateOutputFilename } = require('./utils');
const { findBrowserExecutable } = require('./browser');
const { openInteractiveWorkspace, openOnlineDesmos } = require('./web-launcher');
const { isDshOnline, sendToDsh, clearDsh } = require('./dsh-client');

function createCli() {
  const program = new Command();

  program
    .name('desmos')
    .description('Desmos 智能图形计算器：支持 DSH 内部画板零 CDP 直通、前台浏览器交互、无头高清出图与 Obsidian 笔记排版')
    .version('1.0.0');

  // ==========================================
  // 命令 1: plot / send (DSH 原生画板直通，第一优先级)
  // ==========================================
  program
    .command('plot [formulas...]')
    .alias('send')
    .description('【DSH 画板直通】将公式直接推送到 DSH 界面中的 Desmos 画板（0ms 零 CDP 延迟）')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-b, --bounds <bounds>', '视窗数学边界，格式: xmin,xmax,ymin,ymax')
    .option('-a, --append', '追加公式（不清除旧公式）', false)
    .option('-3, --3d', '强制开启 3D 空间立体坐标系（默认自动识别）', false)
    .option('-2, --2d', '强制开启 2D 平面直角坐标系', false)
    .option('--browser', '强制在独立浏览器窗口中打开', false)
    .option('-d, --dark', '深色模式', false)
    .option('-j, --json', '输出 JSON 格式', false)
    .action(async (formulas, options) => {
      try {
        const expressions = [...(formulas || []), ...(options.expr || [])];
        if (expressions.length === 0) {
          console.error('❌ 错误: 请至少提供一条数学公式，例如: desmos plot "y=\\sin(x)" 或 "z=x^2-y^2"');
          process.exit(1);
        }

        const dshOnline = await isDshOnline();

        // 1. 如果 DSH 在线且未强制 --browser，直接走 DSH 内部画板直通
        if (dshOnline && !options.browser) {
          const res = await sendToDsh(expressions, {
            bounds: options.bounds,
            append: !!options.append,
            threeD: !!options['3d'],
            twoD: !!options['2d']
          });

          const tag = res.dimension === '3d' ? '3D 空间立体' : '2D 平面';
          if (options.json) {
            console.log(JSON.stringify({ success: true, target: 'dsh-panel', ...res }, null, 2));
          } else {
            console.log(`🚀 [DSH 原生画板 - ${tag}] 公式已成功推送！`);
            console.log(`📊 包含公式 (${expressions.length} 条): ${expressions.join(' , ')}`);
            console.log(`💡 提示: DSH 界面已实时更新为 ${tag}，可直接在前台拖拽旋转或点击「📷 导出」！`);
          }
          return;
        }

        // 2. 否则降级为在独立浏览器中打开
        console.log('🌐 DSH 未运行或指定了 --browser，正在打开独立浏览器工作区...');
        openInteractiveWorkspace(expressions, options);
        console.log(`✅ 已在系统浏览器中打开全功能 Desmos 计算器！`);
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: err.message }));
        } else {
          console.error(`❌ 推送失败: ${err.message}`);
        }
        process.exit(1);
      }
    });

  // ==========================================
  // 命令 2: clear (清空 DSH 画板)
  // ==========================================
  program
    .command('clear')
    .description('清空 DSH 内部 Desmos 画板中的所有公式')
    .action(async () => {
      try {
        await clearDsh();
        console.log('🧹 DSH Desmos 画板已清空！');
      } catch (err) {
        console.error(`❌ 清空失败: ${err.message}`);
      }
    });

  // ==========================================
  // 命令 3: open / web (独立浏览器打开)
  // ==========================================
  program
    .command('open [formulas...]')
    .alias('web')
    .description('在独立浏览器中打开全功能 Desmos 交互界面')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-b, --bounds <bounds>', '视窗数学边界')
    .option('-d, --dark', '深色模式', false)
    .option('--online', '在 Desmos 官网中打开', false)
    .action(async (formulas, options) => {
      try {
        const expressions = [...(formulas || []), ...(options.expr || [])];
        if (options.online) {
          console.log('🌐 正在启动 Chrome 并导航至 Desmos 官方计算器...');
          await openOnlineDesmos(expressions, options);
          console.log('✅ Desmos 官方计算器已打开！');
        } else {
          openInteractiveWorkspace(expressions, options);
          console.log(`✅ 已在独立浏览器中打开全功能计算器！`);
        }
      } catch (err) {
        console.error(`❌ 打开失败: ${err.message}`);
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

        // 同步尝试通知 DSH 界面
        if (await isDshOnline()) {
          sendToDsh(expressions, { bounds: options.bounds }).catch(() => {});
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
  // 命令 5: render (无头静默导出图片)
  // ==========================================
  program
    .command('render [formulas...]')
    .description('【无头静默模式】直接渲染导出为高分辨率 PNG 图片')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-b, --bounds <bounds>', '视窗数学边界，格式: xmin,xmax,ymin,ymax')
    .option('-o, --output <path>', '输出 PNG 图片文件路径')
    .option('-d, --dark', '使用深色模式', false)
    .option('-l, --light', '使用浅色模式（默认）', true)
    .option('-p, --projector', '开启投影粗线模式', true)
    .option('--polar', '极坐标网格模式', false)
    .option('--degree', '角度制', false)
    .option('-v, --view', '生成后立即用系统查看器打开', false)
    .option('-j, --json', '以 JSON 格式输出结果', false)
    .action(async (formulas, options) => {
      try {
        const expressions = [...(formulas || []), ...(options.expr || [])];
        if (expressions.length === 0) {
          console.error('❌ 错误: 请提供数学公式，例如: desmos render "y=\\sin(x)"');
          process.exit(1);
        }

        const engine = new DesmosEngine();
        const result = await engine.render({
          expressions,
          bounds: options.bounds,
          dark: !!options.dark,
          projector: options.projector !== false,
          polar: !!options.polar,
          degree: !!options.degree,
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
          console.log(`✅ 无头图形渲染成功！`);
          console.log(`📁 输出文件: ${result.outputPath}`);
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
  // 命令 6: status (环境与 DSH 插件巡检)
  // ==========================================
  program
    .command('status')
    .description('巡检 DSH 原生画板在线状态与本地离线引擎')
    .option('-j, --json', 'JSON 格式输出', false)
    .action(async (options) => {
      const dshOnline = await isDshOnline();
      let browserPath = null;
      let browserOk = false;
      try {
        browserPath = findBrowserExecutable();
        browserOk = true;
      } catch {
        browserOk = false;
      }

      const info = {
        dshNativePanel: dshOnline ? 'ONLINE (http://127.0.0.1:3080)' : 'OFFLINE',
        dshZeroCdpChannel: dshOnline ? 'READY' : 'DISABLED',
        browserAvailable: browserOk,
        browserPath: browserPath || '未检测到可用浏览器'
      };

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
      } else {
        console.log('🩺 Desmos 工具生态状态巡检:');
        console.log(`  - DSH 原生画板直通 (Zero-CDP): ${dshOnline ? '🟢 在线就绪 (http://127.0.0.1:3080)' : '⚪ 未连接'}`);
        console.log(`  - 独立浏览器引擎: ${browserOk ? '✅ 已就绪 (' + browserPath + ')' : '❌ 未检测到 Chrome/Edge'}`);
      }
    });

  return program;
}

module.exports = {
  createCli
};
