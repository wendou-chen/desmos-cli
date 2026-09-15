const fs = require('fs');
const path = require('path');
const { normalizeLatex, generateOutputFilename } = require('./utils');

/**
 * 格式化 Obsidian 笔记专用的 Markdown 嵌入代码块
 * @param {Object} params
 * @returns {string}
 */
function formatObsidianMarkdown(params) {
  const {
    imageRelativePath,
    imageFilename,
    expressions = [],
    bounds = null,
    title = '',
    imageWidth = 600,
    useWikiLink = true
  } = params;

  const lines = [];

  if (title) {
    lines.push(`### 📐 ${title}`);
  }

  // 1. 生成 LaTeX 公式块
  lines.push('$$');
  if (expressions.length === 1) {
    const expr = typeof expressions[0] === 'string' ? expressions[0] : expressions[0].latex;
    lines.push(normalizeLatex(expr));
  } else if (expressions.length > 1) {
    lines.push('\\begin{aligned}');
    expressions.forEach((item, idx) => {
      const expr = typeof item === 'string' ? item : item.latex;
      const normalized = normalizeLatex(expr);
      // 将第一个等号或不等号转为对齐符号 &=
      const aligned = normalized.replace(/(=|<=|>=|<|>|\\le|\\ge)/, '&$1');
      const suffix = idx < expressions.length - 1 ? ' \\\\' : '';
      lines.push(`  ${aligned}${suffix}`);
    });
    lines.push('\\end{aligned}');
  }
  lines.push('$$');
  lines.push('');

  // 2. 生成图片引用
  if (useWikiLink) {
    // Obsidian WikiLink 格式: ![[filename.png|600]]
    lines.push(`![[${imageFilename}|${imageWidth}]]`);
  } else {
    // 标准 Markdown 图片格式: ![](path/filename.png)
    lines.push(`![](${imageRelativePath.replace(/\\/g, '/')})`);
  }

  // 3. 可选附加信息
  if (bounds) {
    const bStr = typeof bounds === 'string' ? bounds : `${bounds.left} ~ ${bounds.right}, ${bounds.bottom} ~ ${bounds.top}`;
    lines.push('');
    lines.push(`> *坐标系视窗范围: $x \\in [${bStr.split(/[,:\s]+/)[0]}, ${bStr.split(/[,:\s]+/)[1]}]$, $y \\in [${bStr.split(/[,:\s]+/)[2]}, ${bStr.split(/[,:\s]+/)[3]}]$*`);
  }

  return lines.join('\n');
}

/**
 * 将图形直接保存到 Obsidian Vault 并在笔记中生成引用
 * @param {Object} params
 * @returns {Object}
 */
function processVaultOutput(params) {
  const {
    vaultPath,
    notePath = null,
    attachmentFolder = 'attachments',
    customFilename = null,
    expressions = [],
    bounds = null,
    title = '',
    imageWidth = 600,
    useWikiLink = true
  } = params;

  const resolvedVault = path.resolve(vaultPath);
  if (!fs.existsSync(resolvedVault)) {
    throw new Error(`Obsidian Vault 路径不存在: ${resolvedVault}`);
  }

  // 附件存储目录
  const targetAttachDir = path.join(resolvedVault, attachmentFolder);
  if (!fs.existsSync(targetAttachDir)) {
    fs.mkdirSync(targetAttachDir, { recursive: true });
  }

  const filename = customFilename || generateOutputFilename('desmos_plot', 'png');
  const targetImagePath = path.join(targetAttachDir, filename);

  const markdownSnippet = formatObsidianMarkdown({
    imageRelativePath: `${attachmentFolder}/${filename}`,
    imageFilename: filename,
    expressions,
    bounds,
    title,
    imageWidth,
    useWikiLink
  });

  let noteUpdated = false;
  let targetNoteFile = null;

  if (notePath) {
    targetNoteFile = path.isAbsolute(notePath) 
      ? notePath 
      : path.join(resolvedVault, notePath);
    
    // 如果笔记不存在则创建，存在则追加
    const noteDir = path.dirname(targetNoteFile);
    if (!fs.existsSync(noteDir)) {
      fs.mkdirSync(noteDir, { recursive: true });
    }

    const contentToAppend = fs.existsSync(targetNoteFile)
      ? `\n\n${markdownSnippet}\n`
      : `${markdownSnippet}\n`;

    fs.appendFileSync(targetNoteFile, contentToAppend, 'utf-8');
    noteUpdated = true;
  }

  return {
    vaultPath: resolvedVault,
    imagePath: targetImagePath,
    imageFilename: filename,
    markdownSnippet,
    noteUpdated,
    noteFile: targetNoteFile
  };
}

module.exports = {
  formatObsidianMarkdown,
  processVaultOutput
};
