# Desmos CLI (`desmos-cli`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

将 Desmos Graphing Calculator（图形计算器）深度逆向并转化为全功能命令行（CLI）、Obsidian 专属数学可视化与 Agent-Native 接口的自动化工具箱。

基于 **GUI-to-CLI 与本地无头浏览器（Headless CDP / Playwright-core）** 极速渲染架构，内置离线 Desmos 核心计算引擎，零网络延迟、毫秒级生成高分辨率数学图形，完美对接 Obsidian 笔记数学排版与 AI Agent 自动看图。

---

## 🌟 核心特性

- ⚡ **100% 离线极速渲染**：内置完整 Desmos 计算核心，无需联网等待，本地启动 1 秒内生成超清图。
- 📐 **全类型数学表达支持**：
  - 显函数（多项式、三角、对数指数、分式）
  - 隐函数方程（圆、椭圆、双曲线、笛卡尔叶形线等）
  - 极坐标方程（心形线、玫瑰线、阿基米德螺线）
  - 参数方程与散点标记
  - 不等式与区域阴影着色
- 📓 **Obsidian 深度集成**：
  - 自动生成 LaTeX 数学公式块 + WikiLink `![[image.png|600]]` / Markdown 嵌入代码。
  - 支持直接将图形归档至 Vault 的 `attachments/` 并自动向笔记文件追加内容。
- 🎨 **双主题与高清投影**：
  - 浅色模式（标准白底论文感）与深色模式（极黑背景 + 高对比亮色，完美契合 Obsidian 暗色主题）。
  - 投影粗线模式（Projector Mode，加粗曲线与放大轴标，可读性极佳）。
- 🤖 **Agent-Native 兼容**：全命令支持 `--json` 输出，便于 AI Agent、自动解题脚本与 Unix 管道调度。

---

## 🚀 快速上手

### 1. 安装与就绪检查

```bash
cd E:\Coding_tools\desmos-cli
npm install

# 巡检环境与引擎状态
node bin/desmos.js status
```

### 2. 基础命令示例

```bash
# 绘制单条公式（如三次函数）
node bin/desmos.js render "y=x^3-3x" -o ./cubic.png

# 绘制多条公式（正弦与余弦）并指定视窗范围
node bin/desmos.js render "y=\sin(x)" "y=\cos(x)" -b "-2pi,2pi,-2,2" -o ./trig.png

# 开启深色模式（适合 Obsidian 暗黑主题）
node bin/desmos.js render "y=x^2-4" "y=-x^2+4" --dark -b "-6,6,-6,6" -o ./dark_parabola.png

# 绘制极坐标玫瑰线
node bin/desmos.js render "r=2\sin(2\theta)" --polar --dark -b "-3,3,-3,3" -o ./rose.png

# 绘制笛卡尔叶形线（隐函数方程）
node bin/desmos.js render "x^3+y^3-3xy=0" -b "-4,4,-4,4" -o ./folium.png
```

### 3. Obsidian 专属导出与笔记追加

```bash
# 导出为适合粘贴到 Obsidian 的图文 Markdown 片段
node bin/desmos.js obsidian "y=\frac{1}{1+e^{-x}}" --title "Sigmoid 激活函数" --bounds "-6,6,-0.5,1.5" -d

# 直接存入指定 Obsidian Vault 并追加到笔记中
node bin/desmos.js obsidian "y=\ln(x)" \
  --vault "D:/MyObsidianVault" \
  --note "数学笔记/高等数学/对数函数性质.md" \
  --title "对数函数图像"
```

---

## 📋 命令行选项参考表

| 子命令 / 参数 | 说明 | 示例 |
| :--- | :--- | :--- |
| `desmos render <formulas...>` | 渲染单条或多条公式 | `desmos render "y=x^2"` |
| `desmos obsidian <formulas...>` | 渲染并生成 Obsidian Markdown | `desmos obsidian "y=\sin(x)"` |
| `desmos batch -f <file>` | 从文本文件批量读取多行公式 | `desmos batch -f formulas.txt` |
| `desmos status` | 巡检本地浏览器与离线引擎 | `desmos status` |
| `-b, --bounds <xmin,xmax,ymin,ymax>` | 坐标系视窗范围（支持 pi 解析） | `-b "-2pi,2pi,-1,1"` |
| `-d, --dark` | 深色模式（黑色背景，亮色线条） | `-d` |
| `-l, --light` | 浅色模式（白色背景，默认） | `-l` |
| `-p, --projector` | 投影模式（线条更粗更清晰，默认开启） | `--no-projector` 可关闭 |
| `--polar` | 极坐标网格模式 | `--polar` |
| `--degree` | 角度制模式（默认弧度制） | `--degree` |
| `--hide-grid` | 隐藏网格线 | `--hide-grid` |
| `--hide-axes` | 隐藏坐标轴 | `--hide-axes` |
| `--hide-numbers` | 隐藏刻度数字 | `--hide-numbers` |
| `--xlabel <text>` / `--ylabel <text>` | 坐标轴标签说明 | `--xlabel "时间 t (s)"` |
| `--width <px>` / `--height <px>` | 视窗宽高（默认 1200x800） | `--width 1000 --height 600` |
| `--scale <n>` | Retina DPR 倍率（默认 2x） | `--scale 2` |
| `-v, --view` | 生成后自动用系统查看器打开 | `-v` |
| `-j, --json` | JSON 结构化输出（供 Agent 解析） | `-j` |
