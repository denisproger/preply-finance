// App-wide UI context: selected month, global forms, confirm dialogs, toasts.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { currentMonthKey } from '../lib/dates.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [month, setMonth] = useState(() => {
    try {
      return sessionStorage.getItem('pft:month') || currentMonthKey();
    } catch {
      return currentMonthKey();
    }
  });
  const changeMonth = useCallback((m) => {
    setMonth(m);
    try { sessionStorage.setItem('pft:month', m); } catch { /* ignore */ }
  }, []);

  // ---- global form launcher: { type, props } ----
  const [form, setForm] = useState(null);
  const openForm = useCallback((type, props = {}) => setForm({ type, props, key: Date.now() }), []);
  const closeForm = useCallback(() => setForm(null), []);

  // ---- student detail ----
  const [studentId, setStudentId] = useState(null);

  // ---- confirm dialog (promise based) ----
  const [confirmState, setConfirmState] = useState(null);
  const resolver = useRef(null);
  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setConfirmState(opts);
  }), []);
  const settle = (v) => {
    resolver.current?.(v);
    resolver.current = null;
    setConfirmState(null);
  };

  // ---- toasts ----
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, tone = 'good') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const value = useMemo(
    () => ({ month, setMonth: changeMonth, form, openForm, closeForm, studentId, openStudent: setStudentId, confirm, toast }),
    [month, changeMonth, form, openForm, closeForm, studentId, confirm, toast]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal
        open={!!confirmState}
        onClose={() => settle(false)}
        title={confirmState?.title || 'Are you sure?'}
        size="sm"
        labelledBy="confirm-title"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>Cancel</button>
            <button type="button" data-autofocus className={`btn ${confirmState?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => settle(true)}>
              {confirmState?.confirmLabel || 'Confirm'}
            </button>
          </>
        }
      >
        <div className="confirm-body">{confirmState?.message}</div>
      </Modal>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <Icon name={t.tone === 'bad' ? 'alert' : 'check'} size={16} />
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
