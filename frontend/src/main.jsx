import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  CalendarRange,
  Gauge,
  Filter,
  Landmark,
  LineChart,
  Target,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";
const EVENT_TYPES = ["All", "OPEC policy", "Sanctions", "Conflict", "Macroeconomic shock"];
const TYPE_COLORS = {
  "OPEC policy": "#2f6f73",
  Sanctions: "#8f5a23",
  Conflict: "#a23b3b",
  "Macroeconomic shock": "#4f5f97",
  All: "#4b5563",
};

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

function formatPct(value) {
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(1)}%`;
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${path}`);
  }
  return response.json();
}

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <section className="metric">
      <div className="metric-icon">
        <Icon size={18} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

function EventTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="tooltip">
      <strong>{item.date}</strong>
      {item.price !== null && item.price !== undefined && <p>Brent price: {formatCurrency(item.price)}</p>}
      {item.forecast_price !== null && item.forecast_price !== undefined && (
        <p>
          Forecast: {formatCurrency(item.forecast_price)} ({formatCurrency(item.lower_price)} to{" "}
          {formatCurrency(item.upper_price)})
        </p>
      )}
      {item.event_name && <p>{item.event_name}</p>}
    </div>
  );
}

function ImpactTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <p key={item.dataKey}>
          {item.name}: {item.dataKey.includes("pct") ? formatPct(item.value) : formatCurrency(item.value)}
        </p>
      ))}
    </div>
  );
}

function App() {
  const [summary, setSummary] = useState(null);
  const [prices, setPrices] = useState([]);
  const [events, setEvents] = useState([]);
  const [changePoints, setChangePoints] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [eventTypeSummary, setEventTypeSummary] = useState([]);
  const [eventType, setEventType] = useState("All");
  const [startDate, setStartDate] = useState("2012-11-14");
  const [endDate, setEndDate] = useState("2022-11-14");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStatic() {
      try {
        const [summaryData, changePointData] = await Promise.all([
          fetchJson("/api/summary"),
          fetchJson("/api/change-points"),
        ]);
        setSummary(summaryData);
        setChangePoints(changePointData);
      } catch (err) {
        setError(err.message);
      }
    }
    loadStatic();
  }, []);

  useEffect(() => {
    async function loadFiltered() {
      setLoading(true);
      setError("");
      try {
        const query = `start=${startDate}&end=${endDate}&max_points=900`;
        const [priceData, eventData, forecastData, typeSummaryData] = await Promise.all([
          fetchJson(`/api/prices?${query}`),
          fetchJson(`/api/events?type=${encodeURIComponent(eventType)}`),
          fetchJson("/api/forecast?horizon=60"),
          fetchJson("/api/event-type-summary"),
        ]);
        setPrices(priceData);
        setEvents(eventData);
        setForecast(forecastData);
        setEventTypeSummary(typeSummaryData);
        setSelectedEvent((current) => {
          if (current && eventData.some((item) => item.event_name === current.event_name)) return current;
          return eventData[0] || null;
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadFiltered();
  }, [eventType, startDate, endDate]);

  const eventDateSet = useMemo(() => new Map(events.map((event) => [event.nearest_trading_date, event])), [events]);
  const priceChartData = useMemo(
    () =>
      prices.map((price) => ({
        ...price,
        event_name: eventDateSet.get(price.date)?.event_name,
        event_type: eventDateSet.get(price.date)?.event_type,
      })),
    [prices, eventDateSet],
  );

  const combinedPriceData = useMemo(() => {
    const historical = priceChartData.map((point) => ({
      ...point,
      forecast_price: null,
      lower_price: null,
      upper_price: null,
    }));
    const forecastRows = forecast.map((point) => ({
      date: point.date,
      price: null,
      log_return_pct: null,
      forecast_price: point.forecast_price,
      lower_price: point.lower_price,
      upper_price: point.upper_price,
    }));
    return [...historical, ...forecastRows];
  }, [priceChartData, forecast]);

  const impactChartData = useMemo(
    () =>
      events.map((event) => ({
        name: event.event_name.length > 28 ? `${event.event_name.slice(0, 28)}...` : event.event_name,
        fullName: event.event_name,
        before: event.mean_price_before,
        after: event.mean_price_after,
        pct: event.price_change_pct,
        type: event.event_type,
      })),
    [events],
  );

  const highlightedChangePoints = useMemo(
    () =>
      changePoints.filter((item) => {
        const date = new Date(item.change_date);
        return date >= new Date(startDate) && date <= new Date(endDate);
      }),
    [changePoints, startDate, endDate],
  );

  const selectedVolatilityDelta = selectedEvent
    ? selectedEvent.volatility_after_pct - selectedEvent.volatility_before_pct
    : 0;
  const strongestEvent = useMemo(
    () => [...events].sort((a, b) => Math.abs(b.price_change_pct) - Math.abs(a.price_change_pct))[0],
    [events],
  );

  return (
    <main>
      <header className="app-header">
        <div>
          <span className="eyebrow">Birhan Energies</span>
          <h1>Brent Oil Event Intelligence</h1>
          <p>
            Explore price regimes, event windows, volatility shifts, and change-point hypotheses from
            the Brent oil analysis workflow.
          </p>
        </div>
        <div className="status-chip">
          <RefreshCw size={16} />
          Local analysis data
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="metrics-grid">
        <StatCard
          icon={LineChart}
          label="Latest Brent Price"
          value={summary ? formatCurrency(summary.latest_price) : "..."}
          detail={summary ? summary.decade_range.end : "Loading"}
        />
        <StatCard
          icon={Activity}
          label="Decade Volatility"
          value={summary ? `${summary.volatility_decade_pct}%` : "..."}
          detail="daily log returns"
        />
        <StatCard
          icon={Landmark}
          label="Curated Events"
          value={summary ? summary.event_count : "..."}
          detail="policy, conflict, sanctions, macro"
        />
        <StatCard
          icon={CalendarRange}
          label="Change Points"
          value={summary ? summary.change_point_count : "..."}
          detail="screening candidates"
        />
        <StatCard
          icon={Target}
          label="60-Day Forecast"
          value={forecast.length ? formatCurrency(forecast[forecast.length - 1].forecast_price) : "..."}
          detail="drift with volatility band"
        />
      </section>

      <section className="controls">
        <label>
          <Filter size={16} />
          Event Type
          <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          End
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
      </section>

      <section className="dashboard-grid">
        <article className="panel price-panel">
          <div className="panel-header">
            <div>
              <h2>Historical Brent Price With Events</h2>
              <p>{loading ? "Loading filtered data" : `${prices.length} plotted observations`}</p>
            </div>
          </div>
          <div className="chart-large">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedPriceData} margin={{ top: 16, right: 20, bottom: 6, left: 0 }}>
                <CartesianGrid stroke="#dde3ea" vertical={false} />
                <XAxis dataKey="date" minTickGap={52} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={58} domain={["auto", "auto"]} />
                <Tooltip content={<EventTooltip />} />
                <Area dataKey="price" fill="#d9eceb" stroke="#2f6f73" strokeWidth={2} name="Price" />
                <Area
                  dataKey="upper_price"
                  fill="#e9edf5"
                  stroke="none"
                  connectNulls
                  name="Forecast upper"
                />
                <Area
                  dataKey="lower_price"
                  fill="#ffffff"
                  stroke="none"
                  connectNulls
                  name="Forecast lower"
                />
                <Line
                  dataKey="forecast_price"
                  stroke="#4f5f97"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                  name="Forecast"
                />
                {events.map((event) => (
                  <ReferenceLine
                    key={`${event.event_date}-${event.event_name}`}
                    x={event.nearest_trading_date}
                    stroke={TYPE_COLORS[event.event_type] || "#4b5563"}
                    strokeDasharray="4 4"
                  />
                ))}
                {highlightedChangePoints.map((point) => (
                  <ReferenceLine
                    key={point.change_date}
                    x={point.change_date}
                    stroke="#111827"
                    strokeWidth={1.5}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>

        <aside className="panel event-list">
          <div className="panel-header">
            <div>
              <h2>Event Drilldown</h2>
              <p>{events.length} events in filter</p>
            </div>
          </div>
          <div className="event-scroll">
            {events.map((event) => (
              <button
                className={`event-row ${selectedEvent?.event_name === event.event_name ? "active" : ""}`}
                key={`${event.event_date}-${event.event_name}`}
                onClick={() => setSelectedEvent(event)}
              >
                <span style={{ backgroundColor: TYPE_COLORS[event.event_type] || "#4b5563" }} />
                <strong>{event.event_name}</strong>
                <small>
                  {event.event_date} · {formatPct(event.price_change_pct)}
                </small>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="dashboard-grid lower">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Event Window Price Impact</h2>
              <p>30 trading days before and after each event</p>
            </div>
          </div>
          <div className="chart-medium">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={impactChartData} margin={{ top: 12, right: 18, bottom: 72, left: 0 }}>
                <CartesianGrid stroke="#dde3ea" vertical={false} />
                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<ImpactTooltip />} />
                <Bar dataKey="pct" name="Price shift %" radius={[3, 3, 0, 0]}>
                  {impactChartData.map((item) => (
                    <Cell key={item.fullName} fill={item.pct >= 0 ? "#2f6f73" : "#a23b3b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel detail-panel">
          <div className="panel-header">
            <div>
              <h2>Selected Event Detail</h2>
              <p>{selectedEvent ? selectedEvent.event_type : "Choose an event"}</p>
            </div>
          </div>
          {selectedEvent && (
            <div className="selected-event">
              <h3>{selectedEvent.event_name}</h3>
              <p>{selectedEvent.notes}</p>
              <div className="impact-pair">
                <span>Before average</span>
                <strong>{formatCurrency(selectedEvent.mean_price_before)}</strong>
              </div>
              <div className="impact-pair">
                <span>After average</span>
                <strong>{formatCurrency(selectedEvent.mean_price_after)}</strong>
              </div>
              <div className="impact-pair">
                <span>Price shift</span>
                <strong className={selectedEvent.price_change_pct >= 0 ? "positive" : "negative"}>
                  {selectedEvent.price_change_pct >= 0 ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                  {formatPct(selectedEvent.price_change_pct)}
                </strong>
              </div>
              <div className="impact-pair">
                <span>Volatility shift</span>
                <strong className={selectedVolatilityDelta >= 0 ? "negative" : "positive"}>
                  <Gauge size={17} />
                  {formatPct(selectedVolatilityDelta)}
                </strong>
              </div>
              <a href={selectedEvent.source_url} target="_blank" rel="noreferrer">
                Source
              </a>
            </div>
          )}
        </article>
      </section>

      <section className="insight-strip">
        <article className="panel insight-card">
          <span>Strongest filtered event</span>
          <h2>{strongestEvent ? strongestEvent.event_name : "No event selected"}</h2>
          <p>
            {strongestEvent
              ? `${formatPct(strongestEvent.price_change_pct)} average price movement around ${strongestEvent.event_date}.`
              : "Adjust filters to inspect event windows."}
          </p>
        </article>
        <article className="panel insight-card">
          <span>Forecast context</span>
          <h2>{forecast.length ? `${forecast.length} days` : "Waiting for API"}</h2>
          <p>
            Projection uses recent drift and volatility bands, so it is a scenario baseline rather than
            a causal forecast.
          </p>
        </article>
        <article className="panel insight-card">
          <span>Interpretation guardrail</span>
          <h2>Correlation, not proof</h2>
          <p>Event alignment supports hypotheses; causal claims need controls and robustness checks.</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Event Type Comparison</h2>
            <p>Average 30-trading-day impact by event category</p>
          </div>
        </div>
        <div className="type-summary-grid">
          {eventTypeSummary.map((item) => (
            <article className="type-card" key={item.event_type}>
              <span style={{ backgroundColor: TYPE_COLORS[item.event_type] || "#4b5563" }} />
              <h3>{item.event_type}</h3>
              <strong className={item.average_price_change_pct >= 0 ? "positive" : "negative"}>
                {formatPct(item.average_price_change_pct)}
              </strong>
              <small>
                {item.event_count} events - avg volatility after {item.average_volatility_after_pct.toFixed(2)}%
              </small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Change-Point Candidates</h2>
            <p>Screening output aligned to curated events</p>
          </div>
        </div>
        <div className="change-grid">
          {changePoints.map((point) => (
            <article className="change-card" key={point.rank}>
              <span>#{point.rank}</span>
              <h3>{point.change_date}</h3>
              <p>{point.associated_event}</p>
              <strong className={point.price_change_pct >= 0 ? "positive" : "negative"}>
                {formatPct(point.price_change_pct)}
              </strong>
              <small>
                {formatCurrency(point.mean_price_30d_before)} to {formatCurrency(point.mean_price_30d_after)}
              </small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
