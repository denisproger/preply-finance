// Unified, display-ready list of all records (for "recent transactions").
import { entryAmounts, baseAmount, usesFallback } from './finance.js';

export function allTransactions(data, rates) {
  const stu = new Map(data.students.map((s) => [s.id, s.name]));
  const ecat = new Map(data.expenseCategories.map((c) => [c.id, c]));
  const icat = new Map(data.incomeCategories.map((c) => [c.id, c]));
  const out = [];
  for (const e of data.preplyEntries) {
    const a = entryAmounts(e, rates);
    out.push({
      id: e.id, kind: 'preply', date: e.date, createdAt: e.createdAt, status: e.status,
      label: stu.get(e.studentId) || 'Student', sub: `Preply · ${e.lessons || 0} lesson${e.lessons === 1 ? '' : 's'}`,
      icon: '🎓', base: a.netBase, amount: a.net, currency: e.currency, fallback: a.fallback, sign: 1, record: e,
    });
  }
  for (const r of data.otherIncome) {
    const c = icat.get(r.categoryId);
    out.push({
      id: r.id, kind: 'income', date: r.date, createdAt: r.createdAt, status: r.status,
      label: r.title || r.source || c?.name || 'Income', sub: [r.source, c?.name].filter(Boolean).join(' · '),
      icon: c?.icon || '💵', base: baseAmount(r, rates), amount: r.amount, currency: r.currency, fallback: usesFallback(r, rates), sign: 1, record: r,
    });
  }
  for (const x of data.expenses) {
    const c = ecat.get(x.categoryId);
    out.push({
      id: x.id, kind: 'expense', date: x.date, createdAt: x.createdAt, status: 'paid',
      label: x.description || c?.name || 'Expense', sub: c?.name || '',
      icon: c?.icon || '•', base: baseAmount(x, rates), amount: x.amount, currency: x.currency, fallback: usesFallback(x, rates), sign: -1, record: x,
    });
  }
  return out.sort((a, b) => (a.date === b.date ? (b.createdAt || '').localeCompare(a.createdAt || '') : a.date < b.date ? 1 : -1));
}
