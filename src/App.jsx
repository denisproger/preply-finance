import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './components/AppContext.jsx';
import Icon from './components/Icon.jsx';
import Modal from './components/Modal.jsx';
import { useRoute } from './lib/router.js';
import { useRates, useResolvedTheme } from './lib/hooks.js';
import { useT } from './i18n/index.js';
import { formatRate } from './lib/money.js';
import { getStatus, subscribe } from './data/store.js';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import OtherIncome from './pages/OtherIncome.jsx';
import Expenses from './pages/Expenses.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import ExpenseForm from './forms/ExpenseForm.jsx';
import IncomeForm from './forms/IncomeForm.jsx';
import StudentForm from './forms/StudentForm.jsx';
import PreplyEntryForm from './forms/PreplyEntryForm.jsx';
import PayoutForm from './forms/PayoutForm.jsx';
import RecurringForm from './forms/RecurringForm.jsx';
import CategoryForm from './forms/CategoryForm.jsx';

const NAV = [
  { route: 'dashboard', icon: 'dashboard', key: 'nav.dashboard', short: 'nav.dashboard' },
  { route: 'students', icon: 'users', key: 'nav.students', short: 'nav.studentsShort' },
  { route: 'income', icon: 'income', key: 'nav.income', short: 'nav.incomeShort' },
  { route: 'expenses', icon: 'expense', key: 'nav.expenses', short: 'nav.expenses' },
  { route: 'reports', icon: 'reports', key: 'nav.reports', short: 'nav.reports' },
  { route: 'settings', icon: 'settings', key: 'nav.settings', short: 'nav.settings' },
];

const PAGES = { dashboard: Dashboard, students: Students, income: OtherIncome, expenses: Expenses, reports: Reports, settings: Settings };

const FORMS = {
  expense: ExpenseForm,
  income: IncomeForm,
  student: StudentForm,
  preply: PreplyEntryForm,
  payout: PayoutForm,
  recurring: RecurringForm,
  category: CategoryForm,
};

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function useStoreStatus() {
  const [s, setS] = useState(getStatus);
  useEffect(() => subscribe(() => setS(getStatus())), []);
  return s;
}

function Shell() {
  const t = useT();
  const route = useRoute();
  const theme = useResolvedTheme();
  const { form, closeForm, studentId, openStudent } = useApp();
  const status = useStoreStatus();
  const [issuesOpen, setIssuesOpen] = useState(true);
  const [quick, setQuick] = useState(false);
  const Page = PAGES[route];
  const Form = form ? FORMS[form.type] : null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', theme === 'dark' ? '#0c0d10' : '#f7f7f8'));
  }, [theme]);

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden>L</span>
          <div><strong>{t('app.name')}</strong><span>{t('app.tagline')}</span></div>
        </div>
        <QuickActions />
        <nav>
          {NAV.map((n) => (
            <a key={n.route} href={`#/${n.route}`} className={`nav-item ${route === n.route ? 'on' : ''}`} aria-current={route === n.route ? 'page' : undefined}>
              <Icon name={n.icon} /> <span>{t(n.key)}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-foot"><RatePill /></div>
      </aside>

      <header className="topbar">
        <div className="brand compact"><span className="brand-mark" aria-hidden>L</span><strong>{t(NAV.find((n) => n.route === route).key)}</strong></div>
        <div className="topbar-right">
          <RatePill compact />
          <a href="#/settings" className={`icon-btn ${route === 'settings' ? 'on' : ''}`} aria-label={t('nav.settings')}><Icon name="settings" /></a>
        </div>
      </header>

      <main className="main" id="main">
        {status.loadIssues.length > 0 && issuesOpen && (
          <div className={`alert ${status.recovered ? 'alert-over' : 'alert-warn'}`} role="status">
            <Icon name="alert" size={16} />
            <span>{status.loadIssues.join(' ')}</span>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => setIssuesOpen(false)}><Icon name="x" size={14} /></button>
          </div>
        )}
        {status.saveError && (
          <div className="alert alert-over" role="alert"><Icon name="alert" size={16} /> Couldn’t save: {status.saveError}</div>
        )}
        <div className="page" key={route}><Page /></div>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV.filter((n) => n.route !== 'settings').map((n) => (
          <a key={n.route} href={`#/${n.route}`} className={route === n.route ? 'on' : ''} aria-current={route === n.route ? 'page' : undefined}>
            <Icon name={n.icon} size={20} />
            <span>{t(n.short)}</span>
          </a>
        ))}
      </nav>
      <button className="fab" onClick={() => setQuick(true)} aria-label={t('actions.quickAdd')}><Icon name="plus" size={24} strokeWidth={2.2} /></button>

      <Modal open={quick} onClose={() => setQuick(false)} title={t('actions.quickAdd')} size="sm">
        <QuickActions vertical onPick={() => setQuick(false)} />
      </Modal>

      {Form && <Form key={form.key} {...form.props} onClose={closeForm} />}
      {studentId && <StudentDetail id={studentId} onClose={() => openStudent(null)} />}
    </div>
  );
}

function QuickActions({ vertical, onPick }) {
  const t = useT();
  const { openForm } = useApp();
  const go = (type) => {
    onPick?.();
    openForm(type);
  };
  return (
    <div className={`quick ${vertical ? 'quick-v' : ''}`}>
      <button className="btn btn-primary" onClick={() => go('expense')}><Icon name="expense" size={16} /> {t('actions.addExpense')}</button>
      <button className="btn" onClick={() => go('income')}><Icon name="income" size={16} /> {t('actions.addIncome')}</button>
      <button className="btn" onClick={() => go('preply')}><Icon name="calendar" size={16} /> {t('actions.recordLessons')}</button>
      <button className="btn" onClick={() => go('student')}><Icon name="users" size={16} /> {t('actions.addStudent')}</button>
    </div>
  );
}

function RatePill({ compact }) {
  const rates = useRates();
  const dot = { live: 'good', cached: 'accent', manual: 'warn', default: 'bad' }[rates.label];
  return (
    <a href="#/settings" className={`rate-pill ${compact ? 'compact' : ''}`} title={`USD/CZK rate — ${rates.label}${rates.date ? ` (${rates.date})` : ''}`}>
      <span className={`dot dot-${dot} ${rates.loading ? 'pulse' : ''}`} />
      <span className="num">{compact ? '' : '1 USD = '}{formatRate(rates.rates.USD)}{compact ? '' : ' Kč'}</span>
      {!compact && <span className="muted">{rates.label}</span>}
    </a>
  );
}
