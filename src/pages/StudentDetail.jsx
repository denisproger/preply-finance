import { useMemo } from 'react';
import Modal from '../components/Modal.jsx';
import { useData } from '../data/useData.js';
import { useRates } from '../lib/hooks.js';
import { useApp } from '../components/AppContext.jsx';
import { useT } from '../i18n/index.js';
import { studentMonthStats, entryAmounts } from '../lib/finance.js';
import { lastNMonths, formatMonth, formatMonthShort, formatDate } from '../lib/dates.js';
import { formatMoney, round2 } from '../lib/money.js';
import { StatusBadge, IconButton, EmptyState } from '../components/ui.jsx';
import { IncomeExpenseChart } from '../components/Charts.jsx';
import Icon from '../components/Icon.jsx';
import { deletePreplyEntry, setStudentStatus } from '../data/actions.js';

/** Student detail: plan breakdown, this month, 12-month history and all records. */
export default function StudentDetail({ id, onClose }) {
  const t = useT();
  const data = useData();
  const rates = useRates();
  const { month, openForm, confirm, toast } = useApp();
  const s = data.students.find((x) => x.id === id);

  const view = useMemo(() => {
    if (!s) return null;
    const months = lastNMonths(month, 12);
    const history = months.map((m) => ({ month: m, ...studentMonthStats(data, s, m, rates.rates) }));
    const entries = data.preplyEntries.filter((e) => e.studentId === s.id).sort((a, b) => (a.date < b.date ? 1 : -1));
    const lifetime = entries.filter((e) => e.status !== 'expected').reduce((a, e) => {
      const x = entryAmounts(e, rates.rates);
      return { lessons: a.lessons + e.lessons, net: round2(a.net + x.net), netBase: round2(a.netBase + x.netBase) };
    }, { lessons: 0, net: 0, netBase: 0 });
    return { history, entries, lifetime, cur: history[history.length - 1] };
  }, [data, s, month, rates]);

  if (!s || !view) return null;
  const { cur, history, entries, lifetime } = view;
  // Chart: reuse the income/expense chart shape → "net income" bars = actual, second series = plan.
  const chartSeries = history.map((h) => ({ month: h.month, totalNet: h.actualNetBase, expenses: h.planNetBase }));

  return (
    <Modal open onClose={onClose} size="lg" title={s.name}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => { setStudentStatus(s.id, s.status === 'archived' ? 'active' : 'archived'); toast(s.status === 'archived' ? 'Restored' : 'Archived'); }}>
            <Icon name="archive" size={15} /> {s.status === 'archived' ? t('actions.unarchive') : t('actions.archive')}
          </button>
          <button className="btn" onClick={() => openForm('student', { initial: s })}><Icon name="edit" size={15} /> {t('actions.edit')}</button>
          <button className="btn btn-primary" onClick={() => openForm('preply', { studentId: s.id })}><Icon name="plus" size={15} /> {t('actions.recordLessons')}</button>
        </>
      }>
      <div className="detail-head">
        <StatusBadge status={s.status} t={t} />
        <span className="muted">{t(`model.${s.paymentModel}`)} · {s.currency} · commission {cur.plan.pct}%{s.commissionPct === null ? ' (default)' : ''}</span>
      </div>
      {s.notes && <p className="detail-notes">{s.notes}</p>}

      <div className="detail-grid">
        <div className="detail-box">
          <h3>Monthly plan</h3>
          <dl className="kv">
            <div><dt>{s.paymentModel === 'subscription' ? 'Subscription' : `${formatMoney(s.pricePerLesson, s.currency)} × ${s.expectedLessons} lessons`}</dt><dd className="num">{formatMoney(cur.plan.gross, s.currency)}</dd></div>
            <div><dt>Commission {cur.plan.pct}%</dt><dd className="num neg">−{formatMoney(cur.plan.commission, s.currency)}</dd></div>
            <div><dt><strong>Expected net</strong></dt><dd className="num"><strong>{formatMoney(cur.plan.net, s.currency)}</strong> <span className="muted small">≈ {formatMoney(cur.planNetBase, 'CZK', { decimals: 0 })}</span></dd></div>
          </dl>
        </div>
        <div className="detail-box">
          <h3>{formatMonth(month)}</h3>
          <dl className="kv">
            <div><dt>Lessons done / planned</dt><dd className="num">{cur.lessonsDone} / {cur.plan.lessons}{cur.lessonsPending ? ` (+${cur.lessonsPending} expected)` : ''}</dd></div>
            <div><dt>Actual gross</dt><dd className="num">{formatMoney(cur.actualGross, s.currency)}</dd></div>
            <div><dt>Actual commission</dt><dd className="num neg">−{formatMoney(cur.actualCommission, s.currency)}</dd></div>
            <div><dt><strong>Actual net</strong></dt><dd className="num pos"><strong>{formatMoney(cur.actualNet, s.currency)}</strong> <span className="muted small">{formatMoney(cur.actualNetBase, 'CZK', { decimals: 0 })}</span></dd></div>
            <div><dt>Forecast net (month)</dt><dd className="num">{formatMoney(cur.forecastNet, s.currency)}</dd></div>
          </dl>
        </div>
        <div className="detail-box">
          <h3>Lifetime</h3>
          <dl className="kv">
            <div><dt>Lessons</dt><dd className="num">{lifetime.lessons}</dd></div>
            <div><dt>Net earned</dt><dd className="num">{formatMoney(lifetime.net, s.currency)}</dd></div>
            <div><dt>In CZK</dt><dd className="num">{formatMoney(lifetime.netBase, 'CZK', { decimals: 0 })}</dd></div>
          </dl>
        </div>
      </div>

      <h3 className="sub-h">Last 12 months (net, CZK)</h3>
      <IncomeExpenseChart series={chartSeries} height={200} labels={['Actual net', 'Planned net']} />

      <div className="table-scroll mt-sm">
        <table className="table table-compact">
          <thead><tr><th>Month</th><th className="r">Lessons</th><th className="r">Gross</th><th className="r">Commission</th><th className="r">Net</th><th className="r">Net CZK</th></tr></thead>
          <tbody>
            {[...history].reverse().filter((h) => h.entries.length).map((h) => (
              <tr key={h.month}>
                <td>{formatMonthShort(h.month)}</td>
                <td className="r num">{h.lessonsDone}</td>
                <td className="r num">{formatMoney(h.actualGross, s.currency)}</td>
                <td className="r num neg">−{formatMoney(h.actualCommission, s.currency)}</td>
                <td className="r num">{formatMoney(h.actualNet, s.currency)}</td>
                <td className="r num">{formatMoney(h.actualNetBase, 'CZK', { decimals: 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="sub-h">Records</h3>
      {!entries.length ? <EmptyState icon="calendar" title="No records yet" body="Use “Record lessons” after lessons take place." /> : (
        <ul className="txn-list bordered">
          {entries.map((e) => {
            const a = entryAmounts(e, rates.rates);
            return (
              <li key={e.id} className="txn static">
                <span className="txn-icon txn-preply" aria-hidden>🎓</span>
                <span className="txn-main">
                  <span className="txn-label">{e.lessons} lesson{e.lessons === 1 ? '' : 's'} · {formatMoney(a.net, e.currency)} net</span>
                  <span className="txn-sub">{formatDate(e.date)} · gross {formatMoney(e.gross, e.currency)} · {e.commissionPct}%{e.notes ? ` · ${e.notes}` : ''}</span>
                </span>
                <span className="txn-right">
                  <StatusBadge status={e.status} t={t} />
                  <IconButton icon="edit" label="Edit record" onClick={() => openForm('preply', { initial: e })} />
                  <IconButton icon="trash" label="Delete record" tone="danger" onClick={async () => {
                    if (await confirm({ title: 'Delete record?', message: 'This Preply record will be removed permanently.', confirmLabel: 'Delete', danger: true })) { deletePreplyEntry(e.id); toast('Record deleted'); }
                  }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
