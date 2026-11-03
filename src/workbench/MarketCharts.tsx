import { Market, money, percent, score, yoyClass, yoyText } from './data';

export function Empty({ children }: { children: React.ReactNode }) { return <div className="wb-empty">{children}</div>; }

export function Ranking({ markets, selected, onSelect }: { markets: Market[]; selected: string; onSelect: (id: string) => void }) {
  return <div className="wb-ranking">{markets.map(m => <button key={m.market} className={selected === m.market ? 'selected' : ''} onClick={() => onSelect(m.market)}><span className="wb-rank-number">{m.rank.toString().padStart(2, '0')}</span><span className="wb-rank-country">{m.name_cn}</span><span className="wb-track"><i style={{ width: `${m.total_score}%` }} /></span><strong>{score(m.total_score)}</strong></button>)}</div>;
}

export function CompareMarkets({ markets, selected, onSelect }: { markets: Market[]; selected: string; onSelect: (id: string) => void }) {
  return <div className="wb-compare"><table><thead><tr><th>市场</th><th>年进口额</th><th>进口同比</th><th>中国供应份额</th><th>适用关税</th><th>GDP 增速</th><th>供应集中度</th><th>综合分</th></tr></thead><tbody>{markets.map(m => <tr key={m.market} className={m.market === selected ? 'current' : ''} onClick={() => onSelect(m.market)}><td><span className={`wb-compare-rank medal-${m.rank <= 3 ? m.rank : 'other'}`}>{m.rank}</span>{m.name_cn}</td><td>{money(m.annual_import)}</td><td className={`wb-yoy ${yoyClass(m.yoy)}`}>{yoyText(m.yoy)}</td><td>{percent(m.china_share)}</td><td>{m.tariff_rate == null ? '—' : `${m.tariff_rate.toFixed(1)}%`}</td><td>{m.dimensions.macro?.raw == null ? '—' : `${m.dimensions.macro.raw.toFixed(1)}%`}</td><td>{m.dimensions.competition?.raw == null ? '—' : m.dimensions.competition.raw.toFixed(2)}</td><td><strong>{score(m.total_score)}</strong></td></tr>)}</tbody></table><p className="wb-note">表中为各项实际测得值（供应集中度为 HHI，越低供应越分散）；综合分由六项候选内相对分加权：市场规模 20% · 增长潜力 20% · 供应竞争 15% · 中国供应 15% · 关税条件 15% · 宏观环境 15%。点击行切换市场。</p></div>;
}

export function Trend({ market }: { market: Market }) {
  const history = market.history || [];
  const forecast = market.forecast;
  if (!history.length || !forecast.periods?.length) return <Empty>这份历史结果缺少日期序列，请让助手重新分析市场以查看趋势。</Empty>;
  const historical = history.slice(-24);
  const values = [...historical.map(p => p.value), ...forecast.values];
  const max = Math.max(...values, ...(forecast.intervals || []).map(p => p.high)) * 1.08;
  const min = Math.min(0, ...(forecast.intervals || []).map(p => p.low));
  const x = (i: number) => 57 + i / (values.length - 1) * 490;
  const y = (v: number) => 191 - (v - min) / (max - min || 1) * 161;
  const line = (vs: number[], offset = 0) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i + offset)},${y(v)}`).join(' ');
  const boundary = historical.length - 1;
  const intervals = forecast.intervals?.length === forecast.values.length ? forecast.intervals : undefined;
  const area = intervals ? intervals.map((p, i) => `${x(i + historical.length)},${y(p.high)}`).concat([...intervals].reverse().map((p, i) => `${x(values.length - 1 - i)},${y(p.low)}`)).join(' ') : '';
  return <><svg className="wb-chart" viewBox="0 0 570 235" role="img" aria-label={`${market.name_cn}进口历史与未来12个月预测`}>{[0, 1, 2, 3].map(i => <g key={i}><line x1="57" x2="547" y1={y(min + (max-min)*i/3)} y2={y(min + (max-min)*i/3)} className="wb-gridline"/><text x="49" y={y(min+(max-min)*i/3)+4} textAnchor="end">{((min+(max-min)*i/3)/1e6).toFixed(0)}</text></g>)}<text x="57" y="15">百万美元 / 月</text><rect x={x(boundary)} y="28" width={547-x(boundary)} height="163" fill="#eaf2f8" opacity=".6"/><polygon points={area} fill="#77accd" opacity=".22"/><line x1={x(boundary)} x2={x(boundary)} y1="28" y2="191" stroke="#9bb3c7" strokeDasharray="3 4"/><path d={line(historical.map(p => p.value))} fill="none" stroke="#3979ad" strokeWidth="2.5"/><path d={line([historical[boundary].value, ...forecast.values], boundary)} fill="none" stroke="#3979ad" strokeWidth="2.5" strokeDasharray="5 4"/>{values.map((v,i) => <circle key={i} cx={x(i)} cy={y(v)} r="5" fill="transparent"><title>{`${i < historical.length ? historical[i].period : forecast.periods![i-historical.length]} · ${money(v)}${i >= historical.length ? '（预测）' : ''}`}</title></circle>)}<text x="57" y="214">{historical[0].period}</text><text x={x(boundary)} y="214" textAnchor="middle">{historical[boundary].period}</text><text x="547" y="214" textAnchor="end">{forecast.periods[forecast.periods.length - 1]}</text></svg><div className="wb-chart-caption"><span>━ 历史　┄ 预测{intervals ? `　浅色带：${Math.round((forecast.confidence_level || .8)*100)}% 区间` : ''}</span><span>回测 MAPE {forecast.mape.toFixed(1)}%</span></div>{!forecast.enters_market_score && <p className="wb-note">预测误差较高，仅作趋势参考；市场增长评分采用历史增长率。</p>}</>;
}
