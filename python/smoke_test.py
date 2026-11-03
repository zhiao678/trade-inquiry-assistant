"""商品解析与市场分析 Worker 的本地冒烟测试。"""

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATABASE = ROOT / "data" / "trade-inquiry.duckdb"
WORKER = ROOT / "python" / "analysis_worker.py"

def main() -> None:
    requests = [
        {"method": "resolve_product", "params": {"product_name": "家用咖啡机"}},
        {"method": "resolve_product", "params": {"product_name": "纯电动乘用车", "search_terms_en": "vehicles with only electric motor for propulsion"}},
        {"method": "resolve_product", "params": {"product_name": "870380"}},
        {"method": "resolve_product", "params": {"product_name": "000000"}},
        {"method": "analyze_markets", "params": {"confirmed_hs6": "851671"}},
        {"method": "analyze_markets", "params": {"confirmed_hs6": "870380"}},
        {"method": "analyze_markets", "params": {"confirmed_hs6": "010619"}},
        {"method": "analyze_markets", "params": {"confirmed_hs6": "851671", "markets": ["AUS", "JPN"]}},
        {"method": "analyze_markets", "params": {"confirmed_hs6": "851671", "markets": ["USA"]}},
    ]
    environment = dict(os.environ)
    environment["TRADE_INQUIRY_DATABASE"] = str(DATABASE)
    environment["PYTHONIOENCODING"] = "utf-8"
    environment["PYTHONUTF8"] = "1"
    completed = subprocess.run([sys.executable, str(WORKER)], input="\n".join(json.dumps(item, ensure_ascii=False) for item in requests) + "\n", capture_output=True, text=True, encoding="utf-8", env=environment, check=True, timeout=90)
    results = [json.loads(line) for line in completed.stdout.splitlines() if line.strip()]
    if len(results) != len(requests): raise SystemExit(f"Worker返回数量错误：{len(results)}")
    coffee, electric, exact_hs, invalid_hs, markets, electric_markets, partial_markets, selected_markets, unsupported = results
    assert coffee["ok"] and coffee["data"]["candidates"][0]["hs6"] == "851671"
    assert electric["ok"] and electric["data"]["candidates"][0]["hs6"] == "870380"
    assert exact_hs["ok"] and exact_hs["data"]["needs_confirmation"] is False
    assert invalid_hs["ok"] and invalid_hs["data"]["candidates"] == []
    assert markets["ok"] and len(markets["data"]["markets"]) == 15
    assert markets["data"]["scope"]["analysis_year"] == 2023
    assert electric_markets["ok"] and electric_markets["dataQuality"]["status"] == "PARTIAL"
    assert partial_markets["ok"] and partial_markets["data"]["scope"]["missing_markets"]
    assert selected_markets["ok"] and {item["market"] for item in selected_markets["data"]["markets"]} == {"AUS", "JPN"}
    assert not unsupported["ok"] and unsupported["error"]["code"] == "UNSUPPORTED_MARKET"
    print("PASS resolve_product: text candidate, exact HS, invalid HS")
    print("PASS analyze_markets: RCEP15, selected markets, scope and fallback guards")

if __name__ == "__main__": main()
