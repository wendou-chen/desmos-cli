import type { Context } from 'cordis'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from 'schemastery'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export const name = "@dsh-external/dsh-desmos-panel"
export const inject = []

export interface Config {
  port?: number
}

export const Config = z.object({
  port: z.number().default(0),
})

type AppContext = Context & {
  tools?: any
  webServer?: any
}

// 缓存最新的图形状态供前端同步
let currentPlotState = {
  version: 1,
  action: 'plot',
  expressions: [{ id: 'e1', latex: 'y=\\sin(x)', color: '#2563eb' }],
  bounds: null as any,
  timestamp: Date.now()
}

export function apply(ctx: AppContext, config: Config): void {
  const assetsPath = join(__dirname, '../../assets/desmos_api.js')
  const localAssetPath = existsSync(assetsPath) 
    ? assetsPath 
    : join(__dirname, '../assets/desmos_api.js')

  // 1. WebServer 静态资源与状态路由注册
  ctx.inject(['webServer'], (wctx: any) => {
    if (wctx.webServer?.register) {
      wctx.effect(() => wctx.webServer.register({
        kind: 'prefix',
        path: '/dsh-desmos',
        handler: (req: any, res: any) => {
          const url = req.url || ''

          // 静态 Desmos API 脚本
          if (url.startsWith('/dsh-desmos/assets/desmos_api.js')) {
            if (existsSync(localAssetPath)) {
              const content = readFileSync(localAssetPath, 'utf-8')
              res.writeHead(200, {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'public, max-age=86400'
              })
              res.end(content)
              return
            }
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('desmos_api.js not found')
            return
          }

          // 查询最新绘图状态
          if (url.startsWith('/dsh-desmos/api/state')) {
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache'
            })
            res.end(JSON.stringify(currentPlotState))
            return
          }

          // 接收外部绘图指令
          if (url.startsWith('/dsh-desmos/api/plot') && req.method === 'POST') {
            let body = ''
            req.on('data', (chunk: any) => { body += chunk })
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}')
                currentPlotState = {
                  version: currentPlotState.version + 1,
                  action: parsed.action || 'plot',
                  expressions: parsed.expressions || [],
                  bounds: parsed.bounds || null,
                  timestamp: Date.now()
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, version: currentPlotState.version }))
              } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, error: err.message }))
              }
            })
            return
          }

          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not Found')
        }
      }), 'dsh-desmos-panel: webServer prefix route')
    }
  })

  // 2. 注册 Agent 专有 DSH 工具：desmos_plot_to_sidebar
  ctx.inject(['tools'], (tctx: any) => {
    tctx.tools?.register?.({
      name: 'desmos_plot_to_sidebar',
      description: '【DSH 原生画板直通】直接在 DSH 界面中的 Desmos 画板渲染数学公式，用户可即时在前台交互微调，无需开启外部浏览器。',
      parameters: z.object({
        formulas: z.array(z.string()).description('LaTeX 格式的数学公式列表，如 ["y=\\\\sin(x)", "y=\\\\cos(x)"] 或 ["x^2+y^2=16"]'),
        bounds: z.string().optional().description('坐标系视窗范围，格式: "xmin,xmax,ymin,ymax" 如 "-5,5,-5,5"'),
        title: z.string().optional().description('数学图形标题，如 "正弦曲线"'),
        clearBefore: z.boolean().default(true).description('是否在绘制前清空画布上一代公式')
      }),
      async execute(args: any) {
        const rawFormulas = Array.isArray(args.formulas) ? args.formulas : [args.formulas]
        const formattedExprs = rawFormulas.map((f: string, idx: number) => ({
          id: `expr_${idx + 1}`,
          latex: f.trim(),
          lineWidth: 3
        }))

        currentPlotState = {
          version: currentPlotState.version + 1,
          action: args.clearBefore ? 'plot' : 'append',
          expressions: formattedExprs,
          bounds: args.bounds || null,
          timestamp: Date.now()
        }

        // 生成适合放入笔记的 Obsidian 语法
        let latexMarkdown = ''
        if (rawFormulas.length === 1) {
          latexMarkdown = `$$\n${rawFormulas[0]}\n$$`
        } else {
          latexMarkdown = `$$\n\\begin{aligned}\n` + rawFormulas.map((f: string, i: number) => {
            const aligned = f.replace(/(=|<=|>=|<|>|\\le|\\ge)/, '&$1')
            return `  ${aligned}${i < rawFormulas.length - 1 ? ' \\\\' : ''}`
          }).join('\n') + `\n\\end{aligned}\n$$`
        }

        return {
          success: true,
          message: `✅ 已成功将 ${rawFormulas.length} 条公式推送到 DSH Desmos 画板！`,
          expressions: rawFormulas,
          obsidianMarkdown: `${latexMarkdown}\n\n![[desmos_graph.png|600]]`,
          tip: '画板已实时同步出图，用户可点击画板右上角「📷 导出 PNG」或「📋 复制 Obsidian」！'
        }
      }
    })

    // 3. 注册 Agent 专有 DSH 工具：desmos_clear_sidebar
    tctx.tools?.register?.({
      name: 'desmos_clear_sidebar',
      description: '清空 DSH Desmos 画板中的所有公式与图形。',
      parameters: z.object({}),
      async execute() {
        currentPlotState = {
          version: currentPlotState.version + 1,
          action: 'clear',
          expressions: [],
          bounds: null,
          timestamp: Date.now()
        }
        return {
          success: true,
          message: '🧹 DSH Desmos 画板已清空！'
        }
      }
    })
  })

  ctx.logger?.info?.('[@dsh-external/dsh-desmos-panel] Desmos 画板插件已就绪')
}
