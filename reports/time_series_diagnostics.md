# Brent Oil Time Series Diagnostics

Generated from `data/BrentOilPrices.csv`.

## Coverage

- Full sample: 1987-05-20 to 2022-11-14 (9,011 observations).
- Task 1 decade window available in the file: 2012-11-14 to 2022-11-14 (2,543 observations).

## Price Level Properties

- Full-sample mean price: $48.42 per barrel.
- Full-sample minimum/maximum: $9.10 / $143.95 per barrel.
- Full-sample linear trend: 2.31 dollars per barrel per year.
- Decade-window linear trend: -1.85 dollars per barrel per year.

## Return Properties

- Full-sample mean daily log return: 0.0179%.
- Full-sample daily log-return volatility: 2.55%.
- Decade-window mean daily log return: -0.0062%.
- Decade-window daily log-return volatility: 3.04%.

## Stationarity Check

- ADF-style t-statistic on price levels, lag 1: -1.656.
- ADF-style t-statistic on log returns, lag 1: -69.285.
- Interpretation: Brent price levels behave like a non-stationary series with visible structural shifts, while log returns are much closer to stationary and are more appropriate for volatility and event-window modeling.
- Note: this is a lightweight diagnostic implementation, not a replacement for a full econometrics package with exact MacKinnon p-values.

## Annual Summary Since 2012

| Year | Average | Minimum | Maximum |
| --- | ---: | ---: | ---: |
| 2012 | 111.57 | 88.69 | 128.14 |
| 2013 | 108.56 | 96.84 | 118.90 |
| 2014 | 98.97 | 55.27 | 115.19 |
| 2015 | 52.32 | 35.26 | 66.33 |
| 2016 | 43.64 | 26.01 | 54.97 |
| 2017 | 54.12 | 43.98 | 66.80 |
| 2018 | 71.34 | 50.57 | 86.07 |
| 2019 | 64.32 | 53.23 | 74.94 |
| 2020 | 42.10 | 9.12 | 70.25 |
| 2021 | 70.86 | 50.37 | 85.76 |
| 2022 | 103.48 | 78.25 | 133.18 |
