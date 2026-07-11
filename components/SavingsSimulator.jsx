"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  savingsProjection,
  monteCarloProjection,
  chf,
  pct,
} from "../lib/finance";

const SAVINGS_RATE = 0.005; // typical Swiss savings account / pillar-3a cash rate
const DEFAULT_INFLATION = 1.0; // % p.a., long-run Swiss average assumption
const DEFAULT_TER = 0.2; // % p.a., typical low-cost index ETF fee

function NumberInput({ label, value, onChange, min, max, step, suffix }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <div className="glass2 flex items-center px-3">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(+e.target.value)}
          className="min-h-[44px] w-full bg-transparent text-sm font-semibold tabular-nums outline-none"
        />
        {suffix && <span className="ml-1 shrink-0 text-xs text-muted">{suffix}</span>}
      </div>
    </label>
  );
}

export default function SavingsSimulator({ backtestedReturn, historicalReturns }) {
  const [initial, setInitial] = useState(10000);
  const [monthly, setMonthly] = useState(500);
  const [years, setYears] = useState(20);
  const [annualReturn, setAnnualReturn] = useState(
    +(backtestedReturn * 100).toFixed(1)
  );
  const [touched, setTouched] = useState(false);
  const [ter, setTer] = useState(DEFAULT_TER);
  const [realMode, setRealMode] = useState(false);
  const [inflation, setInflation] = useState(DEFAULT_INFLATION);

  // Follow the portfolio's backtested return until the user edits the field.
  useEffect(() => {
    if (!touched) setAnnualReturn(+(backtestedReturn * 100).toFixed(1));
  }, [backtestedReturn, touched]);

  const { points, savingsPoints, mc, feeCost } = useMemo(() => {
    const safeYears = Math.min(50, Math.max(1, years || 1));
    const gross = (annualReturn || 0) / 100;
    const net = gross - Math.max(0, ter || 0) / 100; // return after fund fees
    // Deflate to today's purchasing power when the inflation toggle is on.
    const defl = realMode
      ? (p) => {
          const f = Math.pow(1 + Math.max(0, inflation || 0) / 100, -p.year);
          const out = {};
          for (const k of Object.keys(p)) {
            out[k] = k === "year" ? p.year : Math.round(p[k] * f);
          }
          return out;
        }
      : (p) => p;
    const grossPoints = savingsProjection(initial || 0, monthly || 0, safeYears, gross);
    const netPoints = savingsProjection(initial || 0, monthly || 0, safeYears, net);
    const mcRaw =
      historicalReturns && historicalReturns.length > 0
        ? monteCarloProjection(initial || 0, monthly || 0, safeYears, historicalReturns)
        : null;
    return {
      points: netPoints.map(defl),
      savingsPoints: savingsProjection(initial || 0, monthly || 0, safeYears, SAVINGS_RATE).map(defl),
      mc: mcRaw ? mcRaw.map(defl) : null,
      feeCost:
        grossPoints[grossPoints.length - 1].value -
        netPoints[netPoints.length - 1].value,
    };
  }, [initial, monthly, years, annualReturn, ter, realMode, inflation, historicalReturns]);

  const final = points[points.length - 1];
  const savingsFinal = savingsPoints[savingsPoints.length - 1];
  const difference = final.value - savingsFinal.value;

  const chartData = points.map((p, i) => ({
    year: p.year,
    contributed: p.contributed,
    gains: Math.max(0, p.gains),
    savings: savingsPoints[i]?.value,
  }));

  return (
    <section className="mt-10">
      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Savings-Plan Simulator
        </h2>
        <p className="mt-1 text-sm text-muted">
          What happens if you invest every month instead of leaving it in the
          bank?
        </p>
      </div>

      <div className="glass p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberInput label="Initial amount" value={initial} onChange={setInitial} min={0} step={1000} suffix="CHF" />
          <NumberInput label="Monthly contribution" value={monthly} onChange={setMonthly} min={0} step={50} suffix="CHF" />
          <NumberInput label="Years" value={years} onChange={setYears} min={1} max={50} step={1} suffix="yrs" />
          <NumberInput
            label="Expected return"
            value={annualReturn}
            onChange={(v) => {
              setTouched(true);
              setAnnualReturn(v);
            }}
            min={-10}
            max={30}
            step={0.5}
            suffix="% p.a."
          />
        </div>
        <div className="mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
          <NumberInput
            label="Fund fee (TER)"
            value={ter}
            onChange={setTer}
            min={0}
            max={3}
            step={0.05}
            suffix="% p.a."
          />
          <NumberInput
            label="Inflation"
            value={inflation}
            onChange={setInflation}
            min={0}
            max={5}
            step={0.1}
            suffix="% p.a."
          />
          <button
            onClick={() => setRealMode((v) => !v)}
            aria-pressed={realMode}
            className={`col-span-2 flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
              realMode
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-line bg-panel2/80 text-muted hover:text-text"
            }`}
          >
            <span
              className={`h-4 w-7 rounded-full p-0.5 transition ${
                realMode ? "bg-gold/60" : "bg-line"
              }`}
            >
              <span
                className={`block h-3 w-3 rounded-full bg-text transition ${
                  realMode ? "translate-x-3" : ""
                }`}
              />
            </span>
            {realMode ? "Real (today’s purchasing power)" : "Nominal values"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Expected return defaults to your portfolio’s backtested 10-year CAGR
          — edit it to explore other scenarios. Returns are shown net of the
          fund fee{realMode ? " and adjusted for inflation" : ""}.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="glass2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Projected value (invested)
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-green">
              {chf(final.value)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {chf(final.contributed)} contributed · {chf(final.gains)} gains
            </p>
          </div>
          <div className="glass2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Swiss savings account @ {pct(SAVINGS_RATE)}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {chf(savingsFinal.value)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              typical savings / pillar-3a cash rate
            </p>
          </div>
          <motion.div
            key={difference}
            initial={{ scale: 0.97, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`rounded-xl border p-4 ${
              difference >= 0
                ? "border-green/40 bg-green/10"
                : "border-red/40 bg-red/10"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Difference after {Math.min(50, Math.max(1, years || 1))} years
            </p>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums ${
                difference >= 0 ? "text-green" : "text-red"
              }`}
            >
              {difference >= 0 ? "+" : ""}
              {chf(difference)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {difference >= 0
                ? "the cost of leaving money in the bank"
                : "investing would have lost vs. the bank"}
            </p>
          </motion.div>
        </div>

        {feeCost > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            <span className="font-semibold text-gold">
              Fees matter: a {ter}% TER costs you {chf(feeCost)}
            </span>{" "}
            in lost compounding over {Math.min(50, Math.max(1, years || 1))}{" "}
            years compared to investing fee-free.
            {realMode &&
              ` All figures are in today’s purchasing power (${inflation}% inflation).`}
          </p>
        )}

        <div className="mt-6 h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="gGains" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gContrib" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e5b567" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#e5b567" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#26262b" strokeDasharray="3 6" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: "#8b909b", fontSize: 11 }}
                tickFormatter={(y) => `${y}y`}
                axisLine={{ stroke: "#26262b" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#8b909b", fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${Math.round(v / 1000)}k`
                }
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                formatter={(v, name) => [
                  chf(v),
                  name === "contributed"
                    ? "Contributed"
                    : name === "gains"
                    ? "Investment gains"
                    : "Savings account",
                ]}
                labelFormatter={(y) => `Year ${y}`}
                contentStyle={{
                  background: "#16161b",
                  border: "1px solid #26262b",
                  borderRadius: 12,
                  color: "#e6e8ec",
                }}
              />
              <Area
                type="monotone"
                dataKey="contributed"
                stackId="1"
                stroke="#e5b567"
                strokeWidth={1.5}
                fill="url(#gContrib)"
              />
              <Area
                type="monotone"
                dataKey="gains"
                stackId="1"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#gGains)"
              />
              <Area
                type="monotone"
                dataKey="savings"
                stroke="#8b909b"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-gold" /> Contributed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-green" /> Investment gains
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-muted" />{" "}
            Savings account @ {pct(SAVINGS_RATE)}
          </span>
        </div>
      </div>

      {mc && (
        <div className="glass mt-6 p-5 sm:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Monte Carlo — 1,000 simulated futures
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Instead of assuming one smooth return, we replay 1,000 possible
            futures by randomly resampling your portfolio&apos;s real
            historical monthly returns (bootstrap). The band shows where 80%
            of outcomes land.
          </p>

          <div className="mt-4 rounded-xl border border-green/40 bg-green/10 p-4">
            <p className="text-sm leading-relaxed">
              <span className="font-bold text-green">
                90% of simulations end with at least{" "}
                {chf(mc[mc.length - 1].p10)}
              </span>
              <span className="text-muted">
                {" "}
                · median outcome {chf(mc[mc.length - 1].p50)} · best 10% reach{" "}
                {chf(mc[mc.length - 1].p90)}+
              </span>
            </p>
          </div>

          <div className="mt-5 h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={mc.map((p) => ({ ...p, band: [p.p10, p.p90] }))}
                margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
              >
                <defs>
                  <linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#26262b" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "#8b909b", fontSize: 11 }}
                  tickFormatter={(y) => `${y}y`}
                  axisLine={{ stroke: "#26262b" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#8b909b", fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${Math.round(v / 1000)}k`
                  }
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(v, name) =>
                    name === "band"
                      ? [`${chf(v[0])} – ${chf(v[1])}`, "p10 – p90 range"]
                      : [chf(v), "Median (p50)"]
                  }
                  labelFormatter={(y) => `Year ${y}`}
                  contentStyle={{
                    background: "#16161b",
                    border: "1px solid #26262b",
                    borderRadius: 12,
                    color: "#e6e8ec",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="band"
                  stroke="none"
                  fill="url(#gBand)"
                  animationDuration={500}
                />
                <Area
                  type="monotone"
                  dataKey="p50"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="none"
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-green" /> Median path (p50)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-green/25" /> 80% of
              outcomes (p10–p90)
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
