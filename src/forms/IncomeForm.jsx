import { useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { TextInput, TextArea, SelectInput, Field, Segmented } from '../components/ui.jsx';
import { AmountField, RateField, RepeatField, defaultRateFor, parsePositive } from './shared.jsx';
import { useData } from '../data/useData.js';
import { useRates, useSubmitGuard } from '../lib/hooks.js';
import { saveIncome, createRecurring } from '../data/actions.js';
import { todayISO, isValidISODate } from '../lib/dates.js';
import { useApp } from '../components/AppContext.jsx';
import { useT } from '../i18n/index.js';

/** Non-Preply income (coaching, freelance, cash jobs…). No commission is applied. */
export default function IncomeForm({ initial, onClose }) {
  const t = useT();
  const { toast } = useApp();
  const categories = useData((d) => d.incomeCategories);
  const income = useData((d) => d.otherIncome);
  const rates = useRates();
  const editing = !!initial?.id;
  const startCurrency = initial?.currency || 'CZK';
  const [f, setF] = useState(() => ({
    title: initial?.title || '',
    source: initial?.source || '',
    categoryId: initial?.categoryId || categories[0]?.id || '',
    amount: initial?.amount ? String(initial.amount) : '',
    currency: startCurrency,
    date: initial?.date || todayISO(),
    status: initial?.status || 'received',
    notes: initial?.notes || '',
    fxRate: initial?.fxRate ? String(initial.fxRate) : editing ? '' : defaultRateFor(startCurrency, rates),
    repeat: 'none',
  }));
  const [errors, setErrors] = useState({});
  const [busy, guard] = useSubmitGuard();
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const sources = useMemo(() => [...new Set(income.map((r) => r.source).filter(Boolean))].sort(), [income]);

  const submit = (e) => {
    e.preventDefault();
    guard(async () => {
      const err = {};
      const amount = parsePositive(f.amount);
      if (!amount) err.amount = 'Enter an amount greater than 0';
      if (!f.title.trim() && !f.source.trim()) err.title = 'Add a title or a source';
      if (!isValidISODate(f.date)) err.date = 'Enter a valid date';
      if (f.currency !== 'CZK' && f.fxRate !== '' && !parsePositive(f.fxRate)) err.fxRate = 'Invalid rate';
      setErrors(err);
      if (Object.keys(err).length) return;
      const rec = {
        ...(editing ? { id: initial.id, recurringId: initial.recurringId, occurrenceKey: initial.occurrenceKey } : {}),
        title: f.title.trim(),
        source: f.source.trim(),
        categoryId: f.categoryId,
        amount,
        currency: f.currency,
        date: f.date,
        status: f.date > todayISO() && f.status === 'received' ? 'expected' : f.status,
        notes: f.notes.trim(),
        fxRate: f.currency === 'CZK' ? null : parsePositive(f.fxRate),
      };
      if (!editing && f.repeat !== 'none') {
        createRecurring({
          kind: 'income',
          frequency: f.repeat,
          dayOfMonth: Number(f.date.slice(8, 10)),
          startDate: f.date,
          endDate: null,
          template: { title: rec.title, source: rec.source, categoryId: rec.categoryId, amount, currency: f.currency, status: f.status, notes: rec.notes },
        });
        toast('Recurring income added');
      } else {
        saveIncome(rec);
        toast(editing ? 'Income updated' : 'Income added');
      }
      onClose();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit income' : t('actions.addIncome')}
      footer={<button type="submit" form="income-form" className="btn btn-primary" disabled={busy}>{busy ? t('actions.saving') : t('actions.save')}</button>}
    >
      <form id="income-form" className="form" onSubmit={submit} noValidate>
        <AmountField amount={f.amount} setAmount={set('amount')} currency={f.currency} setCurrency={(c) => setF((s) => ({ ...s, currency: c, fxRate: defaultRateFor(c, rates) }))} error={errors.amount} autoFocus />
        <div className="grid-2">
          <TextInput label="Title / description" value={f.title} onChange={set('title')} error={errors.title} placeholder="e.g. October BJJ classes" maxLength={200} />
          <Field label="Income source" htmlFor="inc-source" hint="e.g. a gym, client or employer">
            <input id="inc-source" className="input" list="income-sources" value={f.source} onChange={set('source')} maxLength={120} placeholder="e.g. Gracie Barra Ostrava" />
            <datalist id="income-sources">{sources.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
        </div>
        <div className="grid-2">
          <SelectInput label={t('common.category')} value={f.categoryId} onChange={set('categoryId')} options={categories.map((c) => ({ value: c.id, label: `${c.icon ? c.icon + ' ' : ''}${c.name}` }))} />
          <TextInput label={t('common.date')} type="date" value={f.date} onChange={set('date')} error={errors.date} />
        </div>
        <Field label={t('common.status')} hint={f.status === 'expected' ? 'Expected income is shown as upcoming and not counted in totals until marked received.' : 'Counted in this month’s totals.'}>
          <Segmented value={f.status} onChange={set('status')} label="Status" options={[{ value: 'received', label: t('status.received') }, { value: 'expected', label: t('status.expected') }]} />
        </Field>
        <RateField currency={f.currency} value={f.fxRate} onChange={set('fxRate')} date={f.date} amount={f.amount} />
        {!editing && <RepeatField value={f.repeat} onChange={set('repeat')} help="Creates one record per period (e.g. a monthly coaching payment). Edit or stop future ones in the Recurring tab." />}
        <TextArea label={t('common.notes')} optional value={f.notes} onChange={set('notes')} maxLength={2000} />
      </form>
    </Modal>
  );
}
