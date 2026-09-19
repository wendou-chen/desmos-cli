---
name: desmos
description: Desmos 官方级高精度数学图形可视化、2D/3D双引擎曲面绘制与 Obsidian 笔记排版全套技能。画图一律首选直接通过 CLI 直推 DSH 内部原生画板（0ms 呈现），支持 2D/3D 自动切换与 Obsidian 排版。严禁启动外部浏览器或 CDP 窗口。触发词：desmos、desmos 3d、desmos-cli、desmos skill、函数画图、绘制函数、数学图像、查看函数图像、函数可视化、3d坐标系、三维画图、空间曲面、立体几何、Obsidian数学公式、极坐标图像、隐函数图像、画板绘图、画图看图像。
---

# Desmos 数学图形可视化、2D/3D 画板与 Obsidian 嵌入技能指南

> 🚨 **【执行最高铁律】严禁启动任何外部 Chrome 浏览器、Playwright 窗口或 CDP 进程！**
> DSH 右侧边栏已深度集成原生 Desmos 2D/3D 画板，画图时**直接通过 CLI 发送至内部画板**，0ms 极速呈现。

---

## 🛠️ 核心执行命令（画图第一首选）

```bash
# 直接绘制公式（自动识别 2D 平面或 3D 空间，0ms 直推右侧画板）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "<formula1>" "<formula2>" ...
```

---

## 🌟 核心使用场景

### 场景 1：看图与函数/曲面可视化（直接推送画板）

当需要查看函数图像、极值点、交点或 3D 空间曲面时：

```bash
# 1. 绘制 2D 平面函数（自动识别为 2D）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "y=x^3-3x" "y=2x"

# 2. 绘制 3D 空间曲面（检测到 z= 自动切换至 3D 立体坐标系！）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "z=x^2-y^2"

# 3. 绘制 3D 隐式曲面（如空间球面）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "x^2+y^2+z^2=9"

# 4. 追加新曲线/曲面（不清除旧公式）
node E:\Coding_tools\desmos-cli\bin\desmos.js plot "z=2" -a

# 5. 清空画布
node E:\Coding_tools\desmos-cli\bin\desmos.js clear
```

---

### 场景 2：Obsidian 笔记排版与图文生成

当需要为本地 Obsidian 笔记生成对齐 LaTeX 公式块与 WikiLink 图片时：

```bash
# 1. 存入指定 Vault 并向笔记追加图文
node E:\Coding_tools\desmos-cli\bin\desmos.js obsidian "z=x^2-y^2" \
  --title "双曲抛物面马鞍面" \
  --vault "D:/a考研/Obsidian Vault" \
  --note "考研数学/高等数学/概念辨析与公式推导/马鞍面分析.md"

# 2. 仅在控制台输出标准 Obsidian Markdown 片段
node E:\Coding_tools\desmos-cli\bin\desmos.js obsidian "y=x^2-4" "y=-x^2+4" --title "双抛物线交点"
```

---

### 场景 3：无头静默图片导出（离线报告）

```bash
node E:\Coding_tools\desmos-cli\bin\desmos.js render "y=\sin(x)" -b "-2pi,2pi,-2,2" -o "sine.png"
```

---

## 📋 常用参数选项

| 子命令 / 参数 | 说明 | 示例 |
| :--- | :--- | :--- |
| `plot <formulas...>` | **首选**：直推 DSH 右侧画板 | `node .../desmos.js plot "z=x^2-y^2"` |
| `clear` | 清空右侧画板 | `node .../desmos.js clear` |
| `obsidian <formulas...>` | 存入 Obsidian Vault 并排版 | `node .../desmos.js obsidian "y=x^2"` |
| `render <formulas...>` | 静默渲染高清 PNG | `node .../desmos.js render "y=x^2" -o p.png` |
| `-3, --3d` | 强制开启 3D 坐标系 | `-3` |
| `-2, --2d` | 强制开启 2D 坐标系 | `-2` |
| `-a, --append` | 追加公式（不覆盖已有公式） | `-a` |
| `-b, --bounds <...>` | 视窗范围 (xmin,xmax,ymin,ymax) | `-b "-2pi,2pi,-1,1"` |
