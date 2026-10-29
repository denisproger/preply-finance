import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { TextInput, Field } from '../components/ui.jsx';
import { saveCategory } from '../data/actions.js';
import { useSubmitGuard } from '../lib/hooks.js';

const ICONS = ['🛒', '☕', '🍕', '🎉', '🍻', '🚋', '🚗', '⛽', '🏠', '💡', '📱', '🛍️', '👕', '💊', '🥋', '🏋️', '🔁', '📚', '✈️', '🎁', '🐶', '💇', '🎮', '🎬', '💻', '💵', '🎓', '🧰', '•'];

export default function CategoryForm({ kind, initial, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [icon, setIcon] = useState(initial?.icon || '');
  const [err, setErr] = useState('');
  const [busy, guard] = useSubmitGuard();
  const submit = (e) => {
    e.preventDefault();
    guard(async () => {
      if (!name.trim()) return setErr('Enter a name');
      saveCategory(kind, { ...(initial?.id ? { id: initial.id } : {}), name: name.trim(), icon: icon.trim() });
      onClose();
    });
  };
  return (
    <Modal open onClose={onClose} size="sm" title={initial?.id ? 'Edit category' : 'New category'}
      footer={<button type="submit" form="cat-form" className="btn btn-primary" disabled={busy}>Save</button>}>
      <form id="cat-form" className="form" onSubmit={submit} noValidate>
        <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} error={err} data-autofocus maxLength={60} />
        <Field label="Icon" optional hint="Pick one or type any emoji">
          <div className="inline-row">
            <input className="input icon-input" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} aria-label="Icon" />
          </div>
          <div className="emoji-grid">
            {ICONS.map((i) => (
              <button key={i} type="button" className={`emoji ${icon === i ? 'on' : ''}`} onClick={() => setIcon(i)} aria-label={`Icon ${i}`}>{i}</button>
            ))}
          </div>
        </Field>
      </form>
    </Modal>
  );
}
