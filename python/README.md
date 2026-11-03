# Python 市场分析 Worker

`analysis_worker.py` 是 Electron 调用的确定性分析层，只负责查询 DuckDB、执行市场算法并输出结构化 JSON。

默认数据库是 `data/trade-inquiry.duckdb`，也可通过 `TRADE_INQUIRY_DATABASE` 指定其他路径。

可用方法：`resolve_product`、`analyze_markets`。

```json
{"method":"analyze_markets","params":{"confirmed_hs6":"851671"}}
```

## 数据与算法

- 商品编码、贸易、宏观、关税和国家维表来自公开数据；
- 市场横向评分使用共同完整年度；
- 关税采用 China-specific Applied Tariff，不解释为 RCEP 优惠税率；
- 市场分数是候选范围内相对分数，不是成交概率；
- 月度序列不少于 60 点时使用 ARIMA(1,1,0)，并输出 MAE、RMSE 和 MAPE；不足时降级为历史 CAGR。

## 测试

```powershell
.\.venv\Scripts\python.exe .\python\smoke_test.py
```
