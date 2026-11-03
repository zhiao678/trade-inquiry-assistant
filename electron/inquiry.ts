export type InquiryFieldKey =
  | 'product_name'
  | 'target_market'
  | 'quantity'
  | 'specifications'
  | 'delivery_requirement'
  | 'trade_term'
  | 'payment_terms'
  | 'certifications'

export type InquiryAnalysisInput = {
  original_text: string
  product_name?: string
  target_market?: string
  target_market_iso3?: string
  quantity?: string
  specifications?: string[]
  buyer_company?: string
  delivery_requirement?: string
  trade_term?: string
  payment_terms?: string
  certifications?: string[]
  deadline?: string
}

export type InquiryMissingField = {
  key: InquiryFieldKey
  label: string
  importance: 'HIGH' | 'MEDIUM'
  question: string
}

export type InquiryRiskFlag = {
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  detail: string
}

export type InquiryAnalysis = {
  original_text: string
  extracted: {
    product_name: string | null
    target_market: string | null
    target_market_iso3: string | null
    quantity: string | null
    specifications: string[]
    buyer_company: string | null
    delivery_requirement: string | null
    trade_term: string | null
    payment_terms: string | null
    certifications: string[]
    deadline: string | null
  }
  completeness_score: number
  readiness: 'NEEDS_CLARIFICATION' | 'PRELIMINARY_REVIEW_READY'
  readiness_label: string
  known_field_count: number
  total_field_count: number
  missing_fields: InquiryMissingField[]
  risk_flags: InquiryRiskFlag[]
  follow_up_questions: string[]
}

const FIELD_RULES: Array<{
  key: InquiryFieldKey
  label: string
  weight: number
  importance: 'HIGH' | 'MEDIUM'
  question: string
}> = [
  { key: 'product_name', label: '商品', weight: 20, importance: 'HIGH', question: '请确认具体商品名称、主要用途和材质。' },
  { key: 'target_market', label: '目标市场', weight: 15, importance: 'HIGH', question: '货物最终销往哪个国家或地区？' },
  { key: 'quantity', label: '采购数量', weight: 15, importance: 'HIGH', question: '本次预计采购数量和计量单位是什么？' },
  { key: 'specifications', label: '规格参数', weight: 15, importance: 'HIGH', question: '请提供型号、尺寸、电压、插头或其他关键规格。' },
  { key: 'delivery_requirement', label: '交付要求', weight: 10, importance: 'MEDIUM', question: '期望交货时间、目的港或收货地点是什么？' },
  { key: 'trade_term', label: '贸易术语', weight: 10, importance: 'MEDIUM', question: '期望使用 EXW、FOB、CIF 还是其他贸易术语？' },
  { key: 'payment_terms', label: '付款条件', weight: 10, importance: 'MEDIUM', question: '期望的付款方式和付款节点是什么？' },
  { key: 'certifications', label: '认证要求', weight: 5, importance: 'MEDIUM', question: '目标市场是否要求特定认证、测试报告或标签？' },
]

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text || null
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.flatMap((item) => {
    const text = cleanText(item)
    return text ? [text] : []
  }))]
}

export function buildInquiryAnalysis(input: InquiryAnalysisInput): InquiryAnalysis {
  const originalText = cleanText(input.original_text)
  if (!originalText) throw new Error('询盘原文不能为空。')

  const extracted = {
    product_name: cleanText(input.product_name),
    target_market: cleanText(input.target_market),
    target_market_iso3: cleanText(input.target_market_iso3)?.toUpperCase() || null,
    quantity: cleanText(input.quantity),
    specifications: cleanList(input.specifications),
    buyer_company: cleanText(input.buyer_company),
    delivery_requirement: cleanText(input.delivery_requirement),
    trade_term: cleanText(input.trade_term)?.toUpperCase() || null,
    payment_terms: cleanText(input.payment_terms),
    certifications: cleanList(input.certifications),
    deadline: cleanText(input.deadline),
  }

  const present = (key: InquiryFieldKey) => {
    const value = extracted[key]
    return Array.isArray(value) ? value.length > 0 : Boolean(value)
  }
  const missingFields: InquiryMissingField[] = FIELD_RULES
    .filter((field) => !present(field.key))
    .map(({ key, label, importance, question }) => ({ key, label, importance, question }))
  const completenessScore = FIELD_RULES.reduce(
    (total, field) => total + (present(field.key) ? field.weight : 0),
    0,
  )
  const knownFieldCount = FIELD_RULES.length - missingFields.length
  const criticalMissing = missingFields.filter((field) => field.importance === 'HIGH')
  const riskFlags: InquiryRiskFlag[] = []

  if (!extracted.product_name || !extracted.target_market) {
    riskFlags.push({
      level: 'HIGH',
      title: '分析对象尚未锁定',
      detail: '商品或目标市场缺失，暂时不能进行可靠的编码与市场判断。',
    })
  }
  if (!extracted.quantity || extracted.specifications.length === 0) {
    riskFlags.push({
      level: 'MEDIUM',
      title: '报价基础不完整',
      detail: '采购数量或关键规格缺失，当前信息不足以形成正式报价。',
    })
  }
  if (!extracted.delivery_requirement || !extracted.trade_term) {
    riskFlags.push({
      level: 'MEDIUM',
      title: '交付边界不清晰',
      detail: '交付地点、时间或贸易术语未明确，成本与责任范围仍需确认。',
    })
  }
  if (!extracted.payment_terms) {
    riskFlags.push({
      level: 'LOW',
      title: '商务条件待确认',
      detail: '询盘尚未说明付款方式，可在产品与交付要求确认后继续沟通。',
    })
  }

  const needsClarification = criticalMissing.length > 0
  return {
    original_text: originalText,
    extracted,
    completeness_score: completenessScore,
    readiness: needsClarification ? 'NEEDS_CLARIFICATION' : 'PRELIMINARY_REVIEW_READY',
    readiness_label: needsClarification ? '需要补充关键信息' : '可进入初步评估',
    known_field_count: knownFieldCount,
    total_field_count: FIELD_RULES.length,
    missing_fields: missingFields,
    risk_flags: riskFlags,
    follow_up_questions: missingFields.map((field) => field.question),
  }
}
