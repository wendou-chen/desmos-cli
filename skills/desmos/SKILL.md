---
name: desmos
description: Desmos 官方级高精度数学图形可视化、2D/3D双引擎曲面绘制与 Obsidian 笔记排版全套技能。支持根据 LaTeX 或标准数学公式一键绘制 2D 平面函数、极坐标方程、隐函数、不等式区域，以及 3D 空间曲面（z=f(x,y)）、三维隐式等值面（如球面、椭球面、马鞍面）、空间参数曲线与立体几何图形。具备自动生成标准 Obsidian LaTeX 公式块（多公式智能 aligned 对齐）与 WikiLink 图片嵌入代码的能力，支持直写本地 Obsidian Vault 笔记。触发词：desmos、desmos 3d、desmos-cli、desmos skill、函数画图、绘制函数、数学图像、查看函数图像、函数可视化、3d坐标系、三维画图、空间曲面、立体几何、Obsidian数学公式、极坐标图像、隐函数图像、画板绘图、画图看图像。
---

# Desmos 数学图形可视化、2D/3D 曲面绘制与 Obsidian 嵌入技能指南

本技能为数学解题、空间几何、多元微积分与 Obsidian 笔记整理提供全功能可视化支持，包含 **交互式图形画板直看**、**Obsidian Vault 笔记图文归档** 与 **无头高精度图片渲染**。

---

## 🛠️ 核心执行命令

```bash
node E:\Coding_tools\desmos-cli\bin\desmos.js <command> [options]
```

---

## 🌟 核心使用场景与工作流

### 场景 1：即时绘制数学图形 / 查看 2D 函数与 3D 空间曲面

当需要直观查看函数几何特征、极值点、交点或立体空间曲面时直接调用：

```bash
# 1. 绘制 2D 平面函数
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "y=x^3-3x" "y=2x"

# 2. 绘制 3D 空间曲面（如双曲抛物面马鞍面，自动识别 3D 坐标系）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "z=x^2-y^2"

# 3. 绘制 3D 空间立体球面/椭球面
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "x^2+y^2+z^2=9"

# 4. 追加新曲线/曲面（不清除旧公式）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "z=2" -a

# 5. 清空画布
node E:\Coding_tools\desmos-cli\bin\desmos.js clear
```

> **画板交互特性**：
> - 📐/🌐 **2D/3D 双模式自由切换**：支持平面直角坐标系与空间立体坐标系；
> - 🔄 **3D 手势交互**：鼠标左键 360° 旋转视角、右键平移、滚轮无级缩放；
> - 📷 **一键导出**：一键保存为高分辨率 PNG 图片；
> - 📋 **一键笔记**：一键复制对齐的 LaTeX 公式块与 Obsidian 嵌入代码；
> - ☀️/🌙 **明亮/深色主题切换**：默认纯白明亮背景，随时可切深色。

---

### 场景 2：Obsidian 笔记专属图文排版（存入 Vault）

当需要将推导过程与图像真正沉淀进本地 Obsidian 笔记时使用：

```bash
# 1. 渲染高清 PNG 并存入指定 Vault，向目标笔记追加 LaTeX 公式块与图片引用
node E:\Coding_tools\desmos-cli\bin\desmos.js obsidian "z=x^2-y^2" \
  --title "双曲抛物面马鞍面" \
  --vault "D:/MyObsidianVault" \
  --note "数学笔记/高等数学/多元微分与空间曲面.md"

# 2. 在控制台直接输出标准 Obsidian Markdown 片段（供复制粘贴）
node E:\Coding_tools\desmos-cli\bin\desmos.js obsidian "y=x^2-4" "y=-x^2+4" --title "双抛物线交点"
```

**生成的标准 Obsidian Markdown 结构示例**：

```markdown
### 📐 双抛物线交点

$$
\begin{aligned}
  y&=x^{2}-4 \\
  y&=-x^{2}+4
\end{aligned}
$$

![[attachments/desmos_plot_20260408_120000.png|600]]
```

---

### 场景 3：无头静默图片导出

用于自动化脚本、报告生成或离线绘图：

```bash
# 静默导出 2400x1600 高清 PNG 图片
node E:\Coding_tools\desmos-cli\bin\desmos.js render "y=\sin(x)" -b "-2pi,2pi,-2,2" -o "sine.png"
```

---

## 📋 常用参数选项速查表

| 子命令 / 参数 | 说明 | 示例 |
| :--- | :--- | :--- |
| `plot <formulas...>` | 绘制图形（自动识别 2D 平面或 3D 空间） | `desmos plot "z=x^2-y^2"` |
| `obsidian <formulas...>` | 存入 Obsidian Vault 并生成图文 Markdown | `desmos obsidian "y=x^2"` |
| `render <formulas...>` | 静默渲染并导出高清 PNG | `desmos render "y=x^2" -o plot.png` |
| `clear` | 一键清空画板公式 | `desmos clear` |
| `-3, --3d` | 强制使用 3D 空间立体坐标系 | `desmos plot "z=2x+y" --3d` |
| `-2, --2d` | 强制使用 2D 平面直角坐标系 | `desmos plot "y=x^2" --2d` |
| `-a, --append` | 追加公式（不覆盖已有公式） | `-a` |
| `-b, --bounds <xmin,xmax,ymin,ymax>` | 坐标系视窗范围（支持 `pi` 换算） | `-b "-2pi,2pi,-1,1"` |
| `--vault <path>` | Obsidian Vault 根目录绝对路径 | `--vault "D:/Vault"` |
| `--note <path>` | 目标笔记文件相对路径（自动追加） | `--note "高等数学/函数.md"` |
| `-d, --dark` | 深色模式（默认为纯白明亮模式） | `--dark` |
| `-j, --json` | JSON 结构化管道输出 | `-j` |

---

## 🔍 多模态视觉验收要求

Agent 在生成静态图片后，若具备多模态看图能力（如原生视觉 `read_image`），**必须调用 `read_image` 直读生成的 PNG 图片**，对图形的对称性、交点、极值点及单调区间进行实际核验，确保图表精准符合用户的数学预期。
