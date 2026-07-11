/**
 * CHF Compass — data pipeline.
 *
 * Fetches ~15y of monthly adjusted-close prices for every asset in the
 * universe from the Yahoo Finance chart API, converts USD-priced assets to
 * CHF using the USDCHF=X series, aligns everything to a common monthly date
 * range, and writes the result to data/assets.json (committed, so the app
 * never makes a runtime API call).
 *
 * Run once: node scripts/fetch-data.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const UNIVERSE = [
  { ticker: "URTH",    name: "MSCI World",       category: "Equities",    currency: "USD", region: "Global",       assetClass: "Equity",    sector: "Diversified" },
  { ticker: "SPY",     name: "S&P 500",          category: "Equities",    currency: "USD", region: "US",           assetClass: "Equity",    sector: "Diversified" },
  { ticker: "QQQ",     name: "Nasdaq 100",       category: "Equities",    currency: "USD", region: "US",           assetClass: "Equity",    sector: "Technology" },
  { ticker: "EEM",     name: "Emerging Markets", category: "Equities",    currency: "USD", region: "Emerging",     assetClass: "Equity",    sector: "Diversified" },
  { ticker: "^SSMI",   name: "SMI (Swiss Market Index)", category: "Switzerland", currency: "CHF", region: "Switzerland", assetClass: "Equity", sector: "Diversified" },
  { ticker: "NESN.SW", name: "Nestlé",           category: "Switzerland", currency: "CHF", region: "Switzerland",  assetClass: "Equity",    sector: "Consumer Staples" },
  { ticker: "NOVN.SW", name: "Novartis",         category: "Switzerland", currency: "CHF", region: "Switzerland",  assetClass: "Equity",    sector: "Healthcare" },
  { ticker: "UBSG.SW", name: "UBS",              category: "Switzerland", currency: "CHF", region: "Switzerland",  assetClass: "Equity",    sector: "Financials" },
  { ticker: "AGG",     name: "US Aggregate Bonds", category: "Bonds",     currency: "USD", region: "US",           assetClass: "Bonds",     sector: "Fixed Income" },
  { ticker: "GLD",     name: "Gold",             category: "Commodities", currency: "USD", region: "Global",       assetClass: "Commodity", sector: "Precious Metals" },
  { ticker: "BTC-USD", name: "Bitcoin",          category: "Crypto",      currency: "USD", region: "Global",       assetClass: "Crypto",    sector: "Digital Assets" },
];

async function fetchChart(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=1mo&range=max`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("no chart result");
  const ts = result.timestamp || [];
  const adj =
    result.indicators?.adjclose?.[0]?.adjclose ||
    result.indicators?.quote?.[0]?.close ||
  [];
  // Map to month key (YYYY-MM) -> price. Keep the last observation per month.
  const byMonth = new Map();
  for (let i = 0; i < ts.length; i++) {
    const p = adj[i];
    if (p == null || !isFinite(p) || p <= 0) continue;
    const d = new Date(ts[i] * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, p);
  }
  if (byMonth.size < 24) throw new Error(`only ${byMonth.size} monthly points`);
  return byMonth;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("Fetching USDCHF=X ...");
  const fx = await fetchChart("USDCHF=X");

  const series = [];
  for (const asset of UNIVERSE) {
    await sleep(400);
    try {
      const prices = await fetchChart(asset.ticker);
      series.push({ ...asset, prices });
      console.log(`OK   ${asset.ticker} (${prices.size} months)`);
    } catch (e) {
      console.warn(`DROP ${asset.ticker}: ${e.message}`);
    }
  }
  if (series.length === 0) throw new Error("no assets fetched");

  // Convert USD assets to CHF. Yahoo's FX series has occasional missing
  // months (e.g. Octobers) — forward-fill from the most recent prior rate.
  const fxMonths = [...fx.keys()].sort();
  const fxAt = (month) => {
    if (fx.has(month)) return fx.get(month);
    let best = null;
    for (const m of fxMonths) {
      if (m < month) best = m;
      else break;
    }
    return best ? fx.get(best) : null;
  };
  for (const s of series) {
    if (s.currency !== "USD") continue;
    const converted = new Map();
    for (const [month, price] of s.prices) {
      const rate = fxAt(month);
      if (rate) converted.set(month, price * rate);
    }
    s.prices = converted;
  }

  // Common date range: months where every asset has a price, limited to ~10y.
  const allMonths = [...series[0].prices.keys()].filter((m) =>
    series.every((s) => s.prices.has(m))
  );
  allMonths.sort();
  const months = allMonths.slice(-121); // 121 price points = 120 monthly returns = 10 years
  console.log(`Common range: ${months[0]} .. ${months[months.length - 1]} (${months.length} points)`);

  const out = {
    generatedAt: new Date().toISOString(),
    baseCurrency: "CHF",
    months,
    // USDCHF rate per common month (forward-filled) — lets the app recover
    // local-currency (USD) returns for the hedged-vs-unhedged view.
    fx: months.map((m) => +fxAt(m).toFixed(6)),
    assets: series.map((s) => {
      // Full available CHF history (for stress tests over older crises).
      const histMonths = [...s.prices.keys()].sort();
      return {
        ticker: s.ticker,
        name: s.name,
        category: s.category,
        region: s.region,
        assetClass: s.assetClass,
        sector: s.sector,
        nativeCurrency: s.currency,
        prices: months.map((m) => +s.prices.get(m).toFixed(4)),
        history: {
          months: histMonths,
          prices: histMonths.map((m) => +s.prices.get(m).toFixed(4)),
        },
      };
    }),
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(join(ROOT, "data", "assets.json"), JSON.stringify(out));
  console.log(`Wrote data/assets.json with ${out.assets.length} assets.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
