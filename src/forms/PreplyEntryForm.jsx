import { useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { TextInput, TextArea, Field, Segmented, SelectInput } from '../components/ui.jsx';
import { RateField, defaultRateFor, parsePositive } from './shared.jsx';
import { useData } from '../data/useData.js';
import { useRates, useSubmitGuard } from '../lib/hooks.js';
import { savePreplyEntry } from '../data/actions.js';
import { commissionPctFor, entryAmounts } from '../lib/finance.js';
import { formatMoney, parseAmount, round2 } from '../lib/money.js';
import { todayISO, isValidISODate } from '../lib/dates.js';
import { useApp } from '../components/AppContext.jsx';
import { useT } from '../i18n/index.js';

/**
 * One Preply earning record: completed lessons (per-lesson students) or a
 * subscription payment. Each real earning should be recorded ONCE — its
 * status then moves expected → received → paid out.
 */
export default function PreplyEntryForm({ initial, studentId, onClose }) {
  const t = useT();
  const { toast } = useApp();
  const students = useData((d) => d.students);
  const settings = useData((d) => d.settings);
  const rates = useRates();
  const editing = !!initial?.id;
  const selectable = useMemo(
    () => students.filter((s) => s.status !== 'archived' || s.id === (initial?.studentId || studentId)),
    [students, initial, studentId]
  );
  const firstId = initial?.studentId || studentId || selectable[0]?.id || '';
  const stu0 = students.find((s) => s.id === firstId);

  const autoGross = (stu, lessons) => {
    if (!stu) return '';
    if (stu.paymentModel === 'subscription') return String(stu.subscriptionAmount || '');
    const n = parseAmount(lessons);
    return Number.isFinite(n) && stu.pricePerLesson ? String(round2(n * stu.pricePerLesson)) : '';
  };

  const [f, setF] = useState(() => {
    const lessons = initial ? String(initial.lessons ?? '') : stu0?.paymentModel === 'subscription' ? String(stu0.expectedLessons || '') : '1';
    return {
      studentId: firstId,
      date: initial?.date || todayISO(),
      lessons,
      gross: initial ? String(initial.gross) : autoGross(stu0, lessons),
      grossTouched: !!initial,
      commissionPct: String(initial?.commissionPct ?? (stu0 ? commissionPctFor(stu0, settings) : settings.defaultCommissionPct)),
      status: initial?.status || 'received',
      fxRate: initial?.fxRate ? String(initial.fxRate) : editing ? '' : defaultRateFor(stu0?.currency || 'USD', rates),
      notes: initial?.notes || '',
    };
  });
  const [errors, setErrors] = useState({});
  const [busy, guard] = useSubmitGuard();
  const stu = students.find((s) => s.id === f.studentId);
  const currency = stu?.currency || 'USD';

  const setStudent = (id) => {
    const s = students.find((x) => x.id === id);
    setF((p) => {
      const lessons = s?.paymentModel === 'subscription' ? String(s.expectedLessons || '') : p.lessons || '1';
      return {
        ...p,
        studentId: id,
        lessons,
        gross: autoGross(s, lessons),
        grossTouched: false,
        commissionPct: String(s ? commissionPctFor(s, settings) : settings.defaultCommissionPct),
        fxRate: defaultRateFor(s?.currency || 'USD', rates),
      };
    });
  };
  const setLessons = (v) => setF((p) => ({ ...p, lessons: v, gross: p.grossTouched || stu?.paymentModel === 'subscription' ? p.gross : autoGross(stu, v) }));

  const gross = parseAmount(f.gross);
  const pct = parseAmount(f.commissionPct);
  const preview = Number.isFinite(gross) && Number.isFinite(pct)
    ? entryAmounts({ gross, commissionPct: pct, currency, fxRate: parsePositive(f.fxRate) }, rates.rates)
    : null;

  const submit = (e) => {
    e.preventDefault();
    guard(async () => {
      const err = {};
      if (!stu) err.studentId = 'Choose a student';
      if (!(Number.isFinite(gross) && gross >= 0)) err.gross = 'Enter the gross amount';
      const lessons = f.lessons === '' ? 0 : parseAmount(f.lessons);
      if (!(lessons >= 0)) err.lessons = 'Enter a number of lessons';
      if (!(pct >= 0 && pct <= 100)) err.commissionPct = 'Enter 0–100';
      if (!isValidISODate(f.date)) err.date = 'Enter a valid date';
      if (f.fxRate !== '' && !parsePositive(f.fxRate)) err.fxRate = 'Invalid rate';
      setErrors(err);
      if (Object.keys(err).length) return;
      savePreplyEntry({
        ...(editing ? { id: initial.id, createdAt: initial.createdAt } : {}),
        studentId: f.studentId,
        date: f.date,
        lessons,
        gross: round2(gross),
        currency,
        commissionPct: pct,
        status: f.status,
        fxRate: currency === 'CZK' ? null : parsePositive(f.fxRate),
        notes: f.notes.trim(),
        source: 'manual',
      });
      toast(editing ? 'Record updated' : 'Preply income recorded');
      onClose();
    });
  };

  return (
    <Modal open onClose={onClose} title={editing ? 'Edit Preply record' : 'Record Preply lessons / payment'}
      footer={<button type="submit" form="preply-form" className="btn btn-primary" disabled={busy || !selectable.length}>{busy ? t('actions.saving') : t('actions.save')}</button>}>
      {!selectable.length ? (
        <p className="muted">Add a student first — Preply records belong to a student.</p>
      ) : (
        <form id="preply-form" className="form" onSubmit={submit} noValidate>
          <div className="grid-2">
            <SelectInput label="Student" value={f.studentId} onChange={(e) => setStudent(e.target.value)} error={errors.studentId}
              options={selectable.map((s) => ({ value: s.id, label: `${s.name}${s.status !== 'active' ? ` (${t(`status.${s.status}`)})` : ''}` }))} />
            <TextInput label={t('common.date')} type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} error={errors.date} />
          </div>
          <div className="grid-3">
            <TextInput label="Lessons" inputMode="decimal" value={f.lessons} onChange={(e) => setLessons(e.target.value)} error={errors.lessons} data-autofocus
              hint={stu?.paymentModel === 'per_lesson' ? `× ${formatMoney(stu.pricePerLesson, currency)}` : 'For your statistics'} />
            <TextInput label={`Gross (${currency})`} inputMode="decimal" value={f.gross} error={errors.gross}
              onChange={(e) => setF((p) => ({ ...p, gross: e.target.value, grossTouched: true }))}
              hint={f.grossTouched ? 'Edited manually' : 'Calculated automatically'} />
            <TextInput label="Commission %" inputMode="decimal" value={f.commissionPct} onChange={(e) => setF((p) => ({ ...p, commissionPct: e.target.value }))} error={errors.commissionPct} />
          </div>
          <Field label={t('common.status')}
            hint={{
              expected: 'Planned / scheduled — not counted as earned yet.',
              received: 'Lesson done; money is in your Preply balance. Counted as income.',
              paid_out: 'Already withdrawn to your bank. Counted as income (once).',
            }[f.status]}>
            <Segmented value={f.status} onChange={(v) => setF((p) => ({ ...p, status: v }))} label="Status"
              options={['expected', 'received', 'paid_out'].map((s) => ({ value: s, label: t(`status.${s}`) }))} />
          </Field>
          {preview && (
            <div className="calc-preview">
              <div><span>Gross</span><strong className="num">{formatMoney(preview.gross, currency)}</strong><em>{formatMoney(preview.grossBase, 'CZK')}</em></div>
              <div><span>Commission</span><strong className="num neg">−{formatMoney(preview.commission, currency)}</strong><em>{formatMoney(preview.commissionBase, 'CZK')}</em></div>
              <div><span>Net to you</span><strong className="num pos">{formatMoney(preview.net, currency)}</strong><em>{formatMoney(preview.netBase, 'CZK')}</em></div>
            </div>
          )}
          <RateField currency={currency} value={f.fxRate} onChange={(v) => setF((p) => ({ ...p, fxRate: v }))} date={f.date} amount={f.gross} />
          <TextArea label={t('common.notes')} optional value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} maxLength={2000} />
        </form>
      )}
    </Modal>
  );
}
