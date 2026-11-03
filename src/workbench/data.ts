export type WorkMessage = { id: string; kind: string; name?: string; status?: string; result?: string; role?: string; content?: string };
export type Dimension = { raw: number | null; score: number; weight: number };
export type Market = {
  market: string; name_cn: string; rank: number; total_score: number; recommendation: string;
  annual_import: number; annual_period?: string; yoy: number | null; china_share: number; tariff_rate: number | null;
  dimensions: Record<string, Dimension>; history?: { period: string; value: number }[];
  forecast: { values: number[]; periods?: string[]; intervals?: { low: number; high: number }[]; confidence_level?: number; mape: number; enters_market_score: boolean };
};
// Retained for the dormant customer chart module; customer analysis is no
// longer exposed by the inquiry assistant's tool registry or main UI.
export type Customer = { customer_id: string; country_code: string; cluster_label?: string; new_customer: boolean; value_score: number | null; churn_score: number | null; value_grade: string; M: number };
export type InquiryMissingField = { key: string; label: string; importance: 'HIGH' | 'MEDIUM'; question: string };
export type InquiryRiskFlag = { level: 'HIGH' | 'MEDIUM' | 'LOW'; title: string; detail: string };
export type InquiryData = {
  original_text: string;
  extracted: {
    product_name: string | null; target_market: string | null; target_market_iso3: string | null;
    quantity: string | null; specifications: string[]; buyer_company: string | null;
    delivery_requirement: string | null; trade_term: string | null; payment_terms: string | null;
    certifications: string[]; deadline: string | null;
  };
  completeness_score: number;
  readiness: 'NEEDS_CLARIFICATION' | 'PRELIMINARY_REVIEW_READY';
  readiness_label: string;
  known_field_count: number;
  total_field_count: number;
  missing_fields: InquiryMissingField[];
  risk_flags: InquiryRiskFlag[];
  follow_up_questions: string[];
};
export const dimensionNames: Record<string, string> = { market_size: '市场规模', growth: '增长潜力', competition: '供应竞争环境', china_supply: '中国供应基础', tariff: '关税条件', macro: '宏观环境' };
export const colors = ['#3979ad', '#78abc4', '#a3c9ce', '#c5d4e4', '#d6b57d', '#94a0b2', '#dde4ec'];
export const money = (v: number) => !Number.isFinite(v) ? '—' : v >= 1e8 ? `$${(v / 1e8).toFixed(2)} 亿` : v >= 1e4 ? `$${(v / 1e4).toFixed(1)} 万` : `$${v.toFixed(0)}`;
export const percent = (v: number | null) => v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`;
export const yoyText = (v: number | null) => v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '↑ 增长' : '↓ 下降'} ${Math.abs(v * 100).toFixed(1)}%`;
export const yoyClass = (v: number | null) => v == null || !Number.isFinite(v) ? '' : v >= 0 ? 'up' : 'down';
export const score = (v: number) => Number.isFinite(v) ? v.toFixed(1) : '—';

// Resolve results in invocation order. A new product/market analysis starts a new
// snapshot; failed refreshes cannot silently resurrect unrelated older results.
export function readAnalysis(messages: WorkMessage[]) {
  let inquiry: InquiryData | undefined;
  let markets: { hs6: string; markets: Market[] } | undefined;
  let inquiryKey = '';
  let marketKey = '';
  let busy = false;
  let inquiryFailed = false;
  let marketFailed = false;
  for (const message of messages) {
    if (message.kind !== 'tool') continue;
    if (message.name === 'analyze_inquiry') {
      inquiry = undefined; markets = undefined; inquiryFailed = false; marketFailed = false; inquiryKey = ''; marketKey = '';
    }
    if (message.name === 'resolve_product' || message.name === 'analyze_markets') {
      markets = undefined; marketFailed = false; marketKey = '';
    }
    if (message.status === 'running') { busy = true; continue; }
    if (!message.result) continue;
    try {
      const result = JSON.parse(message.result);
      if (!result.ok || !result.data) {
        if (message.name === 'analyze_inquiry') inquiryFailed = true;
        if (message.name === 'analyze_markets') marketFailed = true;
        continue;
      }
      if (message.name === 'analyze_inquiry' && Array.isArray(result.data.missing_fields)) {
        inquiry = result.data; inquiryKey = message.id;
      }
      if (message.name === 'analyze_markets' && Array.isArray(result.data.markets)) {
        markets = result.data; marketKey = message.id;
      }
    } catch {
      if (message.name === 'analyze_inquiry') inquiryFailed = true;
      if (message.name === 'analyze_markets') marketFailed = true;
    }
  }
  return { inquiry, markets, inquiryKey, marketKey, busy, inquiryFailed, marketFailed };
}
