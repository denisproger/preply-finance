// Versioned data model + validation/normalisation.
//
// Everything the app knows lives in ONE plain JSON object (AppData). The
// storage adapter persists it; this module guarantees that whatever comes
// out of storage or a backup file is well-formed before the UI sees it.

import { newId } from '../lib/ids.js';
import { isValidISODate, todayISO } from '../lib/dates.js';
import { CURRENCIES } from '../lib/money.js';

export const DATA_VERSION = 1;
export const APP_VERSION = '1.0.0';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'cat_groceries', name: 'Groceries & food', icon: '🛒' },
  { id: 'cat_restaurants', name: 'Restaurants & cafes', icon: '☕' },
  { id: 'cat_parties', name: 'Parties & nightlife', icon: '🎉' },
  { id: 'cat_alcohol', name: 'Alcohol & entertainment', icon: '🍻' },
  { id: 'cat_transport', name: 'Transport', icon: '🚋' },
  { id: 'cat_rent', name: 'Rent & accommodation', icon: '🏠' },
  { id: 'cat_utilities', name: 'Utilities & bills', icon: '💡' },
  { id: 'cat_shopping', name: 'Shopping & clothing', icon: '🛍️' },
  { id: 'cat_health', name: 'Health & pharmacy', icon: '💊' },
  { id: 'cat_sports', name: 'Sports & gym', icon: '🥋' },
  { id: 'cat_subscriptions', name: 'Subscriptions', icon: '🔁' },
  { id: 'cat_education', name: 'Education', icon: '📚' },
  { id: 'cat_travel', name: 'Travel', icon: '✈️' },
  { id: 'cat_other', name: 'Other', icon: '•' },
];
export const FALLBACK_EXPENSE_CATEGORY = 'cat_other';

export const DEFAULT_INCOME_CATEGORIES = [
  { id: 'inc_coaching', name: 'Coaching', icon: '🥋' },
  { id: 'inc_private', name: 'Private lessons', icon: '🎓' },
  { id: 'inc_freelance', name: 'Freelance work', icon: '💻' },
  { id: 'inc_onetime', name: 'One-time job', icon: '🧰' },
  { id: 'inc_cash', name: 'Cash payment', icon: '💵' },
  { id: 'inc_other', name: 'Other', icon: '•' },
];
export const FALLBACK_INCOME_CATEGORY = 'inc_other';

export const PAYMENT_METHODS = ['card', 'cash', 'bank', 'other'];
export const STUDENT_STATUSES = ['active', 'paused', 'archived'];
export const PREPLY_STATUSES = ['expected', 'received', 'paid_out'];
export const INCOME_STATUSES = ['expected', 'received'];

export function defaultSettings() {
  return {
    baseCurrency: 'CZK',
    defaultIncomeCurrency: 'USD',
    defaultExpenseCurrency: 'CZK',
    defaultCommissionPct: 18,
    theme: 'system', // 'system' | 'light' | 'dark'
    language: 'en',
    monthlyBudget: 0, // CZK, 0 = not set
    categoryBudgets: {}, // { [categoryId]: CZK }
    budgetWarnPct: 80,
    rateMode: 'auto', // 'auto' (API) | 'manual'
    manualRates: { USD: null, EUR: null },
  };
}

export function emptyData() {
  return {
    version: DATA_VERSION,
    settings: defaultSettings(),
    exchange: null, // { rates:{USD,EUR}, date, fetchedAt, provider }
    students: [],
    preplyEntries: [],
    payouts: [],
    otherIncome: [],
    expenses: [],
    recurring: [],
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c })),
    incomeCategories: DEFAULT_INCOME_CATEGORIES.map((c) => ({ ...c })),
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  };
}

// ---------- small coercion helpers ----------
const str = (v, max = 500) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : fallback);
const posOrNull = (v) => (Number(v) > 0 ? Number(v) : null);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const cur = (v, fallback) => oneOf(v, CURRENCIES, fallback);
const id = (v, prefix) => (typeof v === 'string' && v.length > 2 ? v : newId(prefix));
const date = (v) => (isValidISODate(v) ? v : null);
const arr = (v) => (Array.isArray(v) ? v : []);

function normStudent(s, settings) {
  if (!s || typeof s !== 'object' || !str(s.name).trim()) return null;
  return {
    id: id(s.id, 'stu'),
    name: str(s.name, 120).trim(),
    notes: str(s.notes, 2000),
    currency: cur(s.currency, settings.defaultIncomeCurrency),
    paymentModel: oneOf(s.paymentModel, ['per_lesson', 'subscription'], 'per_lesson'),
    pricePerLesson: Math.max(0, num(s.pricePerLesson)),
    expectedLessons: Math.max(0, num(s.expectedLessons)),
    subscriptionAmount: Math.max(0, num(s.subscriptionAmount)),
    // null = follow the global default from Settings
    commissionPct: s.commissionPct === null || s.commissionPct === '' || s.commissionPct === undefined
      ? null
      : Math.min(100, Math.max(0, num(s.commissionPct, settings.defaultCommissionPct))),
    status: oneOf(s.status, STUDENT_STATUSES, 'active'),
    // Reserved for a future official Preply integration (not used today).
    externalRef: s.externalRef ?? null,
    createdAt: str(s.createdAt) || new Date().toISOString(),
    updatedAt: str(s.updatedAt) || new Date().toISOString(),
  };
}

function normPreplyEntry(e, studentIds) {
  if (!e || typeof e !== 'object' || !studentIds.has(e.studentId) || !date(e.date)) return null;
  const gross = num(e.gross, NaN);
  if (!Number.isFinite(gross) || gross < 0) return null;
  return {
    id: id(e.id, 'ppl'),
    studentId: e.studentId,
    date: e.date,
    lessons: Math.max(0, num(e.lessons)),
    gross,
    currency: cur(e.currency, 'USD'),
    commissionPct: Math.min(100, Math.max(0, num(e.commissionPct, 18))),
    status: oneOf(e.status, PREPLY_STATUSES, 'received'),
    fxRate: posOrNull(e.fxRate),
    notes: str(e.notes, 2000),
    source: 'manual',
    createdAt: str(e.createdAt) || new Date().toISOString(),
    updatedAt: str(e.updatedAt) || new Date().toISOString(),
  };
}

function normPayout(p) {
  if (!p || typeof p !== 'object' || !date(p.date) || !(num(p.amount) > 0)) return null;
  return {
    id: id(p.id, 'pay'),
    date: p.date,
    amount: num(p.amount),
    currency: cur(p.currency, 'USD'),
    receivedCzk: posOrNull(p.receivedCzk),
    notes: str(p.notes, 2000),
    createdAt: str(p.createdAt) || new Date().toISOString(),
  };
}

function normIncome(r, catIds) {
  if (!r || typeof r !== 'object' || !date(r.date)) return null;
  const amount = num(r.amount, NaN);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return {
    id: id(r.id, 'inc'),
    title: str(r.title, 200),
    source: str(r.source, 120),
    categoryId: catIds.has(r.categoryId) ? r.categoryId : FALLBACK_INCOME_CATEGORY,
    amount,
    currency: cur(r.currency, 'CZK'),
    date: r.date,
    status: oneOf(r.status, INCOME_STATUSES, 'received'),
    fxRate: posOrNull(r.fxRate),
    notes: str(r.notes, 2000),
    recurringId: r.recurringId || null,
    occurrenceKey: r.occurrenceKey || null,
    createdAt: str(r.createdAt) || new Date().toISOString(),
    updatedAt: str(r.updatedAt) || new Date().toISOString(),
  };
}

function normExpense(x, catIds) {
  if (!x || typeof x !== 'object' || !date(x.date)) return null;
  const amount = num(x.amount, NaN);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id: id(x.id, 'exp'),
    amount,
    currency: cur(x.currency, 'CZK'),
    categoryId: catIds.has(x.categoryId) ? x.categoryId : FALLBACK_EXPENSE_CATEGORY,
    date: x.date,
    description: str(x.description, 200),
    paymentMethod: oneOf(x.paymentMethod, PAYMENT_METHODS, ''),
    notes: str(x.notes, 2000),
    fxRate: posOrNull(x.fxRate),
    recurringId: x.recurringId || null,
    occurrenceKey: x.occurrenceKey || null,
    createdAt: str(x.createdAt) || new Date().toISOString(),
    updatedAt: str(x.updatedAt) || new Date().toISOString(),
  };
}

function normRecurring(r) {
  if (!r || typeof r !== 'object' || !['expense', 'income'].includes(r.kind) || !date(r.startDate)) return null;
  if (!r.template || typeof r.template !== 'object') return null;
  return {
    id: id(r.id, 'rec'),
    kind: r.kind,
    frequency: oneOf(r.frequency, ['monthly', 'yearly'], 'monthly'),
    dayOfMonth: Math.min(31, Math.max(1, Math.round(num(r.dayOfMonth, 1)))),
    startDate: r.startDate,
    endDate: date(r.endDate),
    template: { ...r.template },
    // Occurrence keys ('2026-10' / '2026') already created. Kept even if the
    // user deletes an occurrence, so it is never silently re-created.
    generatedKeys: arr(r.generatedKeys).filter((k) => typeof k === 'string'),
    createdAt: str(r.createdAt) || new Date().toISOString(),
  };
}

function normCategories(list, defaults, fallbackId, prefix) {
  const seen = new Set();
  const out = [];
  for (const c of arr(list)) {
    if (!c || typeof c !== 'object' || !str(c.name).trim()) continue;
    const cid = id(c.id, prefix);
    if (seen.has(cid)) continue;
    seen.add(cid);
    out.push({ id: cid, name: str(c.name, 60).trim(), icon: str(c.icon, 8) });
  }
  if (!out.length) return defaults.map((c) => ({ ...c }));
  // The fallback ("Other") category must always exist so records can be reassigned.
  if (!seen.has(fallbackId)) out.push({ ...defaults.find((c) => c.id === fallbackId) });
  return out;
}

function normSettings(s) {
  const d = defaultSettings();
  if (!s || typeof s !== 'object') return d;
  const budgets = {};
  if (s.categoryBudgets && typeof s.categoryBudgets === 'object') {
    for (const [k, v] of Object.entries(s.categoryBudgets)) if (Number(v) > 0) budgets[k] = Number(v);
  }
  return {
    ...d,
    defaultIncomeCurrency: cur(s.defaultIncomeCurrency, d.defaultIncomeCurrency),
    defaultExpenseCurrency: cur(s.defaultExpenseCurrency, d.defaultExpenseCurrency),
    defaultCommissionPct: Math.min(100, Math.max(0, num(s.defaultCommissionPct, d.defaultCommissionPct))),
    theme: oneOf(s.theme, ['system', 'light', 'dark'], 'system'),
    language: typeof s.language === 'string' ? s.language : 'en',
    monthlyBudget: Math.max(0, num(s.monthlyBudget)),
    categoryBudgets: budgets,
    budgetWarnPct: Math.min(100, Math.max(1, num(s.budgetWarnPct, 80))),
    rateMode: oneOf(s.rateMode, ['auto', 'manual'], 'auto'),
    manualRates: {
      USD: posOrNull(s.manualRates?.USD),
      EUR: posOrNull(s.manualRates?.EUR),
    },
  };
}

function normExchange(x) {
  if (!x || typeof x !== 'object' || !x.rates) return null;
  const USD = posOrNull(x.rates.USD);
  if (!USD) return null;
  return { rates: { USD, EUR: posOrNull(x.rates.EUR) }, date: str(x.date, 20), fetchedAt: str(x.fetchedAt, 40), provider: str(x.provider, 60) };
}

/** Upgrade older data versions. Add a case for every future schema change. */
export function migrate(raw) {
  const data = { ...raw };
  const v = Number(data.version) || 0;
  if (v > DATA_VERSION) throw new Error(`Data was created by a newer app version (data v${v}).`);
  // v0 -> v1: nothing to transform yet; normalisation fills defaults.
  data.version = DATA_VERSION;
  return data;
}

/**
 * Validate and repair an AppData object.
 * Returns { data, issues } — `issues` lists anything dropped or repaired.
 */
export function normalizeData(raw) {
  const issues = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { data: emptyData(), issues: ['Stored data was not an object; started empty.'] };
  }
  const src = migrate(raw);
  const settings = normSettings(src.settings);
  const expenseCategories = normCategories(src.expenseCategories, DEFAULT_EXPENSE_CATEGORIES, FALLBACK_EXPENSE_CATEGORY, 'cat');
  const incomeCategories = normCategories(src.incomeCategories, DEFAULT_INCOME_CATEGORIES, FALLBACK_INCOME_CATEGORY, 'inc');

  const clean = (list, fn, label) => {
    const input = arr(list);
    const out = [];
    const ids = new Set();
    for (const item of input) {
      const n = fn(item);
      if (!n || ids.has(n.id)) continue;
      ids.add(n.id);
      out.push(n);
    }
    if (out.length !== input.length) issues.push(`${input.length - out.length} invalid ${label} record(s) skipped.`);
    return out;
  };

  const students = clean(src.students, (s) => normStudent(s, settings), 'student');
  const studentIds = new Set(students.map((s) => s.id));
  const expCatIds = new Set(expenseCategories.map((c) => c.id));
  const incCatIds = new Set(incomeCategories.map((c) => c.id));

  const data = {
    version: DATA_VERSION,
    settings,
    exchange: normExchange(src.exchange),
    students,
    preplyEntries: clean(src.preplyEntries, (e) => normPreplyEntry(e, studentIds), 'Preply'),
    payouts: clean(src.payouts, normPayout, 'payout'),
    otherIncome: clean(src.otherIncome, (r) => normIncome(r, incCatIds), 'income'),
    expenses: clean(src.expenses, (x) => normExpense(x, expCatIds), 'expense'),
    recurring: clean(src.recurring, normRecurring, 'recurring rule'),
    expenseCategories,
    incomeCategories,
    meta: {
      createdAt: str(src.meta?.createdAt) || new Date().toISOString(),
      updatedAt: str(src.meta?.updatedAt) || new Date().toISOString(),
    },
  };
  return { data, issues };
}

/** Quick structural check used before importing a backup file. */
export function looksLikeBackup(obj) {
  return (
    obj && typeof obj === 'object' && !Array.isArray(obj) &&
    ('students' in obj || 'expenses' in obj || 'otherIncome' in obj) &&
    Number.isFinite(Number(obj.version))
  );
}

export function summarizeData(d) {
  return {
    students: d.students.length,
    preplyEntries: d.preplyEntries.length,
    payouts: d.payouts.length,
    otherIncome: d.otherIncome.length,
    expenses: d.expenses.length,
    recurring: d.recurring.length,
  };
}

export { todayISO };
