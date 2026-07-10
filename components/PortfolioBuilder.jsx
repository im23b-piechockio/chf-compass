"use client";

import { useState } from "react";

const CATEGORY_ORDER = ["Equities", "Switzerland", "Bonds", "Commodities", "Crypto"];

export default function PortfolioBuilder({
  assets,
  weights,
  setWeights,
  totalPct,
  onSelectAsset,
  presets,
}) {
  const [activePreset, setActivePreset] = useState("Balanced");
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: assets.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  const applyPreset = (preset) => {
    setActivePreset(preset.name);
    setWeights({ ...preset.weights });
  };

  const setWeight = (ticker, value) => {
    setActivePreset(null);
    setWeights((prev) => {
      const next = { ...prev, [ticker]: value };
      if (value === 0) delete next[ticker];
      return next;
    });
  };

  const normalize = () => {
    if (totalPct === 0) return;
    setWeights((prev) => {
      const entries = Object.entries(prev).filter(([, w]) => w > 0);
      const sum = entries.reduce((s, [, w]) => s + w, 0);
      const next = {};
      let assigned = 0;
      entries.forEach(([t, w], i) => {
        const v =
          i === entries.length - 1
            ? 100 - assigned
            : Math.round((w / sum) * 100);
        next[t] = v;
        assigned += v;
      });
      return next;
    });
  };

  const ok = totalPct === 100;

  return (
    <aside className="glass h-fit p-5 lg:sticky lg:top-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Portfolio Builder
        </h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            ok ? "bg-green/15 text-green" : "bg-red/15 text-red"
          }`}
        >
          {totalPct}%
        </span>
      </div>

      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold/80">
          Preset strategies
        </p>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              title={p.desc}
              className={`min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                activePreset === p.name
                  ? "border-green/50 bg-green/15 text-green"
                  : "border-line bg-panel2/80 text-muted hover:border-green/40 hover:text-text"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {activePreset && (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {presets.find((p) => p.name === activePreset)?.desc}
          </p>
        )}
      </div>

      <div className="space-y-5">
        {grouped.map(({ cat, items }) => (
          <div key={cat}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold/80">
              {cat}
            </p>
            <div className="space-y-3">
              {items.map((a) => {
                const w = weights[a.ticker] || 0;
                return (
                  <div key={a.ticker} className="glass2 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <button
                        onClick={() => onSelectAsset(a.ticker)}
                        className="min-h-[28px] truncate text-left text-sm font-medium underline-offset-4 hover:text-green hover:underline"
                        title="View asset details"
                      >
                        {a.name}
                        <span className="ml-1.5 text-xs text-muted">
                          {a.ticker}
                        </span>
                      </button>
                      <span
                        className={`w-11 text-right text-sm font-semibold tabular-nums ${
                          w > 0 ? "text-text" : "text-muted"
                        }`}
                      >
                        {w}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={w}
                      onChange={(e) => setWeight(a.ticker, +e.target.value)}
                      className="block w-full py-2"
                      aria-label={`${a.name} weight`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!ok && (
        <button
          onClick={normalize}
          className="mt-5 min-h-[44px] w-full rounded-xl bg-green/15 px-4 py-3 text-sm font-semibold text-green transition hover:bg-green/25"
        >
          Normalize to 100%
        </button>
      )}
      {!ok && (
        <p className="mt-2 text-center text-xs text-muted">
          Weights must sum to 100% — charts show the normalized mix.
        </p>
      )}
    </aside>
  );
}
