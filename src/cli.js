const path = require('path');
const fs = require('fs');
const { Command } = require('commander');
const { DesmosEngine } = require('./engine');
const { processVaultOutput, formatObsidianMarkdown } = require('./obsidian');
const { openInViewer, generateOutputFilename } = require('./utils');
const { isDshOnline, sendToDsh, clearDsh } = require('./dsh-client');

function createCli() {
  const program = new Command();

  program
    .name('desmos')
    .description('Desmos 智能图形计算器：DSH 原生画板 0ms 纯内联直推 (2D/3D 双引擎) 与 Obsidian 笔记排版')
    .version('1.0.0');

  // ==========================================
  // 命令 1: plot / send (DSH 原生画板直通，绝对第一首选)
  // ==========================================
  program
    .command('plot [formulas...]', { isDefault: true })
    .alias('send')
    .description('【首选：DSH 画板直通】将公式直接推送到 DSH 界面中的 Desmos 画板（0ms 极速，严禁启动外部浏览器）')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-b, --bounds <bounds>', '视窗数学边界，格式: xmin,xmax,ymin,ymax')
    .option('-a, --append', '追加公式（不清除旧公式）', false)
    .option('-3, --3d', '强制开启 3D 空间立体坐标系（默认自动识别）', false)
    .option('-2, --2d', '强制开启 2D 平面直角坐标系', false)
    .option('-d, --dark', '深色模式', false)
    .option('-j, --json', '输出 JSON 格式', false)
    .action(async (formulas, options) => {
      try {
        const expressions = [...(formulas || []), ...(options.expr || [])];
        if (expressions.length === 0) {
          console.error('❌ 错误: 请至少提供一条数学公式，例如: desmos "y=\\sin(x)" 或 "z=x^2-y^2"');
          process.exit(1);
        }

        // 纯内联直推 DSH 画板
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
          console.log(`💡 提示: DSH 右侧画板已实时更新为 ${tag}，可在前台直接查看旋转！`);
        }
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
  // 命令 3: obsidian (Obsidian 专属排版与图文生成)
  // ==========================================
  program
    .command('obsidian [formulas...]')
    .alias('obs')
    .description('生成适合 Obsidian 笔记的 LaTeX 公式块与 WikiLink 图片嵌入代码，并可选存入 Vault')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-t, --title <title>', '笔记标题 / 函数名称', 'Desmos 数学函数图像')
    .option('-v, --vault <path>', 'Obsidian Vault 根目录绝对路径')
    .option('-n, --note <path>', '目标笔记文件相对路径（如 "数学/高数.md"）')
    .option('-o, --output <filename>', '图片输出文件名', 'desmos_graph.png')
    .option('-b, --bounds <bounds>', '坐标轴视窗范围 (xmin,xmax,ymin,ymax)')
    .option('-w, --width <width>', '图片宽度', '2400')
    .option('-h, --height <height>', '图片高度', '1600')
    .option('-d, --dark', '深色模式背景', false)
    .option('-j, --json', '输出 JSON 格式', false)
    .action(async (formulas, options) => {
      try {
        const expressions = [...(formulas || []), ...(options.expr || [])];
        if (expressions.length === 0) {
          console.error('❌ 错误: 请至少提供一条数学公式');
          process.exit(1);
        }

        // 同步推送到 DSH 画板
        try {
          await sendToDsh(expressions, { bounds: options.bounds });
        } catch {}

        if (options.vault) {
          const engine = new DesmosEngine();
          await engine.init();
          const imgBuffer = await engine.renderToImage(expressions, {
            bounds: options.bounds,
            width: parseInt(options.width, 10),
            height: parseInt(options.height, 10),
            invertedColors: options.dark
          });
          await engine.close();

          const result = processVaultOutput({
            vaultPath: options.vault,
            noteRelPath: options.note,
            imageFilename: options.output,
            imageBuffer: imgBuffer,
            expressions: expressions,
            title: options.title,
            isDark: options.dark
          });

          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(`✅ [Obsidian 归档成功]`);
            console.log(`📁 附件已保存: ${result.imagePath}`);
            if (result.noteUpdated) {
              console.log(`📝 笔记已追加: ${result.notePath}`);
            }
            console.log(`\n📋 生成的 Markdown 代码块:\n${result.markdownBlock}`);
          }
        } else {
          const mdBlock = formatObsidianMarkdown(expressions, options.title, options.output);
          if (options.json) {
            console.log(JSON.stringify({ success: true, markdown: mdBlock }, null, 2));
          } else {
            console.log(`📋 Obsidian Markdown 片段:\n\n${mdBlock}`);
          }
        }
      } catch (err) {
        console.error(`❌ 处理失败: ${err.message}`);
        process.exit(1);
      }
    });

  // ==========================================
  // 命令 4: render (无头静默图片渲染)
  // ==========================================
  program
    .command('render [formulas...]')
    .alias('export')
    .description('无头极速渲染 Desmos 图像并保存为 PNG 图片')
    .option('-e, --expr <expressions...>', '追加数学表达式')
    .option('-o, --output <path>', '输出图片路径', 'desmos_output.png')
    .option('-b, --bounds <bounds>', '坐标轴视窗范围 (xmin,xmax,ymin,ymax)')
    .option('-w, --width <width>', '图片宽度', '2400')
    .option('-h, --height <height>', '图片高度', '1600')
    .option('-d, --dark', '深色模式', false)
    .option('-j, --json', '输出 JSON 格式', false)
    .action(async (formulas, options) => {
      try {
        const expressions = [...(formulas || []), ...(options.expr || [])];
        if (expressions.length === 0) {
          console.error('❌ 错误: 请至少提供一条数学公式');
          process.exit(1);
        }

        const engine = new DesmosEngine();
        await engine.init();
        const outputPath = path.resolve(process.cwd(), options.output);
        await engine.renderToImage(expressions, {
          outputPath: outputPath,
          bounds: options.bounds,
          width: parseInt(options.width, 10),
          height: parseInt(options.height, 10),
          invertedColors: options.dark
        });
        await engine.close();

        if (options.json) {
          console.log(JSON.stringify({ success: true, outputPath }, null, 2));
        } else {
          console.log(`✅ 图片已成功导出至: ${outputPath}`);
        }
      } catch (err) {
        console.error(`❌ 渲染失败: ${err.message}`);
        process.exit(1);
      }
    });

  // ==========================================
  // 命令 5: status (状态巡检)
  // ==========================================
  program
    .command('status')
    .description('检查 DSH 画板服务连接状态')
    .action(async () => {
      const dshOnline = await isDshOnline();
      console.log(`📡 DSH 原生画板状态: ${dshOnline ? '🟢 已连接 (Zero-CDP 管道就绪)' : '🔴 未连接'}`);
    });

  return program;
}

module.exports = { createCli };
