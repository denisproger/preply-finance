// Storage adapter. The rest of the app only talks to this interface:
//   load()  -> { status: 'empty' | 'ok' | 'corrupt', data?, raw?, error? }
//   save(data) -> { ok: boolean, error? }
//   clear()
// To move to a cloud database (e.g. Supabase) later, write another adapter
// with the same three methods and pass it to initStore() — no UI changes.

export const STORAGE_KEY = 'pft:data';

export function createLocalStorageAdapter(key = STORAGE_KEY) {
  const ls = () => {
    try {
      return window.localStorage;
    } catch {
      return null; // Safari private mode / disabled storage
    }
  };

  return {
    name: 'localStorage',
    load() {
      const store = ls();
      if (!store) return { status: 'empty', error: 'LocalStorage is not available in this browser mode.' };
      const raw = store.getItem(key);
      if (raw === null) return { status: 'empty' };
      try {
        return { status: 'ok', data: JSON.parse(raw) };
      } catch (err) {
        // Keep the unreadable payload so nothing is irrecoverably lost.
        try {
          store.setItem(`${key}:corrupt:${Date.now()}`, raw);
        } catch { /* quota: ignore */ }
        return { status: 'corrupt', raw, error: String(err?.message || err) };
      }
    },
    save(data) {
      const store = ls();
      if (!store) return { ok: false, error: 'LocalStorage is not available.' };
      try {
        store.setItem(key, JSON.stringify(data));
        return { ok: true };
      } catch (err) {
        const quota = err && (err.name === 'QuotaExceededError' || err.code === 22);
        return { ok: false, error: quota ? 'Storage is full. Export a backup and remove old data.' : String(err?.message || err) };
      }
    },
    clear() {
      ls()?.removeItem(key);
    },
    /** Subscribe to changes made in another tab of the same browser. */
    onExternalChange(cb) {
      const handler = (e) => {
        if (e.key === key) cb();
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
  };
}
