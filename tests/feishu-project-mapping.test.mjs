import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/content/fill.js', import.meta.url), 'utf8');
const start = source.indexOf('  const FEISHU_COLLECTION_SPECS =');
const end = source.indexOf('  const FEISHU_BASIC_MAP =', start);
const specs = vm.runInNewContext(`${source.slice(start, end)};FEISHU_COLLECTION_SPECS`, {
  FEISHU_SECTION_PATTERNS: {}, FEISHU_CAREER_MAPPING: []
});

test('Feishu project months use separate halves like education, not dropdown candidates', () => {
  const dates = specs.projects.mapping.filter(item => item.label === '起止时间');
  assert.deepEqual(JSON.parse(JSON.stringify(dates)), [
    { label: '起止时间', value: 'start', periodIndex: 0 },
    { label: '起止时间', value: 'end', periodIndex: 1 }
  ]);
  assert.equal(specs.projects.mapping.filter(item => item.value === 'name').length, 1);
  assert.equal(specs.projects.mapping.filter(item => item.value === 'description').length, 1);
});
