"""Bayesian change-point model for Brent oil prices.

This script fits a single-switch Bayesian model with PyMC. It is designed for
Task 2: identify the most probable structural break in Brent price behavior,
quantify before/after parameters, and match the inferred break to curated
oil-market events.

Example:
    python src/bayesian_change_point_pymc.py --target log_price --start 2012-11-14
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

import arviz as az
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import pymc as pm


ROOT = Path(__file__).resolve().parents[1]
PRICE_PATH = ROOT / "data" / "BrentOilPrices.csv"
EVENT_PATH = ROOT / "data" / "oil_market_events.csv"
REPORT_DIR = ROOT / "reports"


@dataclass
class ChangePointResult:
    target: str
    start_date: pd.Timestamp
    end_date: pd.Timestamp
    observations: int
    tau_index_median: int
    tau_date_median: pd.Timestamp
    tau_date_mode: pd.Timestamp
    tau_hdi_low: pd.Timestamp
    tau_hdi_high: pd.Timestamp
    before_mean: float
    after_mean: float
    before_sigma: float
    after_sigma: float
    probability_after_gt_before: float
    nearest_event_name: str
    nearest_event_date: pd.Timestamp
    nearest_event_type: str
    days_from_event: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fit a PyMC Bayesian change-point model.")
    parser.add_argument("--price-path", default=PRICE_PATH, type=Path)
    parser.add_argument("--event-path", default=EVENT_PATH, type=Path)
    parser.add_argument("--target", choices=["log_price", "log_return"], default="log_price")
    parser.add_argument("--start", default="2012-11-14", help="Start date for the modeling window.")
    parser.add_argument("--end", default=None, help="Optional end date for the modeling window.")
    parser.add_argument("--draws", default=2000, type=int)
    parser.add_argument("--tune", default=1000, type=int)
    parser.add_argument("--chains", default=4, type=int)
    parser.add_argument("--min-segment", default=60, type=int)
    parser.add_argument("--random-seed", default=42, type=int)
    return parser.parse_args()


def load_prices(path: Path) -> pd.DataFrame:
    prices = pd.read_csv(path)
    parsed_dates = pd.to_datetime(prices["Date"], format="%d-%b-%y", errors="coerce")
    missing = parsed_dates.isna()
    parsed_dates.loc[missing] = pd.to_datetime(prices.loc[missing, "Date"], format="%b %d, %Y")
    prices["date"] = parsed_dates
    prices["price"] = pd.to_numeric(prices["Price"], errors="coerce")
    prices = prices.dropna(subset=["date", "price"]).sort_values("date")
    prices = prices.drop_duplicates("date", keep="last")
    prices["log_price"] = np.log(prices["price"])
    prices["log_return"] = prices["log_price"].diff()
    return prices.reset_index(drop=True)


def load_events(path: Path) -> pd.DataFrame:
    events = pd.read_csv(path)
    events["event_date"] = pd.to_datetime(events["event_date"])
    return events.sort_values("event_date").reset_index(drop=True)


def prepare_series(prices: pd.DataFrame, target: str, start: str, end: str | None) -> pd.DataFrame:
    frame = prices.loc[prices["date"] >= pd.Timestamp(start)].copy()
    if end:
        frame = frame.loc[frame["date"] <= pd.Timestamp(end)].copy()
    if target == "log_return":
        frame = frame.dropna(subset=["log_return"])
    return frame.reset_index(drop=True)


def fit_model(y: np.ndarray, min_segment: int, args: argparse.Namespace) -> az.InferenceData:
    coords = {"time": np.arange(len(y))}
    idx = np.arange(len(y))
    centered_y = y - y.mean()

    with pm.Model(coords=coords) as model:
        tau = pm.DiscreteUniform(
            "tau",
            lower=min_segment,
            upper=len(centered_y) - min_segment,
        )
        mu_before = pm.Normal("mu_before", mu=0.0, sigma=2.0)
        mu_after = pm.Normal("mu_after", mu=0.0, sigma=2.0)
        sigma_before = pm.HalfNormal("sigma_before", sigma=float(np.std(centered_y) * 2.0))
        sigma_after = pm.HalfNormal("sigma_after", sigma=float(np.std(centered_y) * 2.0))

        mu = pm.math.switch(idx < tau, mu_before, mu_after)
        sigma = pm.math.switch(idx < tau, sigma_before, sigma_after)

        pm.Normal("observed", mu=mu, sigma=sigma, observed=centered_y, dims="time")

        trace = pm.sample(
            draws=args.draws,
            tune=args.tune,
            chains=args.chains,
            random_seed=args.random_seed,
            return_inferencedata=True,
            target_accept=0.9,
        )

    return trace


def hdi_indices(samples: np.ndarray, probability: float = 0.94) -> tuple[int, int]:
    interval = az.hdi(samples, hdi_prob=probability)
    return int(round(interval[0])), int(round(interval[1]))


def nearest_event(events: pd.DataFrame, tau_date: pd.Timestamp) -> pd.Series:
    distances = (events["event_date"] - tau_date).abs()
    return events.loc[distances.idxmin()]


def summarize_result(
    frame: pd.DataFrame,
    events: pd.DataFrame,
    trace: az.InferenceData,
    target: str,
) -> ChangePointResult:
    posterior = trace.posterior
    tau_samples = posterior["tau"].values.reshape(-1).astype(int)
    tau_median = int(np.median(tau_samples))
    tau_mode = int(pd.Series(tau_samples).mode().iloc[0])
    low_idx, high_idx = hdi_indices(tau_samples)

    mu_before = posterior["mu_before"].values.reshape(-1) + frame[target].mean()
    mu_after = posterior["mu_after"].values.reshape(-1) + frame[target].mean()
    sigma_before = posterior["sigma_before"].values.reshape(-1)
    sigma_after = posterior["sigma_after"].values.reshape(-1)

    tau_date = frame.loc[tau_median, "date"]
    event = nearest_event(events, tau_date)
    days_from_event = int((tau_date - event["event_date"]).days)

    return ChangePointResult(
        target=target,
        start_date=frame["date"].iloc[0],
        end_date=frame["date"].iloc[-1],
        observations=len(frame),
        tau_index_median=tau_median,
        tau_date_median=tau_date,
        tau_date_mode=frame.loc[tau_mode, "date"],
        tau_hdi_low=frame.loc[max(0, low_idx), "date"],
        tau_hdi_high=frame.loc[min(len(frame) - 1, high_idx), "date"],
        before_mean=float(np.mean(mu_before)),
        after_mean=float(np.mean(mu_after)),
        before_sigma=float(np.mean(sigma_before)),
        after_sigma=float(np.mean(sigma_after)),
        probability_after_gt_before=float(np.mean(mu_after > mu_before)),
        nearest_event_name=str(event["event_name"]),
        nearest_event_date=event["event_date"],
        nearest_event_type=str(event["event_type"]),
        days_from_event=days_from_event,
    )


def write_summary(result: ChangePointResult, trace: az.InferenceData, output_path: Path) -> None:
    rhat = az.summary(trace, var_names=["tau", "mu_before", "mu_after", "sigma_before", "sigma_after"])
    price_scale_note = ""

    if result.target == "log_price":
        before_price = np.exp(result.before_mean)
        after_price = np.exp(result.after_mean)
        pct_change = ((after_price / before_price) - 1.0) * 100.0
        price_scale_note = (
            f"- Mean price regime shifted from about ${before_price:.2f} to ${after_price:.2f}, "
            f"a {pct_change:.1f}% change.\n"
        )
    else:
        before_return = result.before_mean * 100.0
        after_return = result.after_mean * 100.0
        price_scale_note = (
            f"- Mean daily log return shifted from {before_return:.4f}% to {after_return:.4f}%.\n"
        )

    lines = [
        "# PyMC Bayesian Change-Point Model Summary",
        "",
        f"- Target series: `{result.target}`.",
        f"- Modeling window: {result.start_date.date()} to {result.end_date.date()}.",
        f"- Observations: {result.observations:,}.",
        f"- Median posterior change point: {result.tau_date_median.date()}.",
        f"- Modal posterior change point: {result.tau_date_mode.date()}.",
        f"- 94% HDI for change date: {result.tau_hdi_low.date()} to {result.tau_hdi_high.date()}.",
        price_scale_note.rstrip(),
        f"- Before/after sigma: {result.before_sigma:.4f} to {result.after_sigma:.4f}.",
        f"- Probability after-mean exceeds before-mean: {result.probability_after_gt_before:.3f}.",
        f"- Nearest curated event: {result.nearest_event_name} ({result.nearest_event_date.date()}, {result.nearest_event_type}), {result.days_from_event:+d} days from change point.",
        "",
        "## Convergence Summary",
        "",
        "R-hat values near 1.0 indicate acceptable convergence. Inspect trace plots before making final claims.",
        "",
        rhat.to_markdown(),
        "",
    ]
    output_path.write_text("\n".join(lines), encoding="utf8")


def write_machine_summary(result: ChangePointResult, output_path: Path) -> None:
    with output_path.open("w", newline="", encoding="utf8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(result.__dict__.keys()))
        writer.writeheader()
        row = {
            key: value.date().isoformat() if isinstance(value, pd.Timestamp) else value
            for key, value in result.__dict__.items()
        }
        writer.writerow(row)


def save_plots(trace: az.InferenceData, output_prefix: Path) -> None:
    az.plot_trace(trace, var_names=["tau", "mu_before", "mu_after", "sigma_before", "sigma_after"])
    plt.tight_layout()
    plt.savefig(output_prefix.with_name(f"{output_prefix.name}_trace.png"), dpi=160)
    plt.close()

    az.plot_posterior(trace, var_names=["tau", "mu_before", "mu_after", "sigma_before", "sigma_after"])
    plt.tight_layout()
    plt.savefig(output_prefix.with_name(f"{output_prefix.name}_posterior.png"), dpi=160)
    plt.close()


def main() -> None:
    args = parse_args()
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    prices = load_prices(args.price_path)
    events = load_events(args.event_path)
    frame = prepare_series(prices, args.target, args.start, args.end)

    if len(frame) < args.min_segment * 2 + 1:
        raise ValueError("Modeling window is too short for the requested minimum segment length.")

    y = frame[args.target].to_numpy()
    trace = fit_model(y, args.min_segment, args)
    result = summarize_result(frame, events, trace, args.target)

    prefix = REPORT_DIR / f"pymc_change_point_{args.target}"
    trace.to_netcdf(prefix.with_suffix(".nc"))
    write_summary(result, trace, prefix.with_suffix(".md"))
    write_machine_summary(result, prefix.with_suffix(".csv"))
    save_plots(trace, prefix)

    print(f"Wrote {prefix.with_suffix('.md').relative_to(ROOT)}")
    print(f"Wrote {prefix.with_suffix('.csv').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
