# 贸询智答：跨境询盘分析与市场决策助手

贸询智答面向外贸业务人员，把一封客户询盘整理成可执行的下一步：

```text
询盘原文 → 提取商品与商务条件 → 检查信息缺口 → 确认 HS 编码
        → 核验目标市场 → 生成报价前追问和英文跟进邮件
```

项目保留市场分析作为询盘决策的证据模块：可以查看 RCEP 15 个市场的进口规模、增长、中国供应份额、关税和趋势预测。客户与交易数据不参与当前主流程。

## Windows 快速启动

在项目根目录打开 PowerShell。首次安装需要联网。

### 1. 准备数据库（二选一）

**方式 A：直接下载（推荐给评委）**

从项目 [Releases](https://github.com/zhiao678/trade-inquiry-assistant/releases) 下载 `trade-inquiry-database.zip`，把压缩包放到项目根目录后执行：

```powershell
Expand-Archive .\trade-inquiry-database.zip -DestinationPath .\data -Force
```

解压后应得到 `data/trade-inquiry.duckdb`。文件大小为 `327,954,432` 字节，SHA-256 为：

```text
1DAB0913C9D9A895831FDC4A72EE57CCA3D50AC421C0EA714968DA72E025A271
```

可在 PowerShell 中校验：

```powershell
Get-Item .\data\trade-inquiry.duckdb
Get-FileHash .\data\trade-inquiry.duckdb -Algorithm SHA256
```

**方式 B：使用 Git LFS**

安装 [Git for Windows](https://git-scm.com/download/win) 后，在项目根目录执行：

```powershell
git lfs install
git lfs pull
git lfs ls-files
```

确认 `data/trade-inquiry.duckdb` 已下载为实际数据库文件，而不是几十字节的 LFS 指针文件。两种方式得到的是同一个数据库，不需要重复操作。

### 2. 安装 Node.js

安装 Node.js LTS（建议 20 或更高版本），检查：

```powershell
node --version
npm --version
```

### 3. 安装 Python Worker

安装 Python 3.11 或更高版本，并创建虚拟环境：

```powershell
py --version
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\python\requirements.txt
```

### 4. 配置 API Key

复制环境变量模板并编辑：

```powershell
Copy-Item .env.example .env
notepad .env
```

例如使用 DeepSeek：

```dotenv
DEEPSEEK_API_KEY=sk-你的Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

也可以启动后点击右上角“模型连接”填写。Key 只保存在本机配置中，不要提交到 Git。

### 5. 安装并启动

```powershell
npm ci
npm run dev
```

窗口打开后，可直接粘贴询盘；也可以点击“分析示例询盘”开始演示。建议顺序是：先看询盘速览和信息缺口，再确认 HS 编码，最后查看目标市场和英文追问邮件。

## 评委演示重点

- `analyze_inquiry`：提取商品、国家、数量、规格、交付、贸易术语、付款和认证等字段，计算完整度并生成风险与追问清单；
- `resolve_product`：根据商品名称给出 HS 编码候选，名称检索结果必须由用户确认；
- `analyze_markets`：基于已确认 HS 编码分析目标市场；询盘指定国家时重点展示该国，没有指定时可比较 RCEP 15 国；
- 英文追问邮件：只根据询盘中真实存在的信息缺口生成，不补写客户没有提供的商务条件。

项目不判断客户信用或询盘真伪，不编造成交概率、最低报价、账期、物流承诺或竞品价格。市场综合分是本次候选市场内的相对排序，不是成交概率。

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| **没有 API Key**，提示“请先在右上角配置 LLM API Key” | 应用仍可打开，但不能调用智能助手。填写 `.env` 后重启 `npm run dev`，或在右上角“模型连接”中填写并保存。 |
| **数据库不存在**，提示 `业务数据库不存在` 或分析工具不可用 | 优先从 Releases 下载数据库 ZIP 并解压到 `data`；也可以重新执行 `git lfs install` 和 `git lfs pull`。确认最终路径是 `data/trade-inquiry.duckdb`，并核对上面的文件大小或 SHA-256。 |
| **证书错误**，如 `self-signed certificate`、`unable to verify` | 检查系统时间、代理和 `.env` 中的 `*_BASE_URL`，优先使用服务商官方 HTTPS 地址。企业代理拦截 HTTPS 时，应安装企业根证书或更换网络；不要使用 `NODE_TLS_REJECT_UNAUTHORIZED=0` 关闭证书校验。 |
| **Python Worker 启动失败** | 确认 `Test-Path .\.venv\Scripts\python.exe` 返回 `True`，并重新执行第 3 步的依赖安装，然后重启应用。 |

## 可选自检

不调用大模型，只检查 Python、数据库、商品解析和市场分析链路：

```powershell
npm run test:worker
npm run test:ui
```

类型检查和生产构建：

```powershell
npm run typecheck
npm run build
```
