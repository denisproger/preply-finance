import { useMemo, useState } from 'react';
import { useData } from '../data/useData.js';
import { useRates } from '../lib/hooks.js';
import { useApp } from '../components/AppContext.jsx';
import { useT } from '../i18n/index.js';
import { monthSummary, annualSummary, lastMonthsSeries, incomeBySource, expensesByCategory, inMonth, percentChange } from '../lib/finance.js';
import { formatMoney, formatPercent } from '../lib/money.js';
import { addMonths, formatMonth, formatMonthShort, monthsOfYear } from '../lib/dates.js';
import { Card, StatCard, PageHeader, Segmented, EmptyState } from '../components/ui.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import { IncomeExpenseChart, NetTrendChart, DonutBreakdown } from '../components/Charts.jsx';
import Icon from '../components/Icon.jsx';
import { exportCSV, exportJSONBackup } from '../lib/backup.js';

const ROWS = [
  ['Gross Preply income', 'preplyGross'],
  ['Preply commission', 'preplyCommission', 'neg'],
  ['Net Preply income', 'preplyNet'],
  ['Other income', 'otherIncome'],
  ['Total gross income', 'totalGross'],
  ['Total net income', 'totalNet', 'strong'],
  ['Total expenses', 'expenses', 'expense'],
  ['Money left after expenses', 'left', 'strong'],
];

export default function Reports() {
  const t = useT();
  const [mode, setMode] = useState('monthly');
  return (
    <>
      <PageHeader title={t('reports.title')}>
        <Segmented value={mode} onChange={setMode} label="Report type" options={[{ value: 'monthly', label: t('reports.monthly') }, { value: 'annual', label: t('reports.annual') }]} />
      </PageHeader>
      {mode === 'monthly' ? <MonthlyReport /> : <AnnualReport />}
      <ExportCard />
    </>
  );
}

function MonthlyReport() {
  const data = useData();
  const r = useRates().rates;
  const { month } = useApp();
  const [perStudent, setPerStudent] = useState(true);
  const v = useMemo(() => ({
    cur: monthSummary(data, month, r),
    prev: monthSummary(data, addMonths(month, -1), r),
    series: lastMonthsSeries(data, month, 12, r),
    sources: incomeBySource(data, [month], r, { preplyPerStudent: perStudent }),
    cats: expensesByCategory(data, inMonth(data.expenses, month), r),
  }), [data, month, r, perStudent]);
  const { cur, prev } = v;
  return (
    <>
      <div className="toolbar"><MonthPicker /><button className="btn btn-sm toolbar-end" onClick={() => exportCSV(month)}><Icon name="download" size={14} /> CSV for {formatMonth(month, 'en-GB', 'short')}</button></div>
      <div className="stats-grid stats-grid-4">
        <StatCard label="Total net income" value={cur.totalNet} delta={percentChange(cur.totalNet, prev.totalNet)} tone="accent" />
        <StatCard label="Total expenses" value={cur.expenses} delta={percentChange(cur.expenses, prev.expenses)} invert />
        <StatCard label="Money left" value={cur.left} tone={cur.left < 0 ? 'bad' : 'good'} />
        <StatCard label="Savings rate" raw={formatPercent(cur.savingsRate)} sub={cur.savingsRate === null ? 'No income this month' : `prev ${formatPercent(prev.savingsRate)}`} />
      </div>
      <div className="grid-main">
        <Card title="Monthly overview" subtitle="Compared with the previous month · CZK" className="span-2" pad={false}>
          <div className="table-scroll">
            <table className="table report-table">
              <thead><tr><th /><th className="r">{formatMonth(addMonths(month, -1), 'en-GB', 'short')}</th><th className="r">{formatMonth(month, 'en-GB', 'short')}</th><th className="r">Change</th></tr></thead>
              <tbody>
                {ROWS.map(([label, k, style]) => {
                  const diff = cur[k] - prev[k];
                  const pc = percentChange(cur[k], prev[k]);
                  const goodUp = !(style === 'neg' || style === 'expense');
                  return (
                    <tr key={k} className={style === 'strong' ? 'row-strong' : ''}>
                      <th>{label}</th>
                      <td className="r num">{formatMoney(prev[k], 'CZK')}</td>
                      <td className="r num">{formatMoney(cur[k], 'CZK')}</td>
                      <td className={`r num ${diff === 0 ? 'muted' : (diff > 0) === goodUp ? 'pos' : 'neg'}`}>
                        {formatMoney(diff, 'CZK', { sign: true, decimals: 0 })}{pc !== null ? <span className="small"> ({pc > 0 ? '+' : ''}{pc.toFixed(0)}%)</span> : ''}
                      </td>
                    </tr>
                  );
                })}
                <tr className="row-strong"><th>Savings rate</th><td className="r num">{formatPercent(prev.savingsRate)}</td><td className="r num">{formatPercent(cur.savingsRate)}</td><td /></tr>
              </tbody>
            </table>
          </div>
          {cur.usesFallbackRate && <p className="small muted card-pad-x">≈ Some foreign-currency records use the current exchange rate.</p>}
        </Card>
        <Card title="Income by source" subtitle="Net, CZK" actions={<label className="check small"><input type="checkbox" checked={perStudent} onChange={(e) => setPerStudent(e.target.checked)} /> Per student</label>}>
          {v.sources.length ? <DonutBreakdown items={v.sources} maxSlices={7} /> : <EmptyState icon="income" title="No income this month" />}
        </Card>
        <Card title="Historical income & expenses" subtitle="12 months ending this month" className="span-2">
          <IncomeExpenseChart series={v.series} />
        </Card>
        <Card title="Expenses by category" pad={false}>
          {v.cats.length ? (
            <ul className="cat-table">
              {v.cats.map((c) => (
                <li key={c.id}><span>{c.icon} {c.name}</span><span className="muted num">{c.share.toFixed(0)}%</span><span className="num">{formatMoney(c.value, 'CZK', { decimals: 0 })}</span></li>
              ))}
            </ul>
          ) : <EmptyState icon="expense" title="No expenses" />}
        </Card>
      </div>
    </>
  );
}

function AnnualReport() {
  const data = useData();
  const r = useRates().rates;
  const { month } = useApp();
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const v = useMemo(() => {
    const cur = annualSummary(data, year, r);
    const prev = annualSummary(data, year - 1, r);
    const months = monthsOfYear(year);
    return {
      cur, prev,
      sources: incomeBySource(data, months, r, { preplyPerStudent: true }),
      cats: expensesByCategory(data, data.expenses.filter((x) => x.date.startsWith(String(year))), r),
    };
  }, [data, year, r]);
  const T = v.cur.totals;
  return (
    <>
      <div className="toolbar">
        <div className="month-picker">
          <button className="icon-btn" onClick={() => setYear(year - 1)} aria-label="Previous year"><Icon name="left" /></button>
          <span className="month-text">{year}</span>
          <button className="icon-btn" onClick={() => setYear(year + 1)} aria-label="Next year"><Icon name="right" /></button>
        </div>
        <button className="btn btn-sm toolbar-end" onClick={() => exportCSV(String(year))}><Icon name="download" size={14} /> CSV for {year}</button>
      </div>
      <div className="stats-grid stats-grid-4">
        <StatCard label={`Net income ${year}`} value={T.totalNet} delta={percentChange(T.totalNet, v.prev.totals.totalNet)} tone="accent" sub={`Preply net ${formatMoney(T.preplyNet, 'CZK', { decimals: 0 })}`} />
        <StatCard label="Expenses" value={T.expenses} delta={percentChange(T.expenses, v.prev.totals.expenses)} invert />
        <StatCard label="Money left" value={T.left} tone={T.left < 0 ? 'bad' : 'good'} />
        <StatCard label="Savings rate" raw={formatPercent(T.savingsRate)} sub={`Commission paid ${formatMoney(T.preplyCommission, 'CZK', { decimals: 0 })}`} />
      </div>
      <div className="grid-main">
        <Card title={`${year} by month`} className="span-2"><IncomeExpenseChart series={v.cur.months} /></Card>
        <Card title="Income by source" subtitle={String(year)}>
          {v.sources.length ? <DonutBreakdown items={v.sources} maxSlices={7} /> : <EmptyState icon="income" title="No income this year" />}
        </Card>
        <Card title="Monthly table" subtitle="CZK" className="span-3" pad={false}>
          <div className="table-scroll">
            <table className="table report-table">
              <thead><tr><th>Month</th><th className="r">Preply gross</th><th className="r">Commission</th><th className="r">Preply net</th><th className="r">Other</th><th className="r">Net income</th><th className="r">Expenses</th><th className="r">Left</th><th className="r">Savings</th></tr></thead>
              <tbody>
                {v.cur.months.map((m) => (
                  <tr key={m.month} className={m.isEmpty ? 'faded' : ''}>
                    <th>{formatMonthShort(m.month)}</th>
                    <td className="r num">{formatMoney(m.preplyGross, 'CZK', { decimals: 0 })}</td>
                    <td className="r num neg">{m.preplyCommission ? `−${formatMoney(m.preplyCommission, 'CZK', { decimals: 0 })}` : formatMoney(0, 'CZK', { decimals: 0 })}</td>
                    <td className="r num">{formatMoney(m.preplyNet, 'CZK', { decimals: 0 })}</td>
                    <td className="r num">{formatMoney(m.otherIncome, 'CZK', { decimals: 0 })}</td>
                    <td className="r num"><strong>{formatMoney(m.totalNet, 'CZK', { decimals: 0 })}</strong></td>
                    <td className="r num">{formatMoney(m.expenses, 'CZK', { decimals: 0 })}</td>
                    <td className={`r num ${m.left < 0 ? 'neg' : ''}`}>{formatMoney(m.left, 'CZK', { decimals: 0 })}</td>
                    <td className="r num">{formatPercent(m.savingsRate, 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <td className="r num">{formatMoney(T.preplyGross, 'CZK', { decimals: 0 })}</td>
                  <td className="r num neg">−{formatMoney(T.preplyCommission, 'CZK', { decimals: 0 })}</td>
                  <td className="r num">{formatMoney(T.preplyNet, 'CZK', { decimals: 0 })}</td>
                  <td className="r num">{formatMoney(T.otherIncome, 'CZK', { decimals: 0 })}</td>
                  <td className="r num"><strong>{formatMoney(T.totalNet, 'CZK', { decimals: 0 })}</strong></td>
                  <td className="r num">{formatMoney(T.expenses, 'CZK', { decimals: 0 })}</td>
                  <td className="r num"><strong>{formatMoney(T.left, 'CZK', { decimals: 0 })}</strong></td>
                  <td className="r num">{formatPercent(T.savingsRate, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
        <Card title="Net income trend" subtitle={String(year)} className="span-2"><NetTrendChart series={v.cur.months} /></Card>
        <Card title="Top expense categories" subtitle={String(year)} pad={false}>
          {v.cats.length ? (
            <ul className="cat-table">
              {v.cats.map((c) => <li key={c.id}><span>{c.icon} {c.name}</span><span className="muted num">{c.share.toFixed(0)}%</span><span className="num">{formatMoney(c.value, 'CZK', { decimals: 0 })}</span></li>)}
            </ul>
          ) : <EmptyState icon="expense" title="No expenses" />}
        </Card>
      </div>
    </>
  );
}

function ExportCard() {
  return (
    <Card title="Export & backup" subtitle="Your data lives only in this browser — export regularly.">
      <div className="btn-row">
        <button className="btn" onClick={() => exportCSV('all')}><Icon name="download" size={15} /> All records (CSV)</button>
        <button className="btn" onClick={exportJSONBackup}><Icon name="download" size={15} /> Full backup (JSON)</button>
        <a className="btn btn-ghost" href="#/settings">Restore from backup →</a>
      </div>
    </Card>
  );
}
