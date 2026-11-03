# 贸询智答：跨境询盘分析与市场决策助手

贸询智答面向中小外贸企业，把一封客户询盘转化为可执行的市场判断和跟进清单，帮助用户回答：

> 这封询盘说了什么？目标市场是否值得跟进？报价前还需要确认什么？

项目属于“金融经贸”方向，核心演示链路为：

```text
客户询盘
  -> 商品与目标市场识别
  -> HS 编码候选与人工确认
  -> RCEP 市场机会分析
  -> 客户分群与经营重点
  -> 信息缺口、风险提示和跟进动作
```

## 核心能力

- 商品名称或 HS 编码解析，并要求用户确认名称检索得到的候选编码；
- 基于公开贸易、宏观和关税数据进行市场横向比较；
- 输出进口规模、增长、关税、中国供应份额和趋势预测等指标；
- 使用 K-means 对演示客户进行分群，并提供 S/A/B/C 价值分级和流失风险规则评分；
- 将市场、客户与运营建议联动，生成按触达紧急度排序的行动清单；
- 支持 DeepSeek 和 OpenAI Compatible Chat Completions Provider。

## 数据边界

- 市场、贸易、宏观和关税分析使用公开数据；
- 客户与交易表是比赛演示模拟数据，不代表真实企业客户；
- 流失分是规则评分，不是流失概率；
- 市场综合分是本次候选市场内的相对排序，不是成交概率；
- 项目不编造价格、折扣、账期、付款、物流或成交承诺。

## 本地开发

```bash
npm install
npm run dev
```

Python 分析 Worker 读取本地 DuckDB。Windows 初始化：

```powershell
py -m venv .venv
.\.venv\Scripts\pip.exe install -r .\python\requirements.txt
```

macOS/Linux：

```bash
python3 -m venv .venv
.venv/bin/pip install -r python/requirements.txt
```

项目默认读取 `data/maozhi-real.duckdb`。该数据库使用 Git LFS 管理，贸易、宏观和关税数据为公开数据，客户和交易数据为比赛模拟数据。

首次使用前，在项目根目录复制 `.env.example` 为 `.env` 并配置 LLM：

```dotenv
DEEPSEEK_API_KEY=sk-你的Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

也可以在应用设置中填写 OpenAI Compatible Provider。不要把真实 API Key 提交到仓库。

## 验证命令

```bash
npm run typecheck
npm run build
npm run test:worker
```

Worker 冒烟测试会验证商品解析、RCEP 市场分析、240 家演示客户的 K-means 分群、前置条件保护和策略生成链路。

## 演示问题

```text
帮我分析这封询盘：We need 500 household coffee makers for Malaysia.
请提取关键信息、确认商品编码，并评估目标市场。
```

建议演示顺序：先展示询盘信息提取和 HS 候选，再确认编码并查看市场排名，最后进入客户画像和跟进动作。

## 打包

```bash
npm run dist
```

`electron-builder` 会按当前平台生成安装包。正式比赛提交前，应在目标机器上实测未登录用户能否运行应用、访问仓库和观看演示视频。
