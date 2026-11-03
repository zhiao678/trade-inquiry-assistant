// Render regression coverage without starting Electron or requiring a browser.
// Run: node scripts/check-workbench.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');

// The production component runs in Electron's browser renderer. For this
// server-rendered regression test, useEffect is the correct equivalent.
React.useLayoutEffect = React.useEffect;

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}
require.extensions['.css'] = () => {};
const { Workbench } = require(path.join(__dirname, '../src/workbench/Workbench.tsx'));
const { readAnalysis } = require(path.join(__dirname, '../src/workbench/data.ts'));
const { buildInquiryAnalysis } = require(path.join(__dirname, '../electron/inquiry.ts'));
let seen = false;
global.localStorage = { getItem: () => seen ? '1' : null };
const render = messages => renderToString(React.createElement(Workbench, { messages, onPrompt() {} }));
const result = (name, data) => ({ id: name, kind: 'tool', name, status: 'done', result: JSON.stringify({ ok: true, data }) });
const market = { market: 'PHL', name_cn: '菲律宾', rank: 1, total_score: 70, dimensions: {}, forecast: { values: [] } };
const inquiry = buildInquiryAnalysis({
  original_text: 'We need 500 household coffee makers for Malaysia.',
  product_name: 'household coffee makers',
  target_market: 'Malaysia',
  target_market_iso3: 'MYS',
  quantity: '500 units',
});

assert.match(render([]), /进入工作台/);
seen = true;
assert.match(render([]), /这封询盘，值得跟进吗/);
assert.match(render([{ id: 'pending', kind: 'tool', name: 'analyze_inquiry', status: 'running' }]), /正在核验询盘市场机会/);
assert.match(render([{ id: 'failed', kind: 'tool', name: 'analyze_inquiry', status: 'failed', result: '{"ok":false}' }]), /本次询盘解析未完成/);
assert.match(render([result('analyze_inquiry', inquiry)]), /询盘速览/);
assert.match(render([result('analyze_inquiry', inquiry)]), /household coffee makers/);
assert.equal(inquiry.completeness_score, 50);
assert.equal(inquiry.readiness, 'NEEDS_CLARIFICATION');
assert.equal(inquiry.missing_fields.length, 5);
assert.match(render([{ id: 'failed', kind: 'tool', name: 'analyze_markets', status: 'failed', result: '{"ok":false}' }]), /本次市场分析未完成/);
assert.match(render([result('analyze_markets', { hs6: '851671', markets: [market] })]), /菲律宾/);
assert.equal(readAnalysis([result('analyze_markets', { hs6: '851671', markets: [market] }), result('resolve_product', { candidates: [] })]).markets, undefined);
assert.equal(readAnalysis([result('analyze_markets', { hs6: '851671', markets: [market] }), result('analyze_inquiry', inquiry)]).markets, undefined);
console.log('PASS inquiry analysis: completeness, missing fields, readiness');
console.log('PASS workbench render: first launch, inquiry loading/failure/result, market result, analysis reset');
