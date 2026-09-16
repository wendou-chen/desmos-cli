# Desmos Tool Suite (`desmos-cli` & `@dsh-external/dsh-desmos-panel`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

将 Desmos Graphing Calculator（图形计算器）深度逆向并转化为 **DSH 原生画板直通（Zero-CDP）**、**全功能命令行（CLI）** 与 **Obsidian 笔记排版** 三位一体的现代化数学可视化工具箱。

---

## 🌟 核心特性与架构

- 🚀 **DSH 原生画板直通（Zero-CDP，0ms 极速响应）**：
  - 深度集成 DeepSeek Harness (DSH)，内置 `@dsh-external/dsh-desmos-panel` 插件。
  - CLI 与 Agent 在聊天中直接调用 DSH 内存/HTTP 管道，**0 秒直推前端画板，无需开启任何外部无头浏览器或 CDP 进程**！
  - **📐/🌐 2D 平面与 3D 空间双模式自由切换**：支持平面函数、极坐标方程、3D 空间曲面（$z=f(x,y)$）、隐式等值面（如球面 $x^2+y^2+z^2=9$）与空间参数曲线。
- 🖥️ **前台交互与沉浸画板**：
  - 支持公式自由拖拽、缩放、微调公式、动态滑块、三维视角手势旋转。
  - 面板顶部自带「📐 2D / 🌐 3D 切换」「📷 导出高清图」「🌓 切换深浅主题」「📋 复制 Obsidian 代码」「🧹 清空」。
- 📓 **Obsidian 深度集成**：
  - 自动生成 LaTeX 公式块（多公式智能 `aligned` 对齐）+ WikiLink `![[desmos_graph.png|600]]` 图片嵌入代码。
  - 支持直接存入指定 Obsidian Vault 附件目录并自动追加到笔记文件。
- ⚡ **100% 离线自包含**：内置最新 Desmos v1.13 全功能核心（4.31 MB），断网也能秒开秒画。

---

## 📁 仓库结构 (Monorepo)

```
desmos-cli/
├── bin/
│   └── desmos.js               # CLI 可执行文件入口
├── src/
│   ├── dsh-client.js           # DSH 画板直通客户端 (0ms Zero-CDP, 2D/3D 自适应)
│   ├── engine.js               # 本地离线无头导出引擎
│   ├── obsidian.js             # Obsidian Vault 处理与 WikiLink 排版
│   ├── web-launcher.js         # 独立浏览器工作区
│   └── cli.js                  # 命令行路由
├── plugin/
│   └── dsh-desmos-panel/       # DSH 原生画板插件 (Host 服务 + Client React 面板, 2D/3D)
│       ├── src/
│       │   ├── index.ts        # DSH 宿主服务与 HTTP 接口 (/dsh-desmos/api/plot)
│       │   └── client/index.ts # DSH 前端 React 画板 (2D/3D 动态热切换)
│       └── assets/desmos_api.js# 4.31 MB 完整离线 Desmos v1.13 计算核心
├── skills/
│   └── desmos/
│       └── SKILL.md            # 配套的 Agent 技能指南
└── README.md
```

---

## 🚀 快速上手

### 1. 安装

```bash
git clone https://github.com/wendou-chen/desmos-cli.git
cd desmos-cli
npm install
```

### 2. DSH 原生画板直通（日常使用第一推荐，支持 2D & 3D）

```bash
# 绘制 2D 函数（自动识别为 2D）
node bin/desmos.js plot "y=x^3-3x" "y=2x"

# 绘制 3D 空间曲面（双曲抛物面马鞍面，自动切换至 3D！）
node bin/desmos.js plot "z=x^2-y^2"

# 绘制 3D 空间球面隐式曲面
node bin/desmos.js plot "x^2+y^2+z^2=9"

# 强制开启 3D 模式
node bin/desmos.js plot "z=\sin(x)\cos(y)" --3d

# 追加新曲面
node bin/desmos.js plot "z=2" -a

# 清空 DSH 画板
node bin/desmos.js clear
```

### 3. Obsidian 笔记专属导出

```bash
# 导出为适合 Obsidian 复制的图文 Markdown 片段
node bin/desmos.js obsidian "y=\frac{1}{1+e^{-x}}" --title "Sigmoid 激活函数" --bounds "-6,6,-0.5,1.5" -d

# 一键存入指定 Obsidian Vault 并追加到笔记
node bin/desmos.js obsidian "y=x^2-4" "y=-x^2+4" \
  --vault "D:/MyObsidianVault" \
  --note "数学笔记/高等数学/二次函数性质.md" \
  --title "双抛物线交点分析" \
  --dark
```

### 4. 无头静默导出图片

```bash
# 静默导出 2400x1600 高清 PNG 图片
node bin/desmos.js render "y=\sin(x)" -b "-2pi,2pi,-2,2" -o "sine.png"
```

---

## 📋 命令行命令与选项速查

| 子命令 / 参数 | 模式 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `desmos plot <formulas...>` | **DSH 直通** | 0ms 直推 DSH 画板（DSH 未运行时自动降级为打开浏览器） | `desmos plot "y=x^2"` |
| `desmos clear` | **DSH 直通** | 一键清空 DSH 内部画板 | `desmos clear` |
| `desmos obsidian <formulas...>`| **Obsidian** | 存入 Vault 并生成 Markdown 笔记代码 | `desmos obsidian "y=x^2"` |
| `desmos render <formulas...>` | **无头** | 静默导出高清 PNG 图片 | `desmos render "y=x^2" -o plot.png` |
| `desmos open <formulas...>` | **浏览器** | 强制在独立系统浏览器窗口中打开 | `desmos open "y=x^2"` |
| `desmos status` | **巡检** | 检查 DSH 画板与引擎状态 | `desmos status` |
| `-b, --bounds <xmin,xmax,ymin,ymax>` | 通用 | 坐标系视窗范围（支持 `pi` 换算） | `-b "-2pi,2pi,-1,1"` |
| `-a, --append` | DSH 模式 | 追加公式（不清除旧公式） | `-a` |
| `-d, --dark` | 通用 | 深色模式（黑色背景，高对比亮色） | `--dark` |
| `-j, --json` | 通用 | 结构化 JSON 管道输出 | `-j` |

---

## 📜 开源协议

本项目采用 [MIT License](LICENSE) 授权开源。
