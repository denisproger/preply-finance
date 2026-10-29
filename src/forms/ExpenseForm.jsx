import { useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { TextInput, TextArea, Field } from '../components/ui.jsx';
import { AmountField, RateField, RepeatField, defaultRateFor, parsePositive } from './shared.jsx';
import { useData } from '../data/useData.js';
import { useRates, useSubmitGuard } from '../lib/hooks.js';
import { saveExpense, createRecurring } from '../data/actions.js';
import { todayISO, isValidISODate } from '../lib/dates.js';
import { PAYMENT_METHODS } from '../data/schema.js';
import { useApp } from '../components/AppContext.jsx';
import { useT } from '../i18n/index.js';
import { formatMoney } from '../lib/money.js';

/** Quick-add / edit expense. `initial` may be an existing expense (edit) or a template (duplicate). */
export default function ExpenseForm({ initial, onClose }) {
  const t = useT();
  const { toast } = useApp();
  const categories = useData((d) => d.expenseCategories);
  const settings = useData((d) => d.settings);
  const rates = useRates();
  const editing = !!initial?.id;
  const startCurrency = initial?.currency || settings.defaultExpenseCurrency;

  const blank = () => ({
    amount: initial?.amount ? String(initial.amount) : '',
    currency: startCurrency,
    categoryId: initial?.categoryId || '',
    date: initial?.date || todayISO(),
    description: initial?.description || '',
    paymentMethod: initial?.paymentMethod || '',
    notes: initial?.notes || '',
    fxRate: initial?.fxRate ? String(initial.fxRate) : editing ? '' : defaultRateFor(startCurrency, rates),
    repeat: 'none',
  });
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState({});
  const [more, setMore] = useState(!!(initial?.notes || (initial?.currency && initial.currency !== 'CZK')));
  const [busy, guard] = useSubmitGuard();
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const setCurrency = (c) => setF((s) => ({ ...s, currency: c, fxRate: defaultRateFor(c, rates) }));

  const title = editing ? 'Edit expense' : initial ? 'Duplicate expense' : t('actions.addExpense');

  const validate = () => {
    const e = {};
    const amount = parsePositive(f.amount);
    if (!amount) e.amount = 'Enter an amount greater than 0';
    if (!f.categoryId) e.categoryId = 'Pick a category';
    if (!isValidISODate(f.date)) e.date = 'Enter a valid date';
    if (f.currency !== 'CZK' && f.fxRate !== '' && !parsePositive(f.fxRate)) e.fxRate = 'Invalid rate';
    setErrors(e);
    return Object.keys(e).length ? null : amount;
  };

  const submit = (addAnother) => guard(async () => {
    const amount = validate();
    if (!amount) return;
    const record = {
      ...(editing ? { id: initial.id, recurringId: initial.recurringId, occurrenceKey: initial.occurrenceKey } : {}),
      amount,
      currency: f.currency,
      categoryId: f.categoryId,
      date: f.date,
      description: f.description.trim(),
      paymentMethod: f.paymentMethod,
      notes: f.notes.trim(),
      fxRate: f.currency === 'CZK' ? null : parsePositive(f.fxRate),
    };
    if (!editing && f.repeat !== 'none') {
      // The rule creates the first occurrence itself (if it's due), so we don't save the record separately.
      createRecurring({
        kind: 'expense',
        frequency: f.repeat,
        dayOfMonth: Number(f.date.slice(8, 10)),
        startDate: f.date,
        endDate: null,
        template: { amount, currency: f.currency, categoryId: f.categoryId, description: record.description, paymentMethod: f.paymentMethod, notes: record.notes },
      });
      toast(f.date > todayISO() ? 'Recurring expense scheduled' : 'Recurring expense added');
    } else {
      saveExpense(record);
      toast(editing ? 'Expense updated' : `Expense added · ${formatMoney(amount, f.currency)}`);
    }
    if (addAnother) {
      setF((s) => ({ ...s, amount: '', description: '', notes: '', repeat: 'none' }));
      setErrors({});
      document.getElementById('amount')?.focus();
    } else onClose();
  });

  const catChips = useMemo(() => categories, [categories]);

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          {!editing && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => submit(true)}>
              Save &amp; add another
            </button>
          )}
          <button type="submit" form="expense-form" className="btn btn-primary" disabled={busy}>
            {busy ? t('actions.saving') : t('actions.save')}
          </button>
        </>
      }
    >
      <form id="expense-form" className="form" onSubmit={(e) => { e.preventDefault(); submit(false); }} noValidate>
        <AmountField amount={f.amount} setAmount={set('amount')} currency={f.currency} setCurrency={setCurrency} error={errors.amount} autoFocus />

        <Field label={t('common.category')} error={errors.categoryId}>
          <div className="chip-grid" role="radiogroup" aria-label="Category">
            {catChips.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={f.categoryId === c.id}
                className={`chip ${f.categoryId === c.id ? 'on' : ''}`}
                onClick={() => setF((s) => ({ ...s, categoryId: c.id }))}
              >
                <span className="chip-icon" aria-hidden>{c.icon || '•'}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid-2">
          <TextInput label={t('common.description')} value={f.description} onChange={set('description')} placeholder="e.g. Lidl, tram ticket" maxLength={200} />
          <TextInput label={t('common.date')} type="date" value={f.date} onChange={set('date')} error={errors.date} required />
        </div>

        <Field label="Payment method" optional>
          <div className="chip-row">
            {PAYMENT_METHODS.map((m) => (
              <button key={m} type="button" className={`chip chip-sm ${f.paymentMethod === m ? 'on' : ''}`} aria-pressed={f.paymentMethod === m}
                onClick={() => setF((s) => ({ ...s, paymentMethod: s.paymentMethod === m ? '' : m }))}>
                {t(`pay.${m}`)}
              </button>
            ))}
          </div>
        </Field>

        <button type="button" className="disclosure" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? '− Fewer options' : '+ More options (notes, rate, repeat)'}
        </button>
        {more && (
          <>
            <RateField currency={f.currency} value={f.fxRate} onChange={set('fxRate')} date={f.date} amount={f.amount} />
            {!editing && <RepeatField value={f.repeat} onChange={set('repeat')} help="Recurring expenses (rent, subscriptions) are created once per period — never duplicated on refresh." />}
            <TextArea label={t('common.notes')} optional value={f.notes} onChange={set('notes')} maxLength={2000} />
          </>
        )}
      </form>
    </Modal>
  );
}
