import { useMemo, useState } from 'react';
import { useData } from '../data/useData.js';
import { useRates } from '../lib/hooks.js';
import { useApp } from '../components/AppContext.jsx';
import { useT } from '../i18n/index.js';
import { inMonth, inRange, baseAmount, usesFallback, percentChange, expensesByCategory, expensePeriodTotals, dailySpending, budgetState } from '../lib/finance.js';
import { formatMoney, round2, parseAmount } from '../lib/money.js';
import { addMonths, formatMonth, formatDate, todayISO, daysInMonth, currentMonthKey } from '../lib/dates.js';
import { Card, StatCard, EmptyState, PageHeader, Tabs, SearchBox, Segmented, IconButton, Money, ProgressBar, Badge } from '../components/ui.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import RecurringList from '../components/RecurringList.jsx';
import { DailyBars, DonutBreakdown } from '../components/Charts.jsx';
import Icon from '../components/Icon.jsx';
import { deleteExpense, setCategoryBudget, updateSettings, deleteCategory } from '../data/actions.js';
import { FALLBACK_EXPENSE_CATEGORY } from '../data/schema.js';

export default function Expenses() {
  const t = useT();
  const data = useData();
  const rates = useRates();
  const { month, openForm } = useApp();
  const [tab, setTab] = useState('list');
  const r = rates.rates;
  const today = todayISO();

  const view = useMemo(() => {
    const cur = inMonth(data.expenses, month);
    const prevTotal = round2(inMonth(data.expenses, addMonths(month, -1)).reduce((a, x) => a + baseAmount(x, r), 0));
    const totals = expensePeriodTotals(data, today, month, r);
    const cats = expensesByCategory(data, cur, r, { withBudgets: true });
    return { cur, prevTotal, totals, cats, daily: dailySpending(data, month, r, daysInMonth(month)) };
  }, [data, month, r, today]);

  const budget = data.settings.monthlyBudget;
  const bState = budgetState(view.totals.month, budget, data.settings.budgetWarnPct);
  const warnings = view.cats.filter((c) => c.budgetState && c.budgetState.level !== 'ok');
  const isCurrent = month === currentMonthKey();

  return (
    <>
      <PageHeader title={t('expenses.title')}>
        <MonthPicker />
        <button className="btn btn-primary btn-sm desktop-only" onClick={() => openForm('expense')}><Icon name="plus" size={14} /> {t('actions.addExpense')}</button>
      </PageHeader>

      {(bState?.level !== 'ok' && bState) || warnings.length ? (
        <div className="alerts">
          {bState && bState.level !== 'ok' && (
            <p className={`alert alert-${bState.level}`}><Icon name="alert" size={16} />
              {bState.level === 'over'
                ? `Monthly budget exceeded by ${formatMoney(-bState.remaining, 'CZK', { decimals: 0 })} (${Math.round(bState.pct)}%).`
                : `You've used ${Math.round(bState.pct)}% of your monthly budget — ${formatMoney(bState.remaining, 'CZK', { decimals: 0 })} left.`}
            </p>
          )}
          {warnings.map((c) => (
            <p key={c.id} className={`alert alert-${c.budgetState.level}`}><Icon name="alert" size={16} />
              {c.icon} {c.name}: {Math.round(c.budgetState.pct)}% of {formatMoney(c.budget, 'CZK', { decimals: 0 })} budget{c.budgetState.level === 'over' ? ' — over budget' : ''}.
            </p>
          ))}
        </div>
      ) : null}

      <div className="stats-grid stats-grid-4">
        <StatCard label={t('common.today')} value={view.totals.today} sub={isCurrent ? formatDate(today) : 'Always the real today'} />
        <StatCard label={t('common.thisWeek')} value={view.totals.week} sub={`${formatDate(view.totals.weekStart)} – ${formatDate(view.totals.weekEnd)}`} />
        <StatCard label={formatMonth(month)} value={view.totals.month} delta={percentChange(view.totals.month, view.prevTotal)} invert sub={`prev ${formatMoney(view.prevTotal, 'CZK', { decimals: 0 })}`} />
        <StatCard label="Budget left" raw={budget > 0 ? formatMoney(bState.remaining, 'CZK', { decimals: 0 }) : '—'} sub={budget > 0 ? `of ${formatMoney(budget, 'CZK', { decimals: 0 })}` : 'Set a budget in the Budgets tab'} tone={bState?.level === 'over' ? 'bad' : undefined} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'list', label: 'Expenses', count: view.cur.length },
        { value: 'budgets', label: 'Categories & budgets' },
        { value: 'recurring', label: 'Recurring', count: data.recurring.filter((x) => x.kind === 'expense').length },
      ]} />

      {tab === 'list' && <ExpenseList month={month} daily={view.daily} cats={view.cats} budget={budget} />}
      {tab === 'budgets' && <Budgets cats={view.cats} month={month} />}
      {tab === 'recurring' && <Card pad={false}><RecurringList kind="expense" /></Card>}
    </>
  );
}

function ExpenseList({ month, daily, cats, budget }) {
  const t = useT();
  const data = useData();
  const rates = useRates();
  const { openForm, confirm, toast } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [period, setPeriod] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const r = rates.rates;
  const catMap = new Map(data.expenseCategories.map((c) => [c.id, c]));

  const list = useMemo(() => {
    let base = data.expenses;
    if (period === 'month') base = inMonth(base, month);
    else if (period === 'range') base = inRange(base, from || null, to || null);
    const needle = q.trim().toLowerCase();
    return base
      .filter((x) => cat === 'all' || x.categoryId === cat)
      .filter((x) => !needle || `${x.description} ${x.notes}`.toLowerCase().includes(needle))
      .sort((a, b) => (a.date === b.date ? (b.createdAt || '').localeCompare(a.createdAt || '') : a.date < b.date ? 1 : -1));
  }, [data.expenses, month, period, from, to, q, cat]);

  // Group by day with daily totals.
  const groups = useMemo(() => {
    const m = new Map();
    for (const x of list) {
      if (!m.has(x.date)) m.set(x.date, { date: x.date, items: [], total: 0 });
      const g = m.get(x.date);
      g.items.push(x);
      g.total = round2(g.total + baseAmount(x, r));
    }
    return [...m.values()];
  }, [list, r]);
  const total = round2(list.reduce((a, x) => a + baseAmount(x, r), 0));
  const filtered = q || cat !== 'all' || period !== 'month';

  const del = async (x) => {
    const msg = x.recurringId ? 'This occurrence will be deleted and will not be re-created. To stop future ones, use the Recurring tab.' : 'This expense will be removed permanently.';
    if (await confirm({ title: 'Delete expense?', message: msg, confirmLabel: 'Delete', danger: true })) { deleteExpense(x.id); toast('Expense deleted'); }
  };

  return (
    <div className="grid-main">
      <div className="span-2 stack">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Search description" />
          <select className="input select input-sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category filter">
            <option value="all">All categories</option>
            {data.expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <Segmented size="sm" label="Period" value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Month' }, { value: 'range', label: 'Dates' }, { value: 'all', label: 'All' }]} />
          {period === 'range' && (
            <span className="date-range">
              <input type="date" className="input input-sm" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
              <span>–</span>
              <input type="date" className="input input-sm" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            </span>
          )}
          {filtered && <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setCat('all'); setPeriod('month'); setFrom(''); setTo(''); }}>{t('actions.clearFilters')}</button>}
        </div>
        <Card pad={false}>
          {!list.length ? (
            <EmptyState icon="expense" title={filtered ? 'No expenses match' : `No expenses in ${formatMonth(month)}`}
              body={filtered ? null : 'Tap + to log an expense in a few seconds.'}
              action={!filtered && <button className="btn btn-primary" onClick={() => openForm('expense')}><Icon name="plus" /> {t('actions.addExpense')}</button>} />
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.date} className="day-group">
                  <div className="day-head"><span>{formatDate(g.date)}</span><span className="num">{formatMoney(g.total, 'CZK')}</span></div>
                  <ul className="txn-list">
                    {g.items.map((x) => {
                      const c = catMap.get(x.categoryId);
                      return (
                        <li key={x.id} className="txn static">
                          <span className="txn-icon" aria-hidden>{c?.icon || '•'}</span>
                          <span className="txn-main">
                            <span className="txn-label">{x.description || c?.name}{x.recurringId && <Icon name="repeat" size={12} className="inline-icon" title="Recurring" />}</span>
                            <span className="txn-sub">{c?.name}{x.paymentMethod ? ` · ${t(`pay.${x.paymentMethod}`)}` : ''}{x.notes ? ` · ${x.notes}` : ''}</span>
                          </span>
                          <span className="txn-right">
                            <Money base={baseAmount(x, r)} amount={x.amount} currency={x.currency} fallback={usesFallback(x, r)} />
                            <IconButton icon="copy" label="Duplicate" onClick={() => openForm('expense', { initial: { ...x, id: undefined, recurringId: null, occurrenceKey: null, date: todayISO() } })} />
                            <IconButton icon="edit" label="Edit" onClick={() => openForm('expense', { initial: x })} />
                            <IconButton icon="trash" label="Delete" tone="danger" onClick={() => del(x)} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <div className="list-foot"><span>{list.length} expense{list.length === 1 ? '' : 's'}</span><span>Total <strong className="num">{formatMoney(total, 'CZK')}</strong></span></div>
            </>
          )}
        </Card>
      </div>
      <div className="stack">
        <Card title="Daily spending" subtitle={formatMonth(month)}>
          <DailyBars data={daily} budgetPerDay={budget > 0 ? budget / daily.length : 0} />
        </Card>
        <Card title="By category" subtitle={formatMonth(month)}>
          {cats.some((c) => c.value > 0) ? <DonutBreakdown items={cats.filter((c) => c.value > 0).map((c) => ({ key: c.id, name: c.name, icon: c.icon, value: c.value }))} onSelect={(s) => setCat(s.key)} /> : <p className="muted small">No spending yet.</p>}
        </Card>
      </div>
    </div>
  );
}

function BudgetInput({ value, onSave, label }) {
  const [v, setV] = useState(value ? String(value) : '');
  const [err, setErr] = useState(false);
  const commit = () => {
    if (v.trim() === '') { setErr(false); if (value) onSave(0); return; }
    const n = parseAmount(v);
    if (!(n >= 0)) { setErr(true); return; }
    setErr(false);
    if (n !== value) onSave(n);
  };
  return (
    <span className={`suffix-input ${err ? 'has-error' : ''}`}>
      <input className="input input-sm num" inputMode="decimal" value={v} placeholder="No limit" aria-label={label} aria-invalid={err}
        onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      <span>Kč</span>
    </span>
  );
}

function Budgets({ cats, month }) {
  const data = useData();
  const { openForm, confirm, toast } = useApp();
  const spent = new Map(cats.map((c) => [c.id, c]));
  return (
    <div className="grid-main">
      <Card title="Monthly spending budget" subtitle="Total for all categories, in CZK">
        <div className="inline-row">
          <BudgetInput key={data.settings.monthlyBudget} value={data.settings.monthlyBudget} label="Monthly budget" onSave={(n) => { updateSettings({ monthlyBudget: n }); toast('Monthly budget saved'); }} />
        </div>
        <label className="field mt-sm">
          <span className="field-label">Warn me at</span>
          <span className="suffix-input">
            <input className="input input-sm num" type="number" min={1} max={100} value={data.settings.budgetWarnPct} aria-label="Warning threshold"
              onChange={(e) => updateSettings({ budgetWarnPct: Math.min(100, Math.max(1, Number(e.target.value) || 80)) })} />
            <span>% used</span>
          </span>
        </label>
      </Card>
      <Card title="Categories & budgets" subtitle={`Spending in ${formatMonth(month)}`} className="span-2" pad={false}
        actions={<button className="btn btn-sm" onClick={() => openForm('category', { kind: 'expense' })}><Icon name="plus" size={14} /> Category</button>}>
        <ul className="budget-list">
          {data.expenseCategories.map((c) => {
            const row = spent.get(c.id);
            const value = row?.value || 0;
            const budget = data.settings.categoryBudgets[c.id] || 0;
            const st = budgetState(value, budget, data.settings.budgetWarnPct);
            return (
              <li key={c.id}>
                <div className="budget-row">
                  <span className="budget-name"><span aria-hidden>{c.icon || '•'}</span> {c.name}</span>
                  <span className="num budget-spent">{formatMoney(value, 'CZK', { decimals: 0 })}</span>
                  <BudgetInput key={budget} value={budget} label={`Budget for ${c.name}`} onSave={(n) => setCategoryBudget(c.id, n)} />
                  <span className="budget-actions">
                    <IconButton icon="edit" label={`Rename ${c.name}`} onClick={() => openForm('category', { kind: 'expense', initial: c })} />
                    {c.id !== FALLBACK_EXPENSE_CATEGORY && (
                      <IconButton icon="trash" label={`Delete ${c.name}`} tone="danger" onClick={async () => {
                        const n = data.expenses.filter((x) => x.categoryId === c.id).length;
                        if (await confirm({ title: `Delete “${c.name}”?`, message: n ? `${n} expense(s) will be moved to “Other”.` : 'The category will be removed.', confirmLabel: 'Delete', danger: true })) {
                          deleteCategory('expense', c.id); toast('Category deleted');
                        }
                      }} />
                    )}
                  </span>
                </div>
                {budget > 0 && (
                  <div className="budget-bar">
                    <ProgressBar value={value} max={budget} level={st.level} label={`${c.name} budget used`} />
                    <span className={`small ${st.level === 'ok' ? 'muted' : st.level === 'over' ? 'neg' : 'warn'}`}>
                      {Math.round(st.pct)}% {st.level === 'over' ? <Badge tone="bad">Over</Badge> : st.level === 'warn' ? <Badge tone="warn">Near limit</Badge> : null}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
