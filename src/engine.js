const fs = require('fs');
const path = require('path');
const { launchBrowser } = require('./browser');
const {
  DESMOS_PALETTE,
  DARK_PALETTE,
  normalizeLatex,
  parseBounds,
  generateOutputFilename
} = require('./utils');

class DesmosEngine {
  constructor(options = {}) {
    this.options = options;
    this.browser = null;
    this.page = null;
    this.isInitialized = false;
    this.apiJsPath = path.resolve(__dirname, '../assets/desmos_api.js');
  }

  /**
   * 初始化无头浏览器和 Desmos 计算器宿主页面
   * @param {number} width
   * @param {number} height
   * @param {number} scale
   * @param {boolean} isDark
   */
  async init(width = 1200, height = 800, scale = 2, isDark = false) {
    if (this.isInitialized && this.page && !this.page.isClosed()) {
      await this.page.setViewportSize({ width, height });
      return;
    }

    if (!fs.existsSync(this.apiJsPath)) {
      throw new Error(`Desmos API 脚本文件不存在: ${this.apiJsPath}`);
    }

    this.browser = await launchBrowser(this.options);
    this.page = await this.browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: scale
    });

    const bgColor = isDark ? '#131314' : '#ffffff';

    // 加载骨架 HTML
    const skeletonHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: ${bgColor}; }
    #calculator { width: 100%; height: 100%; }
    /* 去除滚动条与外部干扰 */
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  <div id="calculator"></div>
</body>
</html>`;

    await this.page.setContent(skeletonHtml);

    // 注入本地 Desmos API 脚本
    await this.page.addScriptTag({ path: this.apiJsPath });

    // 初始化 Desmos 计算器实例
    await this.page.evaluate((dark) => {
      window.calc = Desmos.GraphingCalculator(document.getElementById('calculator'), {
        keypad: false,
        expressions: false,
        settingsMenu: false,
        zoomButtons: false,
        border: false,
        lockViewport: false,
        invertedColors: dark
      });
    }, isDark);

    this.isInitialized = true;
  }

  /**
   * 格式化表达式列表为 Desmos API 接收的标准对象列表
   * @param {Array<string|Object>|string} rawExpressions
   * @param {boolean} isDark
   * @returns {Array<Object>}
   */
  _prepareExpressions(rawExpressions, isDark = false) {
    const list = Array.isArray(rawExpressions) ? rawExpressions : [rawExpressions];
    const palette = isDark ? DARK_PALETTE : DESMOS_PALETTE;

    return list.map((item, index) => {
      if (typeof item === 'string') {
        const latex = normalizeLatex(item);
        const color = palette[index % palette.length];
        return {
          id: `expr_${index + 1}`,
          latex,
          color,
          lineWidth: 3.5
        };
      } else if (typeof item === 'object' && item !== null) {
        const latex = normalizeLatex(item.latex || item.formula || '');
        const color = item.color || palette[index % palette.length];
        return {
          id: item.id || `expr_${index + 1}`,
          latex,
          color,
          lineStyle: item.lineStyle || 'SOLID',
          lineWidth: item.lineWidth !== undefined ? item.lineWidth : 3.5,
          lineOpacity: item.lineOpacity,
          pointStyle: item.pointStyle,
          pointSize: item.pointSize,
          fillOpacity: item.fillOpacity,
          hidden: !!item.hidden,
          label: item.label || '',
          showLabel: !!item.showLabel
        };
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * 核心渲染与导出图片方法
   * @param {Object} renderOptions
   * @returns {Promise<Object>}
   */
  async render(renderOptions = {}) {
    const {
      expressions = [],
      bounds = null,
      dark = false,
      projector = true,
      polar = false,
      degree = false,
      showGrid = true,
      showAxes = true,
      showNumbers = true,
      xAxisLabel = '',
      yAxisLabel = '',
      xAxisStep = 0,
      yAxisStep = 0,
      fontSize = 18,
      width = 1200,
      height = 800,
      scale = 2,
      output = null
    } = renderOptions;

    await this.init(width, height, scale, dark);

    const formattedExprs = this._prepareExpressions(expressions, dark);

    // 解析数学边界
    let parsedBounds = null;
    if (bounds) {
      if (typeof bounds === 'string') {
        parsedBounds = parseBounds(bounds);
      } else if (typeof bounds === 'object' && bounds.left !== undefined) {
        parsedBounds = bounds;
      }
    }

    // 在页面上下文中配置 Desmos
    const resultData = await this.page.evaluate(async (params) => {
      const {
        exprs,
        boundsObj,
        isDark,
        isProjector,
        isPolar,
        isDegree,
        grid,
        axes,
        numbers,
        xLabel,
        yLabel,
        xStep,
        yStep,
        fontSz
      } = params;

      // 1. 清空画布
      window.calc.setBlank();

      // 2. 更新设置
      window.calc.updateSettings({
        invertedColors: isDark,
        projectorMode: isProjector,
        polarMode: isPolar,
        degreeMode: isDegree,
        showGrid: grid,
        showXAxis: axes,
        showYAxis: axes,
        xAxisNumbers: numbers,
        yAxisNumbers: numbers,
        xAxisLabel: xLabel,
        yAxisLabel: yLabel,
        xAxisStep: xStep,
        yAxisStep: yStep,
        fontSize: fontSz
      });

      // 3. 注入表达式
      for (const expr of exprs) {
        window.calc.setExpression(expr);
      }

      // 4. 设置数学边界（如有指定）
      if (boundsObj) {
        window.calc.setMathBounds({
          left: boundsObj.left,
          right: boundsObj.right,
          bottom: boundsObj.bottom,
          top: boundsObj.top
        });
      }

      // 5. 等待动画与重绘完成
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => setTimeout(r, 120));

      return {
        expressions: window.calc.getExpressions(),
        state: window.calc.getState()
      };
    }, {
      exprs: formattedExprs,
      boundsObj: parsedBounds,
      isDark: !!dark,
      isProjector: !!projector,
      isPolar: !!polar,
      isDegree: !!degree,
      grid: showGrid !== false,
      axes: showAxes !== false,
      numbers: showNumbers !== false,
      xLabel: xAxisLabel || '',
      yLabel: yAxisLabel || '',
      xStep: xAxisStep || 0,
      yStep: yAxisStep || 0,
      fontSz: fontSize || 18
    });

    const outputPath = output 
      ? path.resolve(output)
      : path.resolve(process.cwd(), generateOutputFilename('desmos', 'png'));

    // 确保目标目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 导出高清图片
    let buffer;
    if (dark) {
      // 深色模式下直接截取 DOM 元素以保持完美黑底
      buffer = await this.page.locator('#calculator').screenshot();
    } else {
      // 浅色模式下调用 API 截图以保证纯净白底
      const dataUri = await this.page.evaluate(async (params) => {
        return new Promise((resolve) => {
          window.calc.asyncScreenshot({
            width: params.w,
            height: params.h,
            targetPixelRatio: params.dpr
          }, (uri) => resolve(uri));
        });
      }, { w: width, h: height, dpr: scale });

      const base64Data = dataUri.replace(/^data:image\/png;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    }

    fs.writeFileSync(outputPath, buffer);

    return {
      success: true,
      outputPath,
      width: width * scale,
      height: height * scale,
      expressions: resultData.expressions,
      state: resultData.state
    };
  }

  /**
   * 从 JSON 状态文件还原并渲染图片
   * @param {Object|string} state
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async renderFromState(state, options = {}) {
    const {
      width = 1200,
      height = 800,
      scale = 2,
      dark = false,
      output = null
    } = options;

    await this.init(width, height, scale, dark);

    let stateObj = state;
    if (typeof state === 'string') {
      if (fs.existsSync(state)) {
        stateObj = JSON.parse(fs.readFileSync(state, 'utf-8'));
      } else {
        stateObj = JSON.parse(state);
      }
    }

    const resultData = await this.page.evaluate(async (st) => {
      window.calc.setState(st);
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => setTimeout(r, 150));

      return {
        expressions: window.calc.getExpressions(),
        state: window.calc.getState()
      };
    }, stateObj);

    const outputPath = output 
      ? path.resolve(output)
      : path.resolve(process.cwd(), generateOutputFilename('desmos_state', 'png'));

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const buffer = await this.page.locator('#calculator').screenshot();
    fs.writeFileSync(outputPath, buffer);

    return {
      success: true,
      outputPath,
      width: width * scale,
      height: height * scale,
      expressions: resultData.expressions,
      state: resultData.state
    };
  }

  /**
   * 关闭浏览器释放资源
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isInitialized = false;
    }
  }
}

module.exports = {
  DesmosEngine
};
