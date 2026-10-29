// Chart components (Recharts). Colours come from chartTheme(); every chart
// has a hover tooltip, legend for multi-series, and CZK formatting.
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import { useResolvedTheme } from '../lib/hooks.js';
import { chartTheme } from '../lib/chartTheme.js';
import { formatCompact, formatMoney } from '../lib/money.js';
import { formatMonthShort, formatMonth } from '../lib/dates.js';

function TipBox({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{labelFormatter ? labelFormatter(label, payload) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="chart-tip-row">
          <span className="swatch" style={{ background: p.color || p.payload?.fill }} />
          <span>{p.name}</span>
          <strong className="num">{formatMoney(p.value, 'CZK', { decimals: 0 })}</strong>
        </div>
      ))}
    </div>
  );
}

const axisProps = (th) => ({
  tick: { fill: th.axis, fontSize: 11 },
  axisLine: false,
  tickLine: false,
});

/** Net income vs expenses per month (grouped bars). */
export function IncomeExpenseChart({ series, height = 240, labels = ['Net income', 'Expenses'] }) {
  const th = chartTheme(useResolvedTheme());
  const data = series.map((s) => ({ month: s.month, income: s.totalNet, expenses: s.expenses }));
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={th.grid} />
          <XAxis dataKey="month" tickFormatter={(m) => formatMonthShort(m)} {...axisProps(th)} interval="preserveStartEnd" />
          <YAxis tickFormatter={formatCompact} {...axisProps(th)} width={44} />
          <Tooltip cursor={{ fill: th.grid, opacity: 0.5 }} content={<TipBox labelFormatter={(m) => formatMonth(m)} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: th.axis }} />
          <Bar dataKey="income" name={labels[0]} fill={th.income} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expenses" name={labels[1]} fill={th.expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Net income + money left trend (lines). */
export function NetTrendChart({ series, height = 220 }) {
  const th = chartTheme(useResolvedTheme());
  const data = series.map((s) => ({ month: s.month, net: s.totalNet, left: s.left }));
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={th.grid} />
          <XAxis dataKey="month" tickFormatter={(m) => formatMonthShort(m)} {...axisProps(th)} interval="preserveStartEnd" />
          <YAxis tickFormatter={formatCompact} {...axisProps(th)} width={44} />
          <ReferenceLine y={0} stroke={th.muted} />
          <Tooltip content={<TipBox labelFormatter={(m) => formatMonth(m)} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: th.axis }} />
          <Line type="monotone" dataKey="net" name="Net income" stroke={th.income} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: th.income }} activeDot={{ r: 5, stroke: th.surface, strokeWidth: 2 }} />
          <Line type="monotone" dataKey="left" name="Money left" stroke={th.net} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: th.net }} activeDot={{ r: 5, stroke: th.surface, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Donut + value list. Items beyond `maxSlices` fold into "Other" so colours
 * never repeat. items: [{ key, name, value, icon? }]
 */
export function DonutBreakdown({ items, maxSlices = 6, height = 180, onSelect }) {
  const th = chartTheme(useResolvedTheme());
  const sorted = [...items].sort((a, b) => b.value - a.value);
  let slices = sorted;
  if (sorted.length > maxSlices) {
    const rest = sorted.slice(maxSlices - 1);
    slices = [...sorted.slice(0, maxSlices - 1), { key: '__other', name: `Other (${rest.length})`, value: rest.reduce((a, x) => a + x.value, 0) }];
  }
  const total = slices.reduce((a, x) => a + x.value, 0);
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="96%" paddingAngle={slices.length > 1 ? 2 : 0} stroke={th.surface} strokeWidth={2} isAnimationActive>
              {slices.map((s, i) => <Cell key={s.key} fill={th.series[i % th.series.length]} />)}
            </Pie>
            <Tooltip content={<TipBox labelFormatter={(_, p) => p?.[0]?.name} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span>Total</span>
          <strong className="num">{formatCompact(total)}</strong>
        </div>
      </div>
      <ul className="legend-list">
        {slices.map((s, i) => (
          <li key={s.key}>
            <button type="button" className="legend-row" onClick={() => onSelect?.(s)} disabled={!onSelect || s.key === '__other'}>
              <span className="swatch" style={{ background: th.series[i % th.series.length] }} />
              <span className="legend-name">{s.icon ? `${s.icon} ` : ''}{s.name}</span>
              <span className="legend-pct num">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
              <span className="legend-val num">{formatMoney(s.value, 'CZK', { decimals: 0 })}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Daily spending bars for one month. */
export function DailyBars({ data, height = 160, budgetPerDay }) {
  const th = chartTheme(useResolvedTheme());
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={th.grid} />
          <XAxis dataKey="day" {...axisProps(th)} interval={4} />
          <YAxis tickFormatter={formatCompact} {...axisProps(th)} width={40} />
          {budgetPerDay > 0 && <ReferenceLine y={budgetPerDay} stroke={th.axis} strokeDasharray="4 4" label={{ value: 'daily budget', fill: th.axis, fontSize: 10, position: 'insideTopRight' }} />}
          <Tooltip cursor={{ fill: th.grid, opacity: 0.5 }} content={<TipBox labelFormatter={(_, p) => p?.[0]?.payload?.date} />} />
          <Bar dataKey="value" name="Spent" fill={th.expense} radius={[3, 3, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars: per-student net income. */
export function StudentBars({ data, height }) {
  const th = chartTheme(useResolvedTheme());
  const h = height || Math.max(150, data.length * 52 + 56);
  return (
    <div className="chart" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barCategoryGap="22%" barGap={2}>
          <CartesianGrid horizontal={false} stroke={th.grid} />
          <XAxis type="number" tickFormatter={formatCompact} {...axisProps(th)} />
          <YAxis type="category" dataKey="name" {...axisProps(th)} width={90} />
          <Tooltip cursor={{ fill: th.grid, opacity: 0.5 }} content={<TipBox />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: th.axis }} />
          <Bar dataKey="expected" name="Expected net" fill={th.muted} radius={[0, 4, 4, 0]} maxBarSize={14} />
          <Bar dataKey="actual" name="Actual net" fill={th.income} radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
