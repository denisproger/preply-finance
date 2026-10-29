// CSV export of all financial records as one flat table.
import { entryAmounts, baseAmount } from './finance.js';
import { round2 } from './money.js';

function cell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCSV(rows) {
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export const CSV_HEADER = [
  'date', 'type', 'status', 'student_or_source', 'category', 'description',
  'lessons', 'amount', 'currency', 'commission_pct', 'commission', 'net',
  'fx_rate_used', 'fx_rate_is_recorded', 'net_czk', 'payment_method', 'notes', 'id',
];

/** Build rows for every record, optionally restricted by a date predicate. */
export function buildRecordRows(data, rates, include = () => true) {
  const rows = [];
  const stu = new Map(data.students.map((s) => [s.id, s.name]));
  const ecat = new Map(data.expenseCategories.map((c) => [c.id, c.name]));
  const icat = new Map(data.incomeCategories.map((c) => [c.id, c.name]));
  for (const e of data.preplyEntries) {
    if (!include(e.date)) continue;
    const a = entryAmounts(e, rates);
    rows.push([e.date, 'preply', e.status, stu.get(e.studentId) || '', 'Preply', '', e.lessons, e.gross, e.currency,
      e.commissionPct, a.commission, a.net, a.rate, e.fxRate ? 'yes' : 'no', a.netBase, '', e.notes, e.id]);
  }
  for (const r of data.otherIncome) {
    if (!include(r.date)) continue;
    const rate = r.currency === 'CZK' ? 1 : r.fxRate || rates[r.currency];
    rows.push([r.date, 'income', r.status, r.source, icat.get(r.categoryId) || '', r.title, '', r.amount, r.currency,
      0, 0, r.amount, rate, r.fxRate || r.currency === 'CZK' ? 'yes' : 'no', baseAmount(r, rates), '', r.notes, r.id]);
  }
  for (const x of data.expenses) {
    if (!include(x.date)) continue;
    const rate = x.currency === 'CZK' ? 1 : x.fxRate || rates[x.currency];
    rows.push([x.date, 'expense', 'paid', '', ecat.get(x.categoryId) || '', x.description, '', x.amount, x.currency,
      '', '', round2(-x.amount), rate, x.fxRate || x.currency === 'CZK' ? 'yes' : 'no', round2(-baseAmount(x, rates)),
      x.paymentMethod, x.notes, x.id]);
  }
  for (const p of data.payouts) {
    if (!include(p.date)) continue;
    rows.push([p.date, 'preply_payout (transfer, not income)', 'paid_out', '', '', 'Withdrawal from Preply', '', p.amount,
      p.currency, '', '', '', p.receivedCzk ? round2(p.receivedCzk / p.amount) : '', p.receivedCzk ? 'yes' : 'no',
      p.receivedCzk || '', '', p.notes, p.id]);
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return [CSV_HEADER, ...rows];
}

/** Trigger a browser download. Works on desktop and iOS Safari (opens share sheet). */
export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCSV(filename, rows) {
  // BOM so Excel opens UTF-8 (Czech/Ukrainian characters) correctly.
  downloadFile(filename, '﻿' + toCSV(rows), 'text/csv;charset=utf-8');
}
