# Desmos CLI (`desmos-cli`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

将 Desmos Graphing Calculator（图形计算器）深度逆向并转化为全功能命令行（CLI）、前台 Web 交互工作区与 Obsidian 专属数学可视化的现代化工具箱。

基于 **GUI-to-CLI 与本地浏览器自动化/CDP 控制** 架构，支持 **前台 Web 端交互直看（直接在浏览器中打开全功能计算器并填入公式）** 与 **无头极速渲染归档（一键出高清图并插入 Obsidian 笔记）** 双重体验！

---

## 🌟 核心特性

- 🖥️ **前台 Web 交互直看（有头模式）**：
  - 一键在系统浏览器调起全功能 Desmos 交互界面，公式自动填好。
  - 支持拖拽、缩放、微调公式、动态滑块，页面自带「📷 导出高清图」「🌓 切换主题」「📋 复制 Obsidian 代码」。
- ⚡ **100% 离线极速引擎**：内置完整 Desmos 计算核心（3 MB），零网络依赖，毫秒级响应。
- 🔄 **CDP 实时联动模式**：终端输入公式，前台已打开的 Desmos 网页实时变动更新。
- 📓 **Obsidian 深度集成**：自动生成 LaTeX 公式块（多公式智能 `aligned`）+ WikiLink 图片嵌入代码，可直写 Vault 笔记。
- 🎨 **双主题与高清投影**：支持纯白底浅色模式与极黑底深色模式，默认开启 Projector 粗线高清模式。

---

## 🚀 快速上手

### 1. 安装

```bash
git clone https://github.com/wendou-chen/desmos-cli.git
cd desmos-cli
npm install
```

### 2. 前台 Web 端交互直看（日常探索推荐）

```bash
# 在浏览器打开本地极速交互界面，并自动填入公式
node bin/desmos.js open "y=x^3-3x" "y=2x"

# 深色模式 + 指定坐标轴视窗范围
node bin/desmos.js open "y=\sin(x)" "y=\cos(x)" --dark -b "-2pi,2pi,-2,2"

# 极坐标方程（如心形线）
node bin/desmos.js open "r=1-\sin(\theta)" --dark

# 在 Desmos 官方网站中打开并注入公式（需联网）
node bin/desmos.js open "y=\frac{1}{1+e^{-x}}" --online
```

### 3. CDP 实时常驻联动（像 gemini-cli 一样）

```bash
# 启动常驻窗口（开启 9333 CDP 端口）
node bin/desmos.js live start

# 向前台窗口实时发送并替换公式
node bin/desmos.js live send "y=x^2-4"

# 追加新曲线
node bin/desmos.js live add "y=2x+1"

# 清空画布
node bin/desmos.js live clear
```

### 4. 无头静默导出与 Obsidian 笔记归档

```bash
# 静默导出 2400x1600 高清 PNG
node bin/desmos.js render "y=\sin(x)" "y=\cos(x)" -b "-2pi,2pi,-2,2" -o "trig.png"

# 直接存入 Obsidian Vault 并追加到具体笔记
node bin/desmos.js obsidian "y=\frac{1}{1+e^{-x}}" \
  --title "Sigmoid 激活函数" \
  --vault "D:/MyObsidianVault" \
  --note "数学笔记/深度学习/激活函数.md" \
  --bounds "-6,6,-0.5,1.5" \
  --dark
```

---

## 📋 命令行命令与选项速查

| 子命令 / 参数 | 模式 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `desmos open [formulas...]` | 有头 (Web) | 在浏览器打开交互计算器（公式预填） | `desmos open "y=x^2"` |
| `desmos live start/send/add`| 联动 (CDP) | 终端敲命令，前台浏览器实时变动 | `desmos live send "y=\sin(x)"` |
| `desmos render [formulas...]` | 无头 (Headless) | 静默导出高清 PNG 图片 | `desmos render "y=x^2" -o plot.png` |
| `desmos obsidian [formulas...]`| 归档 (Vault) | 导出图片并生成 Obsidian Markdown | `desmos obsidian "y=x^2"` |
| `desmos status` | 巡检 | 检查本地浏览器与引擎状态 | `desmos status` |
| `-b, --bounds <xmin,xmax,ymin,ymax>` | 通用 | 坐标系视窗范围（支持 `pi`） | `-b "-2pi,2pi,-1,1"` |
| `-d, --dark` | 通用 | 深色模式（黑色背景，高对比亮色） | `--dark` |
| `--online` | Web 模式 | 在 Desmos 官网打开 | `--online` |
| `-j, --json` | 通用 | 结构化 JSON 管道输出 | `-j` |

---

## 📜 开源协议

本项目采用 [MIT License](LICENSE) 授权开源。
