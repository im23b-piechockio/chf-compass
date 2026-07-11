/**
 * Core finance math for CHF Compass.
 * All computations run on real monthly CHF price series from data/assets.json.
 */

/** Monthly return series for one asset: r[t] = p[t] / p[t-1] - 1 */
export function monthlyReturns(prices) {
  const out = [];
  for (let i = 1; i < prices.length; i++) {
    out.push(prices[i] / prices[i - 1] - 1);
  }
  return out;
}

/**
 * Portfolio monthly returns with monthly rebalancing:
 * r_p[t] = sum_i(weight_i * r_i[t]).
 * `weights` is a map ticker -> fraction (must sum to 1).
 */
export function portfolioReturns(assets, weights) {
  const active = assets.filter((a) => (weights[a.ticker] || 0) > 0);
  if (active.length === 0) return [];
  const returnsByAsset = active.map((a) => monthlyReturns(a.prices));
  const n = returnsByAsset[0].length;
  const out = new Array(n).fill(0);
  active.forEach((a, idx) => {
    const w = weights[a.ticker];
    for (let t = 0; t < n; t++) out[t] += w * returnsByAsset[idx][t];
  });
  return out;
}

/** Cumulative value series of `initial` compounded through monthly returns. */
export function cumulativeValue(returns, initial = 10000) {
  const out = [initial];
  let v = initial;
  for (const r of returns) {
    v *= 1 + r;
    out.push(v);
  }
  return out;
}

/** CAGR = (end/start)^(12/months) - 1 */
export function cagr(values) {
  const months = values.length - 1;
  if (months <= 0) return 0;
  return Math.pow(values[values.length - 1] / values[0], 12 / months) - 1;
}

/** Annualized volatility = stdev(monthly returns) * sqrt(12) */
export function annualizedVolatility(returns) {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(12);
}

/** Max drawdown: largest peak-to-trough drop of the cumulative value series. */
export function maxDrawdown(values) {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = v / peak - 1;
    if (dd < mdd) mdd = dd;
  }
  return mdd; // negative number, e.g. -0.32
}

/**
 * Calendar-year returns from monthly returns + aligned month labels
 * ("YYYY-MM", one label per price point; returns start at months[1]).
 * Only full or current partial years present in the data.
 */
export function yearlyReturns(returns, months) {
  const byYear = new Map();
  for (let i = 0; i < returns.length; i++) {
    const year = months[i + 1].slice(0, 4);
    byYear.set(year, (byYear.get(year) ?? 1) * (1 + returns[i]));
  }
  return [...byYear.entries()].map(([year, growth]) => ({
    year,
    ret: growth - 1,
  }));
}

/**
 * Diversification score 0-100 based on concentration (inverse
 * Herfindahl-Hirschman index) and number of holdings.
 * 1 asset -> 0; equal weights across many assets -> high.
 */
export function diversificationScore(weights) {
  const ws = Object.values(weights).filter((w) => w > 0);
  if (ws.length <= 1) return 0;
  const hhi = ws.reduce((s, w) => s + w * w, 0); // 1/n (best) .. 1 (worst)
  const effectiveN = 1 / hhi; // "effective number of holdings"
  // Map effective N of 1 -> 0 and 8+ -> 100 on a log-ish scale.
  const score = ((effectiveN - 1) / 7) * 100;
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Savings plan projection, month-by-month compounding.
 * monthlyRate = (1 + annualReturn)^(1/12) - 1.
 * Contributions are added at the start of each month.
 * Returns one point per year: { year, contributed, value, gains }.
 */
export function savingsProjection(initial, monthly, years, annualReturn) {
  const monthlyRate = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const points = [{ year: 0, contributed: initial, value: initial, gains: 0 }];
  let value = initial;
  let contributed = initial;
  for (let m = 1; m <= years * 12; m++) {
    value = (value + monthly) * (1 + monthlyRate);
    contributed += monthly;
    if (m % 12 === 0) {
      points.push({
        year: m / 12,
        contributed: Math.round(contributed),
        value: Math.round(value),
        gains: Math.round(value - contributed),
      });
    }
  }
  return points;
}

/** Pearson correlation between two equal-length return series. */
export function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const meanA = a.reduce((s, x) => s + x, 0) / n;
  const meanB = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : cov / denom;
}

/** Drawdown series (fraction below running peak, <= 0) from a value series. */
export function drawdownSeries(values) {
  let peak = -Infinity;
  return values.map((v) => {
    if (v > peak) peak = v;
    return v / peak - 1;
  });
}

/** Deterministic PRNG (mulberry32) so simulations are stable across renders. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Monte Carlo savings-plan simulation by bootstrapping historical monthly
 * portfolio returns (sampling with replacement — real data, no distribution
 * assumptions). Returns yearly percentile points:
 * { year, p10, p50, p90 } plus `finalP10/50/90`.
 */
export function monteCarloProjection(
  initial,
  monthly,
  years,
  historicalMonthlyReturns,
  nPaths = 1000,
  seed = 42
) {
  const rand = mulberry32(seed);
  const months = years * 12;
  const hist = historicalMonthlyReturns;
  if (!hist || hist.length === 0) return null;
  // finalValues[y][p] = value of path p at end of year y+1
  const yearly = Array.from({ length: years }, () => new Array(nPaths));
  for (let p = 0; p < nPaths; p++) {
    let value = initial;
    for (let m = 1; m <= months; m++) {
      const r = hist[Math.floor(rand() * hist.length)];
      value = (value + monthly) * (1 + r);
      if (m % 12 === 0) yearly[m / 12 - 1][p] = value;
    }
  }
  const q = (sorted, frac) =>
    sorted[Math.min(sorted.length - 1, Math.floor(frac * sorted.length))];
  const points = [
    { year: 0, p10: initial, p50: initial, p90: initial },
  ];
  for (let y = 0; y < years; y++) {
    const sorted = yearly[y].slice().sort((a, b) => a - b);
    points.push({
      year: y + 1,
      p10: Math.round(q(sorted, 0.1)),
      p50: Math.round(q(sorted, 0.5)),
      p90: Math.round(q(sorted, 0.9)),
    });
  }
  return points;
}

/**
 * Approximate efficient frontier from random long-only portfolios of the
 * given assets. Returns { cloud, frontier } where each point is
 * { vol, ret } (annualized, as fractions). Deterministic via seeded RNG.
 */
export function efficientFrontier(returnSeries, nSamples = 3000, seed = 7) {
  const k = returnSeries.length;
  if (k < 2) return { cloud: [], frontier: [] };
  const rand = mulberry32(seed);
  const n = returnSeries[0].length;
  const cloud = [];
  for (let s = 0; s < nSamples; s++) {
    // Random weights (exponential draws normalized -> uniform on simplex)
    let sum = 0;
    const w = new Array(k);
    for (let i = 0; i < k; i++) {
      w[i] = -Math.log(1 - rand());
      sum += w[i];
    }
    for (let i = 0; i < k; i++) w[i] /= sum;
    const port = new Array(n).fill(0);
    for (let i = 0; i < k; i++) {
      for (let t = 0; t < n; t++) port[t] += w[i] * returnSeries[i][t];
    }
    const values = cumulativeValue(port, 1);
    cloud.push({ vol: annualizedVolatility(port), ret: cagr(values) });
  }
  // Upper hull: bucket by volatility, keep max return, then keep only
  // points where return keeps increasing (efficient part).
  const buckets = new Map();
  for (const p of cloud) {
    const key = Math.round(p.vol * 200); // 0.5%-vol buckets
    if (!buckets.has(key) || buckets.get(key).ret < p.ret) buckets.set(key, p);
  }
  const hull = [...buckets.values()].sort((a, b) => a.vol - b.vol);
  const frontier = [];
  let maxRet = -Infinity;
  for (const p of hull) {
    if (p.ret > maxRet) {
      frontier.push(p);
      maxRet = p.ret;
    }
  }
  return { cloud, frontier };
}

/** Format a number as CHF, e.g. "CHF 12'345". Swiss thousands separator. */
export function chf(n, opts = {}) {
  const rounded = Math.round(n);
  const s = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  return `${rounded < 0 ? "−" : ""}CHF ${s}`;
}

/** Format a fraction as percent, e.g. 0.0834 -> "8.3%". */
export function pct(x, digits = 1) {
  return `${(x * 100).toFixed(digits)}%`;
}
