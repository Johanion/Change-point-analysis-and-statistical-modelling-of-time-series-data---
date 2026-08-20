from __future__ import annotations

import csv
import math
from datetime import datetime
from pathlib import Path
from statistics import mean, stdev

from flask import Flask, jsonify, request
from flask_cors import CORS


ROOT = Path(__file__).resolve().parents[1]
PRICE_PATH = ROOT / "data" / "BrentOilPrices.csv"
EVENT_PATH = ROOT / "data" / "oil_market_events.csv"
CANDIDATE_PATH = ROOT / "reports" / "change_point_candidates.csv"
TASK2_REPORT_PATH = ROOT / "reports" / "task2_change_point_insights.md"


def parse_price_date(value: str) -> datetime:
    value = value.strip()
    for fmt in ("%d-%b-%y", "%b %d, %Y"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unsupported date format: {value}")


def percent_change(before: float, after: float) -> float:
    if before == 0:
        return 0.0
    return ((after / before) - 1.0) * 100.0


def load_prices() -> list[dict]:
    rows = []
    with PRICE_PATH.open(newline="", encoding="utf8") as handle:
        for row in csv.DictReader(handle):
            price = float(row["Price"])
            date = parse_price_date(row["Date"])
            rows.append({"date": date, "price": price, "log_price": math.log(price)})

    rows.sort(key=lambda item: item["date"])
    for index, row in enumerate(rows):
        row["log_return"] = None if index == 0 else row["log_price"] - rows[index - 1]["log_price"]
    return rows


def load_events() -> list[dict]:
    with EVENT_PATH.open(newline="", encoding="utf8") as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        row["event_date_obj"] = datetime.strptime(row["event_date"], "%Y-%m-%d")
    rows.sort(key=lambda item: item["event_date_obj"])
    return rows


def load_change_points() -> list[dict]:
    if not CANDIDATE_PATH.exists():
        return []
    with CANDIDATE_PATH.open(newline="", encoding="utf8") as handle:
        rows = list(csv.DictReader(handle))
    return [
        {
            "rank": int(row["rank"]),
            "change_date": row["change_date"],
            "associated_event": row["associated_event"],
            "event_date": row["event_date"],
            "event_type": row["event_type"],
            "days_from_event": int(row["days_from_event"]),
            "mean_price_30d_before": float(row["mean_price_30d_before"]),
            "mean_price_30d_after": float(row["mean_price_30d_after"]),
            "price_change_pct": float(row["price_change_pct"]),
            "return_vol_30d_before_pct": float(row["return_vol_30d_before_pct"]),
            "return_vol_30d_after_pct": float(row["return_vol_30d_after_pct"]),
            "improvement_pct": float(row["improvement_pct"]),
        }
        for row in rows
    ]


def nearest_price_index(prices: list[dict], target_date: datetime) -> int:
    return min(range(len(prices)), key=lambda index: abs((prices[index]["date"] - target_date).days))


def event_impact(prices: list[dict], event: dict, window: int = 30) -> dict:
    index = nearest_price_index(prices, event["event_date_obj"])
    before = prices[max(0, index - window) : index]
    after = prices[index : min(len(prices), index + window)]
    before_prices = [row["price"] for row in before]
    after_prices = [row["price"] for row in after]
    before_returns = [row["log_return"] for row in before if row["log_return"] is not None]
    after_returns = [row["log_return"] for row in after if row["log_return"] is not None]
    before_mean = mean(before_prices) if before_prices else prices[index]["price"]
    after_mean = mean(after_prices) if after_prices else prices[index]["price"]

    return {
        "event_date": event["event_date"],
        "event_name": event["event_name"],
        "event_type": event["event_type"],
        "region": event["region"],
        "expected_price_channel": event["expected_price_channel"],
        "notes": event["notes"],
        "source_url": event["source_url"],
        "nearest_trading_date": prices[index]["date"].date().isoformat(),
        "mean_price_before": round(before_mean, 2),
        "mean_price_after": round(after_mean, 2),
        "price_change_pct": round(percent_change(before_mean, after_mean), 2),
        "volatility_before_pct": round(stdev(before_returns) * 100, 2) if len(before_returns) > 1 else 0.0,
        "volatility_after_pct": round(stdev(after_returns) * 100, 2) if len(after_returns) > 1 else 0.0,
    }


def filter_prices(prices: list[dict], start: str | None, end: str | None) -> list[dict]:
    start_date = datetime.strptime(start, "%Y-%m-%d") if start else prices[0]["date"]
    end_date = datetime.strptime(end, "%Y-%m-%d") if end else prices[-1]["date"]
    return [row for row in prices if start_date <= row["date"] <= end_date]


def downsample(rows: list[dict], max_points: int) -> list[dict]:
    if len(rows) <= max_points:
        return rows
    step = math.ceil(len(rows) / max_points)
    return rows[::step]


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "brent-dashboard-api"})

    @app.get("/api/summary")
    def summary():
        prices = load_prices()
        decade_prices = [row for row in prices if row["date"] >= datetime(2012, 11, 14)]
        returns = [row["log_return"] for row in decade_prices if row["log_return"] is not None]
        change_points = load_change_points()
        events = load_events()
        return jsonify(
            {
                "date_range": {
                    "start": prices[0]["date"].date().isoformat(),
                    "end": prices[-1]["date"].date().isoformat(),
                },
                "decade_range": {
                    "start": decade_prices[0]["date"].date().isoformat(),
                    "end": decade_prices[-1]["date"].date().isoformat(),
                },
                "observations": len(prices),
                "decade_observations": len(decade_prices),
                "latest_price": decade_prices[-1]["price"],
                "average_price_decade": round(mean(row["price"] for row in decade_prices), 2),
                "volatility_decade_pct": round(stdev(returns) * 100, 2),
                "event_count": len(events),
                "change_point_count": len(change_points),
            }
        )

    @app.get("/api/prices")
    def prices():
        rows = filter_prices(load_prices(), request.args.get("start"), request.args.get("end"))
        max_points = int(request.args.get("max_points", 1200))
        rows = downsample(rows, max_points)
        return jsonify(
            [
                {
                    "date": row["date"].date().isoformat(),
                    "price": round(row["price"], 2),
                    "log_return_pct": None
                    if row["log_return"] is None
                    else round(row["log_return"] * 100, 4),
                }
                for row in rows
            ]
        )

    @app.get("/api/events")
    def events():
        event_type = request.args.get("type")
        events_data = load_events()
        if event_type and event_type != "All":
            events_data = [event for event in events_data if event["event_type"] == event_type]
        prices = load_prices()
        return jsonify([event_impact(prices, event) for event in events_data])

    @app.get("/api/change-points")
    def change_points():
        return jsonify(load_change_points())

    @app.get("/api/model-report")
    def model_report():
        content = TASK2_REPORT_PATH.read_text(encoding="utf8") if TASK2_REPORT_PATH.exists() else ""
        return jsonify({"markdown": content})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
