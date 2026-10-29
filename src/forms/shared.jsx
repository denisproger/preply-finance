import { useState } from 'react';
import { Field, Segmented } from '../components/ui.jsx';
import { CURRENCIES, formatMoney, formatRate, parseAmount, toBase } from '../lib/money.js';
import { fetchHistoricalRate } from '../services/exchangeRate.js';
import { useRates } from '../lib/hooks.js';

export function CurrencyPicker({ value, onChange }) {
  return <Segmented size="sm" label="Currency" value={value} onChange={onChange} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />;
}

/** Large amount input with currency switch. */
export function AmountField({ label = 'Amount', amount, setAmount, currency, setCurrency, error, autoFocus, id = 'amount' }) {
  return (
    <Field label={label} error={error} htmlFor={id} className="amount-field">
      <div className="amount-row">
        <input
          id={id}
          className="input input-amount num"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={!!error}
          {...(autoFocus ? { 'data-autofocus': true } : {})}
        />
        {setCurrency && <CurrencyPicker value={currency} onChange={setCurrency} />}
      </div>
    </Field>
  );
}

/**
 * Exchange rate recorded on a transaction (CZK per 1 unit).
 * Prefilled with the current rate so the transaction's CZK value stays fixed
 * historically. Empty = always convert with the current rate (shown as ≈).
 */
export function RateField({ currency, value, onChange, date, amount }) {
  const rates = useRates();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (currency === 'CZK') return null;
  const current = rates.rates[currency];
  const n = parseAmount(value);
  const amt = parseAmount(amount);
  const preview = Number.isFinite(amt) ? toBase(amt, currency, n > 0 ? n : null, rates.rates).value : null;
  const loadHistorical = async () => {
    setBusy(true);
    setErr('');
    try {
      onChange(String(await fetchHistoricalRate(currency, date)));
    } catch {
      setErr('Historical rate unavailable (offline?). Enter it manually.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field
      label={`Exchange rate (CZK per 1 ${currency})`}
      optional
      error={value !== '' && !(n > 0) ? 'Enter a positive rate or leave empty' : err}
      hint={
        value === ''
          ? `Empty: converted with the current rate (${formatRate(current)}) — value will change when the rate changes.`
          : preview !== null
            ? `= ${formatMoney(preview, 'CZK')}`
            : 'Recorded rate keeps this transaction’s CZK value fixed.'
      }
      htmlFor="fx-rate"
    >
      <div className="inline-row">
        <input id="fx-rate" className="input num" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={formatRate(current)} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(String(current))}>Current</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={loadHistorical} disabled={busy || !date}>
          {busy ? '…' : 'On date'}
        </button>
      </div>
    </Field>
  );
}

export function RepeatField({ value, onChange, help }) {
  return (
    <Field label="Repeat" hint={help}>
      <Segmented
        size="sm"
        label="Repeat"
        value={value}
        onChange={onChange}
        options={[
          { value: 'none', label: 'Once' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'yearly', label: 'Yearly' },
        ]}
      />
    </Field>
  );
}

/** Default rate to prefill for a currency (empty when only the emergency default exists). */
export function defaultRateFor(currency, rates) {
  if (currency === 'CZK' || rates.mode === 'default') return '';
  return String(rates.rates[currency] ?? '');
}

export const parsePositive = (v) => {
  const n = parseAmount(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
