"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import PortfolioBuilder from "./PortfolioBuilder";
import Dashboard from "./Dashboard";
import SavingsSimulator from "./SavingsSimulator";
import QuantLab from "./QuantLab";
import AssetDetail from "./AssetDetail";
import {
  portfolioReturns,
  cumulativeValue,
  cagr,
  annualizedVolatility,
  maxDrawdown,
  yearlyReturns,
  diversificationScore,
} from "../lib/finance";

const DEFAULT_WEIGHTS = {
  URTH: 40,
  "^SSMI": 25,
  AGG: 20,
  GLD: 10,
  "BTC-USD": 5,
};

export const PRESETS = [
  {
    name: "Conservative",
    desc: "Capital preservation first — half bonds, broad equities, some gold.",
    weights: { AGG: 50, URTH: 25, "^SSMI": 15, GLD: 10 },
  },
  {
    name: "Balanced",
    desc: "The classic middle ground: global equities, Swiss core, bonds, gold, a dash of crypto.",
    weights: DEFAULT_WEIGHTS,
  },
  {
    name: "Aggressive",
    desc: "Growth-maximizing: tech-heavy equities, emerging markets and Bitcoin.",
    weights: { QQQ: 40, URTH: 30, EEM: 15, "BTC-USD": 15 },
  },
  {
    name: "All-Swiss",
    desc: "Home bias on purpose — SMI plus the three Swiss blue chips.",
    weights: { "^SSMI": 40, "NESN.SW": 20, "NOVN.SW": 20, "UBSG.SW": 20 },
  },
  {
    name: "Bogleheads 3-Fund",
    desc: "The famous simple mix: world equities, emerging markets, bonds.",
    weights: { URTH: 50, EEM: 20, AGG: 30 },
  },
  {
    name: "Permanent Portfolio",
    desc: "Harry Browne's all-weather idea, adapted: equities, gold, and bonds standing in for cash.",
    weights: { SPY: 25, GLD: 25, AGG: 50 },
  },
];

const RISK_FREE_RATE = 0.005; // ~Swiss risk-free rate assumption

export default function App({ data }) {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS); // percentages
  const [detailTicker, setDetailTicker] = useState(null);

  const totalPct = Object.values(weights).reduce((s, w) => s + w, 0);

  // Fractions for the math; only meaningful when total is 100.
  const stats = useMemo(() => {
    if (totalPct === 0) return null;
    const fractions = {};
    for (const [t, w] of Object.entries(weights)) fractions[t] = w / totalPct;
    const returns = portfolioReturns(data.assets, fractions);
    const values = cumulativeValue(returns, 10000);
    const years = yearlyReturns(returns, data.months);
    const fullYears = years.filter((y) => y.year !== data.months.at(-1).slice(0, 4));
    const best = fullYears.reduce((a, b) => (b.ret > a.ret ? b : a), fullYears[0]);
    const worst = fullYears.reduce((a, b) => (b.ret < a.ret ? b : a), fullYears[0]);
    const c = cagr(values);
    const vol = annualizedVolatility(returns);
    return {
      returns,
      values,
      cagr: c,
      vol,
      mdd: maxDrawdown(values),
      sharpe: vol > 0 ? (c - RISK_FREE_RATE) / vol : 0,
      best,
      worst,
      years: fullYears,
      divScore: diversificationScore(fractions),
      fractions,
    };
  }, [weights, totalPct, data]);

  const detailAsset = detailTicker
    ? data.assets.find((a) => a.ticker === detailTicker)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between py-6 sm:py-8">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <div>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              CHF Compass
            </h1>
            <p className="text-xs text-muted">
              Swiss portfolio &amp; savings simulator
            </p>
          </div>
        </div>
        <span className="glass2 hidden px-3 py-1.5 text-xs text-muted sm:block">
          Real market data · {data.months[0]} – {data.months.at(-1)}
        </span>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10 pt-4 sm:mb-14 sm:pt-8"
      >
        <h2 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Build a portfolio.{" "}
          <span className="text-green">Backtest 10 years.</span> See what your
          savings could become.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          An interactive investment dashboard in Swiss francs, powered by real
          monthly market data. Pick your assets, watch the metrics update live,
          and compare a savings plan against a typical Swiss savings account.
        </p>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <PortfolioBuilder
          assets={data.assets}
          weights={weights}
          setWeights={setWeights}
          totalPct={totalPct}
          onSelectAsset={setDetailTicker}
          presets={PRESETS}
        />
        <Dashboard
          data={data}
          stats={stats}
          weights={weights}
          totalPct={totalPct}
        />
      </div>

      {stats && <QuantLab data={data} stats={stats} weights={weights} />}

      <SavingsSimulator
        backtestedReturn={stats ? stats.cagr : 0.05}
        historicalReturns={stats ? stats.returns : []}
      />

      {detailAsset && (
        <AssetDetail
          asset={detailAsset}
          months={data.months}
          onClose={() => setDetailTicker(null)}
        />
      )}

      <footer className="mt-16 border-t border-line pt-6 text-xs leading-relaxed text-muted">
        <p>
          CHF Compass is a portfolio project, not financial advice. Historical
          performance does not predict future returns. Data: Yahoo Finance,
          monthly adjusted close, USD assets converted to CHF.
        </p>
      </footer>
    </div>
  );
}
