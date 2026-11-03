import type { InquiryData } from './data';

const value = (text: string | null, fallback = '待确认') => text || fallback;

export function InquirySummary({ inquiry, onFollowUp }: { inquiry: InquiryData; onFollowUp: () => void }) {
  const { extracted } = inquiry;
  const risk = inquiry.risk_flags[0];
  return <section className="wb-inquiry-summary" aria-label="询盘速览">
    <header className="wb-inquiry-head">
      <div><span className="eyebrow">INQUIRY SNAPSHOT</span><h2>询盘速览</h2></div>
      <div className="wb-completeness" aria-label={`询盘完整度 ${inquiry.completeness_score}%`}>
        <span><i style={{ width: `${inquiry.completeness_score}%` }} /></span>
        <strong>{inquiry.completeness_score}%</strong>
        <small>{inquiry.readiness_label}</small>
      </div>
    </header>
    <div className="wb-inquiry-content">
      <dl className="wb-inquiry-fields">
        <div><dt>商品</dt><dd>{value(extracted.product_name)}</dd></div>
        <div><dt>目标市场</dt><dd>{value(extracted.target_market)}{extracted.target_market_iso3 ? ` · ${extracted.target_market_iso3}` : ''}</dd></div>
        <div><dt>采购数量</dt><dd>{value(extracted.quantity)}</dd></div>
        <div><dt>关键规格</dt><dd>{extracted.specifications.length ? extracted.specifications.join(' · ') : '待确认'}</dd></div>
      </dl>
      <div className="wb-inquiry-gaps">
        <span>待确认 {inquiry.missing_fields.length} 项</span>
        <div>{inquiry.missing_fields.slice(0, 5).map((field) => <b key={field.key} className={field.importance === 'HIGH' ? 'high' : ''}>{field.label}</b>)}</div>
      </div>
      <div className={`wb-inquiry-risk wb-risk-${risk?.level.toLowerCase() || 'low'}`}>
        <span>{risk ? risk.title : '关键字段已覆盖'}</span>
        <p>{risk ? risk.detail : '可结合市场数据进入下一步评估，正式报价仍需人工复核。'}</p>
      </div>
      <button className="wb-subtle-button wb-inquiry-action" onClick={onFollowUp}>生成英文追问邮件 ↗</button>
    </div>
  </section>;
}
