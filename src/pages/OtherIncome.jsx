import { useMemo, useState } from 'react';
import { useData } from '../data/useData.js';
import { useRates } from '../lib/hooks.js';
import { useApp } from '../components/AppContext.jsx';
import { useT } from '../i18n/index.js';
import { inMonth, baseAmount, usesFallback, percentChange, incomeBySource } from '../lib/finance.js';
import { formatMoney, round2 } from '../lib/money.js';
import { addMonths, formatMonth, formatDate, todayISO } from '../lib/dates.js';
import { Card, StatCard, EmptyState, PageHeader, Tabs, SearchBox, Segmented, StatusBadge, IconButton, Money } from '../components/ui.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import RecurringList from '../components/RecurringList.jsx';
import { DonutBreakdown } from '../components/Charts.jsx';
import Icon from '../components/Icon.jsx';
import { saveIncome, deleteIncome } from '../data/actions.js';

export default function OtherIncome() {
  const t = useT();
  const data = useData();
  const rates = useRates();
  const { month, openForm, confirm, toast } = useApp();
  const [tab, setTab] = useState('records');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('month');
  const r = rates.rates;
  const catMap = new Map(data.incomeCategories.map((c) => [c.id, c]));

  const stats = useMemo(() => {
    const cur = inMonth(data.otherIncome, month);
    const prev = inMonth(data.otherIncome, addMonths(month, -1));
    const total = (l, s) => round2(l.filter((x) => x.status === s).reduce((a, x) => a + baseAmount(x, r), 0));
    return {
      received: total(cur, 'received'),
      expected: total(cur, 'expected'),
      prevReceived: total(prev, 'received'),
      count: cur.length,
      sources: incomeBySource({ ...data, preplyEntries: [] }, [month], r),
    };
  }, [data, month, r]);

  const list = useMemo(() => {
    const base = period === 'month' ? inMonth(data.otherIncome, month) : data.otherIncome;
    const needle = q.trim().toLowerCase();
    return base
      .filter((x) => (cat === 'all' || x.categoryId === cat) && (status === 'all' || x.status === status))
      .filter((x) => !needle || `${x.title} ${x.source} ${x.notes}`.toLowerCase().includes(needle))
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  }, [data.otherIncome, month, period, q, cat, status]);
  const filteredTotal = round2(list.filter((x) => x.status === 'received').reduce((a, x) => a + baseAmount(x, r), 0));
  const filtered = q || cat !== 'all' || status !== 'all';

  const del = async (x) => {
    const msg = x.recurringId ? 'This occurrence of a recurring item will be deleted and will not be re-created. To stop future ones, use the Recurring tab.' : 'This income record will be removed permanently.';
    if (await confirm({ title: 'Delete income?', message: msg, confirmLabel: 'Delete', danger: true })) { deleteIncome(x.id); toast('Income deleted'); }
  };

  return (
    <>
      <PageHeader title={t('income.title')} subtitle="Coaching, private lessons, freelance and other side income. No Preply commission is applied here.">
        <MonthPicker />
      </PageHeader>
      <div className="stats-grid stats-grid-3">
        <StatCard label={`Received · ${formatMonth(month, 'en-GB', 'short')}`} value={stats.received} delta={percentChange(stats.received, stats.prevReceived)} tone="good" />
        <StatCard label="Still expected" value={stats.expected} sub="Not counted until received" />
        <StatCard label="Previous month" value={stats.prevReceived} tone="muted" />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'records', label: 'Records', count: stats.count },
        { value: 'recurring', label: 'Recurring', count: data.recurring.filter((x) => x.kind === 'income').length },
      ]} />

      {tab === 'recurring' ? <Card pad={false}><RecurringList kind="income" /></Card> : (
        <div className="grid-main">
          <div className="span-2 stack">
            <div className="toolbar">
              <SearchBox value={q} onChange={setQ} placeholder="Search income" />
              <select className="input select input-sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category filter">
                <option value="all">All categories</option>
                {data.incomeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Segmented size="sm" label="Status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'received', label: 'Received' }, { value: 'expected', label: 'Expected' }]} />
              <Segmented size="sm" label="Period" value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Month' }, { value: 'all', label: 'All time' }]} />
              {filtered && <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setCat('all'); setStatus('all'); }}>{t('actions.clearFilters')}</button>}
              <button className="btn btn-primary btn-sm toolbar-end" onClick={() => openForm('income')}><Icon name="plus" size={14} /> {t('actions.addIncome')}</button>
            </div>
            <Card pad={false}>
              {!list.length ? (
                <EmptyState icon="income" title={filtered ? 'Nothing matches these filters' : `No other income in ${period === 'month' ? formatMonth(month) : 'your records'}`}
                  body={filtered ? null : 'Log BJJ / grappling coaching, private lessons, freelance jobs or cash payments.'}
                  action={!filtered && <button className="btn btn-primary" onClick={() => openForm('income')}><Icon name="plus" /> {t('actions.addIncome')}</button>} />
              ) : (
                <>
                  <ul className="txn-list">
                    {list.map((x) => {
                      const c = catMap.get(x.categoryId);
                      return (
                        <li key={x.id} className="txn static">
                          <span className="txn-icon txn-income" aria-hidden>{c?.icon || '💵'}</span>
                          <span className="txn-main">
                            <span className="txn-label">{x.title || x.source || c?.name}{x.recurringId && <Icon name="repeat" size={12} className="inline-icon" title="Recurring" />}</span>
                            <span className="txn-sub">{formatDate(x.date)}{x.source && x.title ? ` · ${x.source}` : ''} · {c?.name}</span>
                          </span>
                          <span className="txn-right">
                            <Money base={baseAmount(x, r)} amount={x.amount} currency={x.currency} fallback={usesFallback(x, r)} className={x.status === 'received' ? 'pos' : 'muted'} />
                            <StatusBadge status={x.status} t={t} />
                            {x.status === 'expected' && x.date <= todayISO() && (
                              <IconButton icon="check" label="Mark received" onClick={() => { saveIncome({ ...x, status: 'received' }); toast('Marked as received'); }} />
                            )}
                            <IconButton icon="copy" label="Duplicate" onClick={() => openForm('income', { initial: { ...x, id: undefined, recurringId: null, occurrenceKey: null, date: todayISO() } })} />
                            <IconButton icon="edit" label="Edit" onClick={() => openForm('income', { initial: x })} />
                            <IconButton icon="trash" label="Delete" tone="danger" onClick={() => del(x)} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="list-foot"><span>{list.length} record{list.length === 1 ? '' : 's'}</span><span>Received total <strong className="num">{formatMoney(filteredTotal, 'CZK')}</strong></span></div>
                </>
              )}
            </Card>
          </div>
          <Card title="By source" subtitle={formatMonth(month)}>
            {stats.sources.length ? <DonutBreakdown items={stats.sources} /> : <p className="muted small">No received income this month.</p>}
          </Card>
        </div>
      )}
    </>
  );
}
