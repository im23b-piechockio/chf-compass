"use client";

import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  monthlyReturns,
  correlation,
  cumulativeValue,
  cagr,
  annualizedVolatility,
  drawdownSeries,
  efficientFrontier,
  pct,
} from "../lib/finance";

const TOOLTIP_STYLE = {
  background: "#16161b",
  border: "1px solid #26262b",
  borderRadius: 12,
  color: "#e6e8ec",
};

/** Correlation -1..+1 -> color. Low/negative = green (good), high = red. */
function corrColor(c) {
  const x = Math.max(0, Math.min(1, c)); // <=0 green .. 0.5 gold .. 1 red
  if (x < 0.5) {
    const t = x / 0.5; // green #34d399 -> gold #e5b567
    return `rgba(${Math.round(52 + 177 * t)}, ${Math.round(211 - 30 * t)}, ${Math.round(153 - 50 * t)}, 0.85)`;
  }
  const t = (x - 0.5) / 0.5; // gold -> red #fb7185
  return `rgba(${Math.round(229 + 22 * t)}, ${Math.round(181 - 68 * t)}, ${Math.round(103 + 30 * t)}, 0.85)`;
}

const SHORT_NAMES = {
  URTH: "World",
  SPY: "S&P",
  QQQ: "Nasdaq",
  EEM: "EM",
  "^SSMI": "SMI",
  "NESN.SW": "Nestlé",
  "NOVN.SW": "Novartis",
  "UBSG.SW": "UBS",
  AGG: "Bonds",
  GLD: "Gold",
  "BTC-USD": "BTC",
};

function CorrelationHeatmap({ assets }) {
  const { labels, matrix } = useMemo(() => {
    const returns = assets.map((a) => monthlyReturns(a.prices));
    return {
      labels: assets.map((a) => SHORT_NAMES[a.ticker] || a.ticker),
      matrix: returns.map((ra) => returns.map((rb) => correlation(ra, rb))),
    };
  }, [assets]);

  if (assets.length < 2) {
    return (
      <p className="text-sm text-muted">
        Add at least two assets to see how they move together.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th />
            {labels.map((l) => (
              <th key={l} className="pb-1 text-[10px] font-semibold text-muted">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={labels[i]}>
              <td className="pr-2 text-right text-[10px] font-semibold text-muted">
                {labels[i]}
              </td>
              {row.map((c, j) => (
                <td
                  key={j}
                  title={`${labels[i]} × ${labels[j]}: ${c.toFixed(2)}`}
                  className="h-9 min-w-[36px] rounded-md text-center text-[10px] font-bold tabular-nums text-bg sm:min-w-[44px]"
                  style={{ background: corrColor(c) }}
                >
                  {c.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FrontierChart({ assets, allAssets, stats }) {
  const { assetPoints, frontier, portfolioPoint } = useMemo(() => {
    const returnSeries = assets.map((a) => monthlyReturns(a.prices));
    const { frontier } = efficientFrontier(returnSeries);
    const assetPoints = allAssets.map((a) => {
      const r = monthlyReturns(a.prices);
      return {
        name: a.name,
        vol: +(annualizedVolatility(r) * 100).toFixed(1),
        ret: +(cagr(cumulativeValue(r, 1)) * 100).toFixed(1),
      };
    });
    return {
      assetPoints,
      frontier: frontier.map((p) => ({
        vol: +(p.vol * 100).toFixed(1),
        ret: +(p.ret * 100).toFixed(1),
        name: "Efficient frontier",
      })),
      portfolioPoint: [
        {
          name: "Your portfolio",
          vol: +(stats.vol * 100).toFixed(1),
          ret: +(stats.cagr * 100).toFixed(1),
        },
      ],
    };
  }, [assets, allAssets, stats]);

  return (
    <div className="h-72 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, bottom: 12, left: 4 }}>
          <CartesianGrid stroke="#26262b" strokeDasharray="3 6" />
          <XAxis
            type="number"
            dataKey="vol"
            tick={{ fill: "#8b909b", fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            axisLine={{ stroke: "#26262b" }}
            tickLine={false}
            label={{
              value: "Risk (volatility, % p.a.)",
              position: "insideBottom",
              offset: -8,
              fill: "#8b909b",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="ret"
            tick={{ fill: "#8b909b", fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <ZAxis range={[70, 71]} />
          <Tooltip
            cursor={{ stroke: "#26262b" }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload;
              if (!p) return null;
              return (
                <div style={{ ...TOOLTIP_STYLE, padding: "8px 12px", fontSize: 12 }}>
                  <p style={{ fontWeight: 700, marginBottom: 2 }}>{p.name}</p>
                  <p style={{ color: "#8b909b" }}>
                    Risk {p.vol}% · Return {p.ret}%
                  </p>
                </div>
              );
            }}
          />
          <Scatter
            data={frontier}
            line={{ stroke: "#34d399", strokeWidth: 2 }}
            shape={() => <g />}
          />
          <Scatter data={assetPoints} fill="#e5b567" />
          <Scatter
            data={portfolioPoint}
            shape={(props) => (
              <g>
                <circle cx={props.cx} cy={props.cy} r={9} fill="#34d399" opacity={0.25} />
                <circle cx={props.cx} cy={props.cy} r={5} fill="#34d399" stroke="#0a0a0b" strokeWidth={1.5} />
              </g>
            )}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function UnderwaterChart({ stats, months }) {
  const data = useMemo(
    () =>
      drawdownSeries(stats.values).map((d, i) => ({
        month: months[i],
        dd: +(d * 100).toFixed(1),
      })),
    [stats, months]
  );

  return (
    <div className="h-52 sm:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="gDD" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#fb7185" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#26262b" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "#8b909b", fontSize: 11 }}
            tickFormatter={(m) => m.slice(0, 4)}
            interval={23}
            axisLine={{ stroke: "#26262b" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8b909b", fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(v) => [`${v}%`, "Drawdown"]}
            labelStyle={{ color: "#8b909b" }}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area
            type="monotone"
            dataKey="dd"
            stroke="#fb7185"
            strokeWidth={1.5}
            fill="url(#gDD)"
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function QuantLab({ data, stats, weights }) {
  const selectedAssets = data.assets.filter((a) => (weights[a.ticker] || 0) > 0);

  return (
    <section className="mt-10">
      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Quant Lab</h2>
        <p className="mt-1 text-sm text-muted">
          A deeper look at the risk inside your portfolio — straight from the
          historical data.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass p-5">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted">
            Correlation heatmap
          </h3>
          <p className="mb-4 text-xs leading-relaxed text-muted">
            How your holdings move together (monthly returns). Low or negative
            correlations (green) are what makes diversification work — red
            pairs rise and fall together.
          </p>
          <CorrelationHeatmap assets={selectedAssets} />
        </div>

        <div className="glass p-5">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted">
            Risk vs. return — efficient frontier
          </h3>
          <p className="mb-2 text-xs leading-relaxed text-muted">
            Every asset plotted by 10-year risk and return (gold dots), plus
            the efficient frontier of your selected assets — the best return
            achievable at each risk level across 3,000 simulated weightings.
            The green dot is your current portfolio.
          </p>
          {selectedAssets.length >= 2 ? (
            <FrontierChart assets={selectedAssets} allAssets={data.assets} stats={stats} />
          ) : (
            <p className="text-sm text-muted">
              Add at least two assets to draw a frontier.
            </p>
          )}
        </div>
      </div>

      <div className="glass mt-6 p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted">
          Underwater chart
        </h3>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          How far the portfolio was below its previous peak at every point in
          time — the drawdowns you would have had to sit through. Worst:{" "}
          {pct(stats.mdd)}.
        </p>
        <UnderwaterChart stats={stats} months={data.months} />
      </div>
    </section>
  );
}
