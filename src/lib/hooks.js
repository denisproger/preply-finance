import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../data/useData.js';
import { effectiveRates } from './finance.js';
import { useRateStatus } from '../services/rateController.js';

/** The one set of conversion rates used across the whole UI. */
export function useRates() {
  const settings = useData((d) => d.settings);
  const exchange = useData((d) => d.exchange);
  const status = useRateStatus();
  return useMemo(() => {
    const eff = effectiveRates({ settings, exchange });
    let label;
    if (eff.mode === 'manual') label = 'manual';
    else if (eff.mode === 'default') label = 'default';
    else label = status.liveThisSession ? 'live' : 'cached';
    return { ...eff, label, loading: status.loading, error: status.error };
  }, [settings, exchange, status]);
}

/** 'light' | 'dark' after resolving the "system" preference. */
export function useResolvedTheme() {
  const theme = useData((d) => d.settings.theme);
  const [sysDark, setSysDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const fn = (e) => setSysDark(e.matches);
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);
  return theme === 'system' ? (sysDark ? 'dark' : 'light') : theme;
}

/**
 * Guards a submit handler against double taps / double submits:
 * while the handler runs (and for a short moment after) further calls are ignored.
 */
export function useSubmitGuard() {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      setTimeout(() => {
        busyRef.current = false;
        setBusy(false);
      }, 400);
    }
  }, []);
  return [busy, run];
}

export function useMediaQuery(q) {
  const [m, setM] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return undefined;
    const fn = (e) => setM(e.matches);
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, [q]);
  return m;
}
