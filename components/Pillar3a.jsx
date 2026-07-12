"use client";

import { useMemo, useState } from "react";
import { savingsProjection, chf, pct } from "../lib/finance";

// Official pillar-3a maximum for employees with a pension fund, tax year 2026.
// Update yearly — published by the federal authorities.
const MAX_3A_2026 = 7258;
const CASH_3A_RATE = 0.005; // typical 3a savings-account interest

function Field({ label, children, hint }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export default function Pillar3a({ backtestedReturn }) {
  const [contribution, setContribution] = useState(MAX_3A_2026);
  const [marginalRate, setMarginalRate] = useState(25);
  const [years, setYears] = useState(25);

  const capped = Math.max(0, Math.min(MAX_3A_2026, contribution || 0));
  const safeYears = Math.min(45, Math.max(1, years || 1));

  const { taxSavedYear, taxSavedTotal, invested, cash } = useMemo(() => {
    const monthly = capped / 12;
    const investedPts = savingsProjection(0, monthly, safeYears, backtestedReturn);
    const cashPts = savingsProjection(0, monthly, safeYears, CASH_3A_RATE);
    const taxSavedYear = capped * (marginalRate / 100);
    return {
      taxSavedYear,
      taxSavedTotal: taxSavedYear * safeYears,
      invested: investedPts[investedPts.length - 1],
      cash: cashPts[cashPts.length - 1],
    };
  }, [capped, marginalRate, safeYears, backtestedReturn]);

  return (
    <section className="mt-10">
      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Pillar 3a — the Swiss tax advantage
        </h2>
        <p className="mt-1 text-sm text-muted">
          Every franc you pay into pillar 3a is deducted from your taxable
          income. Here is what that is worth.
        </p>
      </div>

      <div className="glass p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Annual 3a contribution"
            hint={`2026 legal maximum for employees: ${chf(MAX_3A_2026)}`}
          >
            <div className="glass2 flex items-center px-3">
              <input
                type="number"
                value={contribution}
                min={0}
                max={MAX_3A_2026}
                step={100}
                onChange={(e) => setContribution(+e.target.value)}
                onBlur={(e) => {
                  setContribution(capped);
                  e.target.value = String(capped);
                }}
                className="min-h-[44px] w-full bg-transparent text-sm font-semibold tabular-nums outline-none"
                aria-label="Annual 3a contribution"
              />
              <span className="ml-1 shrink-0 text-xs text-muted">CHF</span>
            </div>
          </Field>
          <Field
            label={`Marginal tax rate: ${marginalRate}%`}
            hint="Your rate on the last franc earned — depends on income and canton (typ. 15–40%)."
          >
            <input
              type="range"
              min={10}
              max={45}
              step={1}
              value={marginalRate}
              onChange={(e) => setMarginalRate(+e.target.value)}
              className="mt-3 block w-full py-2"
              aria-label="Marginal tax rate"
            />
          </Field>
          <Field label="Years until withdrawal">
            <div className="glass2 flex items-center px-3">
              <input
                type="number"
                value={years}
                min={1}
                max={45}
                step={1}
                onChange={(e) => setYears(+e.target.value)}
                onBlur={(e) => {
                  e.target.value = String(years);
                }}
                className="min-h-[44px] w-full bg-transparent text-sm font-semibold tabular-nums outline-none"
                aria-label="Years until withdrawal"
              />
              <span className="ml-1 shrink-0 text-xs text-muted">yrs</span>
            </div>
          </Field>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gold/40 bg-gold/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Income tax saved
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gold">
              {chf(taxSavedYear)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              every year · {chf(taxSavedTotal)} over {safeYears} years
            </p>
          </div>
          <div className="glass2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              3a in your portfolio ({pct(backtestedReturn)})
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-green">
              {chf(invested.value)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {chf(invested.contributed)} paid in · {chf(invested.gains)} growth
            </p>
          </div>
          <div className="glass2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              3a savings account ({pct(CASH_3A_RATE)})
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {chf(cash.value)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {chf(invested.value - cash.value)} less than investing it
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Assumptions: contribution paid in monthly instalments; investment
          return equals your portfolio’s backtested 10-year CAGR; tax saving =
          contribution × marginal rate, constant over time. Withdrawals are
          taxed separately at a reduced rate (not modelled). Not tax advice.
        </p>
      </div>
    </section>
  );
}
