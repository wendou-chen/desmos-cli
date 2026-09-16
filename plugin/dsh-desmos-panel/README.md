# DSH Desmos 数学画板插件 (`@dsh-external/dsh-desmos-panel`)

面向 **DeepSeek Harness (DSH)** 的原生 Desmos 数学图形计算器面板与 Agent 直通绘图插件。

---

## 🌟 核心特性

- ⚡ **零 CDP 中间层**：Agent 在聊天中直接调用 DSH 原生工具，数据直通前端画板，毫秒级无延迟渲染。
- 🖥️ **原生 UI 集成**：直接挂载在 DSH 会话界面中，带顶部悬浮工具栏（📷 一键导出 PNG、📋 一键复制 Obsidian 代码、🌓 深浅主题切换、🧹 一键清空）。
- 📦 **100% 离线自包含**：通过 DSH 内置 WebServer 静态托管 Desmos 离线计算核心（3.12 MB），断网也能秒开秒画。
- 📓 **Obsidian 智能对齐**：自动生成 `\begin{aligned}` 多公式对齐块与 `![[desmos_graph.png|600]]` 引用语法。

---

## 🛠️ Agent 工具接口

- `desmos_plot_to_sidebar`：将多条数学公式（LaTeX）推送到 DSH 画板中。
- `desmos_clear_sidebar`：清空画板。

---

## 🔌 内部 API 路由

- `GET /dsh-desmos/assets/desmos_api.js`：提供 Desmos 离线计算引擎脚本。
- `GET /dsh-desmos/api/state`：获取当前画板公式与视窗状态。
- `POST /dsh-desmos/api/plot`：向画板发送绘图指令。
