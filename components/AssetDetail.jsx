"use client";

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  monthlyReturns,
  cumulativeValue,
  cagr,
  annualizedVolatility,
  maxDrawdown,
  pct,
} from "../lib/finance";

export default function AssetDetail({ asset, months, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const stats = useMemo(() => {
    const returns = monthlyReturns(asset.prices);
    const values = cumulativeValue(returns, 100); // indexed to 100
    return {
      values,
      cagr: cagr(values),
      vol: annualizedVolatility(returns),
      mdd: maxDrawdown(values),
    };
  }, [asset]);

  const chartData = stats.values.map((v, i) => ({
    month: months[i],
    value: +v.toFixed(1),
  }));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="glass max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">{asset.name}</h3>
              <p className="text-xs text-muted">
                {asset.ticker} · {asset.category} · priced in CHF
                {asset.nativeCurrency === "USD" ? " (converted from USD)" : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="glass2 flex h-11 w-11 shrink-0 items-center justify-center text-muted transition hover:text-text"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="glass2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                CAGR (10y)
              </p>
              <p className={`mt-0.5 text-lg font-bold tabular-nums ${stats.cagr >= 0 ? "text-green" : "text-red"}`}>
                {pct(stats.cagr)}
              </p>
            </div>
            <div className="glass2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Volatility
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                {pct(stats.vol)}
              </p>
            </div>
            <div className="glass2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Max drawdown
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-red">
                {pct(stats.mdd)}
              </p>
            </div>
          </div>

          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid stroke="#26262b" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#8b909b", fontSize: 10 }}
                  tickFormatter={(m) => m.slice(0, 4)}
                  interval={23}
                  axisLine={{ stroke: "#26262b" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#8b909b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(v) => [v, "Index (start = 100)"]}
                  labelStyle={{ color: "#8b909b" }}
                  contentStyle={{
                    background: "#16161b",
                    border: "1px solid #26262b",
                    borderRadius: 12,
                    color: "#e6e8ec",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#e5b567"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted">
            Growth of 100 (CHF terms), monthly adjusted close, last 10 years.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
