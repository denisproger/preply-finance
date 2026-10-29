import { useCallback } from 'react';
import en from './en.js';
import { useData } from '../data/useData.js';

// Register additional languages here, e.g. `import uk from './uk.js'` → { en, uk }.
export const LANGUAGES = { en: { label: 'English', dict: en } };

function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
}

/** t('nav.dashboard') — falls back to English, then to the key itself. */
export function translate(lang, key, vars) {
  let s = lookup(LANGUAGES[lang]?.dict || en, key) ?? lookup(en, key) ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

export function useT() {
  const lang = useData((d) => d.settings.language);
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}
