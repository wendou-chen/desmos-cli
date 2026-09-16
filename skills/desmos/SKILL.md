---
name: desmos
description: Desmos 官方级高精度数学图形渲染、DSH 原生画板直通（Zero-CDP）与 Obsidian 笔记排版全套工具箱。支持【DSH 内部画板 0ms 直通绘图（当前环境首选，无任何外部浏览器开销）】、【Obsidian Vault 自动存图与 LaTeX 对齐代码块生成（归档用）】与【无头极速渲染】。用于根据数学公式绘制显函数、隐函数、极坐标方程、参数方程与不等式图形。触发词：desmos、desmos-cli、desmos skill、函数画图、绘制函数、数学图像、查看函数图像、函数可视化、Obsidian数学公式、极坐标图像、隐函数图像、画板绘图、画图看图像。
---

# Desmos 数学图形可视化、DSH 原生画板与 Obsidian 嵌入技能指南

本技能提供 **DSH 原生画板直通（Zero-CDP 纯内联直推）**、**Obsidian Vault 专属图文归档** 与 **无头极速图片渲染** 三位一体的完整工作流。

---

## 🛠️ CLI 工具入口

工具包位于 `E:\Coding_tools\desmos-cli`，直接执行：

```bash
node E:\Coding_tools\desmos-cli\bin\desmos.js <subcommand> [options]
```

---

## 🌟 核心工作流与模式选择

### 模式 A：DSH 原生画板直通（🔥 当前环境第一首选，0ms 零 CDP 延迟）

当用户在 DSH 会话中想要**看图形、探索函数特征、交互缩放、手改公式**时，CLI 会直接通过内存/HTTP 管道将公式推送到当前 DSH 界面中的 Desmos 画板上，**无需启动任何外部浏览器或无头进程**：

```bash
# 1. 直接推送到当前 DSH 界面的 Desmos 画板（秒级出图）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "y=x^3-3x" "y=2x"

# 2. 推送正余弦曲线 + 指定坐标轴视窗范围
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "y=\sin(x)" "y=\cos(x)" -b "-2pi,2pi,-2,2"

# 3. 追加新曲线（不覆盖已有公式）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "y=e^{-0.2x}" -a

# 4. 一键清空 DSH 画板
node E:\Coding_tools\desmos-cli\bin\desmos.js clear
```

> **DSH 原生画板功能**：
> - 📷 **导出 PNG**：在画板上拖动缩放到满意角度后，点一下即可下载高清图片。
> - 📋 **复制 Obsidian 代码**：一键生成对齐公式块与 `![[desmos_graph.png|600]]`。
> - ☀️/🌙 **切换深浅主题**：黑底/白底自适应。

---

### 模式 B：Obsidian 专属图文笔记归档（存入 Vault 笔记）

当用户需要**将图形真正归档到本地 Obsidian 笔记**中时使用：

```bash
# 1. 渲染高清 PNG 并存入指定 Vault，向笔记末尾自动追加 LaTeX 公式块与 WikiLink
node E:\Coding_tools\desmos-cli\bin\desmos.js obsidian "y=\frac{1}{1+e^{-x}}" \
  --title "Sigmoid 激活函数" \
  --vault "D:/MyObsidianVault" \
  --note "数学笔记/深度学习/激活函数.md" \
  --bounds "-6,6,-0.5,1.5" \
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

## 🔍 多模态视觉验收要求

Agent 在生成静态图片后，若具备多模态看图能力（如原生视觉 `read_image`），**必须调用 `read_image` 直读生成的 PNG 图片**，对图形的对称性、交点、极值点及单调区间进行实际核验，确保图表精准符合用户的数学预期。
