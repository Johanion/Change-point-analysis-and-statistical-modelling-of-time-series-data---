# Task 1: Foundation for Brent Oil Event Analysis

## 1. Business Objective

Birhan Energies needs a reproducible analysis of how major geopolitical, macroeconomic, sanctions, and OPEC policy events align with Brent crude oil price changes. The practical goal is to help investors, analysts, policymakers, and energy companies understand when the market entered a new price regime and which event narratives are most plausible around those changes.

The current repository contains daily Brent oil prices from 1987-05-20 through 2022-11-14. Because the requested "past decade" is limited by available data, the decade window used in Task 1 is 2012-11-14 through 2022-11-14.

## 2. Data Analysis Workflow

1. Ingest and validate price data.
   - Load `data/BrentOilPrices.csv`.
   - Parse mixed date formats consistently.
   - Check missing prices, duplicate dates, sorting, and outlier candidates.

2. Create an event catalogue.
   - Use `data/oil_market_events.csv` as the structured event dataset.
   - Capture event date, event type, region, expected price channel, notes, and source URL.
   - Group events into OPEC policy, conflict, sanctions, and macroeconomic shocks.

3. Explore time series properties.
   - Plot price levels, log prices, daily returns, rolling means, and rolling volatility.
   - Test whether levels and returns behave as stationary series.
   - Use `npm.cmd run diagnostics` to regenerate `reports/time_series_diagnostics.md`.

4. Prepare modeling features.
   - Convert price levels to log prices and log returns.
   - Build event windows around each event, for example 1, 7, 14, and 30 trading days.
   - Add event-type indicators and post-event flags.

5. Fit statistical models.
   - Use change-point models to detect structural breaks in the price or return process.
   - Compare detected break dates with the curated event catalogue.
   - Estimate before/after averages, volatility changes, and event-window cumulative returns.

6. Validate and interpret.
   - Check whether break dates are stable across model settings.
   - Compare findings with known market context.
   - Separate statistical alignment from causal claims.

7. Communicate results.
   - Translate model outputs into concise stakeholder narratives, charts, and recommendations.
   - Highlight uncertainty, assumptions, and alternative explanations.

## 3. Event Dataset

The curated file `data/oil_market_events.csv` contains 17 events from 2012-2022. It covers:

- Iran sanctions and JCPOA milestones.
- Major OPEC and OPEC+ production decisions.
- Saudi infrastructure attacks and Middle East escalation.
- COVID-19 demand shock.
- Russia-Ukraine war and Russian energy sanctions.

This event catalogue should be treated as an analysis input, not as proof that each event caused a price move.

## 4. Assumptions and Limitations

- Brent daily spot prices are treated as the market outcome. They may not capture intraday reactions, futures curve dynamics, or regional crude spreads.
- Events are represented by approximate start dates, usually public announcement dates. Markets often anticipate events before the official date.
- Multiple events can overlap. For example, COVID-19 demand collapse and OPEC+ supply negotiations both affected prices in March-April 2020.
- The dataset ends on 2022-11-14, so the analysis cannot evaluate later OPEC decisions, later Russia sanctions, Red Sea shipping disruptions, or more recent macroeconomic shocks without updated data.
- The current diagnostics use a lightweight ADF-style implementation. A later modeling phase should use a full econometrics library for formal p-values and sensitivity checks.

Correlation versus causation is the central limitation. A change point near an event date shows temporal association: the price-generating process changed around the same time as a known event. It does not prove the event caused the change. Stronger causal interpretation would require additional evidence such as an event-study design, counterfactual modeling, controls for other market drivers, and robustness across event windows.

## 5. Time Series Properties

The diagnostics report shows:

- Full sample coverage: 1987-05-20 to 2022-11-14, with 9,011 observations.
- Task 1 decade window: 2012-11-14 to 2022-11-14, with 2,543 observations.
- Full-sample linear price trend: +2.31 dollars per barrel per year.
- Decade-window linear price trend: -1.85 dollars per barrel per year.
- Decade-window daily log-return volatility: 3.04%.
- ADF-style t-statistic on levels: -1.656.
- ADF-style t-statistic on log returns: -69.285.

These results imply that Brent price levels are not suitable for simple stationary models without transformation or structural-break handling. Log returns are much closer to stationary, so they are better suited for event-window return analysis, volatility analysis, and many regression-style models. Change-point models remain useful because even returns can move between regimes with different means and volatility.

## 6. Purpose of Change-Point Models

Change-point models identify dates where the statistical behavior of a time series changes. In Brent oil analysis, this means finding points where the average price level, trend, or volatility regime shifts materially.

They help answer business questions such as:

- Did Brent enter a new price regime near a major OPEC decision?
- Was a geopolitical shock followed by a persistent volatility increase?
- Which breaks align with known supply-side events versus demand-side shocks?
- Are some event categories followed by larger or longer-lasting changes?

## 7. Expected Change-Point Outputs

A change-point analysis should produce:

- Estimated change dates.
- Pre-break and post-break parameters, such as mean return, price level, trend, or volatility.
- Credible intervals or confidence scores around break dates where supported by the method.
- Ranked event alignments showing which curated events fall near detected breaks.
- Diagnostic plots with prices, returns, event markers, and detected change points.

Limitations include sensitivity to model choice, lag structure, event-window length, outliers, and overlapping shocks. Change points can identify "when something changed"; they do not by themselves explain "why it changed."

## 8. Stakeholder Communication Channels

- Executive briefing deck: concise narrative, key event timeline, detected regime shifts, and business implications.
- Interactive dashboard: price chart, event filters, change-point overlays, and event-window return summaries.
- Technical notebook or report: methodology, diagnostics, model assumptions, robustness checks, and reproducible code.
- Data appendix: event catalogue, data dictionary, and source links.
- Policy or investment memo: decision-focused interpretation for risk management, hedging, planning, and monitoring.

## 9. Main References Used

- U.S. Energy Information Administration articles for oil market disruption context.
- OPEC press releases for production decisions.
- EU and U.S. government releases for sanctions milestones.
- World Health Organization COVID-19 timeline context.
- UN Secretary-General remarks for the Russia-Ukraine invasion date.
- Project-generated diagnostics in `reports/time_series_diagnostics.md`.
