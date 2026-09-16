import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'

declare global {
  interface Window {
    Desmos?: any
    __DSH_DESMOS_INSTANCE__?: any
    __DSH_DESMOS_DISPATCH__?: (event: any) => void
    __DSH_OPEN_DESMOS_TAB__?: () => void
  }
}

type ClientContext = {
  slots: SlotsService
  sidebarRightTabs?: any
  sidebarRight?: any
  effect(cb: () => void | (() => void), desc?: string): void
}

export const inject = ['slots', 'sidebarRightTabs', 'sidebarRight']

const PLUGIN_ID = "@dsh-external/dsh-desmos-panel"
const TAB_KIND = "desmos"

// 面板与工具栏样式
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
    height: '100%',
    minHeight: '100%',
    background: '#18181b',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: 'rgba(24, 24, 27, 0.95)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(8px)',
    zIndex: 10,
    flexShrink: 0,
  },
  leftGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  segControl: {
    display: 'inline-flex',
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '5px',
    padding: '2px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  segBtn: (active: boolean) => ({
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: active ? 600 : 400,
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
    color: active ? '#ffffff' : '#a1a1aa',
    transition: 'all 0.15s ease',
  }),
  btnGroup: {
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
  },
  actionBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#e4e4e7',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '4px',
    padding: '4px 7px',
    fontSize: '11px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    transition: 'all 0.15s ease',
  },
  canvasWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative' as const,
  },
  statusText: {
    color: '#a1a1aa',
    fontSize: '11px',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '110px',
  },
  // 会话顶栏快捷按钮：彻底去除蓝死与蓝边框，与 DSH 原生主题完美契合
  nativeHeaderBtn: {
    padding: '4px 8px',
    fontSize: '13px',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'transparent',
    color: 'inherit',
    border: 'none',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'background 0.15s ease',
  }
}

/**
 * 动态加载 Desmos 离线脚本 (v1.13 支持 2D/3D 双引擎)
 */
function ensureDesmosScriptLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Desmos) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = '/dsh-desmos/assets/desmos_api.js'
    script.onload = () => resolve()
    script.onerror = () => {
      // 备用降级远程 CDN
      const fallback = document.createElement('script')
      fallback.src = 'https://www.desmos.com/api/v1.13/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6'
      fallback.onload = () => resolve()
      fallback.onerror = (e) => reject(e)
      document.head.appendChild(fallback)
    }
    document.head.appendChild(script)
  })
}

/**
 * 判断公式是否倾向于 3D 空间图形
 */
function is3DFormula(latex: string): boolean {
  if (!latex) return false
  const s = latex.replace(/\s+/g, '')
  // 含 z=、=z、z^2、多元函数 f(x,y)、三维向量 (x,y,z) 等
  return /\bz\b|[zZ]=|=[zZ]|\+z\^|\+z_|\([a-zA-Z0-9+\-*/]+,[a-zA-Z0-9+\-*/]+,[a-zA-Z0-9+\-*/]+\)/.test(s)
}

/**
 * 右侧边栏 Desmos 主体面板（支持 2D/3D 动态热切换）
 */
function DesmosPanelBody() {
  const containerRef = useRef<HTMLDivElement>(null)
  const calcRef = useRef<any>(null)
  const [dimension, setDimension] = useState<'2d' | '3d'>('2d')
  const [isDark, setIsDark] = useState<boolean>(true)
  const [status, setStatus] = useState<string>('就绪')
  const lastVersionRef = useRef<number>(0)
  const currentExpressionsRef = useRef<any[]>([])

  // 初始化或重新创建计算器实例
  const initCalculator = useCallback((dim: '2d' | '3d', darkTheme: boolean, exprsToRestore: any[] = []) => {
    if (!containerRef.current || !window.Desmos) return

    // 销毁旧实例
    if (calcRef.current) {
      try {
        calcRef.current.destroy?.()
      } catch {}
      calcRef.current = null
      containerRef.current.innerHTML = ''
    }

    const commonOptions = {
      keypad: true,
      expressions: true,
      settingsMenu: true,
      invertedColors: darkTheme,
      fontSize: 14,
    }

    let calc: any = null
    if (dim === '3d') {
      if (typeof window.Desmos.Calculator3D === 'function') {
        calc = window.Desmos.Calculator3D(containerRef.current, {
          ...commonOptions,
          border: false,
        })
      } else {
        console.warn('[desmos] Calculator3D not found, fallback to GraphingCalculator')
        calc = window.Desmos.GraphingCalculator(containerRef.current, {
          ...commonOptions,
          zoomButtons: true,
          border: false,
        })
      }
    } else {
      calc = window.Desmos.GraphingCalculator(containerRef.current, {
        ...commonOptions,
        zoomButtons: true,
        border: false,
      })
    }

    calcRef.current = calc
    window.__DSH_DESMOS_INSTANCE__ = calc

    // 恢复公式或设置初始几何图形
    if (exprsToRestore && exprsToRestore.length > 0) {
      exprsToRestore.forEach((expr) => {
        calc.setExpression(expr)
      })
    } else {
      if (dim === '3d') {
        // 经典马鞍面曲面
        calc.setExpression({ id: 'surf_saddle', latex: 'z=x^2-y^2', color: '#3b82f6' })
      } else {
        // 初始正弦波
        calc.setExpression({ id: 'init_wave', latex: 'y=\\sin(x)', color: '#3b82f6', lineWidth: 3.5 })
        calc.setMathBounds({ left: -6.28, right: 6.28, bottom: -2, top: 2 })
      }
    }

    setStatus(dim === '3d' ? '3D 空间已就绪' : '2D 平面已就绪')
  }, [])

  // 组件挂载加载 Desmos 库
  useEffect(() => {
    let unmounted = false

    ensureDesmosScriptLoaded().then(() => {
      if (unmounted) return
      initCalculator('2d', isDark)
    }).catch(err => {
      setStatus(`加载失败: ${err.message}`)
    })

    // 定时轮询与 Host 状态同步 (每 1 秒)
    const timer = setInterval(async () => {
      if (!calcRef.current || unmounted) return
      try {
        const res = await fetch('/dsh-desmos/api/state')
        if (!res.ok) return
        const data = await res.json()
        if (data.version && data.version !== lastVersionRef.current) {
          lastVersionRef.current = data.version

          const exprs = data.expressions || []
          currentExpressionsRef.current = exprs

          // 自动根据公式探测维度或显式指定维度
          let targetDim: '2d' | '3d' = dimension
          if (data.dimension === '3d' || data.dimension === '2d') {
            targetDim = data.dimension
          } else if (exprs.some((e: any) => is3DFormula(e.latex))) {
            targetDim = '3d'
          }

          if (targetDim !== dimension) {
            setDimension(targetDim)
            initCalculator(targetDim, isDark, exprs)
          } else {
            if (data.action === 'plot') {
              calcRef.current.setBlank()
              exprs.forEach((e: any) => calcRef.current.setExpression(e))
              if (data.bounds && calcRef.current.setMathBounds) {
                calcRef.current.setMathBounds(data.bounds)
              }
              setStatus(`已同步 (${exprs.length} 条公式)`)
            } else if (data.action === 'append') {
              exprs.forEach((e: any) => calcRef.current.setExpression(e))
              setStatus(`已追加公式`)
            } else if (data.action === 'clear') {
              calcRef.current.setBlank()
              setStatus('画布已清空')
            }
          }
        }
      } catch {
        // 静默
      }
    }, 1000)

    return () => {
      unmounted = true
      clearInterval(timer)
      if (calcRef.current) {
        calcRef.current.destroy?.()
        calcRef.current = null
        window.__DSH_DESMOS_INSTANCE__ = null
      }
    }
  }, [initCalculator, dimension, isDark])

  // 手动切换 2D / 3D
  const handleSwitchDimension = (target: '2d' | '3d') => {
    if (target === dimension) return
    setDimension(target)
    const existingExprs = calcRef.current?.getExpressions?.() || currentExpressionsRef.current
    initCalculator(target, isDark, existingExprs)
  }

  // 导出高清图片
  const handleExportPng = () => {
    if (!calcRef.current) return
    calcRef.current.asyncScreenshot({
      width: 1600,
      height: 1000,
      targetPixelRatio: 2,
    }, (dataUri: string) => {
      const a = document.createElement('a')
      a.download = `desmos_${dimension}_${Date.now()}.png`
      a.href = dataUri
      a.click()
      setStatus('图片已下载')
    })
  }

  // 复制 Obsidian Markdown 代码
  const handleCopyObsidian = () => {
    if (!calcRef.current) return
    const exprs = calcRef.current.getExpressions?.()
      ?.filter((e: any) => e.type === 'expression' && e.latex) || []

    let latexBlock = ''
    if (exprs.length === 1) {
      latexBlock = `$$\n${exprs[0].latex}\n$$`
    } else if (exprs.length > 1) {
      latexBlock = `$$\n\\begin{aligned}\n` + exprs.map((e: any, idx: number) => {
        const aligned = e.latex.replace(/(=|<=|>=|<|>|\\le|\\ge)/, '&$1')
        return `  ${aligned}${idx < exprs.length - 1 ? ' \\\\' : ''}`
      }).join('\n') + `\n\\end{aligned}\n$$`
    }

    const noteSnippet = `${latexBlock}\n\n![[desmos_${dimension}_graph.png|600]]`
    navigator.clipboard.writeText(noteSnippet).then(() => {
      setStatus('已复制 Obsidian！')
    })
  }

  // 切换主题
  const handleToggleTheme = () => {
    if (!calcRef.current) return
    const nextDark = !isDark
    setIsDark(nextDark)
    calcRef.current.updateSettings({ invertedColors: nextDark })
  }

  // 清空画布
  const handleClear = () => {
    if (!calcRef.current) return
    calcRef.current.setBlank()
    setStatus('画布已清空')
  }

  return React.createElement('div', { style: styles.container },
    React.createElement('div', { style: styles.toolbar },
      React.createElement('div', { style: styles.leftGroup },
        // 2D / 3D 分段切换按钮
        React.createElement('div', { style: styles.segControl },
          React.createElement('button', {
            style: styles.segBtn(dimension === '2d'),
            onClick: () => handleSwitchDimension('2d'),
            title: '切换到 2D 平面直角坐标系'
          }, '📐 2D'),
          React.createElement('button', {
            style: styles.segBtn(dimension === '3d'),
            onClick: () => handleSwitchDimension('3d'),
            title: '切换到 3D 空间立体坐标系'
          }, '🌐 3D')
        ),
        React.createElement('span', { style: styles.statusText }, status)
      ),
      React.createElement('div', { style: styles.btnGroup },
        React.createElement('button', { style: styles.actionBtn, onClick: handleExportPng }, '📷 导出'),
        React.createElement('button', { style: styles.actionBtn, onClick: handleCopyObsidian }, '📋 笔记'),
        React.createElement('button', { style: styles.actionBtn, onClick: handleToggleTheme }, isDark ? '☀️' : '🌙'),
        React.createElement('button', { style: styles.actionBtn, onClick: handleClear }, '🧹')
      )
    ),
    React.createElement('div', {
      ref: containerRef,
      style: styles.canvasWrapper,
      'data-dsh-desmos-canvas': true
    })
  )
}

/**
 * 顶部导航栏按钮组件（完全继承 DSH 原生风格）
 */
function DesmosHeaderButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return React.createElement('button', {
    onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    style: {
      ...styles.nativeHeaderBtn,
      background: hovered ? 'rgba(128, 128, 128, 0.12)' : 'transparent',
    },
    title: '在右侧边栏打开 Desmos 画板 (2D / 3D)'
  },
    React.createElement('span', { style: { fontSize: '14px' } }, '📐'),
    React.createElement('span', null, 'Desmos 画板')
  )
}

/**
 * 客户端插件入口
 */
export function apply(ctx: ClientContext): void {
  // 1. 向 DSH 右侧边栏注册 Tab 声明与引导页入口
  if (ctx.sidebarRightTabs) {
    ctx.effect(() => ctx.sidebarRightTabs.register({
      id: PLUGIN_ID,
      kind: TAB_KIND,
      multiple: false,
      priority: "extension",
      title: () => "📐 Desmos 画板 (2D/3D)",
      guide: [{
        id: "desmos-entry",
        order: 35,
        title: () => "📐 Desmos 数学画板 (2D / 3D)",
        description: () => "交互式 2D 平面函数与 3D 空间曲面可视化"
      }]
    }), 'dsh-desmos-panel: register right sidebar tab & guide')
  }

  // 2. 向 DSH 右侧边栏注册正文组件
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () =>
    ctx.slots.register({
      name: 'sidebar.right.pane.tab',
      key: PLUGIN_ID,
      label: () => 'Desmos 画板',
    }, DesmosPanelBody)
  ), 'dsh-desmos-panel: register right sidebar body')

  // 3. 在会话顶部操作区注册一键呼出按钮（100% 融入 DSH 原生主题风格）
  ctx.effect(() => ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: PLUGIN_ID,
      label: () => '打开 Desmos 画板',
    }, () => React.createElement(DesmosHeaderButton, {
      onClick: () => {
        try {
          ctx.sidebarRight?.openTab?.(TAB_KIND)
        } catch (err) {
          console.error('[desmos] 打开右侧画板失败:', err)
        }
      }
    }))
  ), 'dsh-desmos-panel: register session header action button')

  // 4. 挂载全局打开辅助函数供 Agent 状态同步自动展开
  if (typeof window !== 'undefined') {
    window.__DSH_OPEN_DESMOS_TAB__ = () => {
      try {
        ctx.sidebarRight?.openTab?.(TAB_KIND)
      } catch (err) {
        // 静默
      }
    }
  }
}
