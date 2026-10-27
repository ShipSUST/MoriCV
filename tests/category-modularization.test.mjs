import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE } from '../src/data/default-profile.js';
import { readCanonicalProfileSnapshot } from '../src/shared/canonical-profile.js';
import { buildProfileLibraryEntries } from '../src/shared/profile-view.js';
import { recordSchema, emptyRecord, CATEGORY_SCHEMA } from '../src/shared/schema.js';
import { readFile } from 'node:fs/promises';

test('canonical reading applies fixed categories and migrates legacy summaries to Other', async () => {
  const input = structuredClone(DEFAULT_PROFILE);
  input.schemaVersion = 8;
  input.entries = ['profile.self_evaluation', 'awards.summary', 'skills.summary', 'skills.certificates_summary', 'experience.campus_summary'].map(id => ({
    id, category: '基本信息', label: '用户词条', value: '匿名内容', aliases: ['用户别名'], optionValues: ['匿名候选']
  }));
  const snapshot = await readCanonicalProfileSnapshot({
    readLinked: async () => ({ linked: true, readable: true, text: JSON.stringify(input), name: 'anonymous.json' }), cache: null
  });
  const library = buildProfileLibraryEntries(snapshot.profile);
  assert.equal(library.filter(entry => entry.value).length, 5);
  assert.equal(snapshot.migrationReport.removed.length, 5);
  assert.ok(snapshot.migrationReport.removed.every(row => row.reason === 'unsupported-configuration'));
  assert.equal(library.find(entry => entry.id === 'profile.self_evaluation').category, '基本信息');
  assert.ok(library.filter(entry => entry.value && entry.id !== 'profile.self_evaluation').every(entry => entry.category === '其他'));
  assert.equal(snapshot.profile.entries.find(entry => entry.id === 'profile.self_evaluation').label, '自我评价');
});

test('all category modules preserve the established generic heading, field order and aliases', async () => {
  const { compileCategoryContract } = await import('../src/shared/categories/runtime-contract.js');
  const baseline = JSON.parse(await readFile(new URL('./fixtures/category-runtime-v1115.json', import.meta.url)));
  const current = compileCategoryContract(CATEGORY_SCHEMA);
  // This approved new field does not rewrite the historical rules snapshot.
  const relationships = current.find(schema => schema.key === 'relationships');
  relationships.fields = relationships.fields.filter(field => field.key !== 'phone');
  assert.deepEqual(current, baseline);
});

test('relative phone is a blank text field and preserves each saved JSON value through sidebar and runtime', async () => {
  const { compileCategoryContract, hydrateCategoryContract } = await import('../src/shared/categories/runtime-contract.js');
  const blank = emptyRecord('relationships', 'anonymous.relative');
  assert.equal(blank.phone, '');
  const schema = recordSchema('relationships');
  assert.equal(schema.fields.find(field => field.key === 'phone')?.label, '亲属电话');
  assert.equal(schema.fields.find(field => field.key === 'phone')?.type, 'text');
  const input = structuredClone(DEFAULT_PROFILE);
  input.records.relationships = [
    { ...blank, name: '虚构成员甲', phone: '000000' },
    { ...blank, id: 'anonymous.relative.second', name: '虚构成员乙', phone: '000001' }
  ];
  const snapshot = await readCanonicalProfileSnapshot({
    readLinked: async () => ({ linked: true, readable: true, text: JSON.stringify(input), name: 'anonymous.json' }), cache: null
  });
  const entries = buildProfileLibraryEntries(snapshot.profile).filter(entry => entry.structured);
  assert.deepEqual(entries.map(entry => entry.children.find(child => child.id.endsWith('.phone'))?.value), ['000000', '000001']);
  assert.ok(entries.every(entry => entry.value.includes(entry.children.find(child => child.id.endsWith('.phone')).value)));
  const runtime = hydrateCategoryContract(compileCategoryContract([schema]));
  assert.ok(runtime.repeatSchemas[0].fields.find(field => field.key === 'phone').aliases.includes('联系电话'));
  assert.equal(input.records.relationships[0].phone, '000000');
});

test('a relative module field reaches a blank editor record, sidebar and generic runtime', async () => {
  const { compileCategoryContract, hydrateCategoryContract } = await import('../src/shared/categories/runtime-contract.js');
  const schema = recordSchema('relationships');
  // Synthetic public extension, not a production field or personal value.
  schema.fields.push({ key: 'fixturePhone', label: '匿名联系号码', type: 'text', aliases: ['匿名电话'] });
  try {
    const record = emptyRecord('relationships', 'anonymous.relative');
    assert.equal(record.fixturePhone, '');
    record.name = '虚构成员'; record.fixturePhone = '000000';
    const profile = structuredClone(DEFAULT_PROFILE);
    profile.records.relationships = [record];
    const entry = buildProfileLibraryEntries(profile)[0];
    assert.equal(entry.children.find(child => child.label === '匿名联系号码').value, '000000');
    assert.match(entry.value, /000000/);
    const runtime = hydrateCategoryContract(compileCategoryContract([schema]));
    const field = runtime.repeatSchemas[0].fields.find(field => field.key === 'fixturePhone');
    assert.deepEqual(field.aliases, ['匿名联系号码', '匿名电话']);
  } finally { schema.fields.pop(); }
});

test('a fresh personal profile has no ordinary entries or experience records', () => {
  assert.deepEqual(DEFAULT_PROFILE.entries, []);
  assert.equal(Object.keys(DEFAULT_PROFILE.records).length, 9);
  assert.ok(Object.values(DEFAULT_PROFILE.records).every(rows => rows.length === 0));
  assert.deepEqual(buildProfileLibraryEntries(DEFAULT_PROFILE), []);
});

test('choosing a public template creates only a blank detached draft', async () => {
  const { createTemplateEntry } = await import('../src/shared/categories/templates.js');
  const draft = createTemplateEntry('profile.self_evaluation', '基本信息');
  assert.equal(draft.label, '自我评价');
  assert.equal(draft.value, '');
  assert.equal(draft.category, '基本信息');
  draft.value = '匿名草稿';
  draft.aliases.push('用户别名');
  assert.equal(createTemplateEntry('profile.self_evaluation').value, '');
  assert.ok(!createTemplateEntry('profile.self_evaluation').aliases.includes('用户别名'));
  assert.deepEqual(DEFAULT_PROFILE.entries, []);
});

test('canonical read exposes original migration preview and raw backup source without writing the linked file', async () => {
  const source = { ...structuredClone(DEFAULT_PROFILE), schemaVersion: 8, entries: [
    { id: 'profile.github', category: '基本信息', label: 'GitHub主页', value: 'https://github.com/public-fixture', aliases: [] },
    { id: 'legacy.note', category: '基本信息', label: '旧备注', value: '退场资料', aliases: [] },
    { id: 'basic.name', category: '基本信息', label: '姓名', value: '匿名姓名', aliases: [], optionValues: ['退场配置'] }
  ] };
  source.recordTemplates = {};
  for (const category of CATEGORY_SCHEMA.filter(row => row.kind === 'record')) {
    const record = emptyRecord(category.key);
    record.id = `public.${category.key}`;
    record.fieldOptions = { [category.fields[0].key]: ['匿名记录候选'] };
    record.fieldPaths = { [category.fields[0].key]: [['匿名记录路径']] };
    source.records[category.key] = [record];
    source.recordTemplates[category.key] = { fieldAliases: { [category.fields[0].key]: ['匿名记录别名'] }, fieldOptions: { [category.fields[0].key]: ['匿名模板候选'] } };
  }
  const text = JSON.stringify(source);
  let cached;
  const snapshot = await readCanonicalProfileSnapshot({ readLinked: async () => ({ linked: true, readable: true, text, revision: 'original-revision' }), cache: async profile => { cached = profile; } });
  assert.equal(snapshot.migrationReport.removed.length, 3);
  assert.equal(snapshot.migrationReport.fromVersion, 8);
  assert.equal(snapshot.sourceText, text);
  assert.equal(snapshot.revision, 'original-revision');
  assert.equal(snapshot.profile.entries.some(row => row.id === 'legacy.note'), false);
  assert.equal(snapshot.profile.entries.find(row => row.id === 'basic.name').value, '匿名姓名');
  assert.equal(Object.keys(snapshot.profile.records).length, 9);
  for (const [collection, records] of Object.entries(source.records)) {
    assert.deepEqual(snapshot.profile.records[collection][0].fieldOptions, records[0].fieldOptions);
    assert.deepEqual(snapshot.profile.records[collection][0].fieldPaths, records[0].fieldPaths);
    assert.deepEqual(snapshot.profile.recordTemplates[collection], source.recordTemplates[collection]);
  }
  assert.equal(JSON.stringify(source), text);
  assert.ok(!Object.hasOwn(cached, 'sourceText'));
  assert.ok(!Object.hasOwn(cached, 'migrationReport'));
});
