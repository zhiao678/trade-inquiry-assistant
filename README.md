# 贸询智答：跨境询盘分析与市场决策助手

贸询智答面向中小外贸企业，把一封客户询盘转化为可执行的市场判断和跟进清单，帮助用户回答：

> 这封询盘说了什么？目标市场是否值得跟进？报价前还需要确认什么？

项目属于“金融经贸”方向，核心演示链路为：

```text
客户询盘
  -> 关键信息提取与完整度检查
  -> 信息缺口、风险提示与追问清单
  -> HS 编码候选与人工确认
  -> RCEP 市场机会分析
  -> 英文追问邮件与跟进动作
```

## 核心能力

- 将询盘原文整理为商品、市场、数量、规格、交付、贸易术语、付款和认证等结构化字段；
- 按字段权重计算询盘完整度，标记报价风险并生成逐项追问清单；
- 解析商品名称或 HS 编码，并要求用户确认名称检索得到的候选编码；
- 基于公开贸易、宏观和关税数据进行市场横向比较；
- 输出进口规模、增长、关税、中国供应份额和趋势预测等指标；
- 根据已确认的信息缺口生成专业英文追问邮件，不补写客户未提供的信息；
- 支持 DeepSeek 和 OpenAI Compatible Chat Completions Provider。

## 数据边界

- 市场、贸易、宏观和关税分析使用公开数据；
- 询盘结构化字段仅来自用户原文，系统不会自行补全缺失的商务事实；
- 市场综合分是本次候选市场内的相对排序，不是成交概率；
- 项目不判断客户信用或询盘真伪，也不编造价格、付款、物流或成交承诺。

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

项目默认读取 `data/maozhi-real.duckdb`。该数据库使用 Git LFS 管理；当前产品主流程使用其中的公开贸易、宏观、关税和商品编码数据。

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
npm run test:ui
npm run test:worker
```

界面回归测试会验证询盘完整度、信息缺口、准备状态、结果展示和新询盘状态重置；Worker 冒烟测试用于保护底层数据库与市场算法兼容性。

## 演示问题

```text
帮我分析这封询盘：We need 500 household coffee makers for Malaysia.
请提取关键信息、确认商品编码，并评估目标市场。
```

建议演示顺序：先展示询盘信息提取、完整度和追问清单，再确认 HS 编码并查看目标市场证据，最后生成英文追问邮件。

## 打包

```bash
npm run dist
```

`electron-builder` 会按当前平台生成安装包。正式比赛提交前，应在目标机器上实测未登录用户能否运行应用、访问仓库和观看演示视频。
