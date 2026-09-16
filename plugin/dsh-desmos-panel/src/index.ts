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

/**
 * 自动识别公式是否倾向于 3D 空间曲面/立体图形
 */
function is3DFormula(formula: string): boolean {
  if (!formula) return false
  const s = formula.replace(/\s+/g, '')
  return /\bz\b|[zZ]=|=[zZ]|\+z\^|\+z_|\([a-zA-Z0-9+\-*/]+,[a-zA-Z0-9+\-*/]+,[a-zA-Z0-9+\-*/]+\)/.test(s)
}

// 缓存最新的图形状态供前端同步
let currentPlotState = {
  version: 1,
  dimension: '2d' as '2d' | '3d' | 'auto',
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

          // 静态 Desmos API 脚本 (v1.13 支持 2D/3D)
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
                const rawExprs = parsed.expressions || []
                
                // 维度判定
                let targetDim = parsed.dimension || 'auto'
                if (targetDim === 'auto') {
                  targetDim = rawExprs.some((e: any) => is3DFormula(e.latex || '')) ? '3d' : '2d'
                }

                currentPlotState = {
                  version: currentPlotState.version + 1,
                  dimension: targetDim,
                  action: parsed.action || 'plot',
                  expressions: rawExprs,
                  bounds: parsed.bounds || null,
                  timestamp: Date.now()
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, version: currentPlotState.version, dimension: targetDim }))
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
      description: '【DSH 原生画板直通 (2D/3D)】直接在 DSH 界面中的 Desmos 画板渲染 2D 平面函数或 3D 空间立体曲面图形，毫秒级无延迟直显。',
      parameters: z.object({
        formulas: z.array(z.string()).description('LaTeX 格式数学公式列表。2D 如 ["y=\\\\sin(x)"]，3D 如 ["z=x^2-y^2", "x^2+y^2+z^2=9"]'),
        dimension: z.string().default('auto').description('画板维度："auto"（智能自动识别），"2d"（平面），"3d"（空间曲面）'),
        bounds: z.string().optional().description('坐标系视窗范围，格式: "xmin,xmax,ymin,ymax"'),
        title: z.string().optional().description('数学图形标题，如 "双曲抛物面马鞍面"'),
        clearBefore: z.boolean().default(true).description('是否在绘制前清空画布上一代公式')
      }),
      async execute(args: any) {
        const rawFormulas = Array.isArray(args.formulas) ? args.formulas : [args.formulas]
        
        // 自动判定或指定维度
        let dim = args.dimension || 'auto'
        if (dim === 'auto') {
          dim = rawFormulas.some((f: string) => is3DFormula(f)) ? '3d' : '2d'
        }

        const formattedExprs = rawFormulas.map((f: string, idx: number) => ({
          id: `expr_${idx + 1}`,
          latex: f.trim(),
          lineWidth: dim === '3d' ? undefined : 3
        }))

        currentPlotState = {
          version: currentPlotState.version + 1,
          dimension: dim,
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

        const tag = dim === '3d' ? '3D 空间立体' : '2D 平面'
        return {
          success: true,
          dimension: dim,
          message: `✅ 已成功将 ${rawFormulas.length} 条公式推送到 DSH Desmos [${tag}] 画板！`,
          expressions: rawFormulas,
          obsidianMarkdown: `${latexMarkdown}\n\n![[desmos_${dim}_graph.png|600]]`,
          tip: `画板已自动切换至 ${tag} 模式并渲染，可随时在右侧面板旋转查看或点击「📷 导出」！`
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
          dimension: currentPlotState.dimension,
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

  ctx.logger?.info?.('[@dsh-external/dsh-desmos-panel] Desmos 画板插件 (2D/3D 双引擎) 已就绪')
}
