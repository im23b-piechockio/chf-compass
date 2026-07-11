"use client";

import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  chf,
  pct,
  monthlyReturns,
  cumulativeValue,
} from "../lib/finance";
import CountUp from "./CountUp";

const BENCHMARKS = [
  { ticker: null, label: "No benchmark" },
  { ticker: "URTH", label: "MSCI World" },
  { ticker: "^SSMI", label: "SMI" },
];

const TOOLTIP_STYLE = {
  background: "#16161b",
  border: "1px solid #26262b",
  borderRadius: 12,
  color: "#e6e8ec",
};

function InfoTip({ text }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={text}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-[10px] text-muted transition hover:border-green/50 hover:text-green focus:border-green/50 focus:text-green focus:outline-none"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-lg border border-line bg-panel2 p-2.5 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-text/90 shadow-xl group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}

const PALETTE = [
  "#34d399",
  "#e5b567",
  "#60a5fa",
  "#fb7185",
  "#a78bfa",
  "#f59e0b",
  "#2dd4bf",
  "#f472b6",
  "#93c5fd",
  "#fbbf24",
  "#4ade80",
];

function MetricCard({ label, value, num, fmt, sub, tone = "text", info }) {
  const toneClass =
    tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-text";
  return (
    <div className="glass2 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
        {info && <InfoTip text={info} />}
      </p>
      <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${toneClass}`}>
        {num !== undefined ? <CountUp value={num} format={fmt} /> : value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function buildInsights(stats, weights, totalPct, assets) {
  const insights = [];
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const name = (t) => assets.find((a) => a.ticker === t)?.name || t;

  const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a), ["", 0]);
  const topShare = totalPct ? top[1] / totalPct : 0;
  if (topShare >= 0.5) {
    insights.push({
      tone: "warn",
      text: `${Math.round(topShare * 100)}% of your portfolio is in one asset (${name(top[0])}). A single position dominating the portfolio means its risk dominates too.`,
    });
  }

  const crypto = entries
    .filter(([t]) => assets.find((a) => a.ticker === t)?.category === "Crypto")
    .reduce((s, [, w]) => s + w, 0);
  if (totalPct && crypto / totalPct > 0.15) {
    insights.push({
      tone: "warn",
      text: `Crypto makes up ${Math.round((crypto / totalPct) * 100)}% of the mix — expect large swings; Bitcoin has repeatedly drawn down more than 70%.`,
    });
  }

  if (stats.vol > 0.2) {
    insights.push({
      tone: "warn",
      text: `Annualized volatility is ${pct(stats.vol)} — this portfolio moves a lot. Historically it fell ${pct(Math.abs(stats.mdd))} from peak to trough.`,
    });
  } else if (stats.vol < 0.08) {
    insights.push({
      tone: "info",
      text: `Volatility of ${pct(stats.vol)} is low — a defensive mix. The trade-off is usually a lower long-run return.`,
    });
  }

  const bonds = entries
    .filter(([t]) => assets.find((a) => a.ticker === t)?.category === "Bonds")
    .reduce((s, [, w]) => s + w, 0);
  if (totalPct && bonds === 0 && stats.divScore < 60) {
    insights.push({
      tone: "info",
      text: "No bonds in the mix. Bonds tend to cushion equity drawdowns — even a 10–20% allocation can smooth the ride.",
    });
  }

  if (stats.divScore >= 60) {
    insights.push({
      tone: "good",
      text: `Diversification score ${stats.divScore}/100 — the portfolio behaves like ${(1 / Object.values(stats.fractions).filter((w) => w > 0).reduce((s, w) => s + w * w, 0)).toFixed(1)} independent holdings. Nicely spread.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      tone: "good",
      text: "A balanced setup — no concentration or volatility flags. Adjust the sliders to explore trade-offs.",
    });
  }
  return insights;
}

export default function Dashboard({ data, stats, weights, totalPct }) {
  const [benchmark, setBenchmark] = useState("URTH");

  const benchmarkValues = useMemo(() => {
    if (!benchmark) return null;
    const asset = data.assets.find((a) => a.ticker === benchmark);
    if (!asset) return null;
    return cumulativeValue(monthlyReturns(asset.prices), 10000);
  }, [benchmark, data]);

  const donutData = useMemo(
    () =>
      Object.entries(weights)
        .filter(([, w]) => w > 0)
        .map(([ticker, w]) => ({
          name: data.assets.find((a) => a.ticker === ticker)?.name || ticker,
          value: w,
        })),
    [weights, data]
  );

  const chartData = useMemo(() => {
    if (!stats) return [];
    return stats.values.map((v, i) => ({
      month: data.months[i],
      value: Math.round(v),
      benchmark: benchmarkValues ? Math.round(benchmarkValues[i]) : undefined,
    }));
  }, [stats, data, benchmarkValues]);

  if (!stats) {
    return (
      <section className="glass flex min-h-[400px] items-center justify-center p-8 text-center text-muted">
        Add at least one asset to see the dashboard.
      </section>
    );
  }

  const insights = buildInsights(stats, weights, totalPct, data.assets);
  const endValue = stats.values[stats.values.length - 1];
  const benchEnd = benchmarkValues
    ? benchmarkValues[benchmarkValues.length - 1]
    : null;
  const outperformance = benchEnd != null ? endValue - benchEnd : null;
  const benchLabel = BENCHMARKS.find((b) => b.ticker === benchmark)?.label;

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <MetricCard
          label="Annualized return"
          num={stats.cagr}
          fmt={pct}
          sub="CAGR, last 10 years"
          tone={stats.cagr >= 0 ? "green" : "red"}
          info="The compound annual growth rate — the constant yearly return that would turn the starting value into the final value over the whole period."
        />
        <MetricCard
          label="Volatility"
          num={stats.vol}
          fmt={pct}
          sub="annualized, monthly data"
          info="How much the portfolio's value swings around its average, per year. Higher volatility means a bumpier ride."
        />
        <MetricCard
          label="Sharpe ratio"
          num={stats.sharpe}
          fmt={(v) => v.toFixed(2)}
          sub="return per unit of risk"
          tone={stats.sharpe >= 1 ? "green" : stats.sharpe < 0.5 ? "red" : "text"}
          info="Return earned above a ~0.5% risk-free rate, divided by volatility. Above 1 is considered good — more reward for each unit of risk taken."
        />
        <MetricCard
          label="Max drawdown"
          num={stats.mdd}
          fmt={pct}
          sub="worst peak-to-trough"
          tone="red"
          info="The deepest fall from a previous high before recovering — the worst loss an investor would have sat through."
        />
        <MetricCard
          label="Best year"
          value={pct(stats.best.ret)}
          sub={stats.best.year}
          tone="green"
          info="The strongest full calendar-year return of this mix in the backtest period."
        />
        <MetricCard
          label="Worst year"
          value={pct(stats.worst.ret)}
          sub={stats.worst.year}
          tone={stats.worst.ret < 0 ? "red" : "text"}
          info="The weakest full calendar-year return — a feel for what a bad year looks like."
        />
        <MetricCard
          label="Diversification"
          value={`${stats.divScore}/100`}
          sub="concentration-based"
          tone={stats.divScore >= 60 ? "green" : stats.divScore < 30 ? "red" : "text"}
          info="Based on how evenly weights are spread (inverse Herfindahl index). 0 = everything in one asset, 100 = spread across many."
        />
        {outperformance != null && (
          <MetricCard
            label={`vs. ${benchLabel}`}
            num={outperformance}
            fmt={(v) => `${v >= 0 ? "+" : ""}${chf(v)}`}
            sub={`${outperformance >= 0 ? "+" : ""}${pct(endValue / benchEnd - 1)} vs. benchmark`}
            tone={outperformance >= 0 ? "green" : "red"}
            info={`Final value of your portfolio minus the final value of CHF 10’000 invested purely in ${benchLabel} over the same period.`}
          />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <div className="glass p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
            Allocation
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  innerRadius="62%"
                  outerRadius="90%"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [`${v}%`, n]}
                  contentStyle={{
                    background: "#16161b",
                    border: "1px solid #26262b",
                    borderRadius: 12,
                    color: "#e6e8ec",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5">
            {donutData.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="truncate text-muted">{d.name}</span>
                <span className="ml-auto font-semibold tabular-nums">
                  {d.value}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
              CHF 10’000 invested — 10-year backtest
            </h3>
            <div className="flex items-center gap-3">
              <select
                value={benchmark || ""}
                onChange={(e) => setBenchmark(e.target.value || null)}
                aria-label="Benchmark"
                className="glass2 min-h-[36px] px-2.5 py-1 text-xs font-semibold text-muted outline-none"
              >
                {BENCHMARKS.map((b) => (
                  <option key={b.label} value={b.ticker || ""}>
                    {b.label}
                  </option>
                ))}
              </select>
              <span className="text-lg font-bold tabular-nums text-green">
                {chf(endValue)}
              </span>
            </div>
          </div>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid stroke="#26262b" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#8b909b", fontSize: 11 }}
                  tickFormatter={(m) => m.slice(0, 4)}
                  interval={23}
                  axisLine={{ stroke: "#26262b" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#8b909b", fontSize: 11 }}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(v, name) => [
                    chf(v),
                    name === "value" ? "Your portfolio" : benchLabel,
                  ]}
                  labelStyle={{ color: "#8b909b" }}
                  contentStyle={TOOLTIP_STYLE}
                />
                {benchmarkValues && (
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    stroke="#e5b567"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    animationDuration={600}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={600}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Monthly rebalanced to target weights · dividends included
              (adjusted close) · all values in CHF.
            </p>
            {outperformance != null && (
              <p className="text-xs font-semibold tabular-nums">
                <span className="text-muted">vs. {benchLabel}: </span>
                <span className={outperformance >= 0 ? "text-green" : "text-red"}>
                  {outperformance >= 0 ? "+" : ""}
                  {chf(outperformance)} ({outperformance >= 0 ? "+" : ""}
                  {pct(endValue / benchEnd - 1)})
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="glass p-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted">
          Year-by-year returns
          <InfoTip text="Calendar-year return of your portfolio mix for each full year in the backtest — a feel for the good and bad years you would have lived through." />
        </h3>
        <div className="h-52 sm:h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stats.years.map((y) => ({ year: y.year, ret: +(y.ret * 100).toFixed(1) }))}
              margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
            >
              <CartesianGrid stroke="#26262b" strokeDasharray="3 6" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: "#8b909b", fontSize: 11 }}
                axisLine={{ stroke: "#26262b" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#8b909b", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <ReferenceLine y={0} stroke="#26262b" />
              <Tooltip
                formatter={(v) => [`${v}%`, "Return"]}
                cursor={{ fill: "#16161b" }}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="ret" radius={[4, 4, 0, 0]} animationDuration={500}>
                {stats.years.map((y) => (
                  <Cell key={y.year} fill={y.ret >= 0 ? "#34d399" : "#fb7185"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Insights
        </h3>
        <ul className="space-y-2.5">
          {insights.map((ins, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  ins.tone === "warn"
                    ? "bg-red"
                    : ins.tone === "good"
                    ? "bg-green"
                    : "bg-gold"
                }`}
              />
              <span className="text-text/90">{ins.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
