const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "BrentOilPrices.csv");
const OUTPUT_DIR = path.join(ROOT, "reports");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "time_series_diagnostics.md");

const MONTHS = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseCsvLine(line) {
  const fields = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  fields.push(value);
  return fields;
}

function parseDate(raw) {
  const value = raw.trim();
  let match = value.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (match) {
    const [, day, month, year] = match;
    const fullYear = Number(year) >= 70 ? 1900 + Number(year) : 2000 + Number(year);
    return new Date(Date.UTC(fullYear, MONTHS[month], Number(day)));
  }

  match = value.match(/^([A-Za-z]{3}) (\d{2}), (\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return new Date(Date.UTC(Number(year), MONTHS[month], Number(day)));
  }

  throw new Error(`Unsupported date format: ${raw}`);
}

function loadPrices() {
  const rows = fs
    .readFileSync(DATA_PATH, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [dateRaw, priceRaw] = parseCsvLine(line);
      return {
        date: parseDate(dateRaw),
        price: Number(priceRaw),
      };
    })
    .sort((a, b) => a.date - b.date);

  return rows.filter((row) => Number.isFinite(row.price));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function simpleTrend(rows) {
  const firstTime = rows[0].date.getTime();
  const xs = rows.map((row) => (row.date.getTime() - firstTime) / (1000 * 60 * 60 * 24 * 365.25));
  const ys = rows.map((row) => row.price);
  const xMean = mean(xs);
  const yMean = mean(ys);
  const numerator = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  return numerator / denominator;
}

function logReturns(rows) {
  const returns = [];
  for (let i = 1; i < rows.length; i += 1) {
    returns.push(Math.log(rows[i].price / rows[i - 1].price));
  }
  return returns;
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, value, i) => sum + value * vector[i], 0));
}

function invertMatrix(matrix) {
  const size = matrix.length;
  const augmented = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: size }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let pivotRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[pivotRow][pivot])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][pivot]) < 1e-12) {
      throw new Error("Singular matrix in regression.");
    }

    [augmented[pivot], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    for (let col = 0; col < size * 2; col += 1) {
      augmented[pivot][col] /= divisor;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let col = 0; col < size * 2; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col];
      }
    }
  }

  return augmented.map((row) => row.slice(size));
}

function ols(xRows, y) {
  const columns = xRows[0].length;
  const xtx = Array.from({ length: columns }, () => Array(columns).fill(0));
  const xty = Array(columns).fill(0);

  xRows.forEach((x, rowIndex) => {
    for (let i = 0; i < columns; i += 1) {
      xty[i] += x[i] * y[rowIndex];
      for (let j = 0; j < columns; j += 1) {
        xtx[i][j] += x[i] * x[j];
      }
    }
  });

  const xtxInv = invertMatrix(xtx);
  const beta = multiplyMatrixVector(xtxInv, xty);
  const residuals = y.map((actual, i) => actual - xRows[i].reduce((sum, value, j) => sum + value * beta[j], 0));
  const sigma2 = residuals.reduce((sum, value) => sum + value ** 2, 0) / (y.length - columns);
  const standardErrors = xtxInv.map((row, i) => Math.sqrt(sigma2 * row[i]));

  return { beta, standardErrors };
}

function adfTStatistic(series, lags = 1) {
  const differences = [];
  for (let i = 1; i < series.length; i += 1) {
    differences.push(series[i] - series[i - 1]);
  }

  const y = [];
  const xRows = [];
  for (let i = lags; i < differences.length; i += 1) {
    const row = [1, series[i]];
    for (let lag = 1; lag <= lags; lag += 1) {
      row.push(differences[i - lag]);
    }
    xRows.push(row);
    y.push(differences[i]);
  }

  const { beta, standardErrors } = ols(xRows, y);
  return beta[1] / standardErrors[1];
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function annualSummary(rows) {
  const byYear = new Map();
  rows.forEach((row) => {
    const year = row.date.getUTCFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(row.price);
  });

  return Array.from(byYear.entries())
    .map(([year, prices]) => ({
      year,
      average: mean(prices),
      minimum: Math.min(...prices),
      maximum: Math.max(...prices),
    }))
    .filter((row) => row.year >= 2012);
}

function report() {
  const rows = loadPrices();
  const recentRows = rows.filter((row) => row.date >= new Date(Date.UTC(2012, 10, 14)));
  const prices = rows.map((row) => row.price);
  const recentPrices = recentRows.map((row) => row.price);
  const returns = logReturns(rows);
  const recentReturns = logReturns(recentRows);
  const annual = annualSummary(rows);

  const lines = [
    "# Brent Oil Time Series Diagnostics",
    "",
    `Generated from \`data/BrentOilPrices.csv\`.`,
    "",
    "## Coverage",
    "",
    `- Full sample: ${formatDate(rows[0].date)} to ${formatDate(rows[rows.length - 1].date)} (${rows.length.toLocaleString()} observations).`,
    `- Task 1 decade window available in the file: ${formatDate(recentRows[0].date)} to ${formatDate(recentRows[recentRows.length - 1].date)} (${recentRows.length.toLocaleString()} observations).`,
    "",
    "## Price Level Properties",
    "",
    `- Full-sample mean price: $${mean(prices).toFixed(2)} per barrel.`,
    `- Full-sample minimum/maximum: $${Math.min(...prices).toFixed(2)} / $${Math.max(...prices).toFixed(2)} per barrel.`,
    `- Full-sample linear trend: ${simpleTrend(rows).toFixed(2)} dollars per barrel per year.`,
    `- Decade-window linear trend: ${simpleTrend(recentRows).toFixed(2)} dollars per barrel per year.`,
    "",
    "## Return Properties",
    "",
    `- Full-sample mean daily log return: ${(mean(returns) * 100).toFixed(4)}%.`,
    `- Full-sample daily log-return volatility: ${(standardDeviation(returns) * 100).toFixed(2)}%.`,
    `- Decade-window mean daily log return: ${(mean(recentReturns) * 100).toFixed(4)}%.`,
    `- Decade-window daily log-return volatility: ${(standardDeviation(recentReturns) * 100).toFixed(2)}%.`,
    "",
    "## Stationarity Check",
    "",
    `- ADF-style t-statistic on price levels, lag 1: ${adfTStatistic(prices, 1).toFixed(3)}.`,
    `- ADF-style t-statistic on log returns, lag 1: ${adfTStatistic(returns, 1).toFixed(3)}.`,
    "- Interpretation: Brent price levels behave like a non-stationary series with visible structural shifts, while log returns are much closer to stationary and are more appropriate for volatility and event-window modeling.",
    "- Note: this is a lightweight diagnostic implementation, not a replacement for a full econometrics package with exact MacKinnon p-values.",
    "",
    "## Annual Summary Since 2012",
    "",
    "| Year | Average | Minimum | Maximum |",
    "| --- | ---: | ---: | ---: |",
    ...annual.map((row) => `| ${row.year} | ${row.average.toFixed(2)} | ${row.minimum.toFixed(2)} | ${row.maximum.toFixed(2)} |`),
    "",
  ];

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
}

report();
