import { useMemo } from 'react';
import { useData } from '../data/useData.js';
import { useRates } from '../lib/hooks.js';
import { useApp } from '../components/AppContext.jsx';
import { useT } from '../i18n/index.js';
import {
  monthSummary, percentChange, lastMonthsSeries, incomeBySource, expensesByCategory, inMonth,
  preplyForecast, preplyPlanTotal, cumulativeSavings, upcomingIncome, budgetState, preplyBalance,
} from '../lib/finance.js';
import { addMonths, formatMonth, currentMonthKey, formatDateShort } from '../lib/dates.js';
import { formatMoney, formatPercent, toBase } from '../lib/money.js';
import { allTransactions } from '../lib/transactions.js';
import { Card, StatCard, EmptyState, PageHeader, ProgressBar, Badge } from '../components/ui.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import { IncomeExpenseChart, NetTrendChart, DonutBreakdown } from '../components/Charts.jsx';
import { TxnList } from '../components/TxnList.jsx';
import Icon from '../components/Icon.jsx';
import { navigate } from '../lib/router.js';

export default function Dashboard() {
  const t = useT();
  const data = useData();
  const rates = useRates();
  const { month, openForm } = useApp();
  const r = rates.rates;

  const view = useMemo(() => {
    const cur = monthSummary(data, month, r);
    const prev = monthSummary(data, addMonths(month, -1), r);
    const isFutureOrCurrent = month >= currentMonthKey();
    return {
      cur,
      prev,
      series6: lastMonthsSeries(data, month, 6, r),
      series12: lastMonthsSeries(data, month, 12, r),
      sources: incomeBySource(data, [month], r),
      cats: expensesByCategory(data, inMonth(data.expenses, month), r),
      forecast: preplyForecast(data, month, r),
      nextPlan: preplyPlanTotal(data, r),
      cumulative: cumulativeSavings(data, month, r),
      upcoming: upcomingIncome(data, isFutureOrCurrent ? currentMonthKey() : month, r, 6),
      recent: allTransactions(data, r).filter((x) => x.date.slice(0, 7) <= month).slice(0, 8),
      balance: preplyBalance(data),
    };
  }, [data, month, r]);

  const hasAnything = data.students.length || data.preplyEntries.length || data.otherIncome.length || data.expenses.length;
  if (!hasAnything) {
    return (
      <>
        <PageHeader title={t('dash.title')} />
        <Card>
          <EmptyState
            icon="wallet"
            title={t('dash.emptyTitle')}
            body={t('dash.emptyBody')}
            action={
              <div className="btn-row center">
                <button className="btn btn-primary" onClick={() => openForm('student')}><Icon name="users" /> {t('actions.addStudent')}</button>
                <button className="btn" onClick={() => openForm('income')}><Icon name="income" /> {t('actions.addIncome')}</button>
                <button className="btn" onClick={() => openForm('expense')}><Icon name="expense" /> {t('actions.addExpense')}</button>
              </div>
            }
          />
          <p className="muted center small">Want to look around first? You can load demo data in <a href="#/settings">Settings</a> and reset it later.</p>
        </Card>
      </>
    );
  }

  const { cur, prev } = view;
  const d = (k) => percentChange(cur[k], prev[k]);
  const budget = data.settings.monthlyBudget;
  const bState = budgetState(cur.expenses, budget, data.settings.budgetWarnPct);
  const balanceCzk = Object.entries(view.balance).reduce((a, [c, v]) => a + toBase(v, c, null, r).value, 0);
  const prevLabel = formatMonth(addMonths(month, -1));

  return (
    <>
      <PageHeader title={t('dash.title')} subtitle={formatMonth(month)}>
        <MonthPicker />
        <div className="desktop-only btn-row">
          <button className="btn btn-sm" onClick={() => openForm('preply')}><Icon name="plus" size={14} /> Lessons</button>
          <button className="btn btn-sm" onClick={() => openForm('income')}><Icon name="plus" size={14} /> Income</button>
          <button className="btn btn-sm btn-primary" onClick={() => openForm('expense')}><Icon name="plus" size={14} /> Expense</button>
        </div>
      </PageHeader>

      {cur.usesFallbackRate && (
        <p className="notice"><Icon name="info" size={15} /> Some foreign-currency records have no recorded rate and use the current {rates.label} rate (marked ≈).</p>
      )}

      <div className="stats-grid">
        <StatCard label={t('dash.totalGross')} value={cur.totalGross} delta={d('totalGross')} />
        <StatCard label={t('dash.preplyCommission')} value={-cur.preplyCommission} delta={d('preplyCommission')} invert tone="muted" />
        <StatCard label={t('dash.preplyNet')} value={cur.preplyNet} delta={d('preplyNet')} />
        <StatCard label={t('dash.otherIncome')} value={cur.otherIncome} delta={d('otherIncome')} />
        <StatCard label={t('dash.totalNet')} value={cur.totalNet} delta={d('totalNet')} tone="accent" />
        <StatCard label={t('dash.expenses')} value={cur.expenses} delta={d('expenses')} invert />
        <StatCard label={t('dash.left')} value={cur.left} delta={percentChange(cur.left, prev.left)} tone={cur.left < 0 ? 'bad' : 'good'} />
        <StatCard label={t('dash.savings')} raw={formatPercent(cur.savingsRate)} sub={`${t('dash.cumulative')}: ${formatMoney(view.cumulative, 'CZK', { decimals: 0 })}`} />
      </div>

      <div className="grid-main">
        <Card title={t('dash.incomeVsExpenses')} subtitle="Last 6 months · CZK" className="span-2">
          <IncomeExpenseChart series={view.series6} />
        </Card>
        <Card title={t('dash.preplyOutlook')} subtitle={formatMonth(month)} actions={<a className="link" href="#/students">Students →</a>}>
          <dl className="kv">
            <div><dt>{t('dash.expectedThisMonth')} (net)</dt><dd className="num">{formatMoney(view.forecast.net, 'CZK', { decimals: 0 })}</dd></div>
            <div><dt>{t('dash.earnedSoFar')} (net)</dt><dd className="num pos">{formatMoney(cur.preplyNet, 'CZK', { decimals: 0 })}</dd></div>
            <div><dt>Still to earn</dt><dd className="num">{formatMoney(Math.max(0, view.forecast.net - cur.preplyNet), 'CZK', { decimals: 0 })}</dd></div>
            <div><dt>Expected commission</dt><dd className="num neg">−{formatMoney(view.forecast.commission, 'CZK', { decimals: 0 })}</dd></div>
            <div><dt>{t('dash.expectedNextMonth')} (net)</dt><dd className="num">{formatMoney(view.nextPlan.net, 'CZK', { decimals: 0 })}</dd></div>
            <div><dt>{t('dash.balance')}</dt><dd className="num">{formatMoney(balanceCzk, 'CZK', { decimals: 0 })}</dd></div>
          </dl>
          {view.forecast.gross > 0 && (
            <div className="mt-sm">
              <ProgressBar value={cur.preplyNet} max={view.forecast.net} label="Preply earned vs expected" />
              <p className="small muted mt-xs">{Math.round((cur.preplyNet / (view.forecast.net || 1)) * 100)}% of expected Preply income earned</p>
            </div>
          )}
        </Card>

        <Card title={t('dash.netBySource')} subtitle={formatMonth(month)}>
          {view.sources.length ? <DonutBreakdown items={view.sources} /> : <EmptyState icon="income" title="No income received this month" body="Received Preply records and other income will appear here." />}
        </Card>
        <Card title={t('dash.expensesByCategory')} subtitle={formatMonth(month)} actions={<a className="link" href="#/expenses">Expenses →</a>}>
          {view.cats.length ? (
            <DonutBreakdown items={view.cats.map((c) => ({ key: c.id, name: c.name, icon: c.icon, value: c.value }))} onSelect={() => navigate('expenses')} />
          ) : (
            <EmptyState icon="expense" title="No expenses this month" />
          )}
        </Card>
        <Card title={t('dash.budget')} subtitle={budget ? `${formatMoney(budget, 'CZK', { decimals: 0 })} limit` : 'No budget set'}>
          {budget > 0 ? (
            <>
              <div className="budget-head">
                <strong className="num">{formatMoney(cur.expenses, 'CZK', { decimals: 0 })}</strong>
                <span className="muted"> of {formatMoney(budget, 'CZK', { decimals: 0 })}</span>
                {bState.level !== 'ok' && <Badge tone={bState.level === 'over' ? 'bad' : 'warn'}>{bState.level === 'over' ? 'Over budget' : 'Near limit'}</Badge>}
              </div>
              <ProgressBar value={cur.expenses} max={budget} level={bState.level} label="Monthly budget used" />
              <p className="small muted mt-xs">{bState.remaining >= 0 ? `${formatMoney(bState.remaining, 'CZK', { decimals: 0 })} left` : `${formatMoney(-bState.remaining, 'CZK', { decimals: 0 })} over`}</p>
            </>
          ) : (
            <p className="muted small">Set a monthly spending budget in <a href="#/settings">Settings</a> to track it here.</p>
          )}
          <h3 className="sub-h">{t('dash.topCategories')}</h3>
          {view.cats.length ? (
            <ul className="mini-bars">
              {view.cats.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <span>{c.icon} {c.name}</span>
                  <span className="num">{formatMoney(c.value, 'CZK', { decimals: 0 })}</span>
                  <ProgressBar value={c.value} max={view.cats[0].value} label={c.name} level={c.budgetState?.level} />
                </li>
              ))}
            </ul>
          ) : <p className="muted small">Nothing spent yet.</p>}
        </Card>

        <Card title={t('dash.netTrend')} subtitle="Last 12 months · CZK" className="span-2">
          <NetTrendChart series={view.series12} />
        </Card>
        <Card title={`Compared with ${prevLabel}`}>
          <table className="compare">
            <thead><tr><th /><th>{formatMonth(addMonths(month, -1), 'en-GB', 'short')}</th><th>{formatMonth(month, 'en-GB', 'short')}</th><th>Δ</th></tr></thead>
            <tbody>
              {[
                ['Net income', 'totalNet', false],
                ['Expenses', 'expenses', true],
                ['Money left', 'left', false],
              ].map(([label, k, inv]) => {
                const diff = cur[k] - prev[k];
                const good = inv ? diff <= 0 : diff >= 0;
                return (
                  <tr key={k}>
                    <th>{label}</th>
                    <td className="num">{formatMoney(prev[k], 'CZK', { decimals: 0 })}</td>
                    <td className="num">{formatMoney(cur[k], 'CZK', { decimals: 0 })}</td>
                    <td className={`num ${diff === 0 ? '' : good ? 'pos' : 'neg'}`}>{formatMoney(diff, 'CZK', { decimals: 0, sign: true })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title={t('dash.recent')} className="span-2" pad={false}>
          {view.recent.length ? (
            <TxnList items={view.recent} t={t} onOpen={(it) => openForm(it.kind, { initial: it.record })} />
          ) : (
            <EmptyState title="No transactions yet" />
          )}
        </Card>
        <Card title={t('dash.upcoming')} pad={false}>
          {view.upcoming.length ? (
            <ul className="txn-list">
              {view.upcoming.map((u) => (
                <li key={u.id} className="txn static">
                  <span className="txn-icon txn-income" aria-hidden>{u.kind === 'preply' ? '🎓' : '⏳'}</span>
                  <span className="txn-main"><span className="txn-label">{u.label}</span><span className="txn-sub">{formatDateShort(u.date)}</span></span>
                  <span className="txn-right num">{formatMoney(u.value, 'CZK', { decimals: 0 })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small card-pad">No income marked as expected. Recurring income and Preply records with status “Expected” show up here.</p>
          )}
        </Card>
      </div>
    </>
  );
}
