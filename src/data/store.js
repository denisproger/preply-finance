// Central data store (framework-agnostic).
// Every mutation goes through `update()`, which:
//   1. produces a new immutable AppData object,
//   2. writes it to storage synchronously (so a refresh right after a click
//      never loses data),
//   3. notifies subscribers (React re-renders via useSyncExternalStore).

import { emptyData, normalizeData } from './schema.js';
import { generateRecurring } from './recurring.js';
import { createLocalStorageAdapter } from './storage.js';

let adapter = null;
let state = emptyData();
let status = { loadIssues: [], saveError: null, recovered: false, storageAvailable: true };
const listeners = new Set();

function emit() {
  for (const l of listeners) l();
}

function persist(next) {
  const res = adapter ? adapter.save(next) : { ok: true };
  status = { ...status, saveError: res.ok ? null : res.error };
}

/** Load from storage, repair, generate due recurring items. Call once at startup. */
export function initStore(customAdapter) {
  adapter = customAdapter || createLocalStorageAdapter();
  const loaded = adapter.load();
  let issues = [];
  let recovered = false;
  if (loaded.status === 'ok') {
    try {
      const r = normalizeData(loaded.data);
      state = r.data;
      issues = r.issues;
    } catch (err) {
      state = emptyData();
      issues = [`Stored data could not be read (${err.message}). Started empty; the old copy was kept.`];
      recovered = true;
    }
  } else if (loaded.status === 'corrupt') {
    state = emptyData();
    issues = ['Stored data was corrupted and could not be read. A copy was kept in storage; restore from a JSON backup if you have one.'];
    recovered = true;
  } else {
    state = emptyData();
    if (loaded.error) issues = [loaded.error];
  }
  status = { loadIssues: issues, saveError: null, recovered, storageAvailable: !loaded.error };
  const gen = generateRecurring(state);
  state = gen.data;
  persist(state);
  adapter.onExternalChange?.(() => reloadFromStorage());
  emit();
  return status;
}

function reloadFromStorage() {
  const loaded = adapter.load();
  if (loaded.status !== 'ok') return;
  try {
    state = normalizeData(loaded.data).data;
    emit();
  } catch { /* ignore */ }
}

export function getState() {
  return state;
}
export function getStatus() {
  return status;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Apply `fn(data) => newData` and persist. */
export function update(fn) {
  const next = fn(state);
  if (!next || next === state) return state;
  state = { ...next, meta: { ...next.meta, updatedAt: new Date().toISOString() } };
  persist(state);
  emit();
  return state;
}

/** Replace all data (import / reset / demo). Input is validated first. */
export function replaceAll(raw) {
  const { data, issues } = normalizeData(raw);
  const gen = generateRecurring(data);
  state = gen.data;
  persist(state);
  emit();
  return issues;
}

/** Re-run recurring generation (e.g. when the app returns from background on a new day). */
export function runRecurring() {
  const gen = generateRecurring(state);
  if (gen.created) {
    state = gen.data;
    persist(state);
    emit();
  }
  return gen.created;
}
