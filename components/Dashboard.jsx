"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { chf, pct } from "../lib/finance";

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

function MetricCard({ label, value, sub, tone = "text" }) {
  const toneClass =
    tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-text";
  return (
    <div className="glass2 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${toneClass}`}>
        {value}
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
    }));
  }, [stats, data]);

  if (!stats) {
    return (
      <section className="glass flex min-h-[400px] items-center justify-center p-8 text-center text-muted">
        Add at least one asset to see the dashboard.
      </section>
    );
  }

  const insights = buildInsights(stats, weights, totalPct, data.assets);
  const endValue = stats.values[stats.values.length - 1];

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Annualized return"
          value={pct(stats.cagr)}
          sub="CAGR, last 10 years"
          tone={stats.cagr >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="Volatility"
          value={pct(stats.vol)}
          sub="annualized, monthly data"
        />
        <MetricCard
          label="Max drawdown"
          value={pct(stats.mdd)}
          sub="worst peak-to-trough"
          tone="red"
        />
        <MetricCard
          label="Best year"
          value={pct(stats.best.ret)}
          sub={stats.best.year}
          tone="green"
        />
        <MetricCard
          label="Worst year"
          value={pct(stats.worst.ret)}
          sub={stats.worst.year}
          tone={stats.worst.ret < 0 ? "red" : "text"}
        />
        <MetricCard
          label="Diversification"
          value={`${stats.divScore}/100`}
          sub="concentration-based"
          tone={stats.divScore >= 60 ? "green" : stats.divScore < 30 ? "red" : "text"}
        />
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
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
              CHF 10’000 invested — 10-year backtest
            </h3>
            <span className="text-lg font-bold tabular-nums text-green">
              {chf(endValue)}
            </span>
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
                  formatter={(v) => [chf(v), "Portfolio value"]}
                  labelStyle={{ color: "#8b909b" }}
                  contentStyle={{
                    background: "#16161b",
                    border: "1px solid #26262b",
                    borderRadius: 12,
                    color: "#e6e8ec",
                  }}
                />
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
          <p className="mt-2 text-xs text-muted">
            Monthly rebalanced to target weights · dividends included (adjusted
            close) · all values in CHF.
          </p>
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
