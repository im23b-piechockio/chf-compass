# CHF Compass 🧭

**Live demo → [chf-compass.vercel.app](https://chf-compass.vercel.app)**

An interactive investment portfolio dashboard and savings-plan simulator in Swiss francs (CHF), built on **real historical market data** — no invented numbers anywhere.

Built as a portfolio flagship project to demonstrate both software engineering and financial thinking.

## What it does

1. **Portfolio Builder** — pick from 11 real assets (MSCI World, S&P 500, Nasdaq 100, SMI, Nestlé, Novartis, UBS, Emerging Markets, US bonds, gold, Bitcoin), grouped by category, and assign weights that must sum to 100% (one-tap normalization).

2. **Live Dashboard** — as you move the sliders, everything recomputes instantly:
   - Allocation donut chart
   - 10-year backtest of CHF 10'000 invested in your exact mix, rebalanced monthly
   - Metric cards: CAGR, annualized volatility, max drawdown, best/worst year, diversification score
   - Plain-English insights (concentration warnings, volatility flags, etc.)

3. **Savings-Plan Simulator** — initial amount + monthly contribution + horizon, defaulting the expected return to your portfolio's backtested CAGR. Shows contributed vs. compound gains as a stacked area chart, and — the Swiss twist — a side-by-side comparison against a **Swiss savings account at 0.5%**, with the CHF difference front and center.

4. **Asset detail views** — click any asset for its own indexed price chart and key stats.

## Data pipeline (demo-proof by design)

`scripts/fetch-data.mjs` fetches 15 years of monthly adjusted-close prices for every ticker plus `USDCHF=X` from the Yahoo Finance chart API, converts all USD-priced assets to CHF, aligns everything to a common monthly range (last ~10 years), and writes the result to **`data/assets.json`, which is committed**. The live app reads only this static bundled file — zero runtime API calls, so the demo can never break on a rate limit.

```bash
npm run fetch-data   # regenerate data/assets.json (optional)
```

## Finance formulas (`lib/finance.js`)

| Metric | Formula |
| --- | --- |
| Monthly return | `p[t] / p[t-1] − 1` |
| Portfolio return | `Σ wᵢ · rᵢ[t]` (rebalanced monthly) |
| CAGR | `(end / start)^(12 / months) − 1` |
| Annualized volatility | `stdev(monthly returns) · √12` |
| Max drawdown | largest peak-to-trough drop of the cumulative value series |
| Diversification score | based on the inverse Herfindahl index (effective number of holdings) |
| Savings projection | month-by-month compounding at `(1 + r)^(1/12) − 1` |

## Tech stack

- **Next.js 15** (App Router) + **React 18**
- **Tailwind CSS** — dark, minimal fintech design system
- **Recharts** — donut, line, and stacked-area charts
- **Framer Motion** — subtle entrance and state animations
- Fully responsive and mobile-optimized (safe-area insets, ≥44px tap targets, no iOS input zoom)

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Disclaimer

CHF Compass is an educational portfolio project, not financial advice. Historical performance does not predict future returns.
