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

// 动态主题样式生成函数（支持纯白浅色模式与深色模式自适应）
function getStyles(isDark: boolean) {
  return {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      width: '100%',
      height: '100%',
      minHeight: '100%',
      background: isDark ? '#131314' : '#ffffff',
      position: 'relative' as const,
      overflow: 'hidden',
    },
    toolbar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 10px',
      background: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(248, 249, 250, 0.98)',
      borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
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
      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      borderRadius: '5px',
      padding: '2px',
      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
    },
    segBtn: (active: boolean) => ({
      padding: '3px 9px',
      fontSize: '11px',
      fontWeight: active ? 600 : 400,
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      background: active ? (isDark ? 'rgba(255, 255, 255, 0.22)' : '#ffffff') : 'transparent',
      color: active ? (isDark ? '#ffffff' : '#18181b') : (isDark ? '#a1a1aa' : '#71717a'),
      boxShadow: active && !isDark ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
      transition: 'all 0.15s ease',
    }),
    btnGroup: {
      display: 'flex',
      gap: '5px',
      alignItems: 'center',
    },
    actionBtn: {
      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
      color: isDark ? '#e4e4e7' : '#27272a',
      border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
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
      color: isDark ? '#a1a1aa' : '#71717a',
      fontSize: '11px',
      fontFamily: 'monospace',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '140px',
    },
    // 会话顶栏快捷按钮：100% 契合 DSH 原生主题，无蓝底蓝框
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
}

/**
 * 动态加载最新 Desmos v1.13 离线脚本（带防强缓存机制）
 */
function ensureDesmosScriptLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已经具有 3D 计算器能力
    if (window.Desmos && typeof window.Desmos.Calculator3D === 'function') {
      resolve()
      return
    }

    // 若当前已有旧版 Desmos 单例，先重置以防阻断新版导出
    if (window.Desmos && typeof window.Desmos.Calculator3D !== 'function') {
      try {
        delete (window as any).Desmos
      } catch {}
    }

    const script = document.createElement('script')
    // 追加防强缓存时间戳
    script.src = `/dsh-desmos/assets/desmos_api.js?_v=1.13.0_${Date.now()}`
    script.onload = () => {
      if (window.Desmos && typeof window.Desmos.Calculator3D === 'function') {
        resolve()
      } else {
        reject(new Error('Desmos.Calculator3D 未在脚本中定义'))
      }
    }
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
 * 启发式探测公式是否属于 3D 空间曲面/立体几何
 */
function is3DFormula(latex: string): boolean {
  if (!latex) return false
  const s = latex.replace(/\s+/g, '')
  return /\bz\b|[zZ]=|=[zZ]|\+z\^|\+z_|\([a-zA-Z0-9+\-*/.]+,[a-zA-Z0-9+\-*/.]+,[a-zA-Z0-9+\-*/.]+\)/.test(s)
}

/**
 * 右侧边栏 Desmos 主体面板（默认白色浅色明亮主题）
 */
function DesmosPanelBody() {
  const containerRef = useRef<HTMLDivElement>(null)
  const calcRef = useRef<any>(null)
  const [currentDim, setCurrentDim] = useState<'2d' | '3d'>('3d') // 默认 3D
  const activeDimRef = useRef<'2d' | '3d'>('3d')
  const [isDark, setIsDark] = useState<boolean>(false) // 默认调为白色明亮主题！
  const isDarkRef = useRef<boolean>(false)
  const [status, setStatus] = useState<string>('3D 空间正在初始化...')
  const lastVersionRef = useRef<number>(0)
  const currentExprsRef = useRef<any[]>([])

  const currentStyles = getStyles(isDark)

  // 核心实例化方法：按指定维度创建 Calculator
  const createCalculatorInstance = (targetDim: '2d' | '3d', darkTheme: boolean, exprs: any[] = []) => {
    if (!containerRef.current || !window.Desmos) {
      console.warn('[desmos] container or window.Desmos not ready')
      return
    }

    // 1. 彻底清理旧实例
    if (calcRef.current) {
      try {
        calcRef.current.destroy?.()
      } catch (e) {
        console.error('[desmos] destroy error:', e)
      }
      calcRef.current = null
      containerRef.current.innerHTML = ''
    }

    activeDimRef.current = targetDim
    setCurrentDim(targetDim)

    const commonOptions = {
      keypad: true,
      expressions: true,
      settingsMenu: true,
      invertedColors: darkTheme, // 默认白色明亮主题 (false)
      fontSize: 14,
      border: false
    }

    let calc: any = null
    if (targetDim === '3d') {
      if (typeof window.Desmos.Calculator3D === 'function') {
        calc = window.Desmos.Calculator3D(containerRef.current, commonOptions)
        console.log('[desmos] ✅ 成功创建 Desmos 3D 空间计算器 (明亮白色主题)！')
      } else {
        setStatus('❌ 错误: 未检测到 Calculator3D')
        console.error('[desmos] window.Desmos.Calculator3D is not a function!')
        return
      }
    } else {
      calc = window.Desmos.GraphingCalculator(containerRef.current, {
        ...commonOptions,
        zoomButtons: true,
      })
      console.log('[desmos] ✅ 成功创建 Desmos 2D 平面计算器 (明亮白色主题)！')
    }

    calcRef.current = calc
    window.__DSH_DESMOS_INSTANCE__ = calc

    // 2. 注入公式
    if (exprs && exprs.length > 0) {
      exprs.forEach((e) => {
        try { calc.setExpression(e) } catch {}
      })
    } else {
      if (targetDim === '3d') {
        // 经典马鞍面 + 零平面
        calc.setExpression({ id: 'surf_saddle', latex: 'z=x^2-y^2', color: '#2563eb' })
        calc.setExpression({ id: 'plane_zero', latex: 'z=0', color: '#059669' })
      } else {
        calc.setExpression({ id: 'init_wave', latex: 'y=\\sin(x)', color: '#2563eb', lineWidth: 3.5 })
        try { calc.setMathBounds({ left: -6.28, right: 6.28, bottom: -2, top: 2 }) } catch {}
      }
    }

    setStatus(targetDim === '3d' ? '3D 空间立体画板就绪' : '2D 平面直角画板就绪')
  }

  // 组件单次挂载生命周期
  useEffect(() => {
    let unmounted = false

    ensureDesmosScriptLoaded().then(() => {
      if (unmounted) return

      // 先拉取一次服务端当前状态
      fetch('/dsh-desmos/api/state')
        .then(r => r.json())
        .then(data => {
          if (unmounted) return
          let initDim: '2d' | '3d' = '3d'
          const exprs = data.expressions || []
          currentExprsRef.current = exprs
          lastVersionRef.current = data.version || 1

          if (data.dimension === '2d' || data.dimension === '3d') {
            initDim = data.dimension
          } else if (exprs.length > 0) {
            initDim = exprs.some((e: any) => is3DFormula(e.latex || '')) ? '3d' : '2d'
          }

          createCalculatorInstance(initDim, isDarkRef.current, exprs)
        })
        .catch(() => {
          if (unmounted) return
          createCalculatorInstance('3d', isDarkRef.current)
        })
    }).catch(err => {
      setStatus(`脚本加载失败: ${err.message}`)
    })

    // 定时轮询与 Host 状态同步 (每 1 秒)
    const timer = setInterval(async () => {
      if (unmounted) return
      try {
        const res = await fetch('/dsh-desmos/api/state')
        if (!res.ok) return
        const data = await res.json()
        if (data.version && data.version !== lastVersionRef.current) {
          lastVersionRef.current = data.version
          const exprs = data.expressions || []
          currentExprsRef.current = exprs

          // 计算目标维度
          let targetDim: '2d' | '3d' = activeDimRef.current
          if (data.dimension === '3d' || data.dimension === '2d') {
            targetDim = data.dimension
          } else if (exprs.some((e: any) => is3DFormula(e.latex || '')) && activeDimRef.current !== '3d') {
            targetDim = '3d'
          }

          // 若维度改变则彻底重建实例，否则复用现有实例绘制
          if (targetDim !== activeDimRef.current || !calcRef.current) {
            createCalculatorInstance(targetDim, isDarkRef.current, exprs)
          } else {
            if (data.action === 'plot') {
              calcRef.current.setBlank()
              exprs.forEach((e: any) => {
                try { calcRef.current.setExpression(e) } catch {}
              })
              if (data.bounds && calcRef.current.setMathBounds) {
                try { calcRef.current.setMathBounds(data.bounds) } catch {}
              }
              setStatus(`已同步 (${exprs.length} 条公式)`)
            } else if (data.action === 'append') {
              exprs.forEach((e: any) => {
                try { calcRef.current.setExpression(e) } catch {}
              })
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
        try { calcRef.current.destroy?.() } catch {}
        calcRef.current = null
        window.__DSH_DESMOS_INSTANCE__ = null
      }
    }
  }, []) // 仅挂载一次

  // 用户点击工具栏上的 [ 2D | 3D ] 手动切换
  const handleSwitchDimension = (target: '2d' | '3d') => {
    if (target === activeDimRef.current && calcRef.current) return
    const currentExprs = calcRef.current?.getExpressions?.() || currentExprsRef.current
    createCalculatorInstance(target, isDarkRef.current, currentExprs)

    // 通知服务端记录当前维度
    fetch('/dsh-desmos/api/plot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'append', dimension: target, expressions: currentExprs })
    }).catch(() => {})
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
      a.download = `desmos_${activeDimRef.current}_${Date.now()}.png`
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

    const noteSnippet = `${latexBlock}\n\n![[desmos_${activeDimRef.current}_graph.png|600]]`
    navigator.clipboard.writeText(noteSnippet).then(() => {
      setStatus('已复制 Obsidian！')
    })
  }

  // 切换主题 (默认纯白浅色，点击可切换深色)
  const handleToggleTheme = () => {
    if (!calcRef.current) return
    const nextDark = !isDark
    setIsDark(nextDark)
    isDarkRef.current = nextDark
    calcRef.current.updateSettings?.({ invertedColors: nextDark })
  }

  // 清空画布
  const handleClear = () => {
    if (!calcRef.current) return
    calcRef.current.setBlank()
    setStatus('画布已清空')
  }

  return React.createElement('div', { style: currentStyles.container },
    React.createElement('div', { style: currentStyles.toolbar },
      React.createElement('div', { style: currentStyles.leftGroup },
        // 2D / 3D 分段切换按钮
        React.createElement('div', { style: currentStyles.segControl },
          React.createElement('button', {
            style: currentStyles.segBtn(currentDim === '2d'),
            onClick: () => handleSwitchDimension('2d'),
            title: '切换到 2D 平面直角坐标系'
          }, '📐 2D'),
          React.createElement('button', {
            style: currentStyles.segBtn(currentDim === '3d'),
            onClick: () => handleSwitchDimension('3d'),
            title: '切换到 3D 空间立体坐标系'
          }, '🌐 3D')
        ),
        React.createElement('span', { style: currentStyles.statusText }, status)
      ),
      React.createElement('div', { style: currentStyles.btnGroup },
        React.createElement('button', { style: currentStyles.actionBtn, onClick: handleExportPng }, '📷 导出'),
        React.createElement('button', { style: currentStyles.actionBtn, onClick: handleCopyObsidian }, '📋 笔记'),
        React.createElement('button', { style: currentStyles.actionBtn, onClick: handleToggleTheme, title: isDark ? '切为白色明亮模式' : '切为深色暗黑模式' }, isDark ? '☀️ 浅色' : '🌙 深色'),
        React.createElement('button', { style: currentStyles.actionBtn, onClick: handleClear }, '🧹')
      )
    ),
    React.createElement('div', {
      ref: containerRef,
      style: currentStyles.canvasWrapper,
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
      padding: '4px 8px',
      fontSize: '13px',
      borderRadius: '6px',
      cursor: 'pointer',
      background: hovered ? 'rgba(128, 128, 128, 0.12)' : 'transparent',
      color: 'inherit',
      border: 'none',
      fontWeight: 500,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      transition: 'background 0.15s ease',
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
