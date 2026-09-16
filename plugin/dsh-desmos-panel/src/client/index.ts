import React, { useEffect, useRef, useState } from 'react'
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

// 悬浮工具栏与面板样式
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
    padding: '8px 12px',
    background: 'rgba(24, 24, 27, 0.95)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(8px)',
    zIndex: 10,
    flexShrink: 0,
  },
  btnGroup: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  btn: {
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    transition: 'all 0.15s ease',
  },
  secondaryBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#e4e4e7',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '4px',
    padding: '4px 7px',
    fontSize: '11px',
    cursor: 'pointer',
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
    maxWidth: '130px',
  },
  headerBtn: {
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '4px',
    cursor: 'pointer',
    background: 'rgba(37, 99, 235, 0.15)',
    color: '#3b82f6',
    border: '1px solid rgba(37, 99, 235, 0.3)',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  }
}

/**
 * 动态加载 Desmos 离线脚本
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
      fallback.src = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6'
      fallback.onload = () => resolve()
      fallback.onerror = (e) => reject(e)
      document.head.appendChild(fallback)
    }
    document.head.appendChild(script)
  })
}

/**
 * 右侧边栏 Desmos 主体面板
 */
function DesmosPanelBody() {
  const containerRef = useRef<HTMLDivElement>(null)
  const calcRef = useRef<any>(null)
  const [isDark, setIsDark] = useState<boolean>(true)
  const [status, setStatus] = useState<string>('就绪')
  const lastVersionRef = useRef<number>(0)

  useEffect(() => {
    let unmounted = false

    ensureDesmosScriptLoaded().then(() => {
      if (unmounted || !containerRef.current || !window.Desmos) return

      const calc = window.Desmos.GraphingCalculator(containerRef.current, {
        keypad: true,
        expressions: true,
        settingsMenu: true,
        zoomButtons: true,
        border: false,
        invertedColors: true,
        projectorMode: true,
        fontSize: 14,
      })

      calcRef.current = calc
      window.__DSH_DESMOS_INSTANCE__ = calc

      // 默认初始公式
      calc.setExpression({ id: 'init_wave', latex: 'y=\\sin(x)', color: '#2563eb', lineWidth: 3.5 })
      calc.setMathBounds({ left: -6.28, right: 6.28, bottom: -2, top: 2 })

      // 注册全局调度器供通信使用
      window.__DSH_DESMOS_DISPATCH__ = (action: any) => {
        if (!calcRef.current) return

        if (action.type === 'plot') {
          if (!action.append) {
            calcRef.current.setBlank()
          }
          if (action.expressions) {
            action.expressions.forEach((expr: any) => {
              calcRef.current.setExpression(expr)
            })
          }
          if (action.bounds) {
            calcRef.current.setMathBounds(action.bounds)
          }
          setStatus(`已渲染 ${action.expressions?.length || 0} 条公式`)
        } else if (action.type === 'clear') {
          calcRef.current.setBlank()
          setStatus('画布已清空')
        }
      }
    }).catch(err => {
      setStatus(`初始化失败: ${err.message}`)
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
          if (data.action === 'plot') {
            calcRef.current.setBlank()
            if (data.expressions) {
              data.expressions.forEach((e: any) => calcRef.current.setExpression(e))
            }
            if (data.bounds) {
              calcRef.current.setMathBounds(data.bounds)
            }
            setStatus(`已同步公式 (${data.expressions?.length || 0} 条)`)
          } else if (data.action === 'append') {
            if (data.expressions) {
              data.expressions.forEach((e: any) => calcRef.current.setExpression(e))
            }
            setStatus(`已追加公式`)
          } else if (data.action === 'clear') {
            calcRef.current.setBlank()
            setStatus('画布已清空')
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
  }, [])

  // 导出高清图片
  const handleExportPng = () => {
    if (!calcRef.current) return
    calcRef.current.asyncScreenshot({
      width: 1600,
      height: 1000,
      targetPixelRatio: 2,
    }, (dataUri: string) => {
      const a = document.createElement('a')
      a.download = `desmos_graph_${Date.now()}.png`
      a.href = dataUri
      a.click()
      setStatus('图片已下载')
    })
  }

  // 复制 Obsidian Markdown 代码
  const handleCopyObsidian = () => {
    if (!calcRef.current) return
    const exprs = calcRef.current.getExpressions()
      .filter((e: any) => e.type === 'expression' && e.latex)

    let latexBlock = ''
    if (exprs.length === 1) {
      latexBlock = `$$\n${exprs[0].latex}\n$$`
    } else if (exprs.length > 1) {
      latexBlock = `$$\n\\begin{aligned}\n` + exprs.map((e: any, idx: number) => {
        const aligned = e.latex.replace(/(=|<=|>=|<|>|\\le|\\ge)/, '&$1')
        return `  ${aligned}${idx < exprs.length - 1 ? ' \\\\' : ''}`
      }).join('\n') + `\n\\end{aligned}\n$$`
    }

    const snippet = `${latexBlock}\n\n![[desmos_graph.png|600]]`
    navigator.clipboard.writeText(snippet).then(() => {
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
      React.createElement('span', { style: styles.statusText }, `📐 ${status}`),
      React.createElement('div', { style: styles.btnGroup },
        React.createElement('button', { style: styles.btn, onClick: handleExportPng }, '📷 导出'),
        React.createElement('button', { style: styles.secondaryBtn, onClick: handleCopyObsidian }, '📋 复制 Obsidian'),
        React.createElement('button', { style: styles.secondaryBtn, onClick: handleToggleTheme }, isDark ? '☀️ 浅色' : '🌙 深色'),
        React.createElement('button', { style: styles.secondaryBtn, onClick: handleClear }, '🧹 清空')
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
 * 客户端插件入口
 */
export function apply(ctx: ClientContext): void {
  // 1. 向 DSH 右侧边栏注册 Tab 声明与引导页入口（进入右侧边栏列表）
  if (ctx.sidebarRightTabs) {
    ctx.effect(() => ctx.sidebarRightTabs.register({
      id: PLUGIN_ID,
      kind: TAB_KIND,
      multiple: false,
      priority: "extension",
      title: () => "📐 Desmos 画板",
      guide: [{
        id: "desmos-entry",
        order: 35,
        title: () => "📐 Desmos 画板",
        description: () => "交互式数学公式计算与函数图像可视化"
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

  // 3. 在会话顶部操作区注册一键呼出按钮
  ctx.effect(() => ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: PLUGIN_ID,
      label: () => '打开 Desmos 画板',
    }, () => React.createElement('button', {
      onClick: () => {
        try {
          ctx.sidebarRight?.openTab?.(TAB_KIND)
        } catch (err) {
          console.error('[desmos] 打开右侧画板失败:', err)
        }
      },
      style: styles.headerBtn,
      title: '在右侧边栏打开 Desmos 画板（与左侧对话并排）'
    }, '📐 Desmos 画板'))
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
