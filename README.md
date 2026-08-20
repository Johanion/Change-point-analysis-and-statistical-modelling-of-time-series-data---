# Brent Oil Change-Point Analysis

This project, developed for Birhan Energies, analyzes how major geopolitical, macroeconomic, sanctions, and OPEC policy events relate to structural changes in Brent crude oil prices.

## Current Scope

Task 1 lays the foundation for analysis:

- Defines the end-to-end data analysis workflow.
- Compiles a structured oil-market event catalogue.
- Runs initial trend and stationarity diagnostics on Brent prices.
- Explains how change-point models will support event-impact analysis.
- Documents assumptions, limitations, and stakeholder communication formats.

Task 2 implements change-point modeling and insight generation:

- Adds a PyMC Bayesian change-point model for Brent price regimes.
- Generates event-linked impact summaries from reproducible local analysis.
- Documents change-point interpretation, causal limitations, and advanced extensions.

Task 3 adds an interactive dashboard:

- Serves analysis artifacts through a Flask API.
- Provides a React and Recharts interface for event filtering, price trends, change points, and impact drilldowns.

## Repository Structure

- `data/BrentOilPrices.csv`: daily Brent crude oil price dataset.
- `data/oil_market_events.csv`: curated event catalogue for 2012-2022.
- `docs/task1_foundation.md`: Task 1 workflow, assumptions, model explanation, and communication plan.
- `docs/task2_change_point_modeling.md`: Task 2 modeling approach, interpretation guide, and future work.
- `docs/task3_dashboard.md`: Flask and React dashboard runbook.
- `backend/app.py`: Flask API for dashboard data.
- `frontend/`: React dashboard application.
- `src/time_series_diagnostics.js`: dependency-free diagnostics script.
- `src/bayesian_change_point_pymc.py`: PyMC Bayesian change-point model.
- `src/change_point_event_impact.js`: dependency-free Task 2 screening and impact script.
- `reports/time_series_diagnostics.md`: generated trend and stationarity diagnostics.
- `reports/task2_change_point_insights.md`: generated change-point and event-impact report.
- `reports/change_point_candidates.csv`: machine-readable candidate change-point table.

## Reproduce Diagnostics

PowerShell may block the `npm` script wrapper, so use:

```powershell
npm.cmd run diagnostics
```

The command regenerates `reports/time_series_diagnostics.md`.

Generate Task 2 event-impact screening outputs:

```powershell
npm.cmd run task2:impact
```

Run the formal PyMC model after installing Python dependencies:

```powershell
pip install -r requirements.txt
python src/bayesian_change_point_pymc.py --target log_price --start 2012-11-14
```

## Run Dashboard

Install Python and frontend dependencies, then run the two services:

```powershell
pip install -r requirements.txt
npm.cmd --prefix frontend install
flask --app backend.app run --host 127.0.0.1 --port 5000
```

In a second terminal:

```powershell
npm.cmd --prefix frontend run dev
```

Open `http://127.0.0.1:5173`.

## Key Task 1 Finding

Brent price levels show trend and structural instability, while log returns are much closer to stationary. This supports modeling price changes or log returns and using change-point analysis to identify possible regime shifts around major events.
