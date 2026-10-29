import { addMonths, currentMonthKey, formatMonth } from '../lib/dates.js';
import Icon from './Icon.jsx';
import { useApp } from './AppContext.jsx';

/** ‹ October 2026 › with a native month input for jumping anywhere. */
export default function MonthPicker({ value, onChange, compact }) {
  const app = useApp();
  const month = value ?? app.month;
  const set = onChange ?? app.setMonth;
  const isCurrent = month === currentMonthKey();
  return (
    <div className={`month-picker ${compact ? 'compact' : ''}`}>
      <button type="button" className="icon-btn" onClick={() => set(addMonths(month, -1))} aria-label="Previous month">
        <Icon name="left" />
      </button>
      <label className="month-label">
        <span className="month-text">{formatMonth(month)}</span>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && set(e.target.value)}
          aria-label="Select month"
        />
      </label>
      <button type="button" className="icon-btn" onClick={() => set(addMonths(month, 1))} aria-label="Next month">
        <Icon name="right" />
      </button>
      {!isCurrent && (
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => set(currentMonthKey())}>
          Today
        </button>
      )}
    </div>
  );
}
