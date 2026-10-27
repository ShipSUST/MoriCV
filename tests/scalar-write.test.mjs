import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/content/fill.js', import.meta.url), 'utf8');
const start = source.indexOf('  async function writeScalarValue(');
const end = source.indexOf('  async function writeField(', start);
function writer(sanitize = value => value) {
  const failures = new WeakMap();
  const write = vm.runInNewContext(`${source.slice(start, end)};writeScalarValue`, {
    getCurrentValue: element => element.value,
    setNativeValue: (element, value) => { element.value = value; },
    dispatchEditEvents: element => { element.value = sanitize(element.value); },
    wait: async () => {},
    normalizedValueMatches: (actual, expected) => actual === expected,
    controlFailures: failures,
    unconfirmedScalarWrites: new WeakSet()
  });
  return { write, failures };
}
const input = value => ({ value, focus() {} });

test('scalar decimal writing preserves the exact source when supported', async () => {
  const { write } = writer();
  const element = input('');
  assert.equal((await write(element, '1.25')).success, true);
  assert.equal(element.value, '1.25');
});

test('an integer-only site cannot leave a stripped decimal after failed writing', async () => {
  const { write, failures } = writer(value => value.replace('.', ''));
  for (const before of ['', '99']) {
    const element = input(before);
    const result = await write(element, '1.25');
    assert.equal(result.success, false);
    assert.equal(result.needsUndo, false);
    assert.equal(element.value, before);
    assert.match(failures.get(element), /已恢复填写前内容/);
  }
});

test('failed restoration is reported, not silently treated as restored', async () => {
  const { write } = writer(() => '125');
  const result = await write(input(''), '1.25');
  assert.equal(result.success, false);
  assert.equal(result.needsUndo, true);
  assert.match(result.reason, /原值恢复未确认/);
});
