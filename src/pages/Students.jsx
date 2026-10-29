import { useMemo, useState } from 'react';
import { useData } from '../data/useData.js';
import { useRates } from '../lib/hooks.js';
import { useApp } from '../components/AppContext.jsx';
import { useT } from '../i18n/index.js';
import { studentMonthStats, preplyForecast, preplyPlanTotal, preplyBalance, aggregatePreply, entryAmounts, isActual, inMonth } from '../lib/finance.js';
import { formatMoney, toBase, BASE_CURRENCY } from '../lib/money.js';
import { formatMonth, formatDate } from '../lib/dates.js';
import { Card, StatCard, EmptyState, PageHeader, Tabs, SearchBox, Segmented, StatusBadge, IconButton, Money, Badge } from '../components/ui.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import { StudentBars } from '../components/Charts.jsx';
import Icon from '../components/Icon.jsx';
import { deleteStudent, setStudentStatus, deletePreplyEntry, setPreplyEntryStatus, deletePayout } from '../data/actions.js';

export default function Students() {
  const t = useT();
  const [tab, setTab] = useState('list');
  const data = useData();
  const { month } = useApp();
  const counts = {
    list: data.students.length,
    records: inMonth(data.preplyEntries, month).length,
    payouts: data.payouts.length,
  };
  return (
    <>
      <PageHeader title={t('students.title')} subtitle="Expected vs actual income per student. Entered manually — not connected to Preply.">
        <MonthPicker />
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'list', label: t('students.list'), count: counts.list },
        { value: 'records', label: t('students.records'), count: counts.records },
        { value: 'payouts', label: t('students.payouts'), count: counts.payouts },
      ]} />
      {tab === 'list' && <StudentList />}
      {tab === 'records' && <RecordList />}
      {tab === 'payouts' && <PayoutList />}
    </>
  );
}

function StudentSummary({ rows }) {
  const data = useData();
  const { month } = useApp();
  const r = useRates().rates;
  const forecast = preplyForecast(data, month, r);
  const actual = aggregatePreply(inMonth(data.preplyEntries, month).filter(isActual), r);
  const next = preplyPlanTotal(data, r);
  const bal = preplyBalance(data);
  const balCzk = Object.entries(bal).reduce((a, [c, v]) => a + toBase(v, c, null, r).value, 0);
  const balText = Object.entries(bal).filter(([, v]) => v).map(([c, v]) => formatMoney(v, c)).join(' + ');
  return (
    <div className="stats-grid stats-grid-6">
      <StatCard label="Expected gross" value={forecast.gross} sub={formatMonth(month)} />
      <StatCard label="Expected commission" value={-forecast.commission} tone="muted" />
      <StatCard label="Expected net" value={forecast.net} tone="accent" />
      <StatCard label="Actually earned (net)" value={actual.net} sub={`gross ${formatMoney(actual.gross, BASE_CURRENCY, { decimals: 0 })}`} tone="good" />
      <StatCard label="Expected next month" value={next.net} sub={`${rows} active plan${rows === 1 ? '' : 's'}`} />
      <StatCard label="In Preply balance" value={balCzk} sub={balText || 'Nothing pending'} />
    </div>
  );
}

function StudentList() {
  const t = useT();
  const data = useData();
  const rates = useRates();
  const { month, openForm, openStudent, confirm, toast } = useApp();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('current');
  const [sort, setSort] = useState('expectedNet');

  const rows = useMemo(() => {
    const list = data.students
      .filter((s) => (status === 'current' ? s.status !== 'archived' : status === 'all' ? true : s.status === status))
      .filter((s) => !q || `${s.name} ${s.notes}`.toLowerCase().includes(q.toLowerCase()))
      .map((s) => ({ s, st: studentMonthStats(data, s, month, rates.rates) }));
    const by = {
      name: (a, b) => a.s.name.localeCompare(b.s.name),
      expectedNet: (a, b) => b.st.planNetBase - a.st.planNetBase,
      actualNet: (a, b) => b.st.actualNetBase - a.st.actualNetBase,
      status: (a, b) => a.s.status.localeCompare(b.s.status),
    }[sort];
    return list.sort(by);
  }, [data, month, rates, q, status, sort]);

  const activeCount = data.students.filter((s) => s.status === 'active').length;

  const onDelete = async (s) => {
    const n = data.preplyEntries.filter((e) => e.studentId === s.id).length;
    const ok = await confirm({
      title: `Delete ${s.name}?`,
      message: n ? `This also permanently deletes ${n} Preply record${n === 1 ? '' : 's'} for this student. Archive instead to keep history.` : 'This cannot be undone.',
      confirmLabel: 'Delete', danger: true,
    });
    if (ok) { deleteStudent(s.id); toast('Student deleted'); }
  };
  const toggleArchive = (s) => {
    setStudentStatus(s.id, s.status === 'archived' ? 'active' : 'archived');
    toast(s.status === 'archived' ? 'Student restored' : 'Student archived');
  };

  if (!data.students.length) {
    return (
      <Card>
        <EmptyState icon="users" title="No students yet" body="Add each Preply student with their price and expected lessons — gross, commission and net are calculated automatically."
          action={<button className="btn btn-primary" onClick={() => openForm('student')}><Icon name="plus" /> {t('actions.addStudent')}</button>} />
      </Card>
    );
  }

  const chartData = rows.filter(({ s }) => s.status !== 'archived').slice(0, 10).map(({ s, st }) => ({ name: s.name, expected: st.planNetBase, actual: st.actualNetBase }));

  return (
    <>
      <StudentSummary rows={activeCount} />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search students" />
        <Segmented size="sm" label="Status filter" value={status} onChange={setStatus} options={[
          { value: 'current', label: 'Current' }, { value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' },
          { value: 'archived', label: 'Archived' }, { value: 'all', label: 'All' },
        ]} />
        <label className="sort">
          <span>Sort</span>
          <select className="input select input-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="expectedNet">Expected net</option>
            <option value="actualNet">Actual this month</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
          </select>
        </label>
        <button className="btn btn-primary btn-sm toolbar-end" onClick={() => openForm('student')}><Icon name="plus" size={14} /> {t('actions.addStudent')}</button>
      </div>

      {!rows.length ? <Card><EmptyState icon="search" title="No students match" /></Card> : (
        <>
          {/* Desktop table */}
          <div className="card table-card desktop-only">
            <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th><th>Model</th><th className="r">Price / sub.</th><th className="r">Exp. lessons</th>
                  <th className="r">Gross / mo</th><th className="r">Commission</th><th className="r">Net / mo</th>
                  <th className="r">Actual ({formatMonth(month, 'en-GB', 'short')})</th><th className="r">Done / left</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, st }) => (
                  <tr key={s.id} className="clickable" onClick={() => openStudent(s.id)}>
                    <td><strong>{s.name}</strong>{s.commissionPct !== null && <Badge tone="neutral" title="Custom commission">{s.commissionPct}%</Badge>}</td>
                    <td className="muted">{t(`model.${s.paymentModel}`)}</td>
                    <td className="r num">{formatMoney(s.paymentModel === 'subscription' ? s.subscriptionAmount : s.pricePerLesson, s.currency)}</td>
                    <td className="r num">{s.expectedLessons || '—'}</td>
                    <td className="r num">{formatMoney(st.plan.gross, s.currency)}</td>
                    <td className="r num neg">−{formatMoney(st.plan.commission, s.currency)}</td>
                    <td className="r"><Money base={st.planNetBase} amount={st.plan.net} currency={s.currency} fallback /></td>
                    <td className="r"><Money base={st.actualNetBase} amount={st.actualNet} currency={s.currency} className={st.actualNet ? 'pos' : 'muted'} /></td>
                    <td className="r num">{st.lessonsDone} / {st.lessonsRemaining}</td>
                    <td><StatusBadge status={s.status} t={t} /></td>
                    <td className="r nowrap" onClick={(e) => e.stopPropagation()}>
                      <IconButton icon="plus" label={`Record lessons for ${s.name}`} onClick={() => openForm('preply', { studentId: s.id })} />
                      <IconButton icon="edit" label="Edit" onClick={() => openForm('student', { initial: s })} />
                      <IconButton icon="archive" label={s.status === 'archived' ? 'Restore' : 'Archive'} onClick={() => toggleArchive(s)} />
                      <IconButton icon="trash" label="Delete" tone="danger" onClick={() => onDelete(s)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="mobile-only card-list">
            {rows.map(({ s, st }) => (
              <article key={s.id} className="student-card card" onClick={() => openStudent(s.id)}>
                <header>
                  <div>
                    <h3>{s.name}</h3>
                    <p className="muted small">
                      {t(`model.${s.paymentModel}`)} · {formatMoney(s.paymentModel === 'subscription' ? s.subscriptionAmount : s.pricePerLesson, s.currency)}
                      {s.paymentModel === 'per_lesson' ? ` × ${s.expectedLessons}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={s.status} t={t} />
                </header>
                <div className="student-figs">
                  <div><span>Gross</span><strong className="num">{formatMoney(st.plan.gross, s.currency)}</strong></div>
                  <div><span>Commission</span><strong className="num neg">−{formatMoney(st.plan.commission, s.currency)}</strong></div>
                  <div><span>Net</span><strong className="num">{formatMoney(st.plan.net, s.currency)}</strong></div>
                  <div><span>Actual</span><strong className="num pos">{formatMoney(st.actualNet, s.currency)}</strong></div>
                </div>
                <footer onClick={(e) => e.stopPropagation()}>
                  <span className="muted small">{st.lessonsDone} done · {st.lessonsRemaining} left</span>
                  <button className="btn btn-sm" onClick={() => openForm('preply', { studentId: s.id })}><Icon name="plus" size={14} /> Lessons</button>
                </footer>
              </article>
            ))}
          </div>

          {chartData.length > 0 && (
            <Card title="Income by student" subtitle={`Expected vs actual net · ${formatMonth(month)} · CZK`}>
              <StudentBars data={chartData} />
            </Card>
          )}
        </>
      )}
    </>
  );
}

function RecordList() {
  const t = useT();
  const data = useData();
  const rates = useRates();
  const { month, openForm, confirm, toast } = useApp();
  const [student, setStudent] = useState('all');
  const [status, setStatus] = useState('all');
  const stuName = new Map(data.students.map((s) => [s.id, s.name]));
  const entries = inMonth(data.preplyEntries, month)
    .filter((e) => (student === 'all' || e.studentId === student) && (status === 'all' || e.status === status))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const actualAgg = aggregatePreply(entries.filter(isActual), rates.rates);
  const receivedIds = entries.filter((e) => e.status === 'received').map((e) => e.id);

  const markPaid = async () => {
    const ok = await confirm({ title: 'Mark as paid out?', message: `Mark ${receivedIds.length} received record(s) in ${formatMonth(month)} as paid out. Totals don't change — this only tracks that the money left your Preply balance.`, confirmLabel: 'Mark paid out' });
    if (ok) { setPreplyEntryStatus(receivedIds, 'paid_out'); toast('Marked as paid out'); }
  };
  const del = async (e) => {
    if (await confirm({ title: 'Delete record?', message: 'This Preply record will be removed permanently.', confirmLabel: 'Delete', danger: true })) {
      deletePreplyEntry(e.id); toast('Record deleted');
    }
  };

  return (
    <>
      <div className="toolbar">
        <select className="input select input-sm" value={student} onChange={(e) => setStudent(e.target.value)} aria-label="Filter by student">
          <option value="all">All students</option>
          {data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Segmented size="sm" label="Status" value={status} onChange={setStatus}
          options={[{ value: 'all', label: 'All' }, ...['expected', 'received', 'paid_out'].map((s) => ({ value: s, label: t(`status.${s}`) }))]} />
        <div className="toolbar-end btn-row">
          {receivedIds.length > 0 && <button className="btn btn-sm" onClick={markPaid}>Mark received → paid out</button>}
          <button className="btn btn-primary btn-sm" onClick={() => openForm('preply')}><Icon name="plus" size={14} /> {t('actions.recordLessons')}</button>
        </div>
      </div>
      <Card pad={false}>
        {!entries.length ? (
          <EmptyState icon="calendar" title={`No Preply records in ${formatMonth(month)}`} body="Record completed lessons or a subscription payment. Each earning is recorded once; its status then moves from expected to received to paid out." />
        ) : (
          <>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Date</th><th>Student</th><th className="r">Lessons</th><th className="r">Gross</th><th className="r">Commission</th><th className="r">Net</th><th className="r">Net CZK</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {entries.map((e) => {
                    const a = entryAmounts(e, rates.rates);
                    return (
                      <tr key={e.id}>
                        <td className="nowrap">{formatDate(e.date)}</td>
                        <td>{stuName.get(e.studentId)}</td>
                        <td className="r num">{e.lessons}</td>
                        <td className="r num">{formatMoney(a.gross, e.currency)}</td>
                        <td className="r num neg">−{formatMoney(a.commission, e.currency)} <span className="muted small">{e.commissionPct}%</span></td>
                        <td className="r num">{formatMoney(a.net, e.currency)}</td>
                        <td className="r num">{formatMoney(a.netBase, 'CZK')}{a.fallback ? ' ≈' : ''}</td>
                        <td>
                          <select className="status-select" value={e.status} aria-label="Status" onChange={(ev) => setPreplyEntryStatus([e.id], ev.target.value)}>
                            {['expected', 'received', 'paid_out'].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                          </select>
                        </td>
                        <td className="r nowrap">
                          <IconButton icon="edit" label="Edit" onClick={() => openForm('preply', { initial: e })} />
                          <IconButton icon="trash" label="Delete" tone="danger" onClick={() => del(e)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr><th colSpan={3}>Earned (received + paid out)</th><td className="r num" colSpan={3}>gross {formatMoney(actualAgg.gross, 'CZK')} · fee −{formatMoney(actualAgg.commission, 'CZK')}</td><td className="r num"><strong>{formatMoney(actualAgg.net, 'CZK')}</strong></td><td colSpan={2} /></tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function PayoutList() {
  const data = useData();
  const rates = useRates();
  const { openForm, confirm, toast } = useApp();
  const bal = preplyBalance(data);
  const payouts = [...data.payouts].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <>
      <p className="callout">
        Payouts are withdrawals from your Preply balance. They are tracked for reconciliation only and are <strong>never added to income</strong>,
        so nothing is counted twice. Balance = net of received/paid-out records − payouts.
      </p>
      <div className="toolbar">
        <div className="balance-chips">
          {Object.keys(bal).length ? Object.entries(bal).map(([c, v]) => (
            <span key={c} className="balance-chip"><Icon name="wallet" size={14} /> Balance {formatMoney(v, c)} <span className="muted">≈ {formatMoney(toBase(v, c, null, rates.rates).value, 'CZK', { decimals: 0 })}</span></span>
          )) : <span className="muted small">No earnings recorded yet.</span>}
        </div>
        <button className="btn btn-primary btn-sm toolbar-end" onClick={() => openForm('payout', { balance: bal })}><Icon name="plus" size={14} /> Record payout</button>
      </div>
      <Card pad={false}>
        {!payouts.length ? <EmptyState icon="bank" title="No payouts recorded" body="Optional: log each withdrawal (and the CZK that reached your bank) to see your real conversion rate and remaining balance." /> : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Date</th><th className="r">Amount</th><th className="r">Received CZK</th><th className="r">Effective rate</th><th>Notes</th><th /></tr></thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.date)}</td>
                    <td className="r num">{formatMoney(p.amount, p.currency)}</td>
                    <td className="r num">{p.receivedCzk ? formatMoney(p.receivedCzk, 'CZK') : '—'}</td>
                    <td className="r num">{p.receivedCzk ? (p.receivedCzk / p.amount).toFixed(3) : '—'}</td>
                    <td className="muted">{p.notes}</td>
                    <td className="r nowrap">
                      <IconButton icon="edit" label="Edit" onClick={() => openForm('payout', { initial: p, balance: bal })} />
                      <IconButton icon="trash" label="Delete" tone="danger" onClick={async () => {
                        if (await confirm({ title: 'Delete payout?', message: 'The payout record will be removed.', confirmLabel: 'Delete', danger: true })) { deletePayout(p.id); toast('Payout deleted'); }
                      }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

