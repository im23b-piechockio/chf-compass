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
export function efficientFrontier(returnSeries, nSamples = 3000, seed = 7, riskFree = 0.005) {
  const k = returnSeries.length;
  if (k < 2) return { cloud: [], frontier: [], maxSharpe: null, minVol: null };
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
    const vol = annualizedVolatility(port);
    const ret = cagr(values);
    cloud.push({ vol, ret, weights: w, sharpe: vol > 0 ? (ret - riskFree) / vol : 0 });
  }
  const maxSharpe = cloud.reduce((a, b) => (b.sharpe > a.sharpe ? b : a), cloud[0]);
  const minVol = cloud.reduce((a, b) => (b.vol < a.vol ? b : a), cloud[0]);
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
  return { cloud, frontier, maxSharpe, minVol };
}

/**
 * Convert a fractional weight vector (aligned to `tickers`) into integer
 * percentages that sum to exactly 100 (largest-remainder rounding).
 */
export function toPercentWeights(weights, tickers) {
  const raw = weights.map((w) => w * 100);
  const floors = raw.map(Math.floor);
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((w, i) => ({ i, frac: w - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (let j = 0; j < order.length && remaining > 0; j++, remaining--) {
    floors[order[j].i] += 1;
  }
  const out = {};
  tickers.forEach((t, i) => {
    if (floors[i] > 0) out[t] = floors[i];
  });
  return out;
}

/** Sample covariance matrix of an array of equal-length return series. */
export function covarianceMatrix(seriesArr) {
  const k = seriesArr.length;
  const n = seriesArr[0]?.length || 0;
  const means = seriesArr.map((s) => s.reduce((a, b) => a + b, 0) / n);
  const cov = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      let c = 0;
      for (let t = 0; t < n; t++) {
        c += (seriesArr[i][t] - means[i]) * (seriesArr[j][t] - means[j]);
      }
      cov[i][j] = cov[j][i] = c / (n - 1);
    }
  }
  return cov;
}

/**
 * Each asset's fractional contribution to total portfolio risk:
 * RC_i = w_i * (Σw)_i / (wᵀΣw). Contributions sum to 1.
 */
export function riskContributions(weights, cov) {
  const k = weights.length;
  const sigmaW = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) sigmaW[i] += cov[i][j] * weights[j];
  }
  const portVar = weights.reduce((s, w, i) => s + w * sigmaW[i], 0);
  if (portVar <= 0) return weights.map(() => 0);
  return weights.map((w, i) => (w * sigmaW[i]) / portVar);
}

/**
 * Risk-parity weights: iterate w_i <- w_i * (1/k / RC_i)^0.5 until risk
 * contributions equalize. Long-only, sums to 1.
 */
export function riskParityWeights(cov, iterations = 200) {
  const k = cov.length;
  let w = cov.map((row, i) => 1 / Math.sqrt(Math.max(row[i], 1e-12)));
  let sum = w.reduce((a, b) => a + b, 0);
  w = w.map((x) => x / sum);
  for (let it = 0; it < iterations; it++) {
    const rc = riskContributions(w, cov);
    w = w.map((x, i) => x * Math.pow(1 / k / Math.max(rc[i], 1e-9), 0.5));
    sum = w.reduce((a, b) => a + b, 0);
    w = w.map((x) => x / sum);
  }
  return w;
}

/**
 * Historical VaR & CVaR at the given confidence level from monthly returns.
 * Returned as positive loss fractions, e.g. { var: 0.052, cvar: 0.078 }.
 */
export function historicalVaR(returns, confidence = 0.95) {
  if (returns.length === 0) return { var: 0, cvar: 0 };
  const sorted = returns.slice().sort((a, b) => a - b);
  const idx = Math.max(0, Math.floor((1 - confidence) * sorted.length) - 0);
  const varReturn = sorted[idx];
  const tail = sorted.slice(0, idx + 1);
  const cvarReturn = tail.reduce((a, b) => a + b, 0) / tail.length;
  return { var: Math.max(0, -varReturn), cvar: Math.max(0, -cvarReturn) };
}

/**
 * Rolling 12-month metrics from monthly returns aligned to `months`
 * (months has one label per price point; returns start at months[1]).
 * Returns [{ month, ret, vol, sharpe }] starting after the first window.
 */
export function rollingMetrics(returns, months, window = 12, riskFree = 0.005) {
  const out = [];
  for (let end = window; end <= returns.length; end++) {
    const slice = returns.slice(end - window, end);
    const ret = slice.reduce((v, r) => v * (1 + r), 1) - 1;
    const vol = annualizedVolatility(slice);
    out.push({
      month: months[end],
      ret,
      vol,
      sharpe: vol > 0 ? (ret - riskFree) / vol : 0,
    });
  }
  return out;
}

/** Portfolio beta vs a benchmark: cov(rp, rb) / var(rb). */
export function betaVsBenchmark(portReturns, benchReturns) {
  const n = Math.min(portReturns.length, benchReturns.length);
  if (n < 2) return 0;
  const mp = portReturns.reduce((a, b) => a + b, 0) / n;
  const mb = benchReturns.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let varB = 0;
  for (let t = 0; t < n; t++) {
    cov += (portReturns[t] - mp) * (benchReturns[t] - mb);
    varB += (benchReturns[t] - mb) ** 2;
  }
  return varB === 0 ? 0 : cov / varB;
}

/**
 * Buy-and-hold value series: initial split by weights at t0, never
 * rebalanced. `assets` need aligned price arrays.
 */
export function buyAndHoldValue(assets, fractions, initial = 10000) {
  const active = assets.filter((a) => (fractions[a.ticker] || 0) > 0);
  if (active.length === 0) return [];
  const n = active[0].prices.length;
  const out = new Array(n).fill(0);
  for (const a of active) {
    const units = (initial * fractions[a.ticker]) / a.prices[0];
    for (let t = 0; t < n; t++) out[t] += units * a.prices[t];
  }
  return out;
}

/**
 * Stress test: apply a crisis window to the current weights using each
 * asset's full history. Assets without complete data for the window are
 * excluded and the remaining weights renormalized.
 * Returns null if fewer than 1 asset covers the window.
 */
export function stressTest(assets, weights, startMonth, endMonth, initial = 10000) {
  const active = assets.filter((a) => (weights[a.ticker] || 0) > 0);
  const covered = [];
  const excluded = [];
  for (const a of active) {
    const si = a.history.months.indexOf(startMonth);
    if (si > 0 && a.history.months.includes(endMonth)) covered.push(a);
    else excluded.push(a);
  }
  if (covered.length === 0) return null;
  const totalW = covered.reduce((s, a) => s + weights[a.ticker], 0);

  // Build the rebalanced portfolio value series from one month before the
  // window start (so the first window month has a return) through the end
  // of available history (to measure recovery).
  const first = covered
    .map((a) => a.history.months.indexOf(startMonth))
    .reduce((a, b) => Math.max(a, b), 0);
  const refMonths = covered[0].history.months;
  const startIdx = refMonths.indexOf(startMonth);
  const endIdx = refMonths.indexOf(endMonth);
  const months = refMonths.slice(startIdx - 1);
  const values = [initial];
  let v = initial;
  for (let t = 1; t < months.length; t++) {
    let r = 0;
    for (const a of covered) {
      const i = a.history.months.indexOf(months[t]);
      if (i <= 0) return null;
      r += (weights[a.ticker] / totalW) * (a.history.prices[i] / a.history.prices[i - 1] - 1);
    }
    v *= 1 + r;
    values.push(v);
  }

  // Loss over the window itself.
  const windowValues = values.slice(0, endIdx - startIdx + 2);
  const windowMonths = months.slice(0, endIdx - startIdx + 2);
  const trough = Math.min(...windowValues);
  const troughIdx = windowValues.indexOf(trough);
  const loss = trough / initial - 1;
  const endLoss = windowValues[windowValues.length - 1] / initial - 1;

  // Recovery: months from the trough until the value regains `initial`.
  let recoveryMonths = null;
  for (let t = troughIdx + 1; t < values.length; t++) {
    if (values[t] >= initial) {
      recoveryMonths = t - troughIdx;
      break;
    }
  }

  return {
    months: windowMonths,
    values: windowValues,
    loss,
    endLoss,
    troughMonth: windowMonths[troughIdx],
    recoveryMonths,
    covered: covered.map((a) => a.ticker),
    excluded: excluded.map((a) => a.ticker),
  };
}

/**
 * Required monthly saving to reach `target` from `initial` in `years` at
 * `annualReturn` (contributions at start of month, like savingsProjection).
 */
export function requiredMonthly(target, initial, years, annualReturn) {
  const i = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const m = years * 12;
  const growth = Math.pow(1 + i, m);
  const fromInitial = initial * growth;
  if (target <= fromInitial) return 0;
  if (i === 0) return (target - fromInitial) / m;
  // Start-of-month contributions: FV = monthly * ((1+i)^m - 1) / i * (1+i)
  return ((target - fromInitial) * i) / ((growth - 1) * (1 + i));
}

/**
 * Bootstrap Monte Carlo final values: `nPaths` end-wealths after `months`
 * months of contributions (negative = withdrawals) with returns resampled
 * from `hist`. Wealth is floored at 0 once depleted.
 */
export function simulateFinalValues(initial, monthly, months, hist, nPaths = 1000, seed = 42) {
  const rand = mulberry32(seed);
  const finals = new Array(nPaths);
  for (let p = 0; p < nPaths; p++) {
    let v = initial;
    for (let m = 0; m < months; m++) {
      if (v <= 0 && monthly <= 0) {
        v = 0;
        break;
      }
      const r = hist[Math.floor(rand() * hist.length)];
      v = (v + monthly) * (1 + r);
      if (v < 0) v = 0;
    }
    finals[p] = v;
  }
  return finals;
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
