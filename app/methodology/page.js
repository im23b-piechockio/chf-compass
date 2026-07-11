import Link from "next/link";
import data from "../../data/assets.json";

export const metadata = {
  title: "Methodology — CHF Compass",
  description:
    "How CHF Compass works: real Yahoo Finance data, CHF conversion, and every formula used for backtests, risk metrics and simulations.",
};

function Formula({ name, formula, note }) {
  return (
    <div className="glass2 p-4">
      <p className="text-sm font-semibold">{name}</p>
      <p className="mt-1 font-mono text-[13px] text-green">{formula}</p>
      {note && <p className="mt-1 text-xs leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

export default function Methodology() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <header className="flex items-center justify-between py-6 sm:py-8">
        <Link href="/" className="flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">CHF Compass</h1>
            <p className="text-xs text-muted">Methodology</p>
          </div>
        </Link>
        <Link
          href="/"
          className="glass2 flex min-h-[44px] items-center px-4 text-sm font-semibold text-muted transition hover:text-text"
        >
          ← Back to app
        </Link>
      </header>

      <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
        How it works
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Every number in CHF Compass is computed from real historical market
        data — nothing is invented. This page documents the data source and
        every formula, so the results can be checked and reproduced.
      </p>

      <h3 className="mt-8 text-lg font-bold">Data</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
        <li>
          Monthly adjusted-close prices for {data.assets.length} assets from
          the Yahoo Finance chart API (dividends included via adjusted close).
        </li>
        <li>
          USD-priced assets are converted to CHF using the USDCHF=X monthly
          exchange-rate series before any calculation.
        </li>
        <li>
          All series are aligned to a common monthly range:{" "}
          <span className="text-text">
            {data.months[0]} – {data.months.at(-1)}
          </span>{" "}
          ({data.months.length} monthly observations).
        </li>
        <li>
          The dataset is fetched once by a script and committed as a static
          JSON file — the live app makes no market-data API calls, so results
          are stable and reproducible.
        </li>
      </ul>

      <h3 className="mb-3 mt-8 text-lg font-bold">Formulas</h3>
      <div className="space-y-3">
        <Formula
          name="Monthly return"
          formula="r[t] = p[t] / p[t−1] − 1"
          note="Computed per asset on CHF prices."
        />
        <Formula
          name="Portfolio return (monthly rebalancing)"
          formula="r_p[t] = Σ wᵢ · rᵢ[t]"
          note="Weights are reset to target every month — the classic rebalanced backtest."
        />
        <Formula
          name="CAGR (annualized return)"
          formula="(endValue / startValue)^(12 / months) − 1"
        />
        <Formula
          name="Annualized volatility"
          formula="stdev(monthly returns) × √12"
          note="Sample standard deviation."
        />
        <Formula
          name="Sharpe ratio"
          formula="(CAGR − r_f) / volatility, with r_f = 0.5%"
        />
        <Formula
          name="Maximum drawdown"
          formula="min( value[t] / runningPeak[t] − 1 )"
          note="The deepest peak-to-trough fall of the cumulative value series."
        />
        <Formula
          name="Diversification score"
          formula="score = (1/Σwᵢ² − 1) / 7 × 100, capped 0–100"
          note="Based on the inverse Herfindahl index — the 'effective number of holdings'."
        />
        <Formula
          name="Savings projection"
          formula="value[m] = (value[m−1] + contribution) × (1 + (1+r)^(1/12) − 1)"
          note="Month-by-month compounding; fund fees (TER) are subtracted from the annual return; the real-terms toggle divides by (1+inflation)^years."
        />
        <Formula
          name="Monte Carlo simulation"
          formula="1,000 paths, bootstrap-resampling historical monthly returns"
          note="No distribution assumptions — months are drawn with replacement from the portfolio's actual return history (seeded RNG for reproducibility). p10/p50/p90 are percentiles across paths."
        />
        <Formula
          name="Efficient frontier"
          formula="upper hull of 3,000 random long-only weightings"
          note="Each random portfolio's historical CAGR and volatility is computed; the frontier is the best return per risk bucket."
        />
        <Formula
          name="Historical VaR / CVaR (95%, monthly)"
          formula="VaR = 5th percentile of monthly returns; CVaR = mean of returns below it"
          note="Both reported as positive loss figures on a CHF 10'000 position."
        />
        <Formula
          name="Risk contribution"
          formula="RC_i = w_i · (Σw)_i / (wᵀΣw)"
          note="Σ is the covariance matrix of monthly returns. Risk parity iteratively equalizes all RC_i."
        />
        <Formula
          name="Portfolio beta"
          formula="β = cov(r_p, r_bench) / var(r_bench)"
        />
        <Formula
          name="Stress tests"
          formula="crisis window applied to current weights on full asset histories"
          note="Assets without complete data for a window are excluded and the remaining weights renormalized; recovery time counts months from the trough until the starting value is regained."
        />
        <Formula
          name="Rebalancing effect"
          formula="monthly-rebalanced value vs. buy-and-hold (initial split, never rebalanced)"
        />
        <Formula
          name="Pillar 3a tax saving"
          formula="contribution × marginal tax rate"
          note="Contribution capped at the official 2026 employee maximum (CHF 7'258). Withdrawal taxation is not modelled."
        />
      </div>

      <h3 className="mt-8 text-lg font-bold">Assumptions &amp; limitations</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
        <li>No transaction costs, taxes on dividends, or spreads in backtests; fund fees only where the TER input applies.</li>
        <li>Monthly rebalancing is assumed to be frictionless.</li>
        <li>Ten years is a short window — it contains no repeat of e.g. 2008.</li>
        <li>Historical performance does not predict future returns. This is an educational project, not financial advice.</li>
      </ul>

      <footer className="mt-12 border-t border-line pt-6 text-xs text-muted">
        <Link href="/" className="underline underline-offset-4 hover:text-text">
          ← Back to CHF Compass
        </Link>
      </footer>
    </div>
  );
}
