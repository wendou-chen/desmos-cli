---
name: desmos
description: Desmos 官方级高精度数学图形渲染、2D/3D双引擎画板直通（Zero-CDP）与 Obsidian 笔记排版全套工具箱。支持【DSH 原生右侧画板 0ms 直通绘图（2D平面与3D空间立体曲面双引擎自由切换）】、【Obsidian Vault 自动存图与 LaTeX 对齐代码块生成（归档用）】与【无头极速渲染】。用于绘制平面显函数、隐函数、极坐标方程、参数方程、不等式区域，以及 3D 空间曲面方程（z=f(x,y)）、三维隐式等值面（如球面、椭球面）、空间参数曲线与空间点。触发词：desmos、desmos 3d、desmos-cli、desmos skill、3d坐标系、三维画图、空间曲面、立体几何、函数画图、绘制函数、数学图像、查看函数图像、函数可视化、Obsidian数学公式、极坐标图像、隐函数图像、画板绘图、画图看图像。
---

# Desmos 数学图形可视化、2D/3D 双引擎画板与 Obsidian 嵌入技能指南

本技能提供 **DSH 原生画板直通（Zero-CDP 纯内联直推，2D 平面与 3D 空间双模式）**、**Obsidian Vault 专属图文归档** 与 **无头极速图片渲染** 三位一体的完整工作流。

---

## 🛠️ CLI 工具入口

工具包位于 `E:\Coding_tools\desmos-cli`，直接执行：

```bash
node E:\Coding_tools\desmos-cli\bin\desmos.js <subcommand> [options]
```

---

## 🌟 核心工作流与模式选择

### 模式 A：DSH 原生画板直通（🔥 2D / 3D 双模式，0ms 零 CDP 延迟）

当用户在 DSH 会话中想要**看平面函数图形或 3D 空间立体曲面**时，CLI 会直接通过内存/HTTP 管道将公式推送到当前 DSH 界面中的 Desmos 画板上，**支持自动识别公式维度并自动切换 2D / 3D 引擎**：

```bash
# 1. 绘制 2D 平面函数（自动识别为 2D）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "y=x^3-3x" "y=2x"

# 2. 绘制 3D 空间曲面（检测到 z= 自动切换至 3D 坐标系！）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "z=x^2-y^2"

# 3. 绘制 3D 空间立体隐式曲面（如球面）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "x^2+y^2+z^2=9"

# 4. 强制指定维度（--3d 或 --2d）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "z=\sin(x)\cos(y)" --3d

# 5. 追加新曲面/曲线（不覆盖已有公式）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "z=2" -a

# 6. 一键清空 DSH 画板
node E:\Coding_tools\desmos-cli\bin\desmos.js clear
```

> **DSH 原生画板功能**：
> - 📐/🌐 **2D/3D 一键切换**：面板顶部工具栏自带分段开关，可手动在二维与三维间切换；
> - 🔄 **3D 自由手势交互**：支持按住鼠标左键自由旋转三维视角、右键平移、滚轮缩放；
> - 📷 **导出 PNG**：在画板上拖动调整到满意角度后，点一下即可下载高清图片；
> - 📋 **复制 Obsidian 代码**：一键生成对齐公式块与 `![[desmos_graph.png|600]]`；
> - ☀️/🌙 **切换深浅主题**：黑底/白底自适应。

---

### 模式 B：Obsidian 专属图文笔记归档（存入 Vault 笔记）

当用户需要**将图形真正归档到本地 Obsidian 笔记**中时使用：

```bash
# 1. 渲染高清 PNG 并存入指定 Vault，向笔记末尾自动追加 LaTeX 公式块与 WikiLink
node E:\Coding_tools\desmos-cli\bin\desmos.js obsidian "z=x^2-y^2" \
  --title "双曲抛物面马鞍面" \
  --vault "D:/MyObsidianVault" \
  --note "数学笔记/高等数学/多元微分与空间曲面.md" \
  --dark

# 2. 仅在控制台输出适合复制的图文 Markdown 片段
node E:\Coding_tools\desmos-cli\bin\desmos.js obsidian "y=x^2-4" "y=-x^2+4" --title "双抛物线交点"
```

---

### 模式 C：无头静默图片导出（自动化脚本与报告）

```bash
# 静默导出 2400x1600 高清 PNG 图片
node E:\Coding_tools\desmos-cli\bin\desmos.js render "y=\sin(x)" -b "-2pi,2pi,-2,2" -o "sine.png"
```

---

## 🎨 命令行命令与选项速查

| 子命令 / 参数 | 模式 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `desmos plot <formulas...>` | **DSH 直通** | 0ms 直推 DSH 画板（自动判别 2D/3D） | `desmos plot "z=x^2-y^2"` |
| `-3, --3d` | DSH 直通 | 强制使用 3D 空间立体坐标系 | `desmos plot "z=2x+y" --3d` |
| `-2, --2d` | DSH 直通 | 强制使用 2D 平面直角坐标系 | `desmos plot "y=x^2" --2d` |
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

## 🔍 多模态视觉验收要求

Agent 在生成静态图片后，若具备多模态看图能力（如原生视觉 `read_image`），**必须调用 `read_image` 直读生成的 PNG 图片**，对图形的对称性、交点、极值点及单调区间进行实际核验，确保图表精准符合用户的数学预期。
