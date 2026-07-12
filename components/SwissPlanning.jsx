"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  monthlyReturns,
  requiredMonthly,
  simulateFinalValues,
  cagr,
  cumulativeValue,
  chf,
  pct,
} from "../lib/finance";

const TOOLTIP_STYLE = {
  background: "#16161b",
  border: "1px solid #26262b",
  borderRadius: 12,
  color: "#e6e8ec",
};
const AXIS_TICK = { fill: "#8b909b", fontSize: 11 };

function Card({ title, sub, children, className = "" }) {
  return (
    <div className={`glass min-w-0 p-5 ${className}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {sub && (
        <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">{sub}</p>
      )}
      {children}
    </div>
  );
}

function NumField({ label, value, onChange, min, max, step, suffix }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <div className="glass2 flex items-center px-3">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(+e.target.value)}
          onBlur={(e) => {
            e.target.value = String(value);
          }}
          className="min-h-[44px] w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums outline-none"
          aria-label={label}
        />
        {suffix && (
          <span className="ml-1 shrink-0 text-xs text-muted">{suffix}</span>
        )}
      </div>
    </label>
  );
}

function Verdict({ ok, yes, no }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        ok ? "border-green/40 bg-green/10" : "border-red/40 bg-red/10"
      }`}
    >
      <p className={`text-lg font-bold ${ok ? "text-green" : "text-red"}`}>
        {ok ? yes : no}
      </p>
    </div>
  );
}

/* ---------------- 1. FIRE planner ---------------- */

function FirePlanner({ portfolioReturn, histReturns }) {
  const [current, setCurrent] = useState(50000);
  const [monthly, setMonthly] = useState(1500);
  const [spending, setSpending] = useState(60000);
  const [ret, setRet] = useState(+(portfolioReturn * 100).toFixed(1));

  const res = useMemo(() => {
    const r = (ret || 0) / 100;
    const i = Math.pow(1 + r, 1 / 12) - 1;
    const fiNumber = (spending || 0) * 25;
    let v = current || 0;
    let months = 0;
    const points = [{ year: 0, value: Math.round(v) }];
    while (v < fiNumber && months < 12 * 60) {
      v = (v + (monthly || 0)) * (1 + i);
      months++;
      if (months % 12 === 0)
        points.push({ year: months / 12, value: Math.round(v) });
    }
    const reached = v >= fiNumber;
    const fiYears = reached ? +(months / 12).toFixed(1) : null;
    // Withdrawal phase (30 years, constant spending) after FI.
    if (reached) {
      let w = v;
      const startYear = Math.ceil(months / 12);
      for (let m = 1; m <= 360; m++) {
        w = (w - spending / 12) * (1 + i);
        if (m % 12 === 0)
          points.push({
            year: startYear + m / 12,
            value: Math.round(Math.max(0, w)),
            phase: "withdraw",
          });
      }
    }
    // Classic 4%-rule Monte Carlo: start retirement with 25x spending in
    // this portfolio, withdraw monthly for 30 years, count surviving paths.
    const finals = simulateFinalValues(
      fiNumber,
      -(spending || 0) / 12,
      360,
      histReturns
    );
    const successRate = finals.filter((f) => f > 0).length / finals.length;
    return { fiNumber, fiYears, points, successRate, reached };
  }, [current, monthly, spending, ret, histReturns]);

  return (
    <Card
      title="FIRE / retirement planner"
      sub="When could you stop working? Financial independence = 25× your annual spending (the 4% safe-withdrawal rule)."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <NumField label="Invested today" value={current} onChange={setCurrent} min={0} step={5000} suffix="CHF" />
        <NumField label="Monthly saving" value={monthly} onChange={setMonthly} min={0} step={100} suffix="CHF" />
        <NumField label="Annual spending" value={spending} onChange={setSpending} min={12000} step={5000} suffix="CHF" />
        <NumField label="Expected return" value={ret} onChange={setRet} min={-5} max={20} step={0.5} suffix="% p.a." />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="glass2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Your FI number
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gold">
            {chf(res.fiNumber)}
          </p>
          <p className="mt-0.5 text-xs text-muted">25× annual spending</p>
        </div>
        <div className="glass2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Years to FI
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-green">
            {res.fiYears !== null ? `${res.fiYears} yrs` : "> 60 yrs"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            at your current savings pace
          </p>
        </div>
        <div className="glass2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            4%-rule success rate
          </p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${res.successRate >= 0.85 ? "text-green" : res.successRate >= 0.7 ? "text-gold" : "text-red"}`}>
            {pct(res.successRate, 0)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            of 1,000 bootstrap runs survive a 30-year retirement
          </p>
        </div>
      </div>

      <div className="mt-4 h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={res.points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#26262b" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="year" tick={AXIS_TICK} tickFormatter={(y) => `${y}y`} axisLine={{ stroke: "#26262b" }} tickLine={false} />
            <YAxis tick={AXIS_TICK} tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} axisLine={false} tickLine={false} width={44} />
            <ReferenceLine y={res.fiNumber} stroke="#e5b567" strokeDasharray="6 4" label={{ value: "FI", fill: "#e5b567", fontSize: 11, position: "insideTopRight" }} />
            <Tooltip formatter={(v) => [chf(v), "Wealth"]} labelFormatter={(y) => `Year ${y}`} contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} dot={false} animationDuration={500} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Accumulation until FI, then 30 years of withdrawals at constant
        spending. Deterministic chart; the success rate uses bootstrap Monte
        Carlo on your portfolio&apos;s real monthly returns.
      </p>
    </Card>
  );
}

/* ---------------- 2. Mortgage affordability ---------------- */

function Mortgage() {
  const [price, setPrice] = useState(1000000);
  const [income, setIncome] = useState(150000);
  const [equity, setEquity] = useState(200000);
  // Standard Swiss lending rules — editable so scenarios can be explored.
  const [imputedRate, setImputedRate] = useState(5);
  const [maintRate, setMaintRate] = useState(1);
  const [maxShare, setMaxShare] = useState(33);

  const res = useMemo(() => {
    const p = price || 0;
    const eq = equity || 0;
    const loan = Math.max(0, p - eq);
    const minEquity = 0.2 * p;
    const equityOk = eq >= minEquity;
    const interest = (imputedRate / 100) * loan;
    const maintenance = (maintRate / 100) * p;
    const amortBase = Math.max(0, loan - 0.65 * p);
    const amortization = amortBase / 15;
    const total = interest + maintenance + amortization;
    const share = income > 0 ? total / income : Infinity;
    return {
      loan,
      minEquity,
      equityOk,
      interest,
      maintenance,
      amortization,
      total,
      share,
      affordable: equityOk && share <= maxShare / 100,
    };
  }, [price, income, equity, imputedRate, maintRate, maxShare]);

  return (
    <Card
      title="Swiss mortgage affordability (Tragbarkeit)"
      sub="The standard bank check: imputed costs at a stress interest rate must stay under a third of gross income, with at least 20% equity."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <NumField label="Property price" value={price} onChange={setPrice} min={100000} step={50000} suffix="CHF" />
        <NumField label="Gross annual income" value={income} onChange={setIncome} min={0} step={10000} suffix="CHF" />
        <NumField label="Available equity" value={equity} onChange={setEquity} min={0} step={10000} suffix="CHF" />
        <NumField label="Imputed interest" value={imputedRate} onChange={setImputedRate} min={1} max={10} step={0.5} suffix="%" />
        <NumField label="Maintenance" value={maintRate} onChange={setMaintRate} min={0} max={3} step={0.25} suffix="% of price" />
        <NumField label="Max cost share" value={maxShare} onChange={setMaxShare} min={20} max={50} step={1} suffix="% income" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="glass2 divide-y divide-line p-4 text-sm">
          {[
            ["Mortgage loan", chf(res.loan), `${pct(res.loan / (price || 1), 0)} loan-to-value`],
            [`Imputed interest @ ${imputedRate}%`, chf(res.interest), "stress rate, not your actual rate"],
            [`Maintenance @ ${maintRate}%`, chf(res.maintenance), "upkeep + ancillary costs"],
            ["Amortization", chf(res.amortization), "loan above 65% LTV repaid over 15 years"],
            ["Total imputed annual cost", chf(res.total), `${(res.share * 100).toFixed(1)}% of gross income`],
          ].map(([k, v, note]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-medium">{k}</p>
                <p className="text-[11px] text-muted">{note}</p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Verdict
            ok={res.affordable}
            yes="✓ Affordable"
            no="✗ Not affordable"
          />
          {!res.equityOk && (
            <p className="text-xs leading-relaxed text-red">
              Equity below the 20% minimum ({chf(res.minEquity)} required).
            </p>
          )}
          {res.equityOk && !res.affordable && (
            <p className="text-xs leading-relaxed text-muted">
              Costs exceed {maxShare}% of income — a higher income, more
              equity or a cheaper property would be needed.
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-muted">
            Standard rules of thumb used by Swiss lenders (max half of the
            20% equity may come from pillar 2 — not modelled). Illustrative,
            not financial advice.
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- 3. Goal planner ---------------- */

function GoalPlanner({ portfolioReturn, histReturns }) {
  const [target, setTarget] = useState(100000);
  const [years, setYears] = useState(10);
  const [starting, setStarting] = useState(10000);

  const res = useMemo(() => {
    const y = Math.min(50, Math.max(1, years || 1));
    const monthly = requiredMonthly(target || 0, starting || 0, y, portfolioReturn);
    const finals = simulateFinalValues(starting || 0, monthly, y * 12, histReturns);
    const probability = finals.filter((f) => f >= (target || 0)).length / finals.length;
    return { monthly, probability, years: y };
  }, [target, years, starting, portfolioReturn, histReturns]);

  return (
    <Card
      title="Goal planner"
      sub="How much do you need to save each month to hit a goal — and how likely is it, given how your portfolio really behaved?"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <NumField label="Target amount" value={target} onChange={setTarget} min={1000} step={10000} suffix="CHF" />
        <NumField label="Horizon" value={years} onChange={setYears} min={1} max={50} step={1} suffix="yrs" />
        <NumField label="Starting amount" value={starting} onChange={setStarting} min={0} step={5000} suffix="CHF" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="glass2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Required monthly saving
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-green">
            {chf(res.monthly)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            at your portfolio&apos;s {pct(portfolioReturn)} backtested return
          </p>
        </div>
        <div className="glass2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Probability of reaching it
          </p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${res.probability >= 0.6 ? "text-green" : res.probability >= 0.4 ? "text-gold" : "text-red"}`}>
            {pct(res.probability, 0)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            1,000 bootstrap runs on real monthly returns — markets don&apos;t
            move in straight lines
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- 4. Net worth projection ---------------- */

function NetWorth({ portfolioReturn }) {
  const [income, setIncome] = useState(90000);
  const [expenses, setExpenses] = useState(65000);
  const [wealth, setWealth] = useState(30000);
  const [years, setYears] = useState(25);
  const [ret, setRet] = useState(+(portfolioReturn * 100).toFixed(1));

  const res = useMemo(() => {
    const y = Math.min(60, Math.max(1, years || 1));
    const saving = Math.max(0, (income || 0) - (expenses || 0));
    const i = Math.pow(1 + (ret || 0) / 100, 1 / 12) - 1;
    let v = wealth || 0;
    const points = [{ year: 0, value: Math.round(v) }];
    for (let m = 1; m <= y * 12; m++) {
      v = (v + saving / 12) * (1 + i);
      if (m % 12 === 0) points.push({ year: m / 12, value: Math.round(v) });
    }
    return {
      saving,
      savingsRate: income > 0 ? saving / income : 0,
      final: v,
      points,
    };
  }, [income, expenses, wealth, years, ret]);

  return (
    <Card
      title="Net-worth projection"
      sub="Income minus expenses, invested every month — the savings rate is the single biggest lever."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <NumField label="Annual income" value={income} onChange={setIncome} min={0} step={5000} suffix="CHF" />
        <NumField label="Annual expenses" value={expenses} onChange={setExpenses} min={0} step={5000} suffix="CHF" />
        <NumField label="Current wealth" value={wealth} onChange={setWealth} min={0} step={5000} suffix="CHF" />
        <NumField label="Years" value={years} onChange={setYears} min={1} max={60} step={1} suffix="yrs" />
        <NumField label="Return" value={ret} onChange={setRet} min={-5} max={20} step={0.5} suffix="% p.a." />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <p>
          <span className="text-muted">Savings rate: </span>
          <span className={`font-bold tabular-nums ${res.savingsRate >= 0.2 ? "text-green" : "text-gold"}`}>
            {pct(res.savingsRate, 0)}
          </span>
          <span className="text-muted"> ({chf(res.saving)}/yr)</span>
        </p>
        <p>
          <span className="text-muted">Net worth in {Math.min(60, Math.max(1, years || 1))} years: </span>
          <span className="font-bold tabular-nums text-green">{chf(res.final)}</span>
        </p>
      </div>
      <div className="mt-3 h-48 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={res.points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#26262b" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="year" tick={AXIS_TICK} tickFormatter={(y) => `${y}y`} axisLine={{ stroke: "#26262b" }} tickLine={false} />
            <YAxis tick={AXIS_TICK} tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v) => [chf(v), "Net worth"]} labelFormatter={(y) => `Year ${y}`} contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" stroke="#e5b567" strokeWidth={2} dot={false} animationDuration={500} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------------- 5. Staggered 3a withdrawal ---------------- */

// Very rough progressive lump-sum withdrawal tax estimate (combined
// federal + cantonal, ZH-like). Real rates vary strongly by canton and
// marital status — illustrative only.
const LUMP_SUM_BRACKETS = [
  { upTo: 25000, rate: 0.03 },
  { upTo: 50000, rate: 0.045 },
  { upTo: 100000, rate: 0.06 },
  { upTo: 250000, rate: 0.08 },
  { upTo: Infinity, rate: 0.11 },
];

function lumpSumTax(amount) {
  let tax = 0;
  let prev = 0;
  for (const b of LUMP_SUM_BRACKETS) {
    const slice = Math.min(amount, b.upTo) - prev;
    if (slice <= 0) break;
    tax += slice * b.rate;
    prev = b.upTo;
  }
  return tax;
}

function Staggered3a() {
  const [capital, setCapital] = useState(300000);
  const [accounts, setAccounts] = useState(3);

  const res = useMemo(() => {
    const c = Math.max(0, capital || 0);
    const n = Math.min(5, Math.max(1, Math.round(accounts || 1)));
    const single = lumpSumTax(c);
    const split = lumpSumTax(c / n) * n;
    return { single, split, saved: single - split, n };
  }, [capital, accounts]);

  return (
    <Card
      title="Staggered 3a withdrawal"
      sub="Lump-sum withdrawal tax is progressive — withdrawing several smaller 3a accounts in different years is taxed less than one big one. That's why the Swiss open multiple 3a accounts."
    >
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Total 3a capital" value={capital} onChange={setCapital} min={0} step={25000} suffix="CHF" />
        <NumField label="Number of accounts" value={accounts} onChange={setAccounts} min={1} max={5} step={1} suffix="acc." />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="glass2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            One withdrawal
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-red">
            {chf(res.single)}
          </p>
          <p className="mt-0.5 text-xs text-muted">estimated tax</p>
        </div>
        <div className="glass2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {res.n} staggered withdrawals
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {chf(res.split)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {chf(capital / res.n)} each, in different years
          </p>
        </div>
        <div className="rounded-xl border border-green/40 bg-green/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Tax saved
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-green">
            {chf(res.saved)}
          </p>
          <p className="mt-0.5 text-xs text-muted">just by splitting accounts</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Uses a rough progressive bracket table ({LUMP_SUM_BRACKETS.map((b, i) => `${(b.rate * 100).toFixed(1)}%${i < LUMP_SUM_BRACKETS.length - 1 ? ` to ${Math.round(b.upTo / 1000)}k` : " above"}`).join(", ")}) — actual rates vary by canton and marital status. Illustrative, not tax advice.
      </p>
    </Card>
  );
}

/* ---------------- 6. Multi-canton tax comparison ---------------- */

// Approximate effective total income-tax rates (federal + canton + commune,
// single person, no church tax, cantonal capital). eff(income) =
// cap * income / (income + 80000) — calibrated to typical published
// effective rates around CHF 100k. Rough estimates for comparison only.
const CANTONS = [
  { code: "ZG", name: "Zug", cap: 0.2 },
  { code: "SZ", name: "Schwyz", cap: 0.23 },
  { code: "ZH", name: "Zürich", cap: 0.31 },
  { code: "BE", name: "Bern", cap: 0.38 },
  { code: "VD", name: "Vaud", cap: 0.4 },
  { code: "GE", name: "Geneva", cap: 0.4 },
];

function CantonTax() {
  const [income, setIncome] = useState(100000);

  const rows = useMemo(() => {
    const inc = Math.max(0, income || 0);
    return CANTONS.map((c) => {
      const eff = c.cap * (inc / (inc + 80000));
      return { ...c, eff, tax: Math.round(inc * eff) };
    }).sort((a, b) => a.tax - b.tax);
  }, [income]);
  const cheapest = rows[0];
  const priciest = rows[rows.length - 1];

  return (
    <Card
      title="Where you live matters — canton tax comparison"
      sub="Approximate income-tax burden across six cantons for the same gross income (single person, cantonal capital)."
    >
      <div className="max-w-xs">
        <NumField label="Gross annual income" value={income} onChange={setIncome} min={0} step={10000} suffix="CHF" />
      </div>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#26262b" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="code" tick={AXIS_TICK} axisLine={{ stroke: "#26262b" }} tickLine={false} />
            <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${Math.round(v / 1000)}k`} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              formatter={(v, n, { payload }) => [`${chf(v)} (${pct(payload.eff, 1)})`, payload.name]}
              cursor={{ fill: "#16161b" }}
              contentStyle={TOOLTIP_STYLE}
            />
            <Bar dataKey="tax" radius={[4, 4, 0, 0]} animationDuration={500}>
              {rows.map((r) => (
                <Cell key={r.code} fill={r === cheapest ? "#34d399" : r === priciest ? "#fb7185" : "#e5b567"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-sm">
        <span className="text-muted">Moving {priciest.name} → {cheapest.name} would save roughly </span>
        <span className="font-bold tabular-nums text-green">
          {chf(priciest.tax - cheapest.tax)}
        </span>
        <span className="text-muted"> per year at this income.</span>
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Based on approximate effective-rate curves calibrated to published
        cantonal figures — real bills depend on commune, deductions, marital
        status and wealth tax. Illustrative, not tax advice.
      </p>
    </Card>
  );
}

/* ---------------- 7. Currency exposure & hedging ---------------- */

function CurrencyView({ data, stats, weights }) {
  const res = useMemo(() => {
    const fx = data.fx;
    const usdAssets = data.assets.filter(
      (a) => a.nativeCurrency === "USD" && (weights[a.ticker] || 0) > 0
    );
    const perAsset = usdAssets.map((a) => {
      const chfCagr = cagr(cumulativeValue(monthlyReturns(a.prices), 1));
      const usdPrices = a.prices.map((p, i) => p / fx[i]);
      const usdCagr = cagr(cumulativeValue(monthlyReturns(usdPrices), 1));
      return { name: a.name, weight: weights[a.ticker], chfCagr, usdCagr, fxEffect: chfCagr - usdCagr };
    });
    // Portfolio level: hedged proxy = USD assets in local currency.
    const totalW = Object.values(weights).reduce((s, w) => s + w, 0);
    const n = data.months.length - 1;
    const unhedged = new Array(n).fill(0);
    const hedged = new Array(n).fill(0);
    for (const a of data.assets) {
      const w = (weights[a.ticker] || 0) / totalW;
      if (w === 0) continue;
      const rChf = monthlyReturns(a.prices);
      const rLocal =
        a.nativeCurrency === "USD"
          ? monthlyReturns(a.prices.map((p, i) => p / fx[i]))
          : rChf;
      for (let t = 0; t < n; t++) {
        unhedged[t] += w * rChf[t];
        hedged[t] += w * rLocal[t];
      }
    }
    const unhedgedEnd = cumulativeValue(unhedged, 10000).at(-1);
    const hedgedEnd = cumulativeValue(hedged, 10000).at(-1);
    const usdShare = usdAssets.reduce((s, a) => s + weights[a.ticker], 0) / totalW;
    const fxMove = fx.at(-1) / fx[0] - 1;
    return { perAsset, unhedgedEnd, hedgedEnd, usdShare, fxMove };
  }, [data, weights]); // eslint-disable-line react-hooks/exhaustive-deps

  const fxImpact = res.unhedgedEnd - res.hedgedEnd;

  return (
    <Card
      title="Currency exposure — the CHF effect"
      sub={`The franc is a famously strong currency: USD/CHF moved ${pct(res.fxMove)} over the backtest. For a CHF investor, foreign returns are worth less when the dollar falls.`}
    >
      {res.perAsset.length === 0 ? (
        <p className="text-sm text-muted">
          No USD-denominated assets in your portfolio — you have no USD
          currency risk.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass2 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                USD exposure
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {pct(res.usdShare, 0)}
              </p>
              <p className="mt-0.5 text-xs text-muted">of your portfolio</p>
            </div>
            <div className="glass2 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                As invested (unhedged)
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-green">
                {chf(res.unhedgedEnd)}
              </p>
              <p className="mt-0.5 text-xs text-muted">CHF 10’000 over 10y, in CHF</p>
            </div>
            <div className="glass2 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Hedged proxy (local returns)
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {chf(res.hedgedEnd)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                FX {fxImpact >= 0 ? "helped" : "cost"} you{" "}
                <span className={fxImpact >= 0 ? "text-green" : "text-red"}>
                  {chf(Math.abs(fxImpact))}
                </span>
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-2 font-semibold">USD asset</th>
                  <th className="pb-2 text-right font-semibold">Weight</th>
                  <th className="pb-2 text-right font-semibold">Return in USD</th>
                  <th className="pb-2 text-right font-semibold">Return in CHF</th>
                  <th className="pb-2 text-right font-semibold">FX effect</th>
                </tr>
              </thead>
              <tbody>
                {res.perAsset.map((a) => (
                  <tr key={a.name} className="border-b border-line/60">
                    <td className="py-2">{a.name}</td>
                    <td className="py-2 text-right tabular-nums">{a.weight}%</td>
                    <td className="py-2 text-right tabular-nums">{pct(a.usdCagr)}</td>
                    <td className="py-2 text-right tabular-nums">{pct(a.chfCagr)}</td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${a.fxEffect >= 0 ? "text-green" : "text-red"}`}>
                      {a.fxEffect >= 0 ? "+" : ""}
                      {pct(a.fxEffect)} p.a.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            “Hedged proxy” assumes perfect, free currency hedging (local
            returns only) — real hedging has costs. CHF-denominated assets are
            unaffected.
          </p>
        </>
      )}
    </Card>
  );
}

/* ---------------- Section ---------------- */

export default function SwissPlanning({ data, stats, weights }) {
  return (
    <section className="mt-10">
      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Life Planning
        </h2>
        <p className="mt-1 text-sm text-muted">
          Your portfolio in the context of a Swiss financial life — retirement,
          property, taxes and the franc. All assumptions editable and labelled;
          illustrative, not financial advice.
        </p>
      </div>
      <div className="space-y-6">
        <FirePlanner portfolioReturn={stats.cagr} histReturns={stats.returns} />
        <div className="grid gap-6 xl:grid-cols-2">
          <GoalPlanner portfolioReturn={stats.cagr} histReturns={stats.returns} />
          <Staggered3a />
        </div>
        <Mortgage />
        <div className="grid gap-6 xl:grid-cols-2">
          <NetWorth portfolioReturn={stats.cagr} />
          <CantonTax />
        </div>
        <CurrencyView data={data} stats={stats} weights={weights} />
      </div>
    </section>
  );
}
