import React, { useEffect, useRef, useState } from 'react'
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'

declare global {
  interface Window {
    Desmos?: any
    __DSH_DESMOS_INSTANCE__?: any
    __DSH_DESMOS_DISPATCH__?: (event: any) => void
    __DSH_TOGGLE_DESMOS_VIEW__?: () => void
  }
}

type ClientContext = {
  slots: SlotsService
  effect(cb: () => void | (() => void), desc?: string): void
}

export const inject = ['slots']

// 悬浮工具栏与面板样式
const styles = {
  viewWrapper: {
    width: '100%',
    height: '460px',
    minHeight: '380px',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#18181b',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
    margin: '12px 0',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    background: 'rgba(24, 24, 27, 0.95)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    zIndex: 10,
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
    borderRadius: '5px',
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s ease',
  },
  secondaryBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#e4e4e7',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '5px',
    padding: '5px 10px',
    fontSize: '12px',
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
    fontSize: '12px',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  headerActionBtn: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
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
 * Desmos 面板主体组件
 */
function DesmosPanelView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const calcRef = useRef<any>(null)
  const [isDark, setIsDark] = useState<boolean>(true)
  const [status, setStatus] = useState<string>('就绪')
  const [visible, setVisible] = useState<boolean>(true)
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
        fontSize: 15,
      })

      calcRef.current = calc
      window.__DSH_DESMOS_INSTANCE__ = calc

      // 默认画一个初始函数
      calc.setExpression({ id: 'init_wave', latex: 'y=\\sin(x)', color: '#2563eb', lineWidth: 3.5 })
      calc.setMathBounds({ left: -6.28, right: 6.28, bottom: -2, top: 2 })
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
          setVisible(true)
          if (data.action === 'plot') {
            calcRef.current.setBlank()
            if (data.expressions) {
              data.expressions.forEach((e: any) => calcRef.current.setExpression(e))
            }
            if (data.bounds) {
              calcRef.current.setMathBounds(data.bounds)
            }
            setStatus(`已同步 Agent 公式 (${data.expressions?.length || 0} 条)`)
          } else if (data.action === 'append') {
            if (data.expressions) {
              data.expressions.forEach((e: any) => calcRef.current.setExpression(e))
            }
            setStatus(`已追加 Agent 公式`)
          } else if (data.action === 'clear') {
            calcRef.current.setBlank()
            setStatus('画布已清空')
          }
        }
      } catch {
        // 静默
      }
    }, 1000)

    window.__DSH_TOGGLE_DESMOS_VIEW__ = () => {
      setVisible(v => !v)
    }

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
      setStatus('已复制 Obsidian Markdown！')
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

  if (!visible) return null

  return React.createElement('div', { style: styles.viewWrapper },
    React.createElement('div', { style: styles.toolbar },
      React.createElement('span', { style: styles.statusText }, `📐 ${status}`),
      React.createElement('div', { style: styles.btnGroup },
        React.createElement('button', { style: styles.btn, onClick: handleExportPng }, '📷 导出 PNG'),
        React.createElement('button', { style: styles.secondaryBtn, onClick: handleCopyObsidian }, '📋 复制 Obsidian'),
        React.createElement('button', { style: styles.secondaryBtn, onClick: handleToggleTheme }, isDark ? '☀️ 浅色' : '🌙 深色'),
        React.createElement('button', { style: styles.secondaryBtn, onClick: handleClear }, '🧹 清空'),
        React.createElement('button', { style: styles.secondaryBtn, onClick: () => setVisible(false) }, '✕ 收起')
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
 * 会话头部操作栏按钮组件
 */
function DesmosHeaderAction() {
  return React.createElement('button', {
    style: styles.headerActionBtn,
    title: '打开/展开 Desmos 数学画板',
    onClick: () => {
      if (window.__DSH_TOGGLE_DESMOS_VIEW__) {
        window.__DSH_TOGGLE_DESMOS_VIEW__()
      }
    }
  }, '📐 Desmos 画板')
}

/**
 * 客户端插件入口应用
 */
export function apply(ctx: ClientContext): void {
  // 1. 注册 conversation.view 主面板
  ctx.effect(() => ctx.slots.inject('conversation.view', () =>
    ctx.slots.register({
      name: 'conversation.view',
      id: '@dsh-external/dsh-desmos-panel-view',
      label: () => 'Desmos 数学画板',
    }, DesmosPanelView)
  ), 'dsh-desmos-panel: register conversation view')

  // 2. 注册会话头部快捷按钮
  ctx.effect(() => ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: '@dsh-external/dsh-desmos-panel-header-action',
      label: () => 'Desmos 画板',
    }, DesmosHeaderAction)
  ), 'dsh-desmos-panel: register session header action')
}
