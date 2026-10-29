// Date helpers. All dates are stored as local calendar strings:
//   day   -> 'YYYY-MM-DD'
//   month -> 'YYYY-MM'
// Working with strings (not Date objects / UTC timestamps) avoids
// time-zone shifts that would move a transaction into another month.

const pad = (n) => String(n).padStart(2, '0');

export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonthKey(now = new Date()) {
  return todayISO(now).slice(0, 7);
}

export function monthOf(dateStr) {
  return typeof dateStr === 'string' ? dateStr.slice(0, 7) : '';
}

export function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function isValidMonthKey(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function addMonths(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Inclusive list of month keys ending at `endKey`. */
export function lastNMonths(endKey, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addMonths(endKey, -i));
  return out;
}

export function monthsOfYear(year) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
}

export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Build a date inside a month, clamping the day (e.g. 31 -> 30 in April). */
export function dateInMonth(monthKey, day) {
  const d = Math.min(Math.max(1, day), daysInMonth(monthKey));
  return `${monthKey}-${pad(d)}`;
}

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week containing `dateStr`. */
export function startOfWeek(dateStr) {
  const dt = parseISO(dateStr);
  const dow = (dt.getDay() + 6) % 7; // Monday = 0
  dt.setDate(dt.getDate() - dow);
  return todayISO(dt);
}

export function addDays(dateStr, n) {
  const dt = parseISO(dateStr);
  dt.setDate(dt.getDate() + n);
  return todayISO(dt);
}

export function compareMonth(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function formatMonth(monthKey, locale = 'en-GB', style = 'long') {
  if (!isValidMonthKey(monthKey)) return monthKey;
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: style, year: 'numeric' });
}

export function formatMonthShort(monthKey, locale = 'en-GB') {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short' }) + ` ’${String(y).slice(2)}`;
}

export function formatDate(dateStr, locale = 'en-GB') {
  if (!isValidISODate(dateStr)) return dateStr || '';
  return parseISO(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr, locale = 'en-GB') {
  if (!isValidISODate(dateStr)) return dateStr || '';
  return parseISO(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
