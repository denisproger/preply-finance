// Small reusable presentational components.
import { useId } from 'react';
import Icon from './Icon.jsx';
import { formatMoney, BASE_CURRENCY } from '../lib/money.js';

export function Card({ title, subtitle, actions, children, className = '', pad = true, ...rest }) {
  return (
    <section className={`card ${pad ? 'card-pad' : ''} ${className}`} {...rest}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Headline number tile. `delta` = % change (positive good unless invert). */
export function StatCard({ label, value, currency = BASE_CURRENCY, sub, delta, invert = false, tone, icon, raw }) {
  let deltaEl = null;
  if (delta !== null && delta !== undefined && Number.isFinite(delta)) {
    const good = invert ? delta <= 0 : delta >= 0;
    deltaEl = (
      <span className={`delta ${good ? 'delta-good' : 'delta-bad'}`} title="Change vs previous month">
        {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(Math.abs(delta) >= 100 ? 0 : 1)}%
      </span>
    );
  }
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-label">
        {icon && <Icon name={icon} size={14} />}
        <span>{label}</span>
      </div>
      <div className="stat-value num">{raw !== undefined ? raw : formatMoney(value, currency)}</div>
      <div className="stat-foot">
        {deltaEl}
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'info', title, body, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function Badge({ tone = 'neutral', children, title }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

const STATUS_TONES = { expected: 'warn', received: 'good', paid_out: 'accent', active: 'good', paused: 'warn', archived: 'neutral' };
export function StatusBadge({ status, t }) {
  return <Badge tone={STATUS_TONES[status] || 'neutral'}>{t ? t(`status.${status}`) : status}</Badge>;
}

export function ProgressBar({ value, max, level, label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className={`progress progress-${level || 'ok'}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** CZK value with the original amount underneath when it differs. */
export function Money({ base, amount, currency, fallback, className = '', sign }) {
  const showOrig = currency && currency !== BASE_CURRENCY;
  return (
    <span className={`money ${className}`}>
      <span className="num">{formatMoney(base, BASE_CURRENCY, { sign })}</span>
      {showOrig && (
        <span className="money-orig num" title={fallback ? 'Converted with the current rate (no rate recorded on this transaction)' : 'Converted with the rate recorded on this transaction'}>
          {formatMoney(amount, currency)}
          {fallback ? ' ≈' : ''}
        </span>
      )}
    </span>
  );
}

export function Field({ label, hint, error, children, optional, className = '', htmlFor }) {
  return (
    <div className={`field ${error ? 'field-error' : ''} ${className}`}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {optional && <span className="field-opt"> · optional</span>}
        </label>
      )}
      {children}
      {error ? <p className="field-msg" role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

/** Labelled input; generates an id so label/for work for screen readers. */
export function TextInput({ label, hint, error, optional, className, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className} htmlFor={id}>
      <input id={id} className="input" aria-invalid={!!error} {...props} />
    </Field>
  );
}

export function SelectInput({ label, hint, error, optional, className, options, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className} htmlFor={id}>
      <select id={id} className="input select" aria-invalid={!!error} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function TextArea({ label, optional, ...props }) {
  const id = useId();
  return (
    <Field label={label} optional={optional} htmlFor={id}>
      <textarea id={id} className="input textarea" rows={2} {...props} />
    </Field>
  );
}

/** Segmented control (radio group). */
export function Segmented({ value, onChange, options, label, size }) {
  return (
    <div className={`seg ${size === 'sm' ? 'seg-sm' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconButton({ icon, label, onClick, tone, size = 16, className = '', ...rest }) {
  return (
    <button type="button" className={`icon-btn ${tone ? `icon-btn-${tone}` : ''} ${className}`} onClick={onClick} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search' }) {
  return (
    <label className="search">
      <Icon name="search" size={15} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

export function Tabs({ value, onChange, tabs }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tb) => (
        <button key={tb.value} role="tab" type="button" aria-selected={value === tb.value} className={value === tb.value ? 'on' : ''} onClick={() => onChange(tb.value)}>
          {tb.label}
          {tb.count !== undefined && <span className="tab-count">{tb.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </div>
  );
}
