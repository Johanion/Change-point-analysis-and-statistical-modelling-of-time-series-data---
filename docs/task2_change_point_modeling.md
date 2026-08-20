# Task 2: Change Point Modeling and Insight Generation

## 1. Objective

Task 2 moves from analysis planning into statistical modeling. The goal is to identify structural breaks in Brent oil price behavior, associate those breaks with the curated event catalogue from Task 1, and quantify how the price regime changed around major events.

## 2. Core Model

The formal Bayesian model is implemented in `src/bayesian_change_point_pymc.py`.

The model estimates one dominant switch point, `tau`, over a selected time window:

- `tau`: unknown day where price behavior changes.
- `mu_before`, `mu_after`: mean behavior before and after the switch.
- `sigma_before`, `sigma_after`: volatility before and after the switch.
- `observed`: normally distributed target series, selected by `pm.math.switch`.

The script supports two targets:

- `log_price`: best for identifying persistent price-level regimes.
- `log_return`: best for identifying changes in average daily returns and volatility.

The default window starts on 2012-11-14 because the available Brent price file ends on 2022-11-14, making this the available decade window.

## 3. Running the PyMC Model

Install dependencies in a Python environment:

```powershell
pip install -r requirements.txt
```

Run the Bayesian model:

```powershell
python src/bayesian_change_point_pymc.py --target log_price --start 2012-11-14
```

Optional return-based run:

```powershell
python src/bayesian_change_point_pymc.py --target log_return --start 2012-11-14
```

Expected outputs:

- `reports/pymc_change_point_log_price.md`
- `reports/pymc_change_point_log_price.csv`
- `reports/pymc_change_point_log_price.nc`
- `reports/pymc_change_point_log_price_trace.png`
- `reports/pymc_change_point_log_price_posterior.png`

## 4. Model Interpretation

Before interpreting outputs:

- Check `r_hat` values in the PyMC summary. Values near 1.0 indicate acceptable convergence.
- Inspect trace plots for stable chain mixing.
- Inspect the posterior distribution of `tau`. A narrow peak means the model is confident about the break date. A wide or multi-modal distribution means uncertainty is high.
- Compare posterior before/after means and volatility.
- Use the generated nearest-event match as a hypothesis, not as proof of causality.

For log-price runs, the script converts posterior means back to price scale. A statement such as "mean price shifted from $X to $Y" refers to the modeled price-regime average, not a one-day spot-price move.

## 5. Reproducible Screening Results

Because Python and PyMC are not available in the current local environment, the repository also includes a dependency-free companion analysis:

```powershell
npm.cmd run task2:impact
```

This script:

- Screens log prices for multiple structural-break candidates.
- Matches candidate break dates to the nearest curated event.
- Computes 30-trading-day before/after average prices.
- Computes 30-trading-day before/after daily log-return volatility.
- Writes `reports/task2_change_point_insights.md` and `reports/change_point_candidates.csv`.

These screening results are useful for immediate insight generation, but the PyMC posterior should be treated as the final Bayesian evidence after it is run in a Python environment.

## 6. Main Insight Hypotheses

The current screening report highlights the following event-linked candidates:

- 2014-11-13, near the 2014-11-27 OPEC decision to maintain the production ceiling: average Brent price fell from $85.86 to $68.42 over adjacent 30-trading-day windows, a -20.3% shift.
- 2020-03-06, near the 2020-03-11 COVID-19 pandemic shock: average Brent price fell from $55.80 to $25.11, a -55.0% shift, while daily volatility rose from 2.46% to 12.54%.
- 2021-06-01, near the 2021-07-18 OPEC+ production-increase agreement: average Brent price rose from $67.66 to $74.04, a 9.4% shift.
- 2022-01-25, near the 2022-02-24 Russia-Ukraine invasion: average Brent price rose from $80.31 to $99.86, a 24.4% shift, while daily volatility rose from 1.82% to 2.92%.

These are plausible causal hypotheses because they align with large demand or supply-risk narratives. They are not causal proof because other factors were active at the same time and markets may have anticipated public announcements.

## 7. Advanced Extensions

Future modeling can strengthen the analysis by adding explanatory variables:

- GDP growth and industrial production to capture demand conditions.
- Inflation, interest rates, and exchange rates to capture macro-financial pressure.
- Oil inventories, spare production capacity, and rig counts to capture supply-demand balance.
- Sanctions intensity indicators and geopolitical risk indexes to quantify event severity.

Advanced models can add different perspectives:

- VAR models can estimate dynamic relationships between Brent prices and macroeconomic variables.
- Markov-switching models can explicitly classify calm, stressed, and volatile market regimes.
- Multi-change-point Bayesian models can estimate several breaks in one model rather than one dominant switch.
- Hierarchical Bayesian event models can estimate whether OPEC, sanctions, conflict, or macro shocks have systematically different average effects.
