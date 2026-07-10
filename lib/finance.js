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
