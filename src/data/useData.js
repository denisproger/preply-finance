import { useSyncExternalStore } from 'react';
import { getState, subscribe } from './store.js';

/** Subscribe a component to AppData (or a slice of it via `selector`). */
export function useData(selector = (d) => d) {
  return useSyncExternalStore(subscribe, () => selector(getState()));
}
