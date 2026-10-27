import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/content/fill.js', import.meta.url), 'utf8');
const start = source.indexOf('  function isFeishuYearControl(');
const end = source.indexOf('  async function chooseFeishuYear(', start);
let feishu = true;
const helpers = vm.runInNewContext(`${source.slice(start, end)};({isFeishuYearControl,feishuDateYear,feishuComparableValue})`, { isFeishuStructuredPage: () => feishu });
const input = (placeholder = 'YYYY', atsx = true, period = false) => ({ matches: () => true, getAttribute: () => placeholder,
  closest: selector => selector === '.atsx-date-picker' ? atsx : selector === '.atsx-date-picker-period-month' ? period : true });
test('Feishu year precision accepts supplied year, month and valid date, never infers invalid input', () => {
  for (const value of ['2021', '2021-04', '2021/04/10', '2021-04-10', '2024-02-29']) assert.equal(helpers.feishuDateYear(value), value.slice(0,4));
  for (const value of ['', '至今', '2021-13', '2021-02-29', '2021/04-10', '0000', '2021-04 extra']) assert.equal(helpers.feishuDateYear(value), '');
});
test('Year driver is gated by site, ATSX container and exact year precision', () => {
  assert.equal(helpers.isFeishuYearControl(input()), true);
  assert.equal(helpers.isFeishuYearControl(input('YYYY-MM')), false);
  assert.equal(helpers.isFeishuYearControl(input('YYYY', false)), false);
  assert.equal(helpers.isFeishuYearControl(input('YYYY', true, true)), false);
  feishu = false; assert.equal(helpers.isFeishuYearControl(input()), false); feishu = true;
});
test('Year record comparison only normalizes matching years on the matching control', () => {
  const yearField = { querySelector: () => input() };
  assert.equal(helpers.feishuComparableValue(yearField, '2021', '2021/04/10'), '2021/04/10');
  assert.equal(helpers.feishuComparableValue(yearField, '2020', '2021/04/10'), '2020');
  assert.equal(helpers.feishuComparableValue({ querySelector: () => null }, '2021', '2021/04/10'), '2021');
  assert.equal(helpers.feishuComparableValue(yearField, '', '2021/04/10'), '');
});
