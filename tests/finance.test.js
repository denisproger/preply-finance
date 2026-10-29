// Run with: npm test   (uses Node's built-in test runner, no extra deps)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, normalizeData } from '../src/data/schema.js';
import {
  studentPlan, entryAmounts, monthSummary, savingsRate, preplyBalance, studentMonthStats,
  budgetState, percentChange, effectiveRates, incomeBySource, preplyPlanTotal,
} from '../src/lib/finance.js';
import { toBase, parseAmount, round2, formatMoney } from '../src/lib/money.js';
import { generateRecurring, dueOccurrences } from '../src/data/recurring.js';

const rates = { USD: 22, EUR: 25 };
const student = (o = {}) => ({
  id: 'stu_1', name: 'Anna', currency: 'USD', paymentModel: 'per_lesson', pricePerLesson: 15,
  expectedLessons: 8, subscriptionAmount: 0, commissionPct: null, status: 'active', ...o,
});

test('spec example: $15 × 8 lessons, 18% commission', () => {
  const p = studentPlan(student(), emptyData().settings);
  assert.equal(p.gross, 120);
  assert.equal(p.commission, 21.6);
  assert.equal(p.net, 98.4);
});

test('subscription model and per-student commission override', () => {
  const p = studentPlan(student({ paymentModel: 'subscription', subscriptionAmount: 200, commissionPct: 25 }), emptyData().settings);
  assert.deepEqual([p.gross, p.commission, p.net], [200, 50, 150]);
});

test('USD to CZK conversion: $100 at 22.00 = 2,200 CZK', () => {
  assert.equal(toBase(100, 'USD', null, rates).value, 2200);
  assert.equal(toBase(100, 'USD', null, rates).fallback, true);
  assert.equal(toBase(100, 'USD', 21.5, rates).value, 2150); // recorded historical rate wins
  assert.equal(toBase(100, 'CZK', null, rates).value, 100);
});

test('entry amounts in CZK keep net = gross − commission', () => {
  const a = entryAmounts({ gross: 120, commissionPct: 18, currency: 'USD', fxRate: null }, rates);
  assert.equal(a.grossBase, 2640);
  assert.equal(a.commissionBase, 475.2);
  assert.equal(a.netBase, 2164.8);
});

test('month summary: no double counting, payouts are not income, expected excluded', () => {
  const d = emptyData();
  d.students = [student()];
  d.preplyEntries = [
    { id: 'e1', studentId: 'stu_1', date: '2026-10-05', lessons: 4, gross: 60, currency: 'USD', commissionPct: 18, status: 'received', fxRate: null },
    { id: 'e2', studentId: 'stu_1', date: '2026-10-12', lessons: 4, gross: 60, currency: 'USD', commissionPct: 18, status: 'paid_out', fxRate: null },
    { id: 'e3', studentId: 'stu_1', date: '2026-10-20', lessons: 2, gross: 30, currency: 'USD', commissionPct: 18, status: 'expected', fxRate: null },
  ];
  d.payouts = [{ id: 'p1', date: '2026-10-15', amount: 49.2, currency: 'USD', receivedCzk: 1080 }];
  d.otherIncome = [
    { id: 'i1', date: '2026-10-10', amount: 3000, currency: 'CZK', status: 'received', fxRate: null },
    { id: 'i2', date: '2026-10-30', amount: 1500, currency: 'CZK', status: 'expected', fxRate: null },
  ];
  d.expenses = [
    { id: 'x1', date: '2026-10-02', amount: 1000, currency: 'CZK', categoryId: 'cat_groceries', fxRate: null },
    { id: 'x2', date: '2026-10-03', amount: 10, currency: 'USD', categoryId: 'cat_other', fxRate: null },
    { id: 'x3', date: '2026-09-30', amount: 999, currency: 'CZK', categoryId: 'cat_other', fxRate: null },
  ];
  const s = monthSummary(d, '2026-10', rates);
  assert.equal(s.preplyGross, 2640); // 120 USD × 22
  assert.equal(s.preplyCommission, 475.2);
  assert.equal(s.preplyNet, 2164.8);
  assert.equal(s.otherIncome, 3000);
  assert.equal(s.totalGross, 5640);
  assert.equal(s.totalNet, 5164.8);
  assert.equal(s.expenses, 1220);
  assert.equal(s.left, 3944.8);
  assert.equal(round2(s.savingsRate), round2((3944.8 / 5164.8) * 100));
  // Balance: net 98.4 earned − 49.2 paid out
  assert.equal(preplyBalance(d).USD, 49.2);
  // Student stats: 8 lessons done of 8 planned, 2 pending; forecast = max(plan 120, 120+30)
  const st = studentMonthStats(d, d.students[0], '2026-10', rates);
  assert.equal(st.lessonsDone, 8);
  assert.equal(st.lessonsRemaining, 0);
  assert.equal(st.forecastGross, 150);
  assert.equal(st.actualNet, 98.4);
});

test('savings rate handles zero and negative income', () => {
  assert.equal(savingsRate(0, 500), null);
  assert.equal(savingsRate(-100, 0), null);
  assert.equal(savingsRate(1000, 250), 75);
  assert.equal(savingsRate(1000, 1500), -50);
});

test('budget state levels', () => {
  assert.equal(budgetState(50, 100).level, 'ok');
  assert.equal(budgetState(85, 100).level, 'warn');
  assert.equal(budgetState(101, 100).level, 'over');
  assert.equal(budgetState(10, 0), null);
});

test('percent change guards zero baseline', () => {
  assert.equal(percentChange(100, 0), null);
  assert.equal(percentChange(150, 100), 50);
});

test('amount parsing accepts Czech and English formats', () => {
  assert.equal(parseAmount('12,50'), 12.5);
  assert.equal(parseAmount('1 234,50'), 1234.5);
  assert.equal(parseAmount('1,234.50'), 1234.5);
  assert.equal(parseAmount('1.234,50'), 1234.5);
  assert.ok(Number.isNaN(parseAmount('abc')));
  assert.ok(Number.isNaN(parseAmount('')));
});

test('money formatting', () => {
  assert.equal(formatMoney(1234.5, 'CZK'), '1,234.50 Kč');
  assert.equal(formatMoney(98.4, 'USD'), '$98.40');
  assert.equal(formatMoney(-5, 'USD'), '−$5.00');
});

test('effective rates: manual overrides API, default when nothing known', () => {
  const d = emptyData();
  assert.equal(effectiveRates(d).mode, 'default');
  d.exchange = { rates: { USD: 21.9, EUR: 24.6 }, date: '2026-10-28', fetchedAt: 'x', provider: 'p' };
  assert.equal(effectiveRates(d).rates.USD, 21.9);
  d.settings.rateMode = 'manual';
  d.settings.manualRates.USD = 23;
  assert.equal(effectiveRates(d).mode, 'manual');
  assert.equal(effectiveRates(d).rates.USD, 23);
});

test('recurring: no duplicates on repeated runs, deleted occurrences stay deleted', () => {
  let d = emptyData();
  d.recurring = [{
    id: 'rec_1', kind: 'expense', frequency: 'monthly', dayOfMonth: 31, startDate: '2026-08-31', endDate: null,
    template: { amount: 12000, currency: 'CZK', categoryId: 'cat_rent', description: 'Rent' }, generatedKeys: [],
  }];
  const now = new Date(2026, 9, 29); // 29 Oct 2026
  const r1 = generateRecurring(d, now);
  assert.equal(r1.created, 2); // Aug 31, Sep 30 (Oct 31 not due yet)
  assert.deepEqual(r1.data.expenses.map((e) => e.date), ['2026-08-31', '2026-09-30']);
  const r2 = generateRecurring(r1.data, now);
  assert.equal(r2.created, 0);
  const afterDelete = { ...r1.data, expenses: r1.data.expenses.slice(1) };
  assert.equal(generateRecurring(afterDelete, now).created, 0);
  const nov = generateRecurring(r1.data, new Date(2026, 10, 15));
  assert.equal(nov.created, 1); // Oct 31
});

test('recurring income is generated through end of month as expected', () => {
  const d = emptyData();
  d.recurring = [{
    id: 'rec_2', kind: 'income', frequency: 'monthly', dayOfMonth: 30, startDate: '2026-10-30', endDate: null,
    template: { amount: 4000, currency: 'CZK', categoryId: 'inc_coaching', title: 'BJJ', status: 'received' }, generatedKeys: [],
  }];
  const r = generateRecurring(d, new Date(2026, 9, 29));
  assert.equal(r.created, 1);
  assert.equal(r.data.otherIncome[0].status, 'expected');
  assert.equal(dueOccurrences({ ...d.recurring[0], frequency: 'yearly' }, '2028-12-31').length, 3);
});

test('normalizeData repairs bad input and drops invalid records', () => {
  const { data, issues } = normalizeData({
    version: 1,
    students: [{ id: 'stu_1', name: 'Ok' }, { name: '' }],
    expenses: [{ amount: 'x', date: '2026-01-01' }, { amount: 5, date: '2026-13-40' }, { amount: 5, date: '2026-01-02', categoryId: 'nope' }],
    preplyEntries: [{ studentId: 'missing', date: '2026-01-01', gross: 5 }],
  });
  assert.equal(data.students.length, 1);
  assert.equal(data.expenses.length, 1);
  assert.equal(data.expenses[0].categoryId, 'cat_other');
  assert.equal(data.preplyEntries.length, 0);
  assert.ok(issues.length >= 2);
  assert.equal(normalizeData(null).data.students.length, 0);
  assert.throws(() => normalizeData({ version: 99 }));
});

test('plan totals and income by source', () => {
  const d = emptyData();
  d.students = [student(), student({ id: 'stu_2', status: 'paused' })];
  assert.equal(preplyPlanTotal(d, rates).net, round2(98.4 * 22));
  d.otherIncome = [{ id: 'i', date: '2026-10-01', amount: 100, currency: 'CZK', status: 'received', source: 'BJJ gym', categoryId: 'inc_coaching' }];
  assert.equal(incomeBySource(d, ['2026-10'], rates)[0].name, 'BJJ gym');
});
