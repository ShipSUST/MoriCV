import '../src/shared/category-runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { DEFAULT_PROFILE } from '../src/data/default-profile.js';
import { migrateProfile, validateProfile } from '../src/shared/storage.js';
import { emptyRecord, recordSchema, siteProfile } from '../src/shared/schema.js';
import { buildProfileLibraryEntries } from '../src/shared/profile-view.js';

const removed = ['entranceExamScore', 'entranceExamRank', 'current'];
test('Education template replaces three old fields with two distinct blank fields', () => {
  const schema = recordSchema('educations');
  assert.equal(schema.fields.length, 16);
  assert.deepEqual(schema.fields.slice(-2).map(f => [f.key, f.label]), [['unifiedExamScore', '统考成绩'], ['professionalCourses', '专业课程']]);
  for (const key of removed) assert.equal(schema.fields.some(f => f.key === key), false);
  const blank = emptyRecord('educations', 'anonymous.new');
  assert.equal(blank.unifiedExamScore, ''); assert.equal(blank.professionalCourses, '');
  for (const key of removed) assert.equal(Object.hasOwn(blank, key), false);
});
test('Old education values, aliases and candidates are discarded, never migrated to new fields', () => {
  const source = structuredClone(DEFAULT_PROFILE);
  const aliases = Object.fromEntries(removed.map(key => [key, ['旧别名']]));
  const options = Object.fromEntries(removed.map(key => [key, ['旧候选']]));
  source.records.educations = [{ id: 'anonymous.old', school: '示例学校', entranceExamScore: '旧成绩', entranceExamRank: '旧排名', current: true,
    fieldAliases: { ...aliases, school: ['原学校别名'] }, fieldOptions: { ...options, school: ['原学校候选'] } }];
  source.recordTemplates = { educations: { fieldAliases: { ...aliases }, fieldOptions: { ...options } } };
  const before = structuredClone(source), result = migrateProfile(source), row = result.records.educations[0];
  assert.deepEqual(source, before); assert.equal(validateProfile(result), true);
  assert.equal(row.unifiedExamScore, ''); assert.equal(row.professionalCourses, '');
  for (const key of removed) {
    assert.equal(Object.hasOwn(row, key), false);
    assert.equal(Object.hasOwn(row.fieldOptions || {}, key), false);
    for (const bag of ['fieldAliases', 'fieldOptions']) assert.equal(Object.hasOwn(result.recordTemplates.educations[bag] || {}, key), false);
  }
  assert.deepEqual(row.fieldOptions.school, ['原学校候选']);
  assert.deepEqual(result.recordTemplates.educations.fieldAliases.school, ['原学校别名']);
  assert.deepEqual(migrateProfile(result), result);
  assert.equal(buildProfileLibraryEntries(result).flatMap(e => e.children || []).some(e => removed.some(k => e.id === `anonymous.old.${k}`)), false);
});
test('Removed legacy flat entries do not create empty education records', () => {
  const source = structuredClone(DEFAULT_PROFILE);
  source.schemaVersion = 5;
  source.entries.push(...['education.master.entrance_exam_score', 'education.master.entrance_exam_rank'].map(id => ({ id, category: '教育经历', label: '旧资料', value: '丢弃' })));
  const result = migrateProfile(source);
  assert.equal(result.records.educations.length, 0);
  assert.equal(result.entries.some(e => e.value === '丢弃'), false);
});
test('New education fields round trip values and independent candidates without inheriting deleted data', () => {
  const source = structuredClone(DEFAULT_PROFILE);
  source.records.educations = [{ id: 'anonymous.newvalues', unifiedExamScore: '用户新成绩', professionalCourses: '用户课程一\n用户课程二',
    entranceExamScore: '旧值', fieldOptions: { unifiedExamScore: ['新候选'], professionalCourses: ['课程候选'], entranceExamScore: ['旧候选'] } }];
  source.recordTemplates = { educations: { fieldAliases: { professionalCourses: ['课程明细'] } } };
  const result = migrateProfile(source), entries = buildProfileLibraryEntries(result).flatMap(e => e.children || []);
  assert.deepEqual(migrateProfile(JSON.parse(JSON.stringify(result))), result);
  assert.deepEqual(entries.find(e => e.id === 'anonymous.newvalues.unifiedExamScore').optionValues, ['新候选']);
  const courses = entries.find(e => e.id === 'anonymous.newvalues.professionalCourses');
  assert.equal(courses.value, '用户课程一\n用户课程二'); assert.ok(courses.aliases.includes('课程明细'));
  assert.equal(siteProfile(result).records.educations[0].unifiedExamScore, '用户新成绩');
});
test('Education deletion never removes current or candidates from internships and projects', () => {
  const source = structuredClone(DEFAULT_PROFILE);
  for (const collection of ['internships', 'projects']) {
    source.records[collection] = [{ id: `anonymous.${collection}`, current: true, fieldOptions: { current: ['是'] } }];
  }
  const result = migrateProfile(source);
  for (const collection of ['internships', 'projects']) assert.deepEqual(result.records[collection], source.records[collection]);
});

const code = await readFile(new URL('../src/content/fill.js', import.meta.url), 'utf8');
function constant(name, context = { ResumeHelperCategories: globalThis.ResumeHelperCategories }) {
  const start = code.indexOf(`  const ${name} =`);
  const tail = code.slice(start + 1);
  const stop = tail.search(/^  (?:(?:async )?function |const )/m);
  return vm.runInNewContext(`${code.slice(start, start + 1 + stop)};${name}`, context);
}
test('All education mappings use new field keys and no retired score/rank keys', () => {
  const mappings = [
    constant('MOKA_COLLECTION_SPECS').educations.blocks({ educations: [] })[0].mapping,
    constant('ZHIYE_COLLECTION_SPECS').educations.mapping,
    constant('FEISHU_COLLECTION_SPECS', { FEISHU_SECTION_PATTERNS: {}, FEISHU_CAREER_MAPPING: [] }).educations.mapping,
    constant('GENERIC_REPEAT_SCHEMAS')[0].fields
  ];
  for (const mapping of mappings) {
    const keys = mapping.map(f => f.value || f.key);
    assert.ok(keys.includes('unifiedExamScore')); assert.ok(keys.includes('professionalCourses'));
    assert.equal(keys.includes('entranceExamScore'), false); assert.equal(keys.includes('entranceExamRank'), false);
  }
});
