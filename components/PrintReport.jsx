"use client";

import { chf, pct } from "../lib/finance";

/**
 * One-page report shown only when printing (see @media print in globals.css).
 * A clean, consulting-style summary of the current portfolio.
 */
export default function PrintReport({ data, stats, weights, totalPct }) {
  if (!stats) return null;
  const holdings = Object.entries(weights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([ticker, w]) => ({
      w,
      asset: data.assets.find((a) => a.ticker === ticker),
    }));
  const endValue = stats.values[stats.values.length - 1];

  return (
    <div id="print-report" className="hidden print:block">
      <div style={{ fontFamily: "Inter, sans-serif", color: "#111" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>
          CHF Compass — Portfolio Report
        </h1>
        <p style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>
          Backtest period {data.months[0]} – {data.months.at(-1)} · base
          currency CHF · monthly rebalancing · real historical data (Yahoo
          Finance, adjusted close) · generated at chf-compass.vercel.app
        </p>

        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "14px 0 6px" }}>
          Allocation ({totalPct}%)
        </h2>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #999", textAlign: "left" }}>
              <th style={{ padding: "4px 0" }}>Asset</th>
              <th>Ticker</th>
              <th>Category</th>
              <th style={{ textAlign: "right" }}>Weight</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map(({ asset, w }) => (
              <tr key={asset.ticker} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "4px 0" }}>{asset.name}</td>
                <td>{asset.ticker}</td>
                <td>{asset.category}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{w}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "16px 0 6px" }}>
          Key metrics (10-year backtest)
        </h2>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["Final value of CHF 10’000", chf(endValue)],
              ["Annualized return (CAGR)", pct(stats.cagr)],
              ["Annualized volatility", pct(stats.vol)],
              ["Sharpe ratio (0.5% risk-free)", stats.sharpe.toFixed(2)],
              ["Maximum drawdown", pct(stats.mdd)],
              [`Best year (${stats.best.year})`, pct(stats.best.ret)],
              [`Worst year (${stats.worst.year})`, pct(stats.worst.ret)],
              ["Diversification score", `${stats.divScore}/100`],
            ].map(([k, v]) => (
              <tr key={k} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "4px 0", color: "#444" }}>{k}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: 10, color: "#777", marginTop: 18 }}>
          Methodology: monthly returns r[t] = p[t]/p[t−1] − 1; portfolio return
          = Σ wᵢ·rᵢ (rebalanced monthly); CAGR = (end/start)^(12/months) − 1;
          volatility = stdev(monthly) × √12; USD assets converted to CHF via
          USDCHF. Historical performance does not predict future returns. Not
          financial advice.
        </p>
      </div>
    </div>
  );
}
