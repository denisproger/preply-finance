import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { TextInput, TextArea, Field } from '../components/ui.jsx';
import { AmountField, parsePositive } from './shared.jsx';
import { useSubmitGuard } from '../lib/hooks.js';
import { savePayout } from '../data/actions.js';
import { todayISO, isValidISODate } from '../lib/dates.js';
import { useApp } from '../components/AppContext.jsx';
import { formatMoney } from '../lib/money.js';

/** A withdrawal from the Preply balance. Tracking only — never counted as income. */
export default function PayoutForm({ initial, balance, onClose }) {
  const { toast } = useApp();
  const [f, setF] = useState({
    amount: initial?.amount ? String(initial.amount) : '',
    currency: initial?.currency || 'USD',
    date: initial?.date || todayISO(),
    receivedCzk: initial?.receivedCzk ? String(initial.receivedCzk) : '',
    notes: initial?.notes || '',
  });
  const [errors, setErrors] = useState({});
  const [busy, guard] = useSubmitGuard();
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const submit = (e) => {
    e.preventDefault();
    guard(async () => {
      const err = {};
      const amount = parsePositive(f.amount);
      if (!amount) err.amount = 'Enter the withdrawn amount';
      if (!isValidISODate(f.date)) err.date = 'Enter a valid date';
      if (f.receivedCzk !== '' && !parsePositive(f.receivedCzk)) err.receivedCzk = 'Enter a positive amount or leave empty';
      setErrors(err);
      if (Object.keys(err).length) return;
      savePayout({ ...(initial?.id ? { id: initial.id } : {}), amount, currency: f.currency, date: f.date, receivedCzk: parsePositive(f.receivedCzk), notes: f.notes.trim() });
      toast('Payout recorded');
      onClose();
    });
  };
  const bal = balance?.[f.currency];
  return (
    <Modal open onClose={onClose} title={initial?.id ? 'Edit payout' : 'Record Preply payout'}
      footer={<button type="submit" form="payout-form" className="btn btn-primary" disabled={busy}>Save</button>}>
      <form id="payout-form" className="form" onSubmit={submit} noValidate>
        <p className="callout">
          A payout moves money you already earned from your Preply balance to your bank. It is <strong>not added to income</strong> —
          your lessons were already counted when you recorded them. Use it to reconcile your balance.
        </p>
        <AmountField label="Amount withdrawn" amount={f.amount} setAmount={set('amount')} currency={f.currency} setCurrency={set('currency')} error={errors.amount} autoFocus />
        {Number.isFinite(bal) && <p className="form-note">Current recorded balance: {formatMoney(bal, f.currency)}</p>}
        <div className="grid-2">
          <TextInput label="Date" type="date" value={f.date} onChange={set('date')} error={errors.date} />
          <TextInput label="Actually received in CZK" optional inputMode="decimal" value={f.receivedCzk} onChange={set('receivedCzk')} error={errors.receivedCzk} hint="From your bank statement (after fees)" />
        </div>
        <Field><TextArea label="Notes" optional value={f.notes} onChange={set('notes')} /></Field>
      </form>
    </Modal>
  );
}
