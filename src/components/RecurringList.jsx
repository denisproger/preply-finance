import { useData } from '../data/useData.js';
import { useApp } from './AppContext.jsx';
import { useRates } from '../lib/hooks.js';
import { describeRule, isRuleActive } from '../data/recurring.js';
import { stopRecurring, deleteRecurring } from '../data/actions.js';
import { formatMoney, toBase } from '../lib/money.js';
import { formatDate, todayISO } from '../lib/dates.js';
import { Badge, IconButton, EmptyState } from './ui.jsx';

/** Recurring rules for expenses or income, with edit / stop / delete. */
export default function RecurringList({ kind }) {
  const rules = useData((d) => d.recurring);
  const cats = useData((d) => (kind === 'expense' ? d.expenseCategories : d.incomeCategories));
  const { openForm, confirm, toast } = useApp();
  const rates = useRates();
  const list = rules.filter((r) => r.kind === kind).sort((a, b) => Number(isRuleActive(b)) - Number(isRuleActive(a)));
  const cat = new Map(cats.map((c) => [c.id, c]));
  const today = todayISO();
  const monthlyTotal = list
    .filter((r) => isRuleActive(r, today))
    .reduce((a, r) => a + toBase(r.template.amount, r.template.currency, null, rates.rates).value / (r.frequency === 'yearly' ? 12 : 1), 0);

  if (!list.length) {
    return (
      <EmptyState icon="repeat" title={`No recurring ${kind === 'expense' ? 'expenses' : 'income'}`}
        body={`Choose “Monthly” or “Yearly” under Repeat when adding ${kind === 'expense' ? 'an expense (rent, subscriptions)' : 'income (e.g. a regular coaching payment)'}. Each period is created exactly once — refreshing the app never duplicates it.`} />
    );
  }
  return (
    <>
      <p className="small muted card-pad-x">Active rules ≈ <strong className="num">{formatMoney(monthlyTotal, 'CZK', { decimals: 0 })}</strong> per month.</p>
      <ul className="txn-list">
        {list.map((r) => {
          const c = cat.get(r.template.categoryId);
          const active = isRuleActive(r, today);
          return (
            <li key={r.id} className={`txn static ${active ? '' : 'faded'}`}>
              <span className="txn-icon" aria-hidden>{c?.icon || '🔁'}</span>
              <span className="txn-main">
                <span className="txn-label">{r.template.description || r.template.title || r.template.source || c?.name}</span>
                <span className="txn-sub">
                  {describeRule(r)} · since {formatDate(r.startDate)}
                  {r.endDate ? ` · ${active ? 'until' : 'ended'} ${formatDate(r.endDate)}` : ''} · {r.generatedKeys.length} created
                </span>
              </span>
              <span className="txn-right">
                <span className="num">{formatMoney(r.template.amount, r.template.currency)}</span>
                {!active && <Badge>Stopped</Badge>}
                <IconButton icon="edit" label="Edit future occurrences" onClick={() => openForm('recurring', { rule: r })} />
                {active && (
                  <IconButton icon="pause" label="Stop future occurrences" onClick={async () => {
                    if (await confirm({ title: 'Stop this recurring item?', message: 'No new records will be created after today, and any not-yet-due record from this rule is removed. Past records are kept.', confirmLabel: 'Stop' })) {
                      stopRecurring(r.id); toast('Recurring item stopped');
                    }
                  }} />
                )}
                <IconButton icon="trash" label="Delete rule" tone="danger" onClick={async () => {
                  if (await confirm({ title: 'Delete rule?', message: 'The rule is removed. Records it already created stay as normal records.', confirmLabel: 'Delete', danger: true })) {
                    deleteRecurring(r.id); toast('Rule deleted');
                  }
                }} />
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
