import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { TextInput, SelectInput, TextArea } from '../components/ui.jsx';
import { AmountField, parsePositive } from './shared.jsx';
import { useData } from '../data/useData.js';
import { useSubmitGuard } from '../lib/hooks.js';
import { updateRecurring } from '../data/actions.js';
import { isValidISODate } from '../lib/dates.js';
import { useApp } from '../components/AppContext.jsx';

/** Edit a recurring rule. Changes apply to future occurrences only. */
export default function RecurringForm({ rule, onClose }) {
  const { toast } = useApp();
  const cats = useData((d) => (rule.kind === 'expense' ? d.expenseCategories : d.incomeCategories));
  const tpl = rule.template;
  const [f, setF] = useState({
    amount: String(tpl.amount ?? ''),
    currency: tpl.currency || 'CZK',
    label: rule.kind === 'expense' ? tpl.description || '' : tpl.title || '',
    source: tpl.source || '',
    categoryId: tpl.categoryId,
    dayOfMonth: String(rule.dayOfMonth),
    endDate: rule.endDate || '',
    notes: tpl.notes || '',
  });
  const [errors, setErrors] = useState({});
  const [busy, guard] = useSubmitGuard();
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const submit = (e) => {
    e.preventDefault();
    guard(async () => {
      const err = {};
      const amount = parsePositive(f.amount);
      const day = Number(f.dayOfMonth);
      if (!amount) err.amount = 'Enter an amount';
      if (!(day >= 1 && day <= 31)) err.dayOfMonth = '1–31';
      if (f.endDate && !isValidISODate(f.endDate)) err.endDate = 'Invalid date';
      setErrors(err);
      if (Object.keys(err).length) return;
      const template = rule.kind === 'expense'
        ? { ...tpl, amount, currency: f.currency, description: f.label.trim(), categoryId: f.categoryId, notes: f.notes.trim() }
        : { ...tpl, amount, currency: f.currency, title: f.label.trim(), source: f.source.trim(), categoryId: f.categoryId, notes: f.notes.trim() };
      updateRecurring({ ...rule, dayOfMonth: day, endDate: f.endDate || null, template });
      toast('Recurring rule updated');
      onClose();
    });
  };
  return (
    <Modal open onClose={onClose} title={`Edit recurring ${rule.kind}`}
      footer={<button type="submit" form="rec-form" className="btn btn-primary" disabled={busy}>Save</button>}>
      <form id="rec-form" className="form" onSubmit={submit} noValidate>
        <p className="callout">Changes apply to future occurrences. Records already created stay as they are — edit those individually.</p>
        <AmountField amount={f.amount} setAmount={set('amount')} currency={f.currency} setCurrency={set('currency')} error={errors.amount} autoFocus />
        <div className="grid-2">
          <TextInput label={rule.kind === 'expense' ? 'Description' : 'Title'} value={f.label} onChange={set('label')} />
          {rule.kind === 'income' && <TextInput label="Source" value={f.source} onChange={set('source')} />}
          <SelectInput label="Category" value={f.categoryId} onChange={set('categoryId')} options={cats.map((c) => ({ value: c.id, label: c.name }))} />
        </div>
        <div className="grid-2">
          <TextInput label="Day of month" inputMode="numeric" value={f.dayOfMonth} onChange={set('dayOfMonth')} error={errors.dayOfMonth} hint="31 = last day in shorter months" />
          <TextInput label="End date" optional type="date" value={f.endDate} onChange={set('endDate')} error={errors.endDate} hint="Leave empty to repeat indefinitely" />
        </div>
        <TextArea label="Notes" optional value={f.notes} onChange={set('notes')} />
      </form>
    </Modal>
  );
}
