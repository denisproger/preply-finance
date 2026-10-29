import { formatDateShort } from '../lib/dates.js';
import { Money, StatusBadge } from './ui.jsx';

/** Compact list of transactions. items from lib/transactions.js */
export function TxnList({ items, onOpen, t, showStatus = true }) {
  return (
    <ul className="txn-list">
      {items.map((it) => (
        <li key={`${it.kind}:${it.id}`}>
          <button type="button" className="txn" onClick={() => onOpen?.(it)} disabled={!onOpen}>
            <span className={`txn-icon txn-${it.kind}`} aria-hidden>{it.icon}</span>
            <span className="txn-main">
              <span className="txn-label">{it.label}</span>
              <span className="txn-sub">
                {formatDateShort(it.date)}
                {it.sub ? ` · ${it.sub}` : ''}
              </span>
            </span>
            <span className="txn-right">
              <Money base={it.sign * it.base} amount={it.sign * it.amount} currency={it.currency} fallback={it.fallback} className={it.sign > 0 ? 'pos' : ''} sign={it.sign > 0} />
              {showStatus && it.status === 'expected' && <StatusBadge status="expected" t={t} />}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
