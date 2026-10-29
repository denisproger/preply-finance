# Ledger — Preply & Personal Finance

A personal finance web app for tracking **Preply tutoring income**, **other side income** (BJJ / grappling coaching, private lessons, freelance, cash jobs), **expenses**, **budgets** and **savings** — with CZK as the main currency and automatic USD/EUR → CZK conversion.

- React 18 + Vite, plain CSS, Recharts — no backend, no account, no subscription
- Data stored in your browser (LocalStorage), with JSON backup/restore and CSV export
- Installable on iPhone as a home-screen app (PWA), works offline
- Deploys free to GitHub Pages with the included GitHub Actions workflow

> **Not connected to Preply.** All students and income figures are entered manually. The app never asks for or stores Preply credentials.

---

## 1. Run it locally

Requirements: [Node.js](https://nodejs.org) 18 or newer (20 LTS recommended).

```bash
npm install        # install dependencies (once)
npm run dev        # start the dev server → open the URL it prints (http://localhost:5173)
npm test           # run the financial-calculation tests
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

## 2. Upload the project to GitHub

1. Create a new repository on <https://github.com/new> (e.g. `ledger`). Public or private both work for Pages on most plans; public is always free.
2. In this project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/ledger.git
git push -u origin main
```

## 3. Deploy with GitHub Pages

1. On GitHub open the repository → **Settings → Pages**.
2. Under **Build and deployment → Source** choose **GitHub Actions**.
3. Push to `main` (or open **Actions → Deploy to GitHub Pages → Run workflow**).
4. After ~1 minute the app is live at `https://<your-username>.github.io/<repo-name>/`.

Every later `git push` to `main` re-runs the tests, builds and redeploys automatically.

No configuration is needed for the repository name: `vite.config.js` uses a relative `base: './'` and the app uses hash URLs (`#/expenses`), so it works under any GitHub Pages path and when opened directly.

## 4. Add it to your iPhone home screen

1. Open the GitHub Pages URL in **Safari** on the iPhone.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch “Ledger” from the home screen — it opens full-screen like an app and works offline (the exchange rate refreshes when you’re online).

## 5. Daily use

### Add your students (Preply Students → Add student)
- Enter name, currency (USD by default), payment model:
  - **Per lesson** — price per lesson × expected lessons per month
  - **Monthly subscription** — a fixed monthly amount
- Commission uses the default from Settings (18%) unless you untick “Use default” and enter a custom %.
- Expected gross, commission and net are calculated automatically (e.g. $15 × 8 = $120 gross, $21.60 commission, $98.40 net).
- Status: *Active* (counts toward expected income), *Paused*, *Archived* (kept for history).

### Record Preply income (Record lessons)
Record each real earning **once** — e.g. after lessons happen, or when a subscription is charged:
- **Expected** – planned/scheduled; not counted as earned yet
- **Received** – lesson done, money is in your Preply balance → counted as income
- **Paid out** – already withdrawn to your bank → still counted once

**Payouts** (Students → Payouts) log withdrawals from your Preply balance and the CZK that reached your bank. They are *transfers*, never added to income, so nothing is double-counted. The app shows your remaining Preply balance = net earned − payouts.

Expected vs actual: the student table shows each student’s plan (expected gross/commission/net), what was actually recorded in the selected month, lessons done/left, and the month forecast (`max(plan, recorded)` — so lessons aren’t counted twice).

### Record other income and expenses
- The **+** button (bottom-right on iPhone, sidebar on desktop) opens quick-add for an expense, income, lessons or a student.
- Expenses: type the amount (comma or dot), tap a category, save. “Save & add another” keeps the sheet open.
- Choose **Repeat → Monthly/Yearly** for rent, subscriptions or a regular coaching payment. Each period is created exactly once (tracked by a period key), so reloading the app never duplicates it, and a deleted occurrence is not re-created. Edit or stop future occurrences in the **Recurring** tab.
- Duplicate any expense/income with the copy icon.
- Budgets: Expenses → **Categories & budgets** (monthly total and per-category limits; warnings at 80% by default and when exceeded).

### Back up and restore
- **Settings → Download backup (JSON)** saves everything (students, records, categories, settings).
- **Settings → Restore from backup…** validates the file, shows what it contains, and asks for confirmation before replacing your data.
- **Export records (CSV)** (Settings or Reports) for Excel/Numbers/Google Sheets; Reports can export a single month or year.

## Important: where your data lives

Data is saved in **LocalStorage of the browser you use** — e.g. Safari on your iPhone *or* Chrome on your computer. It is **not** synced between devices and there is no cloud copy. Clearing website data or uninstalling the browser deletes it. To move data between iPhone and computer, export a JSON backup on one and restore it on the other. Back up regularly.

## Currency conversion

- CZK is the display currency; every record keeps its original amount and currency.
- Rates come from the free, key-less [Frankfurter API](https://frankfurter.dev) (European Central Bank reference rates), with [open.er-api.com](https://open.er-api.com) as a fallback. The last good rate is cached; if the API is unreachable the app keeps working with the cached rate.
- Settings shows the rate, its date and whether it is **live**, **cached**, **manual** or **default** (no rate fetched yet). You can refresh it or switch to a manual rate.
- `Amount in CZK = amount × CZK-per-unit rate` (e.g. $100 × 22.00 = 2,200 CZK).
- New foreign-currency records are pre-filled with the current rate, which is stored on the record so its historical CZK value never changes. Use **On date** to fetch the ECB rate for the transaction date. Records without a stored rate use the current rate and are marked **≈**.

## Calculations

| Figure | Formula |
| --- | --- |
| Preply net | Preply gross − Preply commission |
| Total gross income | Preply gross + other income |
| Total net income | Preply net + other income (no commission on other income) |
| Money left | Total net income − total expenses |
| Savings rate | (total net − expenses) / total net × 100 — shown as “—” when net income ≤ 0 |

Only *received/paid-out* Preply records and *received* other income count toward totals; *expected* items appear as forecasts/upcoming.

## Architecture

```
src/
  main.jsx               entry: init store, rate refresh, service worker
  App.jsx                layout (sidebar / bottom nav), routing, global forms
  data/
    schema.js            versioned data model, validation, migrations
    storage.js           LocalStorage adapter (swap for Supabase etc.)
    store.js             central store: update → save → notify
    actions.js           all mutations (students, records, recurring…)
    recurring.js         idempotent recurring-transaction generator
    demoData.js          optional demo dataset (Settings → Load demo data)
  lib/
    finance.js           all financial calculations (pure functions)
    money.js             parsing, rounding, conversion, formatting
    dates.js, csv.js, backup.js, transactions.js, hooks.js, router.js
  services/
    exchangeRate.js      rate providers (Frankfurter → open.er-api)
    rateController.js    refresh state (loading / live / error)
  components/            UI kit, charts, modal, month picker…
  forms/                 expense, income, student, Preply record, payout…
  pages/                 Dashboard, Students, OtherIncome, Expenses, Reports, Settings
  i18n/                  en.js strings + t() helper
  styles/app.css         design tokens, light/dark themes, layout
public/                  manifest, service worker, icons
tests/finance.test.js    calculation tests (node --test)
```

- **Moving to a cloud database later:** implement the `load()/save()/clear()` interface from `src/data/storage.js` (e.g. with Supabase) and pass it to `initStore()` in `main.jsx`. Pages and calculations don’t change.
- **Adding a language:** copy `src/i18n/en.js` to e.g. `uk.js`, translate, register it in `src/i18n/index.js`; it appears in Settings → Language.
- **Future Preply integration:** students carry an unused `externalRef` field and records a `source: 'manual'` field, so an official API importer could add records alongside manual ones. No scraping or unofficial integration is included.
- **Icons:** regenerate with `npm run icons` (needs Python + Pillow).
