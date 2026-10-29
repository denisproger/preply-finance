// Stable unique IDs. crypto.randomUUID is available in all modern browsers
// (including iOS Safari 15.4+); a fallback keeps older engines working.
export function newId(prefix = 'id') {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `${prefix}_${rand}`;
}
