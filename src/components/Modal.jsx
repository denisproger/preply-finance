import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

/**
 * Accessible modal: centred dialog on desktop, bottom sheet on phones.
 * Esc / backdrop click closes; focus moves into the dialog and returns after.
 */
// Count open modals so nested dialogs (e.g. confirm over a form) keep scroll locked.
let openModals = 0;

export default function Modal({ open, onClose, title, children, footer, size = 'md', labelledBy }) {
  const ref = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    openModals += 1;
    document.body.classList.add('modal-open');
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
      if (e.key === 'Tab' && ref.current) {
        // Simple focus trap
        const f = ref.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    // Focus the first field marked autoFocus, else the dialog itself.
    requestAnimationFrame(() => {
      const target = ref.current?.querySelector('[data-autofocus]') || ref.current;
      target?.focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      openModals = Math.max(0, openModals - 1);
      if (!openModals) document.body.classList.remove('modal-open');
      lastFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || 'modal-title'}
        tabIndex={-1}
        ref={ref}
      >
        <header className="modal-head">
          <h2 id={labelledBy || 'modal-title'}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
