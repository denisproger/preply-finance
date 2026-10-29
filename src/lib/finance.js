// Financial calculations — pure functions, no React, no storage.
//
// Definitions used everywhere (all in CZK unless stated otherwise):
//   Preply net          = Preply gross − Preply commission
//   Total gross income  = Preply gross + other income
//   Total net income    = Preply net + other income   (no commission on other income)
//   Money left          = total net income − total expenses
//   Savings rate        = money left / total net income × 100  (null if income ≤ 0)
//
// "Actual" Preply income = records with status `received` or `paid_out`.
// A payout (withdrawal from the Preply balance to the bank) is a transfer of
// money that was already counted as income, so payouts are NEVER added to
// income totals — this is what prevents double-counting.

import { round2, toBase, EMERGENCY_RATES } from './money.js';
import { addMonths, lastNMonths, monthOf, monthsOfYear, startOfWeek, addDays } from './dates.js';

// ---------------------------------------------------------------- rates
/**
 * The single set of rates used for every conversion in the UI.
 * mode: 'manual' | 'api' (live or cached) | 'default' (emergency fallback)
 */
export function effectiveRates(data) {
  const s = data.settings;
  if (s.rateMode === 'manual' && s.manualRates.USD > 0) {
    return {
      rates: { USD: s.manualRates.USD, EUR: s.manualRates.EUR || data.exchange?.rates.EUR || EMERGENCY_RATES.EUR },
      mode: 'manual',
      date: null,
    };
  }
  if (data.exchange?.rates.USD > 0) {
    return {
      rates: { USD: data.exchange.rates.USD, EUR: data.exchange.rates.EUR || EMERGENCY_RATES.EUR },
      mode: 'api',
      date: data.exchange.date,
      fetchedAt: data.exchange.fetchedAt,
      provider: data.exchange.provider,
    };
  }
  return { rates: { ...EMERGENCY_RATES }, mode: 'default', date: null };
}

// ---------------------------------------------------------------- generic
export const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);

export function inMonth(list, monthKey) {
  return list.filter((r) => monthOf(r.date) === monthKey);
}

export function inRange(list, from, to) {
  return list.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
}

/** Converted CZK value of a simple record ({ amount, currency, fxRate }). */
export function baseAmount(rec, rates) {
  return round2(toBase(rec.amount, rec.currency, rec.fxRate, rates).value);
}

export function usesFallback(rec, rates) {
  return toBase(1, rec.currency, rec.fxRate, rates).fallback;
}

/** Percentage change; null when there's no meaningful baseline. */
export function percentChange(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Savings rate, guarded against zero / negative income. */
export function savingsRate(totalNet, totalExpenses) {
  if (!Number.isFinite(totalNet) || totalNet <= 0) return null;
  return ((totalNet - totalExpenses) / totalNet) * 100;
}

// ---------------------------------------------------------------- students
export function commissionPctFor(student, settings) {
  return student.commissionPct === null || student.commissionPct === undefined
    ? settings.defaultCommissionPct
    : student.commissionPct;
}

/**
 * Expected monthly figures from the student's plan (student's own currency).
 *   per lesson:   gross = price × expected lessons
 *   subscription: gross = fixed monthly amount
 *   commission = gross × pct / 100 ; net = gross − commission
 */
export function studentPlan(student, settings) {
  const pct = commissionPctFor(student, settings);
  const gross =
    student.paymentModel === 'subscription'
      ? round2(student.subscriptionAmount)
      : round2(student.pricePerLesson * student.expectedLessons);
  const commission = round2((gross * pct) / 100);
  return { gross, commission, net: round2(gross - commission), pct, lessons: student.expectedLessons };
}

/** Amounts for a single Preply record, original currency + CZK. */
export function entryAmounts(entry, rates) {
  const commission = round2((entry.gross * entry.commissionPct) / 100);
  const net = round2(entry.gross - commission);
  const conv = toBase(1, entry.currency, entry.fxRate, rates);
  const grossBase = round2(entry.gross * conv.rate);
  const commissionBase = round2(commission * conv.rate);
  return {
    gross: entry.gross,
    commission,
    net,
    grossBase,
    commissionBase,
    netBase: round2(grossBase - commissionBase),
    rate: conv.rate,
    fallback: conv.fallback,
  };
}

export const isActual = (entry) => entry.status === 'received' || entry.status === 'paid_out';

/** Aggregate Preply records into gross/commission/net (CZK). */
export function aggregatePreply(entries, rates) {
  let gross = 0;
  let commission = 0;
  let fallback = false;
  for (const e of entries) {
    const a = entryAmounts(e, rates);
    gross += a.grossBase;
    commission += a.commissionBase;
    fallback = fallback || a.fallback;
  }
  gross = round2(gross);
  commission = round2(commission);
  return { gross, commission, net: round2(gross - commission), fallback };
}

/** Per-student figures for one month (original currency, plus CZK). */
export function studentMonthStats(data, student, monthKey, rates) {
  const plan = studentPlan(student, data.settings);
  const entries = data.preplyEntries.filter((e) => e.studentId === student.id && monthOf(e.date) === monthKey);
  const actual = entries.filter(isActual);
  const expected = entries.filter((e) => e.status === 'expected');
  const sumOrig = (list, key) => round2(sum(list, (e) => entryAmounts(e, rates)[key]));
  const actualGross = sumOrig(actual, 'gross');
  const lessonsDone = sum(actual, (e) => e.lessons);
  const pendingGross = sumOrig(expected, 'gross');
  // Forecast for the month: never less than the plan, but if more has already
  // been earned/scheduled than planned, the recorded figure wins. Using max()
  // instead of plan + records avoids counting the same lesson twice.
  const forecastGross = student.status === 'active' ? Math.max(plan.gross, round2(actualGross + pendingGross)) : round2(actualGross + pendingGross);
  const pct = commissionPctFor(student, data.settings);
  const forecastCommission = round2((forecastGross * pct) / 100);
  const toCzk = (v) => round2(toBase(v, student.currency, null, rates).value);
  return {
    plan,
    entries,
    lessonsDone,
    lessonsPending: sum(expected, (e) => e.lessons),
    lessonsRemaining: Math.max(0, plan.lessons - lessonsDone),
    actualGross,
    actualCommission: sumOrig(actual, 'commission'),
    actualNet: sumOrig(actual, 'net'),
    actualNetBase: round2(sum(actual, (e) => entryAmounts(e, rates).netBase)),
    actualGrossBase: round2(sum(actual, (e) => entryAmounts(e, rates).grossBase)),
    pendingGross,
    forecastGross,
    forecastCommission,
    forecastNet: round2(forecastGross - forecastCommission),
    forecastNetBase: toCzk(round2(forecastGross - forecastCommission)),
    planNetBase: toCzk(plan.net),
    planGrossBase: toCzk(plan.gross),
    planCommissionBase: toCzk(plan.commission),
  };
}

/** Preply forecast for a month across students (CZK). Archived students are excluded. */
export function preplyForecast(data, monthKey, rates) {
  let gross = 0;
  let commission = 0;
  for (const s of data.students) {
    if (s.status === 'archived') continue;
    const st = studentMonthStats(data, s, monthKey, rates);
    gross += toBase(st.forecastGross, s.currency, null, rates).value;
    commission += toBase(st.forecastCommission, s.currency, null, rates).value;
  }
  gross = round2(gross);
  commission = round2(commission);
  return { gross, commission, net: round2(gross - commission) };
}

/** Plan-only projection (e.g. next month): active students' expected income in CZK. */
export function preplyPlanTotal(data, rates) {
  let gross = 0;
  let commission = 0;
  for (const s of data.students) {
    if (s.status !== 'active') continue;
    const p = studentPlan(s, data.settings);
    gross += toBase(p.gross, s.currency, null, rates).value;
    commission += toBase(p.commission, s.currency, null, rates).value;
  }
  gross = round2(gross);
  commission = round2(commission);
  return { gross, commission, net: round2(gross - commission) };
}

/**
 * Money still sitting in the Preply balance, per currency:
 * net of all `received` + `paid_out` records minus recorded payouts.
 */
export function preplyBalance(data) {
  const out = {};
  for (const e of data.preplyEntries) {
    if (!isActual(e)) continue;
    const net = round2(e.gross - round2((e.gross * e.commissionPct) / 100));
    out[e.currency] = round2((out[e.currency] || 0) + net);
  }
  for (const p of data.payouts) out[p.currency] = round2((out[p.currency] || 0) - p.amount);
  return out;
}

// ---------------------------------------------------------------- month summary
export function monthSummary(data, monthKey, rates) {
  const preplyActual = inMonth(data.preplyEntries, monthKey).filter(isActual);
  const preply = aggregatePreply(preplyActual, rates);
  const incomeRecs = inMonth(data.otherIncome, monthKey).filter((r) => r.status === 'received');
  const expenseRecs = inMonth(data.expenses, monthKey);
  const otherIncome = round2(sum(incomeRecs, (r) => baseAmount(r, rates)));
  const expenses = round2(sum(expenseRecs, (r) => baseAmount(r, rates)));
  const totalGross = round2(preply.gross + otherIncome);
  const totalNet = round2(preply.net + otherIncome);
  const left = round2(totalNet - expenses);
  const fallback =
    preply.fallback || incomeRecs.some((r) => usesFallback(r, rates)) || expenseRecs.some((r) => usesFallback(r, rates));
  return {
    month: monthKey,
    preplyGross: preply.gross,
    preplyCommission: preply.commission,
    preplyNet: preply.net,
    otherIncome,
    totalGross,
    totalNet,
    expenses,
    left,
    savingsRate: savingsRate(totalNet, expenses),
    usesFallbackRate: fallback,
    counts: { preply: preplyActual.length, income: incomeRecs.length, expenses: expenseRecs.length },
    isEmpty: !preplyActual.length && !incomeRecs.length && !expenseRecs.length,
  };
}

export function monthlySeries(data, months, rates) {
  return months.map((m) => monthSummary(data, m, rates));
}

export function lastMonthsSeries(data, endKey, n, rates) {
  return monthlySeries(data, lastNMonths(endKey, n), rates);
}

/** All months that have any record (sorted). */
export function monthsWithData(data) {
  const set = new Set();
  for (const k of ['preplyEntries', 'otherIncome', 'expenses']) for (const r of data[k]) set.add(monthOf(r.date));
  return [...set].sort();
}

/** Money left accumulated over every month up to and including `monthKey`. */
export function cumulativeSavings(data, monthKey, rates) {
  return round2(sum(monthsWithData(data).filter((m) => m <= monthKey), (m) => monthSummary(data, m, rates).left));
}

export function annualSummary(data, year, rates) {
  const months = monthlySeries(data, monthsOfYear(year), rates);
  const t = (k) => round2(sum(months, (m) => m[k]));
  const totals = {
    preplyGross: t('preplyGross'),
    preplyCommission: t('preplyCommission'),
    preplyNet: t('preplyNet'),
    otherIncome: t('otherIncome'),
    totalGross: t('totalGross'),
    totalNet: t('totalNet'),
    expenses: t('expenses'),
  };
  totals.left = round2(totals.totalNet - totals.expenses);
  totals.savingsRate = savingsRate(totals.totalNet, totals.expenses);
  return { months, totals };
}

// ---------------------------------------------------------------- breakdowns
/** Net income by source for a set of months (CZK): Preply per student + other sources. */
export function incomeBySource(data, months, rates, { preplyPerStudent = false } = {}) {
  const set = new Set(months);
  const map = new Map();
  const add = (key, name, v, kind) => {
    const cur = map.get(key) || { key, name, value: 0, kind };
    cur.value = round2(cur.value + v);
    map.set(key, cur);
  };
  const studentName = new Map(data.students.map((s) => [s.id, s.name]));
  for (const e of data.preplyEntries) {
    if (!set.has(monthOf(e.date)) || !isActual(e)) continue;
    const a = entryAmounts(e, rates);
    if (preplyPerStudent) add(`stu:${e.studentId}`, `Preply · ${studentName.get(e.studentId) || '?'}`, a.netBase, 'preply');
    else add('preply', 'Preply (net)', a.netBase, 'preply');
  }
  const catName = new Map(data.incomeCategories.map((c) => [c.id, c.name]));
  for (const r of data.otherIncome) {
    if (!set.has(monthOf(r.date)) || r.status !== 'received') continue;
    const label = r.source?.trim() || catName.get(r.categoryId) || 'Other';
    add(`src:${label.toLowerCase()}`, label, baseAmount(r, rates), 'other');
  }
  return [...map.values()].filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
}

/** Spending per category for a list of expense records, with budget usage. */
export function expensesByCategory(data, records, rates, { withBudgets = false } = {}) {
  const totals = new Map();
  for (const r of records) totals.set(r.categoryId, round2((totals.get(r.categoryId) || 0) + baseAmount(r, rates)));
  const all = sum([...totals.values()]);
  const rows = data.expenseCategories
    .map((c) => {
      const value = totals.get(c.id) || 0;
      const budget = data.settings.categoryBudgets[c.id] || 0;
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        value,
        share: all > 0 ? (value / all) * 100 : 0,
        budget,
        budgetState: budget > 0 ? budgetState(value, budget, data.settings.budgetWarnPct) : null,
      };
    })
    .filter((r) => r.value > 0 || (withBudgets && r.budget > 0));
  return rows.sort((a, b) => b.value - a.value);
}

/** Budget usage: level is 'ok', 'warn' (≥ warnPct) or 'over' (> 100%). */
export function budgetState(spent, budget, warnPct = 80) {
  if (!(budget > 0)) return null;
  const pct = (spent / budget) * 100;
  return {
    pct,
    remaining: round2(budget - spent),
    level: pct > 100 ? 'over' : pct >= warnPct ? 'warn' : 'ok',
  };
}

/** Today / this week / selected-month expense totals (CZK). */
export function expensePeriodTotals(data, today, monthKey, rates) {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const t = (list) => round2(sum(list, (r) => baseAmount(r, rates)));
  return {
    today: t(data.expenses.filter((r) => r.date === today)),
    week: t(inRange(data.expenses, weekStart, weekEnd)),
    month: t(inMonth(data.expenses, monthKey)),
    weekStart,
    weekEnd,
  };
}

/** Daily spending for every day of a month (for the bar chart). */
export function dailySpending(data, monthKey, rates, days) {
  const map = new Map();
  for (const r of inMonth(data.expenses, monthKey)) map.set(r.date, round2((map.get(r.date) || 0) + baseAmount(r, rates)));
  return Array.from({ length: days }, (_, i) => {
    const d = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
    return { date: d, day: i + 1, value: map.get(d) || 0 };
  });
}

/** Expected (not yet received) income: other income + Preply pending, from `fromDate` on. */
export function upcomingIncome(data, fromMonth, rates, limit = 8) {
  const studentName = new Map(data.students.map((s) => [s.id, s.name]));
  const items = [];
  for (const r of data.otherIncome) {
    if (r.status !== 'expected' || monthOf(r.date) < fromMonth) continue;
    items.push({ id: r.id, kind: 'income', date: r.date, label: r.title || r.source || 'Income', value: baseAmount(r, rates), amount: r.amount, currency: r.currency });
  }
  for (const e of data.preplyEntries) {
    if (e.status !== 'expected' || monthOf(e.date) < fromMonth) continue;
    const a = entryAmounts(e, rates);
    items.push({ id: e.id, kind: 'preply', date: e.date, label: `Preply · ${studentName.get(e.studentId) || '?'}`, value: a.netBase, amount: a.net, currency: e.currency });
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, limit);
}

export { addMonths };
