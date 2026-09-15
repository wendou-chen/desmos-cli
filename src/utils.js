const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Desmos 经典调色板
const DESMOS_PALETTE = [
  '#2d70b3', // 经典蓝 (Blue)
  '#c74440', // 经典红 (Red)
  '#388c46', // 经典绿 (Green)
  '#fa7e19', // 经典橙 (Orange)
  '#6042a6', // 经典紫 (Purple)
  '#000000'  // 黑色 (Black)
];

// 深色模式下高对比度调色板
const DARK_PALETTE = [
  '#54a0ff', // 亮蓝
  '#ff6b6b', // 亮红
  '#1dd1a1', // 亮绿
  '#feca57', // 亮黄橙
  '#ff9ff3', // 亮粉紫
  '#00d2d3'  // 青绿
];

/**
 * 将用户输入的数学公式规范化为 Desmos 兼容的 LaTeX 格式
 * @param {string} input
 * @returns {string}
 */
function normalizeLatex(input) {
  if (!input || typeof input !== 'string') return '';
  let s = input.trim();

  // 如果已经包含较多 LaTeX 语法前缀，做基础微调后直接返回
  if (s.includes('\\')) {
    return s;
  }

  // 替换常见数学函数为 LaTeX 宏
  const funcReplacements = [
    [/\bsin\b/g, '\\sin'],
    [/\bcos\b/g, '\\cos'],
    [/\btan\b/g, '\\tan'],
    [/\bcot\b/g, '\\cot'],
    [/\bsec\b/g, '\\sec'],
    [/\bcsc\b/g, '\\csc'],
    [/\barcsin\b/g, '\\arcsin'],
    [/\barccos\b/g, '\\arccos'],
    [/\barctan\b/g, '\\arctan'],
    [/\bsinh\b/g, '\\sinh'],
    [/\bcosh\b/g, '\\cosh'],
    [/\btanh\b/g, '\\tanh'],
    [/\bln\b/g, '\\ln'],
    [/\blog\b/g, '\\log'],
    [/\bexp\b/g, '\\exp'],
    [/\bpi\b/g, '\\pi'],
    [/\btheta\b/g, '\\theta'],
    [/\bphi\b/g, '\\phi'],
    [/\balpha\b/g, '\\alpha'],
    [/\bbeta\b/g, '\\beta'],
    [/\bgamma\b/g, '\\gamma'],
    [/\bsqrt\(([^)]+)\)/g, '\\sqrt{$1}']
  ];

  for (const [regex, replacement] of funcReplacements) {
    s = s.replace(regex, replacement);
  }

  return s;
}

/**
 * 解析 bounds 参数字符串，如 "-10,10,-5,5" 或 "-2pi,2pi,-1,1"
 * @param {string} boundsStr
 * @returns {{left: number, right: number, bottom: number, top: number}|null}
 */
function parseBounds(boundsStr) {
  if (!boundsStr || typeof boundsStr !== 'string') return null;
  
  const parts = boundsStr.split(/[,:\s]+/).map(p => {
    let valStr = p.trim().toLowerCase();
    // 支持 pi 符号解析
    if (valStr.includes('pi')) {
      const coef = valStr.replace('pi', '').trim();
      if (coef === '' || coef === '+') return Math.PI;
      if (coef === '-') return -Math.PI;
      return parseFloat(coef) * Math.PI;
    }
    return parseFloat(valStr);
  });

  if (parts.length >= 4 && parts.slice(0, 4).every(n => !isNaN(n))) {
    return {
      left: parts[0],
      right: parts[1],
      bottom: parts[2],
      top: parts[3]
    };
  }

  return null;
}

/**
 * 获取默认输出图片文件路径
 * @param {string} [prefix='desmos_plot']
 * @param {string} [ext='png']
 * @returns {string}
 */
function generateOutputFilename(prefix = 'desmos_plot', ext = 'png') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}_${timestamp}.${ext}`;
}

/**
 * 在系统默认图片查看器中打开文件
 * @param {string} filePath
 */
function openInViewer(filePath) {
  const absPath = path.resolve(filePath);
  if (process.platform === 'win32') {
    exec(`start "" "${absPath}"`);
  } else if (process.platform === 'darwin') {
    exec(`open "${absPath}"`);
  } else {
    exec(`xdg-open "${absPath}"`);
  }
}

module.exports = {
  DESMOS_PALETTE,
  DARK_PALETTE,
  normalizeLatex,
  parseBounds,
  generateOutputFilename,
  openInViewer
};
