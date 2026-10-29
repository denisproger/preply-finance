// Currency helpers: parsing, rounding, conversion to the base currency (CZK)
// and consistent formatting. Every CZK figure in the app goes through
// `toBase`, so the dashboard, reports and lists can never disagree.

export const BASE_CURRENCY = 'CZK';
export const CURRENCIES = ['CZK', 'USD', 'EUR'];

/**
 * Emergency rates used only when no live, cached or manual rate exists
 * (e.g. very first launch while offline). The UI labels them as "default"
 * and asks the user to refresh or enter a manual rate.
 */
export const EMERGENCY_RATES = { USD: 23.0, EUR: 24.5 };

/** Round to 2 decimals without the 1.005 -> 1.00 float trap. */
export function round2(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
}

/** Accepts "1 234,50", "1,234.50", "12.5", "12,5". Returns NaN when invalid. */
export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  if (typeof input !== 'string') return NaN;
  let s = input.trim().replace(/[\s ']/g, '');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal separator.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(',', '.');
  }
  if (!/^-?\d*\.?\d+$/.test(s) && !/^-?\d+\.?$/.test(s)) return NaN;
  return Number(s);
}

/**
 * Convert an amount to CZK.
 * Priority: CZK as-is -> the transaction's own recorded rate -> current rate.
 * @returns {{ value:number, rate:number, fallback:boolean }}
 *   `fallback` is true when the current (not historical) rate was used.
 */
export function toBase(amount, currency, txnRate, rates) {
  const a = Number(amount) || 0;
  if (!currency || currency === BASE_CURRENCY) return { value: a, rate: 1, fallback: false };
  if (Number(txnRate) > 0) return { value: a * Number(txnRate), rate: Number(txnRate), fallback: false };
  const r = Number(rates?.[currency]) > 0 ? Number(rates[currency]) : EMERGENCY_RATES[currency] || 0;
  return { value: a * r, rate: r, fallback: true };
}

const numberFormatters = new Map();
function nf(decimals) {
  if (!numberFormatters.has(decimals)) {
    numberFormatters.set(
      decimals,
      new Intl.NumberFormat('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    );
  }
  return numberFormatters.get(decimals);
}

const SYMBOLS = { USD: { sym: '$', pre: true }, EUR: { sym: '€', pre: true }, CZK: { sym: 'Kč', pre: false } };

/** formatMoney(1234.5, 'CZK') -> "1,234.50 Kč"; formatMoney(98.4,'USD') -> "$98.40". */
export function formatMoney(amount, currency = BASE_CURRENCY, { decimals = 2, sign = false } = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const abs = nf(decimals).format(Math.abs(round2(n)));
  const neg = round2(n) < 0;
  const s = SYMBOLS[currency] || { sym: currency, pre: false };
  const core = s.pre ? `${s.sym}${abs}` : `${abs} ${s.sym}`;
  if (neg) return `−${core}`;
  if (sign && n > 0) return `+${core}`;
  return core;
}

/** Compact axis labels: 12500 -> "12.5k". */
export function formatCompact(n) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(v));
}

export function formatPercent(n, decimals = 1) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toFixed(decimals)}%`;
}

export function formatRate(r) {
  return Number(r) > 0 ? Number(r).toFixed(3) : '—';
}
