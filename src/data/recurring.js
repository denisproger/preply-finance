// Recurring transactions.
//
// A rule generates at most ONE record per period. Each period has a
// deterministic key ('2026-10' for monthly, '2026' for yearly) that is stored
// in rule.generatedKeys the moment the record is created. Because the key is
// remembered — even if the user later deletes that record — refreshing or
// reopening the app can never create duplicates or resurrect deleted items.

import { newId } from '../lib/ids.js';
import { addMonths, dateInMonth, monthOf, todayISO } from '../lib/dates.js';

const MAX_BACKFILL = 60;

/** Period keys + dates a rule is due for, up to and including `horizonDate`. */
export function dueOccurrences(rule, horizonDate) {
  const out = [];
  const startMonth = monthOf(rule.startDate);
  const lastDate = rule.endDate && rule.endDate < horizonDate ? rule.endDate : horizonDate;
  if (rule.frequency === 'yearly') {
    const mm = rule.startDate.slice(5, 7);
    for (let y = Number(rule.startDate.slice(0, 4)); out.length < MAX_BACKFILL; y++) {
      const date = dateInMonth(`${y}-${mm}`, rule.dayOfMonth);
      if (date > lastDate) break;
      if (date >= rule.startDate) out.push({ key: String(y), date });
    }
  } else {
    for (let m = startMonth, i = 0; i < 600 && out.length < MAX_BACKFILL; m = addMonths(m, 1), i++) {
      const date = dateInMonth(m, rule.dayOfMonth);
      if (date > lastDate) break;
      if (date >= rule.startDate) out.push({ key: m, date });
    }
  }
  return out;
}

function buildRecord(rule, occ, today) {
  const t = rule.template;
  const now = new Date().toISOString();
  const base = {
    amount: Number(t.amount) || 0,
    currency: t.currency,
    date: occ.date,
    notes: t.notes || '',
    fxRate: null, // recurring items use the current rate unless edited later
    recurringId: rule.id,
    occurrenceKey: occ.key,
    createdAt: now,
    updatedAt: now,
  };
  if (rule.kind === 'expense') {
    return {
      ...base,
      id: newId('exp'),
      categoryId: t.categoryId,
      description: t.description || '',
      paymentMethod: t.paymentMethod || '',
    };
  }
  return {
    ...base,
    id: newId('inc'),
    title: t.title || '',
    source: t.source || '',
    categoryId: t.categoryId,
    // Future-dated income is always "expected"; past/today keeps the template status.
    status: occ.date > today ? 'expected' : t.status === 'received' ? 'received' : 'expected',
  };
}

/**
 * Create any due occurrences. Pure: returns a new data object (or the same
 * one when nothing changed) plus the number of records created.
 * Expenses are generated up to today; income up to the end of this month
 * (so this month's expected coaching payment shows up in forecasts).
 */
export function generateRecurring(data, now = new Date()) {
  const today = todayISO(now);
  const endOfMonth = dateInMonth(monthOf(today), 31);
  let created = 0;
  const newExpenses = [];
  const newIncome = [];
  const rules = data.recurring.map((rule) => {
    const horizon = rule.kind === 'expense' ? today : endOfMonth;
    const known = new Set(rule.generatedKeys);
    const fresh = dueOccurrences(rule, horizon).filter((o) => !known.has(o.key));
    if (!fresh.length) return rule;
    for (const occ of fresh) {
      const rec = buildRecord(rule, occ, today);
      (rule.kind === 'expense' ? newExpenses : newIncome).push(rec);
      created++;
    }
    return { ...rule, generatedKeys: [...rule.generatedKeys, ...fresh.map((o) => o.key)] };
  });
  if (!created) return { data, created: 0 };
  return {
    data: {
      ...data,
      recurring: rules,
      expenses: [...data.expenses, ...newExpenses],
      otherIncome: [...data.otherIncome, ...newIncome],
    },
    created,
  };
}

export function describeRule(rule) {
  return rule.frequency === 'yearly'
    ? `Yearly on ${rule.startDate.slice(5)} (day ${rule.dayOfMonth})`
    : `Monthly on day ${rule.dayOfMonth}`;
}

export function isRuleActive(rule, today = todayISO()) {
  return !rule.endDate || rule.endDate >= today;
}
