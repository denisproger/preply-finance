import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { TextInput, TextArea, Field, Segmented, SelectInput } from '../components/ui.jsx';
import { CurrencyPicker, parsePositive } from './shared.jsx';
import { useData } from '../data/useData.js';
import { useRates, useSubmitGuard } from '../lib/hooks.js';
import { saveStudent } from '../data/actions.js';
import { studentPlan } from '../lib/finance.js';
import { formatMoney, parseAmount, toBase } from '../lib/money.js';
import { useApp } from '../components/AppContext.jsx';
import { useT } from '../i18n/index.js';

export default function StudentForm({ initial, onClose }) {
  const t = useT();
  const { toast } = useApp();
  const settings = useData((d) => d.settings);
  const rates = useRates();
  const editing = !!initial?.id;
  const [f, setF] = useState(() => ({
    name: initial?.name || '',
    notes: initial?.notes || '',
    currency: initial?.currency || settings.defaultIncomeCurrency,
    paymentModel: initial?.paymentModel || 'per_lesson',
    pricePerLesson: initial?.pricePerLesson ? String(initial.pricePerLesson) : '',
    expectedLessons: initial?.expectedLessons ? String(initial.expectedLessons) : '',
    subscriptionAmount: initial?.subscriptionAmount ? String(initial.subscriptionAmount) : '',
    customCommission: initial?.commissionPct !== null && initial?.commissionPct !== undefined,
    commissionPct: initial?.commissionPct ?? '',
    status: initial?.status || 'active',
  }));
  const [errors, setErrors] = useState({});
  const [busy, guard] = useSubmitGuard();
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));

  const num = (v) => {
    const n = parseAmount(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  // Live preview using the same calculation as the rest of the app.
  const draft = {
    paymentModel: f.paymentModel,
    pricePerLesson: num(f.pricePerLesson),
    expectedLessons: num(f.expectedLessons),
    subscriptionAmount: num(f.subscriptionAmount),
    commissionPct: f.customCommission ? num(f.commissionPct) : null,
  };
  const plan = studentPlan(draft, settings);
  const czk = (v) => formatMoney(toBase(v, f.currency, null, rates.rates).value, 'CZK');

  const submit = (e) => {
    e.preventDefault();
    guard(async () => {
      const err = {};
      if (!f.name.trim()) err.name = 'Enter the student’s name';
      if (f.paymentModel === 'per_lesson' && !parsePositive(f.pricePerLesson)) err.pricePerLesson = 'Enter the price per lesson';
      if (f.paymentModel === 'subscription' && !parsePositive(f.subscriptionAmount)) err.subscriptionAmount = 'Enter the monthly amount';
      if (f.expectedLessons !== '' && !(parseAmount(f.expectedLessons) >= 0)) err.expectedLessons = 'Enter a number';
      if (f.customCommission) {
        const c = parseAmount(String(f.commissionPct));
        if (!(c >= 0 && c <= 100)) err.commissionPct = 'Enter 0–100';
      }
      setErrors(err);
      if (Object.keys(err).length) return;
      saveStudent({
        ...(editing ? { id: initial.id, createdAt: initial.createdAt, externalRef: initial.externalRef } : {}),
        name: f.name.trim(),
        notes: f.notes.trim(),
        currency: f.currency,
        paymentModel: f.paymentModel,
        pricePerLesson: draft.pricePerLesson,
        expectedLessons: draft.expectedLessons,
        subscriptionAmount: draft.subscriptionAmount,
        commissionPct: draft.commissionPct,
        status: f.status,
      });
      toast(editing ? 'Student updated' : 'Student added');
      onClose();
    });
  };

  return (
    <Modal open onClose={onClose} title={editing ? 'Edit student' : t('actions.addStudent')}
      footer={<button type="submit" form="student-form" className="btn btn-primary" disabled={busy}>{busy ? t('actions.saving') : t('actions.save')}</button>}>
      <form id="student-form" className="form" onSubmit={submit} noValidate>
        <div className="grid-2">
          <TextInput label="Student name" value={f.name} onChange={set('name')} error={errors.name} data-autofocus maxLength={120} autoComplete="off" />
          <Field label="Currency of payment"><CurrencyPicker value={f.currency} onChange={set('currency')} /></Field>
        </div>
        <Field label="Payment model">
          <Segmented value={f.paymentModel} onChange={set('paymentModel')} label="Payment model"
            options={[{ value: 'per_lesson', label: t('model.per_lesson') }, { value: 'subscription', label: 'Monthly subscription' }]} />
        </Field>
        <div className="grid-2">
          {f.paymentModel === 'per_lesson' ? (
            <TextInput label={`Price per lesson (${f.currency})`} inputMode="decimal" value={f.pricePerLesson} onChange={set('pricePerLesson')} error={errors.pricePerLesson} placeholder="15" />
          ) : (
            <TextInput label={`Fixed monthly amount (${f.currency})`} inputMode="decimal" value={f.subscriptionAmount} onChange={set('subscriptionAmount')} error={errors.subscriptionAmount} placeholder="120" />
          )}
          <TextInput label="Expected lessons per month" inputMode="decimal" value={f.expectedLessons} onChange={set('expectedLessons')} error={errors.expectedLessons} placeholder="8" />
        </div>
        <Field label="Preply commission" error={errors.commissionPct}>
          <div className="inline-row">
            <label className="check">
              <input type="checkbox" checked={!f.customCommission} onChange={(e) => setF((s) => ({ ...s, customCommission: !e.target.checked }))} />
              Use default ({settings.defaultCommissionPct}%)
            </label>
            {f.customCommission && (
              <span className="suffix-input">
                <input className="input num" inputMode="decimal" value={f.commissionPct} onChange={set('commissionPct')} aria-label="Commission percentage" placeholder={String(settings.defaultCommissionPct)} />
                <span>%</span>
              </span>
            )}
          </div>
        </Field>

        <div className="calc-preview" aria-live="polite">
          <div><span>Expected gross / month</span><strong className="num">{formatMoney(plan.gross, f.currency)}</strong><em>{czk(plan.gross)}</em></div>
          <div><span>Commission ({plan.pct}%)</span><strong className="num neg">−{formatMoney(plan.commission, f.currency)}</strong><em>{czk(plan.commission)}</em></div>
          <div><span>Expected net / month</span><strong className="num pos">{formatMoney(plan.net, f.currency)}</strong><em>{czk(plan.net)}</em></div>
        </div>

        <SelectInput label={t('common.status')} value={f.status} onChange={set('status')}
          options={['active', 'paused', 'archived'].map((s) => ({ value: s, label: t(`status.${s}`) }))}
          hint="Only active students count towards expected income." />
        <TextArea label={t('common.notes')} optional value={f.notes} onChange={set('notes')} maxLength={2000} />
      </form>
    </Modal>
  );
}
