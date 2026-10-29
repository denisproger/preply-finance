// Keeps track of the exchange-rate refresh lifecycle for the UI
// (loading / error / whether the current rate was fetched live this session).
import { useSyncExternalStore } from 'react';
import { fetchLatestRates, isStale } from './exchangeRate.js';
import { getState } from '../data/store.js';
import { saveExchange } from '../data/actions.js';

let rs = { loading: false, error: null, liveThisSession: false };
const subs = new Set();
const set = (patch) => {
  rs = { ...rs, ...patch };
  subs.forEach((f) => f());
};

export async function refreshRates() {
  if (rs.loading) return;
  set({ loading: true, error: null });
  try {
    const ex = await fetchLatestRates();
    saveExchange(ex);
    set({ loading: false, liveThisSession: true });
    return ex;
  } catch (err) {
    set({ loading: false, error: err.message || 'Exchange rate unavailable' });
    return null;
  }
}

/** Refresh on startup when the cached rate is older than a few hours. */
export function autoRefreshRates() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (isStale(getState().exchange)) refreshRates();
  else set({ liveThisSession: false });
}

export function useRateStatus() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => rs
  );
}
