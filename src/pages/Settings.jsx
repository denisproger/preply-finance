import { useRef, useState } from 'react';
import { useData } from '../data/useData.js';
import { useRates } from '../lib/hooks.js';
import { useApp } from '../components/AppContext.jsx';
import { useT, LANGUAGES } from '../i18n/index.js';
import { Card, PageHeader, Segmented, Field, Badge, IconButton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { CURRENCIES, formatRate, parseAmount } from '../lib/money.js';
import { updateSettings, deleteCategory, restoreDefaultCategories, importData, resetAll } from '../data/actions.js';
import { refreshRates } from '../services/rateController.js';
import { APP_VERSION, DATA_VERSION, looksLikeBackup, normalizeData, summarizeData, FALLBACK_EXPENSE_CATEGORY, FALLBACK_INCOME_CATEGORY } from '../data/schema.js';
import { exportCSV, exportJSONBackup } from '../lib/backup.js';
import { buildDemoData } from '../data/demoData.js';
import { getState } from '../data/store.js';
import { STORAGE_KEY } from '../data/storage.js';

const RATE_LABELS = {
  live: { tone: 'good', text: 'Live', help: 'Fetched from the internet in this session.' },
  cached: { tone: 'accent', text: 'Cached', help: 'Last successfully fetched rate, saved on this device.' },
  manual: { tone: 'warn', text: 'Manual', help: 'Entered by you; used everywhere instead of the API rate.' },
  default: { tone: 'bad', text: 'Default', help: 'No rate has been fetched yet. Refresh or enter a manual rate.' },
};

export default function Settings() {
  const t = useT();
  const s = useData((d) => d.settings);
  return (
    <>
      <PageHeader title={t('settings.title')} />
      <div className="settings-grid">
        <Card title="General">
          <div className="form">
            <Field label="Theme">
              <Segmented value={s.theme} onChange={(v) => updateSettings({ theme: v })} label="Theme"
                options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
            </Field>
            <Field label="Language" hint="More languages (e.g. Ukrainian) can be added in src/i18n.">
              <select className="input select" value={s.language} onChange={(e) => updateSettings({ language: e.target.value })}>
                {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <div className="grid-2">
              <Field label="Main currency" hint="All totals are shown in CZK.">
                <input className="input" value="CZK — Czech koruna" disabled />
              </Field>
              <Field label="Default student currency">
                <select className="input select" value={s.defaultIncomeCurrency} onChange={(e) => updateSettings({ defaultIncomeCurrency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Default expense currency">
                <select className="input select" value={s.defaultExpenseCurrency} onChange={(e) => updateSettings({ defaultExpenseCurrency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <CommissionSetting value={s.defaultCommissionPct} />
            </div>
          </div>
        </Card>
        <RateCard />
        <CategoriesCard kind="expense" />
        <CategoriesCard kind="income" />
        <DataCard />
        <Card title="About">
          <dl className="kv">
            <div><dt>App version</dt><dd>{APP_VERSION}</dd></div>
            <div><dt>Data format</dt><dd>v{DATA_VERSION}</dd></div>
            <div><dt>Storage</dt><dd>This browser (LocalStorage)</dd></div>
            <div><dt>Preply</dt><dd>Not connected — data is entered manually</dd></div>
          </dl>
          <p className="small muted mt-sm">No passwords, Preply credentials or tokens are stored by this app.</p>
        </Card>
      </div>
    </>
  );
}

function CommissionSetting({ value }) {
  const [v, setV] = useState(String(value));
  const [err, setErr] = useState('');
  const { toast } = useApp();
  const commit = () => {
    const n = parseAmount(v);
    if (!(n >= 0 && n <= 100)) return setErr('Enter 0–100');
    setErr('');
    if (n !== value) { updateSettings({ defaultCommissionPct: n }); toast(`Default commission set to ${n}%`); }
  };
  return (
    <Field label="Default Preply commission" error={err} hint="Used by students without a custom %. Existing records keep the % saved on them.">
      <span className="suffix-input">
        <input className="input num" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label="Default commission percentage" />
        <span>%</span>
      </span>
    </Field>
  );
}

function RateCard() {
  const s = useData((d) => d.settings);
  const exchange = useData((d) => d.exchange);
  const rates = useRates();
  const { toast } = useApp();
  const [usd, setUsd] = useState(s.manualRates.USD ? String(s.manualRates.USD) : '');
  const [eur, setEur] = useState(s.manualRates.EUR ? String(s.manualRates.EUR) : '');
  const [err, setErr] = useState('');
  const label = RATE_LABELS[rates.label];
  const saveManual = () => {
    const u = parseAmount(usd);
    const e = eur.trim() ? parseAmount(eur) : null;
    if (!(u > 0)) return setErr('Enter the USD/CZK rate, e.g. 22.15');
    if (e !== null && !(e > 0)) return setErr('EUR rate must be positive or empty');
    setErr('');
    updateSettings({ rateMode: 'manual', manualRates: { USD: u, EUR: e } });
    toast('Manual rate saved and in use');
  };
  const doRefresh = async () => {
    const ex = await refreshRates();
    toast(ex ? `Rate updated: ${formatRate(ex.rates.USD)} CZK/USD` : 'Could not fetch the rate — keeping the saved one', ex ? 'good' : 'bad');
  };
  return (
    <Card title="Exchange rate" subtitle="Used for every CZK conversion in the app"
      actions={<button className="btn btn-sm" onClick={doRefresh} disabled={rates.loading}><Icon name="refresh" size={14} className={rates.loading ? 'spin' : ''} /> {rates.loading ? 'Refreshing…' : 'Refresh'}</button>}>
      <div className="rate-hero">
        <div>
          <span className="muted small">1 USD =</span>
          <strong className="num">{formatRate(rates.rates.USD)} CZK</strong>
        </div>
        <div>
          <span className="muted small">1 EUR =</span>
          <strong className="num">{formatRate(rates.rates.EUR)} CZK</strong>
        </div>
        <Badge tone={label.tone} title={label.help}>{label.text}</Badge>
      </div>
      <p className="small muted">
        {label.help}
        {exchange && rates.label !== 'manual' && <> Rate date {exchange.date} · source {exchange.provider} · fetched {new Date(exchange.fetchedAt).toLocaleString('en-GB')}.</>}
        {exchange && rates.label === 'manual' && <> Last API rate: {formatRate(exchange.rates.USD)} ({exchange.date}).</>}
      </p>
      {rates.error && <p className="alert alert-warn"><Icon name="alert" size={15} /> Refresh failed — the app keeps working with the {rates.label} rate.</p>}
      <Field label="Rate source">
        <Segmented value={s.rateMode} label="Rate source" onChange={(v) => updateSettings({ rateMode: v })}
          options={[{ value: 'auto', label: 'Automatic (API)' }, { value: 'manual', label: 'Manual' }]} />
      </Field>
      {s.rateMode === 'manual' && (
        <div className="form">
          <div className="grid-2">
            <Field label="CZK per 1 USD" error={err}><input className="input num" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} placeholder={formatRate(exchange?.rates.USD)} /></Field>
            <Field label="CZK per 1 EUR" optional><input className="input num" inputMode="decimal" value={eur} onChange={(e) => setEur(e.target.value)} placeholder={formatRate(exchange?.rates.EUR)} /></Field>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveManual}>Use manual rate</button>
        </div>
      )}
      <p className="small muted mt-sm">Transactions with their own recorded rate always keep it. Others use this rate and are marked ≈.</p>
    </Card>
  );
}

function CategoriesCard({ kind }) {
  const cats = useData((d) => (kind === 'expense' ? d.expenseCategories : d.incomeCategories));
  const { openForm, confirm, toast } = useApp();
  const fallback = kind === 'expense' ? FALLBACK_EXPENSE_CATEGORY : FALLBACK_INCOME_CATEGORY;
  return (
    <Card title={kind === 'expense' ? 'Expense categories' : 'Income categories'} pad={false}
      actions={<button className="btn btn-sm" onClick={() => openForm('category', { kind })}><Icon name="plus" size={14} /> Add</button>}>
      <ul className="cat-manage">
        {cats.map((c) => (
          <li key={c.id}>
            <span><span aria-hidden className="cat-icon">{c.icon || '•'}</span>{c.name}</span>
            <span>
              <IconButton icon="edit" label={`Edit ${c.name}`} onClick={() => openForm('category', { kind, initial: c })} />
              {c.id !== fallback && (
                <IconButton icon="trash" tone="danger" label={`Delete ${c.name}`} onClick={async () => {
                  if (await confirm({ title: `Delete “${c.name}”?`, message: 'Records in this category will move to “Other”.', confirmLabel: 'Delete', danger: true })) {
                    deleteCategory(kind, c.id); toast('Category deleted');
                  }
                }} />
              )}
            </span>
          </li>
        ))}
      </ul>
      {kind === 'expense' && (
        <div className="card-pad-x pb">
          <button className="btn btn-ghost btn-sm" onClick={() => { restoreDefaultCategories(); toast('Missing default categories restored'); }}>Restore default categories</button>
        </div>
      )}
    </Card>
  );
}

function DataCard() {
  const { confirm, toast } = useApp();
  const fileRef = useRef(null);
  const data = useData();
  const counts = summarizeData(data);
  const isEmpty = !counts.students && !counts.preplyEntries && !counts.otherIncome && !counts.expenses;
  let bytes = 0;
  try { bytes = (localStorage.getItem(STORAGE_KEY) || '').length * 2; } catch { /* ignore */ }

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let parsed;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('File is too large to be a backup.');
      parsed = JSON.parse(await file.text());
      if (!looksLikeBackup(parsed)) throw new Error('This file does not look like a Ledger backup.');
      normalizeData(parsed); // throws for unsupported versions
    } catch (err) {
      toast(`Import failed: ${err.message}`, 'bad');
      return;
    }
    const { data: clean, issues } = normalizeData(parsed);
    const c = summarizeData(clean);
    const ok = await confirm({
      title: 'Replace all data with this backup?',
      danger: true,
      confirmLabel: 'Replace my data',
      message: (
        <>
          <p>The backup contains <strong>{c.students}</strong> students, <strong>{c.preplyEntries}</strong> Preply records, <strong>{c.payouts}</strong> payouts, <strong>{c.otherIncome}</strong> income and <strong>{c.expenses}</strong> expense records.</p>
          {issues.length > 0 && <p className="warn small">{issues.join(' ')}</p>}
          <p>Your current data ({counts.students} students, {counts.expenses} expenses…) will be <strong>replaced</strong>. Consider downloading a backup first.</p>
        </>
      ),
    });
    if (!ok) return;
    const res = importData(parsed);
    toast(res.length ? `Imported with ${res.length} warning(s)` : 'Backup restored');
  };

  const loadDemo = async () => {
    if (!isEmpty && !(await confirm({ title: 'Load demo data?', message: 'Your current data will be replaced by demo data. Download a backup first if you want to keep it.', confirmLabel: 'Replace with demo', danger: true }))) return;
    importData(buildDemoData(getState().exchange));
    toast('Demo data loaded — reset it any time below');
  };
  const reset = async () => {
    if (!(await confirm({ title: 'Delete ALL data?', message: 'Every student, record, expense, category and setting on this device will be deleted. This cannot be undone. Download a JSON backup first if unsure.', confirmLabel: 'Delete everything', danger: true }))) return;
    resetAll();
    toast('All data deleted');
  };

  return (
    <Card title="Data, backup & restore" className="span-2">
      <p className="callout">
        <Icon name="info" size={15} /> Your data is stored <strong>only in this browser on this device</strong> (LocalStorage). It does <strong>not</strong> sync between your
        iPhone and your computer, and clearing Safari website data deletes it. Download a JSON backup regularly; restore it on another device to move your data.
      </p>
      <div className="data-stats small muted">
        {counts.students} students · {counts.preplyEntries} Preply records · {counts.payouts} payouts · {counts.otherIncome} income · {counts.expenses} expenses · {counts.recurring} recurring rules · {(bytes / 1024).toFixed(0)} KB used
      </div>
      <div className="btn-row">
        <button className="btn" onClick={exportJSONBackup}><Icon name="download" size={15} /> Download backup (JSON)</button>
        <button className="btn" onClick={() => exportCSV('all')}><Icon name="download" size={15} /> Export records (CSV)</button>
        <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} /> Restore from backup…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>
      <div className="btn-row mt-sm">
        <button className="btn btn-ghost" onClick={loadDemo}>Load demo data</button>
        <button className="btn btn-danger-ghost" onClick={reset}><Icon name="trash" size={15} /> Reset all data</button>
      </div>
    </Card>
  );
}
