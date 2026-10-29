import { getState } from '../data/store.js';
import { downloadFile, downloadCSV, buildRecordRows } from './csv.js';
import { effectiveRates } from './finance.js';
import { todayISO } from './dates.js';
import { APP_VERSION } from '../data/schema.js';

export function exportJSONBackup() {
  const data = getState();
  const payload = { ...data, exportedAt: new Date().toISOString(), appVersion: APP_VERSION };
  downloadFile(`ledger-backup-${todayISO()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

/** Export records as CSV. `scope`: 'all' | 'YYYY' | 'YYYY-MM'. */
export function exportCSV(scope = 'all') {
  const data = getState();
  const { rates } = effectiveRates(data);
  const include = scope === 'all' ? () => true : (d) => d.startsWith(scope);
  downloadCSV(`ledger-${scope === 'all' ? 'all' : scope}-${todayISO()}.csv`, buildRecordRows(data, rates, include));
}
