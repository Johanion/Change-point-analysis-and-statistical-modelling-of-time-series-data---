# Brent Oil Change-Point Analysis

This project, developed for Birhan Energies, analyzes how major geopolitical, macroeconomic, sanctions, and OPEC policy events relate to structural changes in Brent crude oil prices.

## Current Scope

Task 1 lays the foundation for analysis:

- Defines the end-to-end data analysis workflow.
- Compiles a structured oil-market event catalogue.
- Runs initial trend and stationarity diagnostics on Brent prices.
- Explains how change-point models will support event-impact analysis.
- Documents assumptions, limitations, and stakeholder communication formats.

## Repository Structure

- `data/BrentOilPrices.csv`: daily Brent crude oil price dataset.
- `data/oil_market_events.csv`: curated event catalogue for 2012-2022.
- `docs/task1_foundation.md`: Task 1 workflow, assumptions, model explanation, and communication plan.
- `src/time_series_diagnostics.js`: dependency-free diagnostics script.
- `reports/time_series_diagnostics.md`: generated trend and stationarity diagnostics.

## Reproduce Diagnostics

PowerShell may block the `npm` script wrapper, so use:

```powershell
npm.cmd run diagnostics
```

The command regenerates `reports/time_series_diagnostics.md`.

## Key Task 1 Finding

Brent price levels show trend and structural instability, while log returns are much closer to stationary. This supports modeling price changes or log returns and using change-point analysis to identify possible regime shifts around major events.
