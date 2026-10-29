// USD/CZK (and EUR/CZK) exchange rates from free, key-less public APIs.
//
// Providers are tried in order; the first valid answer wins:
//   1. Frankfurter (European Central Bank reference rates) — v2 API
//   2. Frankfurter v1 API (same data, older endpoint)
//   3. ExchangeRate-API open access endpoint (open.er-api.com)
// Callers cache the result in AppData.exchange; if every provider fails the
// app keeps using the cached (or manual) rate, so it stays fully usable offline.

const TIMEOUT_MS = 8000;

async function getJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// A CZK-per-USD rate outside this band is certainly a bad response.
const plausible = (r) => Number.isFinite(r) && r > 5 && r < 100;

const providers = [
  {
    name: 'Frankfurter (ECB)',
    async fetch() {
      const [usd, eur] = await Promise.all([
        getJSON('https://api.frankfurter.dev/v2/rate/USD/CZK'),
        getJSON('https://api.frankfurter.dev/v2/rate/EUR/CZK').catch(() => null),
      ]);
      return { USD: Number(usd.rate), EUR: eur ? Number(eur.rate) : null, date: usd.date };
    },
  },
  {
    name: 'Frankfurter (ECB)',
    async fetch() {
      const j = await getJSON('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CZK,EUR');
      const czk = Number(j.rates?.CZK);
      const eurPerUsd = Number(j.rates?.EUR);
      return { USD: czk, EUR: eurPerUsd > 0 ? czk / eurPerUsd : null, date: j.date };
    },
  },
  {
    name: 'ExchangeRate-API',
    async fetch() {
      const j = await getJSON('https://open.er-api.com/v6/latest/USD');
      if (j.result && j.result !== 'success') throw new Error('Provider error');
      const czk = Number(j.rates?.CZK);
      const eurPerUsd = Number(j.rates?.EUR);
      const date = j.time_last_update_unix
        ? new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      return { USD: czk, EUR: eurPerUsd > 0 ? czk / eurPerUsd : null, date };
    },
  },
];

/**
 * Fetch the latest rates.
 * @returns {Promise<{rates:{USD:number,EUR:number|null}, date:string, fetchedAt:string, provider:string}>}
 * @throws when every provider failed (message lists the reasons)
 */
export async function fetchLatestRates() {
  const errors = [];
  for (const p of providers) {
    try {
      const r = await p.fetch();
      if (!plausible(r.USD)) throw new Error('Implausible rate in response');
      return {
        rates: { USD: round4(r.USD), EUR: r.EUR && r.EUR > 5 && r.EUR < 100 ? round4(r.EUR) : null },
        date: typeof r.date === 'string' ? r.date.slice(0, 10) : '',
        fetchedAt: new Date().toISOString(),
        provider: p.name,
      };
    } catch (err) {
      errors.push(`${p.name}: ${err?.name === 'AbortError' ? 'timeout' : err?.message || err}`);
    }
  }
  throw new Error(`Could not fetch exchange rate. ${errors.join(' · ')}`);
}

/**
 * Historical CZK rate for one currency on a given date (ECB, nearest
 * previous business day). Used by the "rate on this date" button in forms.
 */
export async function fetchHistoricalRate(currency, date) {
  if (currency === 'CZK') return 1;
  const j = await getJSON(`https://api.frankfurter.dev/v1/${date}?base=${currency}&symbols=CZK`);
  const r = Number(j.rates?.CZK);
  if (!plausible(r)) throw new Error('No rate for that date');
  return round4(r);
}

const round4 = (x) => Math.round(x * 10000) / 10000;

/** Whether the cached rate is old enough to refresh automatically on startup. */
export function isStale(exchange, maxAgeHours = 6) {
  if (!exchange?.fetchedAt) return true;
  return Date.now() - new Date(exchange.fetchedAt).getTime() > maxAgeHours * 3600 * 1000;
}
