"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import PortfolioBuilder from "./PortfolioBuilder";
import Dashboard from "./Dashboard";
import SavingsSimulator from "./SavingsSimulator";
import PrintReport from "./PrintReport";
import { encodeWeights, decodeWeights, updateUrlParams } from "../lib/urlState";
import {
  portfolioReturns,
  cumulativeValue,
  cagr,
  annualizedVolatility,
  maxDrawdown,
  yearlyReturns,
  diversificationScore,
  pct,
} from "../lib/finance";

const SectionSkeleton = () => (
  <div className="glass mt-10 h-64 animate-pulse" aria-hidden="true" />
);
const QuantLab = dynamic(() => import("./QuantLab"), { loading: SectionSkeleton });
const ProAnalytics = dynamic(() => import("./ProAnalytics"), { loading: SectionSkeleton });
const SwissPlanning = dynamic(() => import("./SwissPlanning"), { loading: SectionSkeleton });
const Pillar3a = dynamic(() => import("./Pillar3a"), { loading: SectionSkeleton });
const AssetDetail = dynamic(() => import("./AssetDetail"));

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

const TABS = [
  { id: "overview", label: "Overview", blurb: "Build & backtest" },
  { id: "analytics", label: "Analytics", blurb: "Risk & quant" },
  { id: "planning", label: "Planning", blurb: "Swiss life & taxes" },
  { id: "simulator", label: "Simulator", blurb: "Savings & compounding" },
];

export default function App({ data }) {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS); // percentages
  const [detailTicker, setDetailTicker] = useState(null);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState("overview");

  // Restore shared state from the URL (after mount, to avoid hydration
  // mismatches), then keep the URL in sync.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = decodeWeights(
      params.get("w"),
      data.assets.map((a) => a.ticker)
    );
    if (fromUrl) setWeights(fromUrl);
    const urlTab = params.get("tab");
    if (TABS.some((t) => t.id === urlTab)) setTab(urlTab);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated) updateUrlParams({ w: encodeWeights(weights) });
  }, [weights, hydrated]);

  const switchTab = (id) => {
    setTab(id);
    updateUrlParams({ tab: id === "overview" ? null : id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — fallback.
      const ta = document.createElement("textarea");
      ta.value = window.location.href;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const totalPct = Object.values(weights).reduce((s, w) => s + w, 0);

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

  const holdingsSummary = Object.entries(weights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([t, w]) => `${data.assets.find((a) => a.ticker === t)?.name || t} ${w}%`)
    .join(" · ");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-3 py-5">
        <button
          onClick={() => switchTab("overview")}
          className="flex items-center gap-3 text-left"
          aria-label="CHF Compass home"
        >
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <div>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              CHF Compass
            </h1>
            <p className="hidden text-xs text-muted sm:block">
              Swiss portfolio &amp; financial planning
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className={`glass2 flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold transition ${
              copied ? "text-green" : "text-muted hover:text-text"
            }`}
            aria-label="Copy a shareable link to this portfolio"
          >
            {copied ? "✓ Copied!" : "Copy link"}
          </button>
          <button
            onClick={() => window.print()}
            className="glass2 hidden min-h-[44px] items-center px-3 text-xs font-semibold text-muted transition hover:text-text sm:flex"
            aria-label="Print a one-page portfolio report"
          >
            Report
          </button>
        </div>
      </header>

      {/* Sticky section navigation */}
      <nav
        aria-label="Sections"
        className="sticky top-0 z-40 -mx-4 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <div className="flex gap-1.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`min-h-[44px] shrink-0 rounded-xl px-4 text-sm font-semibold transition ${
                tab === t.id
                  ? "bg-green/15 text-green"
                  : "text-muted hover:bg-panel2 hover:text-text"
              }`}
            >
              {t.label}
              <span className="ml-2 hidden text-[11px] font-normal text-muted lg:inline">
                {t.blurb}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Portfolio context strip on non-overview tabs */}
      {tab !== "overview" && stats && (
        <div className="glass2 mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-xs">
          <span className="min-w-0 flex-1 truncate text-muted" title={holdingsSummary}>
            <span className="font-semibold text-text">Your portfolio:</span>{" "}
            {holdingsSummary}
          </span>
          <span className="shrink-0 tabular-nums">
            <span className="text-green">{pct(stats.cagr)}</span>
            <span className="text-muted"> return · </span>
            <span className="text-text">{pct(stats.vol)}</span>
            <span className="text-muted"> vol</span>
          </span>
          <button
            onClick={() => switchTab("overview")}
            className="min-h-[32px] shrink-0 rounded-lg bg-green/15 px-2.5 text-xs font-semibold text-green transition hover:bg-green/25"
          >
            Edit
          </button>
        </div>
      )}

      {/* Entrance-only animation — never gate tab content behind an exit
          animation: rAF pauses in background tabs, which would leave the
          previous tab stuck on screen. */}
      <motion.main
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
          {tab === "overview" && (
            <>
              <section className="mb-8 pt-8 sm:mb-10 sm:pt-12">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                  Real data · 10-year backtests · Swiss francs
                </p>
                <h2 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                  Build a portfolio, see its{" "}
                  <span className="text-green">real risk and returns</span> —
                  and plan your Swiss financial future.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                  Pick from 11 real assets and watch a decade of market history
                  judge your mix — then stress-test it, optimize it, and turn it
                  into a savings, retirement and tax plan. No made-up numbers.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => switchTab("analytics")}
                    className="min-h-[44px] rounded-xl bg-green/15 px-5 text-sm font-semibold text-green transition hover:bg-green/25"
                  >
                    Explore the Risk Desk →
                  </button>
                  <button
                    onClick={() => switchTab("simulator")}
                    className="glass2 min-h-[44px] px-5 text-sm font-semibold text-muted transition hover:text-text"
                  >
                    Simulate a savings plan
                  </button>
                </div>
              </section>

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
            </>
          )}

          {tab === "analytics" && stats && (
            <>
              <QuantLab data={data} stats={stats} weights={weights} />
              <ProAnalytics
                data={data}
                stats={stats}
                weights={weights}
                setWeights={setWeights}
              />
            </>
          )}

          {tab === "planning" && stats && (
            <>
              <Pillar3a backtestedReturn={stats.cagr} />
              <SwissPlanning data={data} stats={stats} weights={weights} />
            </>
          )}

          {tab === "simulator" && (
            <SavingsSimulator
              backtestedReturn={stats ? stats.cagr : 0.05}
              historicalReturns={stats ? stats.returns : []}
            />
          )}

          {tab !== "overview" && !stats && tab !== "simulator" && (
            <div className="glass mt-10 p-8 text-center text-muted">
              Add at least one asset in the Overview tab first.
            </div>
          )}
      </motion.main>

      {detailAsset && (
        <AssetDetail
          asset={detailAsset}
          months={data.months}
          onClose={() => setDetailTicker(null)}
        />
      )}

      <PrintReport
        data={data}
        stats={stats}
        weights={weights}
        totalPct={totalPct}
      />

      <footer className="mt-16 border-t border-line pt-6 text-xs leading-relaxed text-muted">
        <p>
          CHF Compass is a portfolio project, not financial advice. Historical
          performance does not predict future returns. Data: Yahoo Finance,
          monthly adjusted close, USD assets converted to CHF.{" "}
          <Link
            href="/methodology"
            className="underline underline-offset-4 hover:text-text"
          >
            Full methodology &amp; formulas →
          </Link>
        </p>
      </footer>
    </div>
  );
}
