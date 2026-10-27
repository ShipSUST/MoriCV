import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/content/fill.js', import.meta.url), 'utf8');
const start = source.indexOf('  function recordValueMatches(');
const end = source.indexOf('  function bestRecordSlot(', start);
const matches = vm.runInNewContext(`${source.slice(start, end)};recordValueMatches`);

test('publication month controls compare both year and month at their supported precision', () => {
  const data = { publishedAt: '2024-09-05' };
  assert.equal(matches('2024-09', data, 'publishedAt'), true);
  assert.equal(matches('2024-08', data, 'publishedAt'), false);
  assert.equal(matches('2023-09', data, 'publishedAt'), false);
  assert.equal(matches('2024', data, 'publishedAt'), false);
});

test('publication day controls do not accept another day in the same month', () => {
  const data = { publishedAt: '2024-09-05' };
  assert.equal(matches('2024-09-05', data, 'publishedAt'), true);
  assert.equal(matches('2024-09-06', data, 'publishedAt'), false);
});
