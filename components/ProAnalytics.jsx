"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  monthlyReturns,
  cumulativeValue,
  cagr,
  covarianceMatrix,
  riskContributions,
  riskParityWeights,
  historicalVaR,
  rollingMetrics,
  betaVsBenchmark,
  buyAndHoldValue,
  stressTest,
  efficientFrontier,
  toPercentWeights,
  chf,
  pct,
} from "../lib/finance";

const TOOLTIP_STYLE = {
  background: "#16161b",
  border: "1px solid #26262b",
  borderRadius: 12,
  color: "#e6e8ec",
};

const CRISES = [
  { id: "gfc", name: "Global Financial Crisis", start: "2007-10", end: "2009-03", blurb: "Lehman collapse & global banking crisis" },
  { id: "covid", name: "COVID Crash", start: "2020-02", end: "2020-03", blurb: "Pandemic lockdown shock" },
  { id: "rates", name: "2022 Rate Shock", start: "2022-01", end: "2022-10", blurb: "Inflation & fastest rate hikes in decades" },
];

const AXIS_TICK = { fill: "#8b909b", fontSize: 11 };

function Card({ title, sub, children, className = "" }) {
  return (
    <div className={`glass min-w-0 p-5 ${className}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {sub && (
        <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">{sub}</p>
      )}
      {children}
    </div>
  );
}

/* ---------------- 1. Stress tests ---------------- */

function StressTests({ data, weights }) {
  const results = useMemo(
    () =>
      CRISES.map((c) => ({
        ...c,
        result: stressTest(data.assets, weights, c.start, c.end),
      })),
    [data, weights]
  );

  return (
    <Card
      title="Historical stress tests"
      sub="How CHF 10’000 in your current mix would have fared in three real crises — computed from each asset's full price history, rebalanced monthly."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {results.map(({ id, name, start, end, blurb, result }) => (
          <div key={id} className="glass2 p-4">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-[11px] text-muted">
              {start} – {end} · {blurb}
            </p>
            {result ? (
              <>
                <p className="mt-2 text-2xl font-bold tabular-nums text-red">
                  {pct(result.loss)}
                </p>
                <p className="text-xs text-muted">
                  {chf(result.loss * 10000)} at the trough (
                  {result.troughMonth}) ·{" "}
                  {result.recoveryMonths !== null
                    ? `recovered in ${result.recoveryMonths} months`
                    : "not recovered within the data"}
                </p>
                <div className="mt-3 h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={result.months.map((m, i) => ({
                        month: m,
                        value: Math.round(result.values[i]),
                      }))}
                      margin={{ top: 2, right: 2, bottom: 0, left: 2 }}
                    >
                      <XAxis dataKey="month" hide />
                      <YAxis hide domain={["auto", "auto"]} />
                      <Tooltip
                        formatter={(v) => [chf(v), "Value"]}
                        labelStyle={{ color: "#8b909b" }}
                        contentStyle={TOOLTIP_STYLE}
                      />
                      <ReferenceLine y={10000} stroke="#26262b" />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#fb7185"
                        strokeWidth={1.5}
                        dot={false}
                        animationDuration={400}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {result.excluded.length > 0 && (
                  <p className="mt-2 text-[10px] leading-relaxed text-muted">
                    Excluded (no data for this period):{" "}
                    {result.excluded.join(", ")} — remaining weights
                    renormalized.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-xs text-muted">
                None of your current holdings has data covering this window.
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- 2+3. Optimizer & risk contribution ---------------- */

function Optimizer({ data, weights, setWeights, stats }) {
  const selected = data.assets.filter((a) => (weights[a.ticker] || 0) > 0);
  const [applied, setApplied] = useState(null);

  const { suggestions, rc } = useMemo(() => {
    if (selected.length < 2) return { suggestions: null, rc: null };
    const tickers = selected.map((a) => a.ticker);
    const series = selected.map((a) => monthlyReturns(a.prices));
    const { maxSharpe, minVol } = efficientFrontier(series);
    const cov = covarianceMatrix(series);
    const parity = riskParityWeights(cov);
    const fracs = tickers.map((t) => weights[t] / selected.reduce((s, a) => s + weights[a.ticker], 0));
    const contributions = riskContributions(fracs, cov);
    return {
      suggestions: {
        maxSharpe: { label: "Max Sharpe", desc: "best historical return per unit of risk", w: toPercentWeights(maxSharpe.weights, tickers), vol: maxSharpe.vol, ret: maxSharpe.ret },
        minVol: { label: "Min volatility", desc: "the calmest possible mix of your assets", w: toPercentWeights(minVol.weights, tickers), vol: minVol.vol, ret: minVol.ret },
        parity: { label: "Risk parity", desc: "every asset contributes equal risk", w: toPercentWeights(parity, tickers) },
      },
      rc: selected.map((a, i) => ({
        name: a.name,
        contribution: +(contributions[i] * 100).toFixed(1),
        weight: +(fracs[i] * 100).toFixed(0),
      })),
    };
  }, [data, weights]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!suggestions) {
    return (
      <Card title="Portfolio optimizer">
        <p className="text-sm text-muted">Add at least two assets to optimize.</p>
      </Card>
    );
  }

  const apply = (key) => {
    setWeights({ ...suggestions[key].w });
    setApplied(key);
    setTimeout(() => setApplied(null), 2000);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card
        title="Portfolio optimizer (Markowitz)"
        sub="Mean-variance optimization over your selected assets — 3,000 sampled long-only weightings, best pick per objective. Applying moves your green dot onto the efficient frontier above."
      >
        <div className="space-y-3">
          {["maxSharpe", "minVol", "parity"].map((key) => {
            const s = suggestions[key];
            return (
              <div key={key} className="glass2 flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="truncate text-[11px] text-muted">
                    {s.desc}
                    {s.vol !== undefined && ` · ${pct(s.ret)} return @ ${pct(s.vol)} vol`}
                  </p>
                  <p className="mt-1 truncate text-[11px] tabular-nums text-muted">
                    {Object.entries(s.w).map(([t, w]) => `${t} ${w}%`).join(" · ")}
                  </p>
                </div>
                <button
                  onClick={() => apply(key)}
                  className={`min-h-[44px] shrink-0 rounded-xl px-4 text-sm font-semibold transition ${
                    applied === key
                      ? "bg-green/25 text-green"
                      : "bg-green/15 text-green hover:bg-green/25"
                  }`}
                >
                  {applied === key ? "✓ Applied" : "Apply"}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Optimized on 10 years of history — past optimality does not guarantee
          future optimality.
        </p>
      </Card>

      <Card
        title="Risk contribution"
        sub="Share of total portfolio risk each holding is responsible for (from the covariance matrix of monthly returns) — often very different from its weight."
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rc} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="#26262b" strokeDasharray="3 6" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} axisLine={{ stroke: "#26262b" }} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fontSize: 10 }} width={92} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v, name) => [`${v}%`, name === "contribution" ? "Risk contribution" : "Weight"]}
                cursor={{ fill: "#16161b" }}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="weight" fill="#26262b" radius={[0, 4, 4, 0]} barSize={8} />
              <Bar dataKey="contribution" radius={[0, 4, 4, 0]} barSize={8}>
                {rc.map((d, i) => (
                  <Cell key={i} fill={d.contribution > d.weight * 1.5 ? "#fb7185" : "#e5b567"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-line" /> weight</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-gold" /> risk share</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-red" /> risk share ≫ weight</span>
        </p>
      </Card>
    </div>
  );
}

/* ---------------- 4. VaR / CVaR ---------------- */

function VarCards({ stats }) {
  const { var: v, cvar } = useMemo(() => historicalVaR(stats.returns), [stats]);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card title="Value at Risk (95%, monthly)">
        <p className="text-2xl font-bold tabular-nums text-red">
          {pct(v)} · {chf(v * 10000)}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          In 95% of historical months, a CHF 10’000 position in this portfolio
          lost no more than this — put differently, a loss this size or worse
          happened about once every 20 months.
        </p>
      </Card>
      <Card title="CVaR / Expected Shortfall (95%)">
        <p className="text-2xl font-bold tabular-nums text-red">
          {pct(cvar)} · {chf(cvar * 10000)}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          When one of those worst-5% months did happen, this was the average
          loss — the “how bad is bad” number risk desks actually watch.
        </p>
      </Card>
    </div>
  );
}

/* ---------------- 5. Rolling metrics ---------------- */

const ROLLING_VIEWS = [
  { key: "ret", label: "12-mo return", color: "#34d399", fmt: (v) => pct(v) },
  { key: "vol", label: "12-mo volatility", color: "#e5b567", fmt: (v) => pct(v) },
  { key: "sharpe", label: "12-mo Sharpe", color: "#60a5fa", fmt: (v) => v.toFixed(2) },
];

function Rolling({ data, stats }) {
  const [view, setView] = useState("ret");
  const rolling = useMemo(
    () => rollingMetrics(stats.returns, data.months),
    [stats, data]
  );
  const active = ROLLING_VIEWS.find((r) => r.key === view);

  return (
    <Card
      title="Rolling 12-month metrics"
      sub="The portfolio's character over time — every point summarizes the preceding 12 months."
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {ROLLING_VIEWS.map((r) => (
          <button
            key={r.key}
            onClick={() => setView(r.key)}
            className={`min-h-[36px] rounded-full border px-3 text-xs font-semibold transition ${
              view === r.key
                ? "border-green/50 bg-green/15 text-green"
                : "border-line bg-panel2/80 text-muted hover:text-text"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rolling.map((r) => ({ month: r.month, v: +(view === "sharpe" ? r[view] : r[view] * 100).toFixed(2) }))}
            margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
          >
            <CartesianGrid stroke="#26262b" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="month" tick={AXIS_TICK} tickFormatter={(m) => m.slice(0, 4)} interval={23} axisLine={{ stroke: "#26262b" }} tickLine={false} />
            <YAxis tick={AXIS_TICK} tickFormatter={(v) => (view === "sharpe" ? v : `${v}%`)} axisLine={false} tickLine={false} width={44} />
            <ReferenceLine y={0} stroke="#26262b" />
            <Tooltip
              formatter={(v) => [view === "sharpe" ? v : `${v}%`, active.label]}
              labelStyle={{ color: "#8b909b" }}
              contentStyle={TOOLTIP_STYLE}
            />
            <Line type="monotone" dataKey="v" stroke={active.color} strokeWidth={2} dot={false} animationDuration={400} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------------- 6. Beta & rebalancing ---------------- */

function BetaRebalancing({ data, stats }) {
  const [bench, setBench] = useState("URTH");
  const analysis = useMemo(() => {
    const b = data.assets.find((a) => a.ticker === bench);
    const beta = betaVsBenchmark(stats.returns, monthlyReturns(b.prices));
    const fracs = stats.fractions;
    const bh = buyAndHoldValue(data.assets, fracs, 10000);
    const reb = stats.values;
    return {
      beta,
      benchName: b.name,
      rebEnd: reb[reb.length - 1],
      bhEnd: bh[bh.length - 1],
      rebCagr: cagr(reb),
      bhCagr: cagr(bh),
    };
  }, [data, stats, bench]);
  const bonus = analysis.rebEnd - analysis.bhEnd;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card title="Portfolio beta">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-3xl font-bold tabular-nums">
            {analysis.beta.toFixed(2)}
          </p>
          <select
            value={bench}
            onChange={(e) => setBench(e.target.value)}
            aria-label="Beta benchmark"
            className="glass2 min-h-[36px] px-2.5 py-1 text-xs font-semibold text-muted outline-none"
          >
            <option value="URTH">vs. MSCI World</option>
            <option value="^SSMI">vs. SMI</option>
            <option value="SPY">vs. S&P 500</option>
          </select>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          When {analysis.benchName} moves 1%, your portfolio historically moved
          about {analysis.beta.toFixed(2)}% in the same direction. Below 1 =
          less market-sensitive than the benchmark, above 1 = more.
        </p>
      </Card>
      <Card title="Rebalancing effect">
        <p className="text-3xl font-bold tabular-nums">
          <span className={bonus >= 0 ? "text-green" : "text-red"}>
            {bonus >= 0 ? "+" : ""}
            {chf(bonus)}
          </span>
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Monthly rebalancing ended at {chf(analysis.rebEnd)} (
          {pct(analysis.rebCagr)} p.a.) vs. buy-and-hold at{" "}
          {chf(analysis.bhEnd)} ({pct(analysis.bhCagr)} p.a.) over 10 years —
          rebalancing {bonus >= 0 ? "added a bonus" : "was a drag"} for this
          mix. (Buy-and-hold lets winners grow into bigger weights.)
        </p>
      </Card>
    </div>
  );
}

/* ---------------- 7. Exposure breakdown ---------------- */

const EXPOSURE_COLORS = ["#34d399", "#e5b567", "#60a5fa", "#fb7185", "#a78bfa", "#2dd4bf"];

function ExposureBar({ title, groups }) {
  const total = groups.reduce((s, g) => s + g.value, 0);
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
      </p>
      <div className="flex h-7 w-full overflow-hidden rounded-lg">
        {groups.map((g, i) => (
          <div
            key={g.name}
            title={`${g.name}: ${Math.round((g.value / total) * 100)}%`}
            style={{ width: `${(g.value / total) * 100}%`, background: EXPOSURE_COLORS[i % EXPOSURE_COLORS.length] }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {groups.map((g, i) => (
          <span key={g.name} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: EXPOSURE_COLORS[i % EXPOSURE_COLORS.length] }} />
            {g.name} <span className="font-semibold tabular-nums text-text">{Math.round((g.value / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Exposure({ data, weights }) {
  const dims = useMemo(() => {
    const selected = data.assets.filter((a) => (weights[a.ticker] || 0) > 0);
    const group = (key) => {
      const map = new Map();
      for (const a of selected) {
        map.set(a[key], (map.get(a[key]) || 0) + weights[a.ticker]);
      }
      return [...map.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };
    return {
      region: group("region"),
      assetClass: group("assetClass"),
      sector: group("sector"),
    };
  }, [data, weights]);

  return (
    <Card
      title="Exposure breakdown"
      sub="Where your money actually sits, across three lenses."
    >
      <div className="space-y-5">
        <ExposureBar title="Region" groups={dims.region} />
        <ExposureBar title="Asset class" groups={dims.assetClass} />
        <ExposureBar title="Sector" groups={dims.sector} />
      </div>
    </Card>
  );
}

/* ---------------- Section ---------------- */

export default function ProAnalytics({ data, stats, weights, setWeights }) {
  return (
    <section className="mt-10">
      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Risk Desk
        </h2>
        <p className="mt-1 text-sm text-muted">
          Professional-grade risk analytics for your portfolio — stress tests,
          optimization, and risk decomposition, all from real history.
        </p>
      </div>
      <div className="space-y-6">
        <StressTests data={data} weights={weights} />
        <Optimizer data={data} weights={weights} setWeights={setWeights} stats={stats} />
        <VarCards stats={stats} />
        <div className="grid gap-6 xl:grid-cols-2">
          <Rolling data={data} stats={stats} />
          <Exposure data={data} weights={weights} />
        </div>
        <BetaRebalancing data={data} stats={stats} />
      </div>
    </section>
  );
}
