# Task 3: Interactive Dashboard

## Overview

Task 3 adds a Flask and React dashboard for stakeholders to explore Brent oil prices, curated events, and change-point insights.

The dashboard is split into:

- `backend/app.py`: Flask API serving analysis data from local CSV and report artifacts.
- `frontend/`: React application built with Vite and Recharts.

## Backend API

Run the API:

```powershell
flask --app backend.app run --host 127.0.0.1 --port 5000
```

Available endpoints:

- `GET /api/health`: service status.
- `GET /api/summary`: coverage, latest price, volatility, event count, and change-point count.
- `GET /api/prices?start=YYYY-MM-DD&end=YYYY-MM-DD&max_points=900`: filtered Brent price series.
- `GET /api/events?type=All`: event catalogue with 30-trading-day before/after impact metrics.
- `GET /api/event-type-summary`: average event impact and volatility by event category.
- `GET /api/change-points`: Task 2 change-point candidates.
- `GET /api/forecast?horizon=60`: simple drift-based Brent price projection with volatility bands.
- `GET /api/model-report`: generated Task 2 Markdown report.

## Frontend

Install frontend dependencies:

```powershell
npm.cmd --prefix frontend install
```

Run the React app:

```powershell
npm.cmd --prefix frontend run dev
```

Open:

```text
http://127.0.0.1:5173
```

For a production-build preview:

```powershell
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run preview
```

Open:

```text
http://127.0.0.1:4173
```

The production build and preview route were verified in the current workspace. The Vite development optimizer can be sensitive to local Windows filesystem permissions; use the production preview command if `npm.cmd --prefix frontend run dev` hits dependency-optimization access errors.

If the Flask API runs somewhere else, set:

```powershell
$env:VITE_API_BASE_URL="http://127.0.0.1:5000"
```

## Dashboard Features

- Historical Brent price chart with event markers and change-point markers.
- Forecast overlay with uncertainty bands for near-term scenario context.
- Event-type filter for OPEC policy, sanctions, conflict, and macroeconomic shocks.
- Date-range controls for focused exploration.
- Event drilldown with notes, source link, before/after average price, price shift, and volatility shift.
- Event impact bar chart showing 30-trading-day price changes.
- Change-point candidate cards with quantified before/after price shifts.
- Event category comparison cards showing average impact and post-event volatility.
- Executive insight cards for strongest filtered event, forecast context, and causal interpretation limits.
- Responsive layout for desktop, tablet, and mobile.

## Data Sources

The dashboard uses existing project artifacts:

- `data/BrentOilPrices.csv`
- `data/oil_market_events.csv`
- `reports/change_point_candidates.csv`
- `reports/task2_change_point_insights.md`

No real-time external data integration is enabled by default. A future extension can add scheduled data refresh jobs or API connectors for macroeconomic variables, inventories, futures prices, and exchange rates.
