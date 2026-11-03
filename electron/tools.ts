import { spawn } from 'node:child_process'
import path from 'node:path'
import { app } from 'electron'
import type { ToolSchema } from './runtime'
import { buildInquiryAnalysis, type InquiryAnalysisInput } from './inquiry'

export type EvidenceItem = { source: string; period?: string; scope?: string; note?: string }
export type DataQuality = {
  status: 'OK' | 'PARTIAL' | 'UNAVAILABLE'
  sourceType: 'SIMULATED_DEMO' | 'PUBLIC_DATA' | 'USER_PROVIDED' | 'MIXED'
  missing: string[]
  warnings: string[]
  forecastMethod?: string
}
export type StructuredToolResult<T = unknown> = {
  ok: boolean
  summary: string
  data?: T
  evidence: EvidenceItem[]
  dataQuality: DataQuality
  warnings: string[]
  error?: { code: string; message: string }
}
export type ToolResult = { ok: boolean; content: string; structured?: StructuredToolResult }
export type ToolExecutor = (args: Record<string, unknown>) => Promise<ToolResult> | ToolResult

export type ToolDefinition = {
  schema: ToolSchema
  execute: ToolExecutor
}

const QUALITY: DataQuality = { status: 'OK', sourceType: 'MIXED', missing: [], warnings: [] }
// 开发时优先使用项目虚拟环境；打包时由构建流程提供对应平台的Python运行时。
const projectPython = process.platform === 'win32'
  ? path.join(__dirname, '../.venv/Scripts/python.exe')
  : path.join(__dirname, '../.venv/bin/python')
const pythonExecutable = process.env.PYTHON_BIN
  || (app.isPackaged ? (process.platform === 'win32' ? 'python' : 'python3') : projectPython)
const workerPath = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked/python/analysis_worker.py')
  : path.join(__dirname, '../python/analysis_worker.py')
const defaultDatabasePath = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked/data/maozhi-real.duckdb')
  : path.join(__dirname, '../data/maozhi-real.duckdb')
const databasePath = process.env.MAOZHI_DATABASE || defaultDatabasePath

// Worker和数据库都支持通过环境变量替换，便于后续接入数据组的正式数据包。

async function callPython(method: string, params: Record<string, unknown>): Promise<StructuredToolResult> {
  return new Promise((resolve) => {
    const child = spawn(pythonExecutable, [workerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MAOZHI_DATABASE: databasePath,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8'
      }
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (result: StructuredToolResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(() => {
      child.kill()
      finish({ ok: false, summary: 'Python分析Worker超时。', evidence: [], dataQuality: { ...QUALITY, status: 'UNAVAILABLE', warnings: ['Worker超过60秒未返回'] }, warnings: ['请检查Python运行环境。'], error: { code: 'PYTHON_TIMEOUT', message: '分析Worker超时' } })
    }, 60000)
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', (error) => finish({ ok: false, summary: '无法启动Python分析Worker。', evidence: [], dataQuality: { ...QUALITY, status: 'UNAVAILABLE', warnings: [stderr || error.message] }, warnings: ['请安装Python 3并确认PYTHON_BIN配置。'], error: { code: 'PYTHON_START_FAILED', message: error.message } }))
    child.on('close', () => {
      if (settled) return
      try { finish(JSON.parse(stdout) as StructuredToolResult) }
      catch { finish({ ok: false, summary: 'Python分析Worker返回了无效结果。', evidence: [], dataQuality: { ...QUALITY, status: 'UNAVAILABLE', warnings: [stderr || '无JSON输出'] }, warnings: ['分析结果无法解析。'], error: { code: 'PYTHON_INVALID_OUTPUT', message: stderr || '无效JSON输出' } }) }
    })
    child.stdin.write(JSON.stringify({ method, params }))
    child.stdin.end()
  })
}

function wrap(result: StructuredToolResult): ToolResult {
  return {
    ok: result.ok,
    content: JSON.stringify(result),
    structured: result
  }
}

function textArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}
function invalid(summary: string, code: string, message: string, warning: string): ToolResult {
  return wrap({ ok: false, summary, evidence: [], dataQuality: { ...QUALITY, status: 'UNAVAILABLE' }, warnings: [warning], error: { code, message } })
}

const analyzeInquiry: ToolDefinition = {
  schema: {
    type: 'function',
    function: {
      name: 'analyze_inquiry',
      description: '把用户提供的跨境询盘整理成结构化字段，计算信息完整度，并生成缺口、风险提示和报价前追问清单。只能提取原文明确出现的信息，禁止猜测。',
      parameters: {
        type: 'object',
        properties: {
          original_text: { type: 'string', description: '用户提供的完整询盘原文，必须忠实保留' },
          product_name: { type: 'string', description: '原文明确提到的商品名称；没有则省略' },
          target_market: { type: 'string', description: '原文明确提到的最终目的国家或地区；没有则省略' },
          target_market_iso3: { type: 'string', description: '目标国家的ISO3代码；仅在目标国家明确时填写' },
          quantity: { type: 'string', description: '采购数量和单位，保留原文表达；没有则省略' },
          specifications: { type: 'array', items: { type: 'string' }, description: '原文明确给出的型号、尺寸、电压、材质、用途等规格' },
          buyer_company: { type: 'string', description: '原文明确出现的采购方公司名称' },
          delivery_requirement: { type: 'string', description: '原文明确出现的交期、目的港或收货地点' },
          trade_term: { type: 'string', description: '原文明确出现的EXW、FOB、CIF等贸易术语' },
          payment_terms: { type: 'string', description: '原文明确出现的付款方式或付款节点' },
          certifications: { type: 'array', items: { type: 'string' }, description: '原文明确提出的认证、测试或标签要求' },
          deadline: { type: 'string', description: '原文明确出现的报价截止时间或项目截止时间' }
        },
        required: ['original_text']
      }
    }
  },
  execute: (args) => {
    try {
      const data = buildInquiryAnalysis(args as InquiryAnalysisInput)
      const warnings = data.missing_fields.length
        ? ['询盘仍有信息缺口，正式报价前应向客户确认。']
        : []
      return wrap({
        ok: true,
        summary: `已提取${data.known_field_count}项关键信息，发现${data.missing_fields.length}项待确认内容。`,
        data,
        evidence: [{ source: '用户提供的询盘原文', scope: '当前对话', note: '结构化字段仅来自原文明确内容' }],
        dataQuality: {
          status: data.missing_fields.length ? 'PARTIAL' : 'OK',
          sourceType: 'USER_PROVIDED',
          missing: data.missing_fields.map((field) => field.key),
          warnings,
        },
        warnings,
      })
    } catch (error) {
      return invalid('询盘解析失败。', 'INVALID_INQUIRY', error instanceof Error ? error.message : String(error), '请提供非空的询盘原文。')
    }
  }
}

const resolveProduct: ToolDefinition = {
  schema: {
    type: 'function',
    function: {
      name: 'resolve_product',
      description: '在HS维表中将商品名称或HS编码解析为候选HS编码。中文商品可同时提供英文检索词。所有候选均来自数据库，名称检索结果必须让用户确认。',
      parameters: {
        type: 'object',
        properties: {
          product_name: { type: 'string', description: '用户提供的商品名称或HS编码' },
          search_terms_en: { type: 'string', description: '可选。根据用户原始描述生成的简洁英文商品检索词，只用于检索数据库，不能直接填写或猜测HS编码。' }
        },
        required: ['product_name']
      }
    }
  },
  execute: async (args) => {
    const productName = textArg(args, 'product_name') || ''
    const searchTermsEn = textArg(args, 'search_terms_en')
    const result = await callPython('resolve_product', {
      product_name: productName,
      ...(searchTermsEn ? { search_terms_en: searchTermsEn } : {})
    })
    return wrap(result)
  }
}

const analyzeMarkets: ToolDefinition = {
  schema: {
    type: 'function',
    function: {
      name: 'analyze_markets',
      description: '基于已确认HS编码分析数据库支持的RCEP15市场，返回地图数据、贸易指标、关税、宏观环境、预测和综合评分。必须先有confirmed_hs6；可用markets指定RCEP国家ISO3列表；数据不足必须降级并说明。',
      parameters: {
        type: 'object',
        properties: {
          confirmed_hs6: { type: 'string', description: '用户确认的6位HS编码' },
          markets: { type: 'array', items: { type: 'string' }, description: '可选RCEP市场ISO3列表，默认数据库支持的全部RCEP15国家' },
          include_forecast: { type: 'boolean', description: '是否计算预测，默认true' }
        },
        required: ['confirmed_hs6']
      }
    }
  },
  execute: async (args) => {
    const hs6 = textArg(args, 'confirmed_hs6')
    if (!hs6 || !/^\d{6}$/.test(hs6)) return invalid('市场分析需要用户确认的6位HS编码。', 'HS_CONFIRMATION_REQUIRED', 'confirmed_hs6必须是6位数字', '请先调用resolve_product并让用户确认HS编码。')
    return wrap(await callPython('analyze_markets', { ...args, confirmed_hs6: hs6 }))
  }
}

export const toolRegistry: ToolDefinition[] = [analyzeInquiry, resolveProduct, analyzeMarkets]
export function toolSchemas(): ToolSchema[] { return toolRegistry.map((tool) => tool.schema) }

export async function executeTool(name: string, argsText: string): Promise<ToolResult> {
  const tool = toolRegistry.find((item) => item.schema.function.name === name)
  if (!tool) return invalid(`未注册的工具：${name}`, 'UNKNOWN_TOOL', name, '请使用已注册的询盘解析、商品解析和市场分析工具。')
  try {
    const parsed: unknown = argsText.trim() ? JSON.parse(argsText) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('工具参数必须是JSON对象')
    return await tool.execute(parsed as Record<string, unknown>)
  } catch (error) {
    return invalid('工具参数解析失败。', 'INVALID_TOOL_ARGUMENTS', error instanceof Error ? error.message : String(error), '请修正工具参数后重试。')
  }
}
