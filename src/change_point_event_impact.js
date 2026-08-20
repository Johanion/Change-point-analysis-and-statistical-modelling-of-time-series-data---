const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PRICE_PATH = path.join(ROOT, "data", "BrentOilPrices.csv");
const EVENT_PATH = path.join(ROOT, "data", "oil_market_events.csv");
const REPORT_DIR = path.join(ROOT, "reports");
const REPORT_PATH = path.join(REPORT_DIR, "task2_change_point_insights.md");
const CANDIDATE_PATH = path.join(REPORT_DIR, "change_point_candidates.csv");

const START_DATE = new Date(Date.UTC(2012, 10, 14));
const MIN_SEGMENT = 90;
const MAX_CHANGE_POINTS = 6;
const ASSOCIATION_WINDOW_DAYS = 60;
const EVENT_WINDOW_TRADING_DAYS = 30;

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

function parsePriceDate(raw) {
  let match = raw.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (match) {
    const [, day, month, year] = match;
    const fullYear = Number(year) >= 70 ? 1900 + Number(year) : 2000 + Number(year);
    return new Date(Date.UTC(fullYear, MONTHS[month], Number(day)));
  }

  match = raw.match(/^([A-Za-z]{3}) (\d{2}), (\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return new Date(Date.UTC(Number(year), MONTHS[month], Number(day)));
  }

  throw new Error(`Unsupported date format: ${raw}`);
}

function parseIsoDate(raw) {
  const [year, month, day] = raw.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function loadPrices() {
  return fs
    .readFileSync(PRICE_PATH, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [dateRaw, priceRaw] = parseCsvLine(line);
      const price = Number(priceRaw);
      return {
        date: parsePriceDate(dateRaw),
        price,
        logPrice: Math.log(price),
      };
    })
    .filter((row) => Number.isFinite(row.price) && row.date >= START_DATE)
    .sort((a, b) => a.date - b.date)
    .map((row, index, rows) => ({
      ...row,
      logReturn: index === 0 ? null : row.logPrice - rows[index - 1].logPrice,
    }));
}

function loadEvents() {
  return fs
    .readFileSync(EVENT_PATH, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [eventDate, eventName, eventType, region, expectedPriceChannel, notes, sourceUrl] =
        parseCsvLine(line);
      return {
        eventDate: parseIsoDate(eventDate),
        eventName,
        eventType,
        region,
        expectedPriceChannel,
        notes,
        sourceUrl,
      };
    })
    .filter((event) => event.eventDate >= START_DATE)
    .sort((a, b) => a.eventDate - b.eventDate);
}

function prefixSums(values) {
  const sums = [0];
  const squares = [0];
  values.forEach((value) => {
    sums.push(sums[sums.length - 1] + value);
    squares.push(squares[squares.length - 1] + value * value);
  });
  return { sums, squares };
}

function segmentSse(prefix, start, end) {
  const n = end - start;
  const sum = prefix.sums[end] - prefix.sums[start];
  const squareSum = prefix.squares[end] - prefix.squares[start];
  return squareSum - (sum * sum) / n;
}

function bestSplit(values, start, end) {
  if (end - start < MIN_SEGMENT * 2) return null;
  const prefix = prefixSums(values);
  const baseSse = segmentSse(prefix, start, end);
  let best = null;

  for (let split = start + MIN_SEGMENT; split <= end - MIN_SEGMENT; split += 1) {
    const leftSse = segmentSse(prefix, start, split);
    const rightSse = segmentSse(prefix, split, end);
    const combinedSse = leftSse + rightSse;
    const improvement = baseSse - combinedSse;
    const improvementPct = improvement / baseSse;

    if (!best || improvement > best.improvement) {
      best = { start, end, split, baseSse, combinedSse, improvement, improvementPct };
    }
  }

  return best;
}

function binarySegmentation(rows) {
  const values = rows.map((row) => row.logPrice);
  const segments = [{ start: 0, end: values.length }];
  const candidates = [];

  while (candidates.length < MAX_CHANGE_POINTS) {
    const options = segments
      .map((segment, segmentIndex) => ({ ...bestSplit(values, segment.start, segment.end), segmentIndex }))
      .filter((option) => option.split !== undefined)
      .sort((a, b) => b.improvement - a.improvement);

    if (options.length === 0 || options[0].improvementPct < 0.03) break;

    const chosen = options[0];
    candidates.push(chosen);
    segments.splice(
      chosen.segmentIndex,
      1,
      { start: chosen.start, end: chosen.split },
      { start: chosen.split, end: chosen.end },
    );
  }

  return candidates.sort((a, b) => a.split - b.split);
}

function nearestEvent(events, date) {
  return events
    .map((event) => ({
      ...event,
      distanceDays: daysBetween(date, event.eventDate),
      absDistanceDays: Math.abs(daysBetween(date, event.eventDate)),
    }))
    .sort((a, b) => a.absDistanceDays - b.absDistanceDays)[0];
}

function windowStats(rows, split, width = EVENT_WINDOW_TRADING_DAYS) {
  const before = rows.slice(Math.max(0, split - width), split);
  const after = rows.slice(split, Math.min(rows.length, split + width));
  const beforeReturns = before.map((row) => row.logReturn).filter(Number.isFinite);
  const afterReturns = after.map((row) => row.logReturn).filter(Number.isFinite);
  const beforeMean = mean(before.map((row) => row.price));
  const afterMean = mean(after.map((row) => row.price));

  return {
    beforeMean,
    afterMean,
    pctChange: ((afterMean / beforeMean) - 1) * 100,
    beforeVol: standardDeviation(beforeReturns) * 100,
    afterVol: standardDeviation(afterReturns) * 100,
  };
}

function eventWindowImpact(rows, events) {
  return events.map((event) => {
    const nearestIndex = rows
      .map((row, index) => ({ index, distance: Math.abs(daysBetween(row.date, event.eventDate)) }))
      .sort((a, b) => a.distance - b.distance)[0].index;
    const stats = windowStats(rows, nearestIndex, EVENT_WINDOW_TRADING_DAYS);
    return { ...event, nearestTradingDate: rows[nearestIndex].date, ...stats };
  });
}

function candidateRows(rows, events) {
  return binarySegmentation(rows).map((candidate, rank) => {
    const date = rows[candidate.split].date;
    const event = nearestEvent(events, date);
    const stats = windowStats(rows, candidate.split);
    return {
      rank: rank + 1,
      changeDate: date,
      evidenceScore: candidate.improvement,
      improvementPct: candidate.improvementPct,
      associatedEvent: event.absDistanceDays <= ASSOCIATION_WINDOW_DAYS ? event.eventName : "No close curated event",
      eventDate: event.eventDate,
      eventType: event.eventType,
      daysFromEvent: event.distanceDays,
      ...stats,
    };
  });
}

function writeCsv(candidates) {
  const header = [
    "rank",
    "change_date",
    "associated_event",
    "event_date",
    "event_type",
    "days_from_event",
    "mean_price_30d_before",
    "mean_price_30d_after",
    "price_change_pct",
    "return_vol_30d_before_pct",
    "return_vol_30d_after_pct",
    "improvement_pct",
  ];

  const rows = candidates.map((candidate) => [
    candidate.rank,
    formatDate(candidate.changeDate),
    candidate.associatedEvent,
    formatDate(candidate.eventDate),
    candidate.eventType,
    candidate.daysFromEvent,
    candidate.beforeMean.toFixed(2),
    candidate.afterMean.toFixed(2),
    candidate.pctChange.toFixed(2),
    candidate.beforeVol.toFixed(2),
    candidate.afterVol.toFixed(2),
    (candidate.improvementPct * 100).toFixed(2),
  ]);

  fs.writeFileSync(
    CANDIDATE_PATH,
    [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n"),
    "utf8",
  );
}

function writeReport(rows, events, candidates) {
  const eventImpacts = eventWindowImpact(rows, events);
  const associated = candidates.filter((candidate) => candidate.associatedEvent !== "No close curated event");
  const lines = [
    "# Task 2: Change Point Modeling and Insight Generation",
    "",
    "## Execution Note",
    "",
    "The formal Bayesian PyMC model is implemented in `src/bayesian_change_point_pymc.py`. Python and PyMC are not available in this local execution environment, so the concrete tables below are generated by the dependency-free companion script `src/change_point_event_impact.js`. Treat these as reproducible screening results and use the PyMC posterior outputs as the final statistical evidence once the Python environment is installed.",
    "",
    "## Data Preparation",
    "",
    `- Modeling window: ${formatDate(rows[0].date)} to ${formatDate(rows[rows.length - 1].date)}.`,
    `- Observations: ${rows.length.toLocaleString()} daily Brent price records.`,
    "- Price levels are converted to log prices for structural-break screening.",
    "- Daily log returns are used to quantify volatility before and after each candidate break.",
    "",
    "## Candidate Change Points",
    "",
    "| Rank | Change Date | Associated Event | Event Date | Days From Event | Mean Price 30d Before | Mean Price 30d After | Price Shift | Vol 30d Before | Vol 30d After |",
    "| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...candidates.map((candidate) =>
      [
        `| ${candidate.rank}`,
        formatDate(candidate.changeDate),
        candidate.associatedEvent,
        formatDate(candidate.eventDate),
        candidate.daysFromEvent,
        `$${candidate.beforeMean.toFixed(2)}`,
        `$${candidate.afterMean.toFixed(2)}`,
        `${candidate.pctChange.toFixed(1)}%`,
        `${candidate.beforeVol.toFixed(2)}%`,
        `${candidate.afterVol.toFixed(2)}% |`,
      ].join(" | "),
    ),
    "",
    "## Event-Linked Impact Statements",
    "",
    ...associated.map((candidate) => {
      const direction = candidate.pctChange >= 0 ? "increased" : "decreased";
      return `- Around ${formatDate(candidate.changeDate)}, nearest to ${candidate.associatedEvent} (${formatDate(candidate.eventDate)}), the 30-trading-day average Brent price ${direction} from $${candidate.beforeMean.toFixed(2)} to $${candidate.afterMean.toFixed(2)} (${candidate.pctChange.toFixed(1)}%). Daily log-return volatility moved from ${candidate.beforeVol.toFixed(2)}% to ${candidate.afterVol.toFixed(2)}%.`;
    }),
    "",
    "## Event Window Cross-Check",
    "",
    "| Event Date | Event | Type | Mean Price 30d Before | Mean Price 30d After | Price Shift |",
    "| --- | --- | --- | ---: | ---: | ---: |",
    ...eventImpacts.map((impact) =>
      [
        `| ${formatDate(impact.eventDate)}`,
        impact.eventName,
        impact.eventType,
        `$${impact.beforeMean.toFixed(2)}`,
        `$${impact.afterMean.toFixed(2)}`,
        `${impact.pctChange.toFixed(1)}% |`,
      ].join(" | "),
    ),
    "",
    "## Interpretation",
    "",
    "- The strongest detected breaks align with major demand and supply regime narratives, especially the 2014-2016 oil price collapse, the COVID-19 demand shock, and the 2022 Russia-Ukraine energy shock.",
    "- OPEC policy announcements often appear near turning points, but the effect can be mixed because markets anticipate decisions and because demand, inventories, sanctions, and macro conditions move at the same time.",
    "- These results support causal hypotheses, not causal proof. Final causal claims require the PyMC posterior diagnostics, event-study robustness checks, and controls for concurrent shocks.",
    "",
    "## Future Work",
    "",
    "- Add macroeconomic drivers such as GDP growth, inflation, interest rates, industrial production, exchange rates, inventories, and global demand forecasts.",
    "- Use VAR models to estimate dynamic relationships between oil prices and macroeconomic variables.",
    "- Use Markov-switching models to estimate explicit calm, stressed, and high-volatility market regimes.",
    "- Extend Bayesian modeling to multiple change points and hierarchical event-type effects.",
    "",
  ];

  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
}

function main() {
  const rows = loadPrices();
  const events = loadEvents();
  const candidates = candidateRows(rows, events);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  writeCsv(candidates);
  writeReport(rows, events, candidates);
  console.log(`Wrote ${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`Wrote ${path.relative(ROOT, CANDIDATE_PATH)}`);
}

main();
