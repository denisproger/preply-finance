// Optional demo dataset, only loaded via Settings → "Load demo data".
// Dates are generated relative to today so the dashboard looks alive.
import { emptyData } from './schema.js';
import { addMonths, currentMonthKey, dateInMonth, todayISO } from '../lib/dates.js';

export function buildDemoData(exchange) {
  const d = emptyData();
  d.exchange = exchange || null;
  const now = currentMonthKey();
  const today = todayISO();
  const months = [-5, -4, -3, -2, -1, 0].map((n) => addMonths(now, n));
  const ts = new Date().toISOString();
  d.students = [
    { id: 'stu_demo_anna', name: 'Anna K.', notes: 'Business English, Tue/Thu', currency: 'USD', paymentModel: 'per_lesson', pricePerLesson: 18, expectedLessons: 8, subscriptionAmount: 0, commissionPct: null, status: 'active' },
    { id: 'stu_demo_marco', name: 'Marco R.', notes: 'IELTS prep', currency: 'USD', paymentModel: 'subscription', pricePerLesson: 0, expectedLessons: 8, subscriptionAmount: 200, commissionPct: null, status: 'active' },
    { id: 'stu_demo_yuki', name: 'Yuki T.', notes: 'Conversation', currency: 'USD', paymentModel: 'per_lesson', pricePerLesson: 25, expectedLessons: 6, subscriptionAmount: 0, commissionPct: 15, status: 'active' },
    { id: 'stu_demo_oleh', name: 'Oleh S.', notes: 'Kids English, weekly', currency: 'USD', paymentModel: 'subscription', pricePerLesson: 0, expectedLessons: 4, subscriptionAmount: 96, commissionPct: null, status: 'active' },
    { id: 'stu_demo_lena', name: 'Lena P.', notes: 'On holiday', currency: 'USD', paymentModel: 'per_lesson', pricePerLesson: 12, expectedLessons: 4, subscriptionAmount: 0, commissionPct: null, status: 'paused' },
  ].map((s) => ({ ...s, createdAt: ts, updatedAt: ts }));

  let n = 0;
  const id = (p) => `${p}_demo_${++n}`;
  const add = (list, rec) => list.push({ ...rec, createdAt: ts, updatedAt: ts });
  months.forEach((m, i) => {
    const isNow = m === now;
    const day = (x) => dateInMonth(m, x);
    const past = (x) => !isNow || day(x) <= today;
    // Anna: 2 lessons per week in 4 batches
    [5, 12, 19, 26].forEach((x) => {
      if (!past(x)) return;
      add(d.preplyEntries, { id: id('ppl'), studentId: 'stu_demo_anna', date: day(x), lessons: 2, gross: 36, currency: 'USD', commissionPct: 18, status: isNow ? 'received' : 'paid_out', fxRate: null, notes: '', source: 'manual' });
    });
    // Marco: monthly subscription
    if (past(3)) add(d.preplyEntries, { id: id('ppl'), studentId: 'stu_demo_marco', date: day(3), lessons: 8, gross: 200, currency: 'USD', commissionPct: 18, status: isNow ? 'received' : 'paid_out', fxRate: null, notes: '', source: 'manual' });
    if (past(4)) add(d.preplyEntries, { id: id('ppl'), studentId: 'stu_demo_oleh', date: day(4), lessons: 4, gross: 96, currency: 'USD', commissionPct: 18, status: isNow ? 'received' : 'paid_out', fxRate: null, notes: '', source: 'manual' });
    // Yuki joined two months ago
    if (i >= 3) [9, 23, 30].forEach((x) => {
      add(d.preplyEntries, { id: id('ppl'), studentId: 'stu_demo_yuki', date: day(x), lessons: 2, gross: 50, currency: 'USD', commissionPct: 15, status: past(x) ? (isNow ? 'received' : 'paid_out') : 'expected', fxRate: null, notes: '', source: 'manual' });
    });
    // Other income
    add(d.otherIncome, { id: id('inc'), title: 'BJJ kids classes', source: 'Local BJJ academy', categoryId: 'inc_coaching', amount: 6000, currency: 'CZK', date: day(28), status: past(28) ? 'received' : 'expected', fxRate: null, notes: '' });
    if (i % 2 === 0 && past(15)) add(d.otherIncome, { id: id('inc'), title: 'Private grappling session', source: 'Private client', categoryId: 'inc_private', amount: 800, currency: 'CZK', date: day(15), status: 'received', fxRate: null, notes: 'Cash' });
    // Expenses
    const spend = [
      [1, 'cat_rent', 8500, 'Rent'], [2, 'cat_groceries', 640, 'Lidl'], [6, 'cat_groceries', 820, 'Albert'], [9, 'cat_restaurants', 210, 'Coffee'],
      [11, 'cat_transport', 550, 'Monthly tram pass'], [13, 'cat_sports', 1200, 'Gym membership'], [16, 'cat_groceries', 710, 'Kaufland'],
      [18, 'cat_parties', 650, 'Friday out'], [20, 'cat_subscriptions', 259, 'Spotify'], [22, 'cat_utilities', 950, 'Electricity'],
      [24, 'cat_alcohol', 380, 'Beers'], [25, 'cat_health', 260, 'Pharmacy'], [27, 'cat_shopping', 600 + i * 80, 'Clothes'],
    ];
    spend.forEach(([x, cat, amt, desc]) => {
      if (past(x)) add(d.expenses, { id: id('exp'), amount: amt, currency: 'CZK', categoryId: cat, date: day(x), description: desc, paymentMethod: x % 3 ? 'card' : 'cash', notes: '', fxRate: null });
    });
  });
  d.payouts = months.slice(0, -1).map((m) => ({ id: id('pay'), date: dateInMonth(addMonths(m, 1), 2), amount: 0, currency: 'USD', receivedCzk: null, notes: 'Demo payout', createdAt: ts }));
  // Payout amounts = that month's net (so the balance equals the current month's earnings).
  d.payouts.forEach((p, i) => {
    const m = months[i];
    const net = d.preplyEntries.filter((e) => e.date.startsWith(m)).reduce((a, e) => a + e.gross * (1 - e.commissionPct / 100), 0);
    p.amount = Math.round(net * 100) / 100;
  });
  d.settings.monthlyBudget = 22000;
  d.settings.categoryBudgets = { cat_groceries: 3000, cat_parties: 1500, cat_restaurants: 800 };
  return d;
}
