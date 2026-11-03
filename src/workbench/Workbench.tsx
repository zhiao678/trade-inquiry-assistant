import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WorkMessage, dimensionNames, money, percent, readAnalysis, score, yoyClass, yoyText } from './data';
import { CompareMarkets, Empty, Ranking, Trend } from './MarketCharts';
import { InquirySummary } from './InquirySummary';
import { WorldMap } from './WorldMap';
import './workbench.css';

export function Workbench({ messages, onPrompt }: { messages: WorkMessage[]; onPrompt: (text: string) => void }) {
  const analysis = useMemo(()=>readAnalysis(messages),[messages]);
  const [page,setPage] = useState<'welcome'|'map'|'dashboard'>(()=>localStorage.getItem('trade-inquiry-workbench-seen')?'map':'welcome');
  const [selected,setSelected] = useState('');
  const [focused,setFocused] = useState(false);
  const [cardOpen,setCardOpen] = useState(false);
  // Screen-space anchor of the clicked pin (right edge, middle, left edge),
  // measured from the canvas so the card can stick beside it.
  const [anchor,setAnchor] = useState<{x:number;y:number;left:number}|null>(null);
  const [cardPos,setCardPos] = useState<{left:number;top:number}|null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const marketStripRef = useRef<HTMLDivElement>(null);
  const markets = analysis.markets?.markets || [];
  const market = markets.find(m=>m.market===selected) || markets[0];
  const enter = () => { localStorage.setItem('trade-inquiry-workbench-seen','1'); setPage('map'); };
  useEffect(()=>{
    if(!analysis.inquiryKey)return;
    localStorage.setItem('trade-inquiry-workbench-seen','1');
    setPage('map');
  },[analysis.inquiryKey]);
  useEffect(()=>{
    setCardOpen(false);
    setSelected(analysis.markets?.markets[0]?.market || '');
    setFocused(false);
    if(!analysis.markets?.markets.length)return;
    localStorage.setItem('trade-inquiry-workbench-seen','1');
    setPage(p=>p==='welcome'?'map':p);
    const timer=window.setTimeout(()=>setFocused(true),650);
    return ()=>window.clearTimeout(timer);
  },[analysis.marketKey]);
  const choose = (id:string) => {
    setSelected(id);
    const canvas = canvasRef.current;
    const pin = canvas?.querySelector(`[data-market="${id}"] .wb-pin-bg`);
    if (canvas && pin) {
      const c = canvas.getBoundingClientRect(), p = pin.getBoundingClientRect();
      setAnchor({ x: p.right - c.left, y: p.top + p.height / 2 - c.top, left: p.left - c.left });
    } else { setAnchor(null); setCardPos(null); }
    setCardOpen(true);
  };
  const dimensions = market ? Object.entries(market.dimensions).sort((a,b)=>b[1].score-a[1].score) : [];
  // Place the card beside the clicked pin, clamped inside the canvas. Runs
  // before paint so the card never flashes at its fallback corner.
  useLayoutEffect(() => {
    if (!cardOpen || !cardRef.current || !canvasRef.current) return;
    const c = canvasRef.current.getBoundingClientRect(), card = cardRef.current.getBoundingClientRect();
    if (!anchor) { setCardPos(null); return; }
    const gap = 14, margin = 12;
    let left = anchor.x + gap;
    if (left + card.width > c.width - margin) left = anchor.left - gap - card.width;
    left = Math.max(margin, Math.min(left, Math.max(margin, c.width - card.width - margin)));
    const top = Math.max(margin, Math.min(anchor.y - card.height / 2, Math.max(margin, c.height - card.height - margin)));
    setCardPos({ left, top });
  }, [cardOpen, anchor, selected]);
  // Any pointer-down outside the card dismisses it; clicking another pin
  // dismisses first and then re-opens through choose().
  useEffect(() => {
    if (!cardOpen) return;
    const onDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setCardOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCardOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [cardOpen]);
  useEffect(() => { if (page !== 'map') setCardOpen(false); }, [page]);
  const askFollowUp = () => onPrompt('请根据当前询盘的已知信息和全部缺口，生成一封简洁、专业的英文追问邮件。不得补写客户未提供的信息。');
  const scrollMarketStrip = (direction: -1 | 1) => marketStripRef.current?.scrollBy({ left: direction * 360, behavior: 'smooth' });
  return <section className={`map-stage wb-stage wb-page-${page}`} aria-label="跨境询盘决策工作台">
    <header className="wb-header"><div className="brand-lockup"><div className="brand-mark">询</div><div><div className="brand-name">贸询智答</div><div className="brand-subtitle">CROSS-BORDER INQUIRY INTELLIGENCE</div></div></div><span className="wb-demo">公开市场数据</span></header>
    {page==='welcome'?<div className="wb-welcome"><div className="map-placeholder"><div className="map-grid"/><div className="map-ring ring-one"/><div className="map-ring ring-two"/><div className="map-ring ring-three"/><div className="map-copy"><span className="eyebrow">INQUIRY TO MARKET</span><h1>跨境询盘决策工作台</h1><button className="wb-enter" onClick={enter}>进入工作台 <span>↓</span></button></div><span className="map-point point-one"/><span className="map-point point-two"/><span className="map-point point-three"/></div><p className="wb-welcome-hint">从一封询盘开始，判断去哪卖、先问什么、怎么跟进。</p></div>:page==='map'?<div className="wb-map-page" key="map">
      <div className="wb-page-heading"><div><span className="eyebrow">FROM INQUIRY TO OPPORTUNITY</span><h1>从询盘找到下一站市场</h1><p>{analysis.markets?`HS ${analysis.markets.hs6} · 本次分析 ${markets.length} 个市场`:analysis.inquiry?`${analysis.inquiry.extracted.product_name || '商品待确认'} · ${analysis.inquiry.extracted.target_market || '市场待确认'}`:'粘贴客户询盘，识别商品并验证目标市场机会。'}</p></div>{markets.length>0&&<button className="wb-subtle-button" onClick={()=>{setCardOpen(false);setFocused(v=>!v);}}>{focused?'◎ 查看全球':'⌖ 聚焦市场'}</button>}</div>
      {analysis.inquiry&&<InquirySummary inquiry={analysis.inquiry} onFollowUp={askFollowUp}/>}
      <div className={`wb-map-canvas ${cardOpen?'has-card':''}`} ref={canvasRef}><WorldMap markets={markets} selected={market?.market || ''} focused={focused} onSelect={choose}/>
      {!markets.length&&<div className="wb-map-empty"><span className="wb-orbit-icon">◎</span><h2>{analysis.busy?'正在核验询盘市场机会':analysis.inquiryFailed?'本次询盘解析未完成':analysis.marketFailed?'本次市场分析未完成':analysis.inquiry?'询盘已梳理，等待确认商品编码':'这封询盘，值得跟进吗？'}</h2><p>{analysis.busy?'结果就绪后，目标市场及相关机会将在地图上点亮。':analysis.inquiryFailed||analysis.marketFailed?'请在右侧查看原因并重试。':analysis.inquiry?'在右侧确认 HS 编码后，助手将继续核验目标市场。':'在右侧粘贴客户询盘，助手会提取商品、目标国家和待确认信息。'}</p>{!analysis.inquiry&&<button className="wb-subtle-button" onClick={()=>onPrompt('帮我分析这封询盘：We need 500 household coffee makers for Malaysia. 请提取关键信息、确认商品编码，并评估目标市场。')}>试试示例询盘 ↗</button>}</div>}
      {market&&cardOpen&&<article className="wb-market-card" ref={cardRef} style={cardPos?{left:cardPos.left,top:cardPos.top,right:'auto'}:undefined} aria-label={`${market.name_cn}市场详情`}><button className="wb-card-close" aria-label="关闭市场详情" onClick={()=>setCardOpen(false)}>×</button><span className="eyebrow">MARKET INSIGHT · #{market.rank}</span><h2>{market.name_cn}<span>{market.market}</span></h2><div className="wb-score-line"><strong>{score(market.total_score)}<small> / 100</small></strong><span className={`wb-recommendation ${market.recommendation.toLowerCase()}`}>{market.recommendation==='PRIORITY'?'优先关注':market.recommendation==='WATCH'?'持续观察':'谨慎评估'}</span></div><div className="wb-metrics"><span>年进口额{market.annual_period?`（${market.annual_period}）`:''}<b>{money(market.annual_import)}</b></span><span>进口同比<b className={yoyClass(market.yoy)}>{yoyText(market.yoy)}</b></span><span>中国供应份额<b>{percent(market.china_share)}</b></span><span>适用关税<b>{market.tariff_rate==null?'—':`${market.tariff_rate.toFixed(1)}%`}</b></span></div><div className="wb-ai-block"><span className="wb-ai-tag">✦ 数据解读</span><ul className="wb-reasons">{dimensions.filter(([,d])=>d.score>=50).slice(0,3).map(([key,d])=><li key={key}>{dimensionNames[key]}在本次候选中较有优势 <b>{score(d.score)} 分</b></li>)}{!dimensions.some(([,d])=>d.score>=50)&&<li>暂未形成突出的相对优势，建议谨慎评估。</li>}</ul>{dimensions.length>0&&<p className="wb-caution">关注点：{dimensionNames[dimensions[dimensions.length-1][0]]}相对较弱，需结合询盘细节核验。</p>}</div><button className="wb-primary-button" onClick={()=>setPage('dashboard')}>查看完整市场证据 <span>↓</span></button><p className="wb-note">本次候选内相对评分，不代表成交概率。</p></article>}
      <button className="wb-floating-nav wb-floating-nav-down" aria-label="打开分析看板" title="分析看板" onClick={()=>setPage('dashboard')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
      </div>
      <div className="wb-map-bottom">{markets.length>0?<><div className="wb-market-strip-meta"><span>RCEP 市场排名</span><strong>{markets.length}</strong></div><button className="wb-market-strip-control" aria-label="查看前一组市场" title="查看前一组市场" onClick={()=>scrollMarketStrip(-1)}>‹</button><div className="wb-market-chips" ref={marketStripRef}>{markets.map(m=><button key={m.market} className={market?.market===m.market?'active':''} onClick={()=>choose(m.market)}><span className={m.rank<=3?`medal medal-${m.rank}`:''}>{m.rank}</span><b>{m.name_cn}</b><small>{m.market}</small></button>)}</div><button className="wb-market-strip-control" aria-label="查看后一组市场" title="查看后一组市场" onClick={()=>scrollMarketStrip(1)}>›</button></>:<p>地图中的机会标记将随分析结果出现</p>}</div>
    </div>:<div className="wb-dashboard-frame" key="dashboard"><button className="wb-floating-nav wb-floating-nav-up" aria-label="返回地图" title="返回地图" onClick={()=>setPage('map')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg></button><div className="wb-dashboard"><div className="wb-dashboard-toolbar"><span>02 / MARKET EVIDENCE</span></div><div className="wb-page-heading"><div><span className="eyebrow">FROM EVIDENCE TO FOLLOW-UP</span><h1>让每一次跟进，都有依据</h1><p>{analysis.markets?`HS ${analysis.markets.hs6} · ${market?.annual_period || '最近完整年度'}贸易数据`:'完成市场分析后，在这里核对市场证据。'}</p></div>{markets.length>0&&<label className="wb-market-select">当前市场<select aria-label="当前市场" value={market?.market} onChange={e=>setSelected(e.target.value)}>{markets.map(m=><option key={m.market} value={m.market}>{m.name_cn}</option>)}</select></label>}</div>
      {!market?<Empty>{analysis.busy?'正在分析，请稍候…':'还没有市场结果。从右侧开始一次市场分析，图表会在这里逐步出现。'}</Empty>:<>
      <div className="wb-kpis"><div><span>当前市场</span><strong>{market.name_cn}</strong><small>本次排名 #{market.rank}</small></div><div><span>商品年进口额</span><strong>{money(market.annual_import)}</strong><small className={`wb-yoy ${yoyClass(market.yoy)}`}>{yoyText(market.yoy)}</small></div><div><span>市场综合分</span><strong>{score(market.total_score)}<em>/100</em></strong><small>候选市场内相对评分</small></div></div>
      <div className="wb-dashboard-grid"><article className="wb-chart-card"><header><h2>市场优先级</h2><span>本次候选</span></header><Ranking markets={markets} selected={market.market} onSelect={setSelected}/></article><article className="wb-chart-card"><header><h2>进口需求走势</h2><span>{market.name_cn} · 未来 12 个月</span></header><Trend market={market}/></article><article className="wb-chart-card wb-full"><header><h2>候选市场数据横评</h2><span>本次 {markets.length} 个候选 · 实测值对比</span></header><CompareMarkets markets={markets} selected={market.market} onSelect={setSelected}/></article></div>
      {analysis.inquiry&&<section className="wb-followup-panel"><header><div><span className="eyebrow">BEFORE QUOTATION</span><h2>报价前确认清单</h2></div><button className="wb-subtle-button" onClick={askFollowUp}>生成英文追问邮件 ↗</button></header>{analysis.inquiry.follow_up_questions.length?<ol>{analysis.inquiry.follow_up_questions.map((question,index)=><li key={question}><span>{String(index+1).padStart(2,'0')}</span>{question}</li>)}</ol>:<p>核心询盘字段已覆盖，可结合企业成本、产能与合规要求进行人工复核。</p>}</section>}
      </>}
      <p className="wb-dashboard-footer">询盘字段来自用户输入 · 市场数据来自公开数据</p>
    </div></div>}
    {page!=='dashboard'&&<footer className="wb-footer"><span><i/> 询盘字段来自用户输入 · 市场数据来自公开数据</span><span>{page==='welcome'?'WELCOME':'01 / EXPLORE'}</span></footer>}
  </section>;
}
