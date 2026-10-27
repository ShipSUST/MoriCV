import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateProfile } from '../src/shared/storage.js';

test('highest education and degree use concise labels and retain full-time aliases and personal values', () => {
  const input = { schemaVersion: 9, entries: [
    { id: 'basic.highest_education_level', value: '匿名学历', optionValues: ['匿名学历候选'] },
    { id: 'basic.highest_academic_degree', value: '匿名称谓', optionValues: ['匿名称谓候选'] }
  ], records: {} };
  const profile = migrateProfile(input);
  for (const [id, label, alias, value] of [
    ['basic.highest_education_level', '最高学历', '全日制最高学历', '匿名学历'],
    ['basic.highest_academic_degree', '最高学位', '全日制最高学位', '匿名称谓']
  ]) {
    const entry = profile.entries.find(row => row.id === id);
    assert.equal(entry.label, label);
    assert.ok(entry.aliases.includes(alias));
    assert.equal(entry.value, value);
    assert.deepEqual(entry.optionValues, input.entries.find(row => row.id === id).optionValues);
  }
});

test('fixed runtime profile restores 36 basic and 8 career fields without borrowing record values', () => {
  const source = { schemaVersion: 8, entries: [{ id: 'basic.name', label: '篡改名称', category: '求职偏好', aliases: ['篡改别名'], value: '虚构姓名', optionValues: ['不允许候选'] }], records: { educations: [{ id: 'education.public', school: '虚构学校', end: '2027-06', educationLevel: '硕士' }] } };
  const before = structuredClone(source);
  const result = migrateProfile(source);
  assert.equal(result.schemaVersion, 9);
  assert.equal(result.entries.filter(row => row.category === '基本信息').length, 36);
  assert.equal(result.entries.filter(row => row.category === '求职偏好').length, 8);
  const name = result.entries.find(row => row.id === 'basic.name');
  assert.equal(name.label, '姓名');
  assert.equal(name.category, '基本信息');
  assert.ok(!name.aliases.includes('篡改别名'));
  assert.equal(name.value, '虚构姓名');
  assert.ok(!name.optionValues?.length);
  assert.equal(result.entries.find(row => row.id === 'basic.graduation_date').value, '');
  assert.equal(result.entries.find(row => row.id === 'career.graduation_year').value, '');
  assert.deepEqual(source, before);
  assert.deepEqual(migrateProfile(result), result);
});

test('migration preview preserves conflicting salary sources but previews unretained legacy entries for deletion', async () => {
  const { previewProfileMigration } = await import('../src/shared/storage.js');
  const input = { schemaVersion: 8, entries: [
    { id: 'career.minimum_salary', category: '求职偏好', label: '最低月薪', value: '10000', aliases: [] },
    { id: 'career.salary_negotiable', category: '求职偏好', label: '期望薪资选项', value: '面议', aliases: [] },
    { id: 'profile.github', category: '基本信息', label: 'GitHub 主页', value: 'https://github.com/public-fixture', aliases: [] },
    { id: 'skills.summary', category: '求职偏好', label: '技术技能', value: '匿名技能', aliases: [] },
    { id: 'unknown.public', category: '旧分类', label: '匿名旧资料', value: '必须保留', aliases: [] }
  ], records: {} };
  const before = structuredClone(input);
  const { profile, report } = previewProfileMigration(input);
  assert.equal(profile.entries.find(row => row.id === 'career.expected_salary').value, '');
  assert.ok(profile.entries.some(row => row.category === '其他' && row.value === '10000'));
  assert.ok(profile.entries.some(row => row.category === '其他' && row.value === '面议'));
  assert.ok(!profile.entries.some(row => row.id === 'unknown.public'));
  assert.equal(profile.entries.find(row => row.id === 'skills.summary').category, '其他');
  assert.ok(!profile.entries.some(row => row.id === 'profile.github'));
  assert.equal(report.conflicts.length, 1);
  assert.equal(report.removed.length, 2);
  assert.ok(report.removed.some(row => row.sourceId === 'unknown.public' && row.reason === 'unretained-field'));
  assert.equal(report.moves.length, 1);
  assert.equal(report.quarantined.length, 2);
  assert.equal(report.fromVersion, 8);
  assert.equal(report.toVersion, 9);
  assert.equal(report.requiresReview, true);
  assert.doesNotMatch(JSON.stringify(report), /10000|必须保留|github.com/);
  assert.deepEqual(input, before);
  const again = previewProfileMigration(profile);
  assert.deepEqual(again.profile, profile);
  assert.equal(again.report.requiresReview, false);
  assert.deepEqual(again.report.moves, []);
});

test('legacy exact labels migrate but identity disagreements and competing user paths require review', async () => {
  const { previewProfileMigration } = await import('../src/shared/storage.js');
  const input = { schemaVersion: 8, entries: [
    { id: 'custom.height', category: '基本信息', label: '身高', value: '180', aliases: [] },
    { id: 'location.native_place', category: '基本信息', label: '出生地', value: '匿名地区', aliases: [], pathValues: [['匿名省']] },
    { id: 'location.current', category: '基本信息', label: '现居住城市', value: '匿名市', aliases: [], pathValues: [['省甲']] },
    { id: 'custom.current', category: '基本信息', label: '现居住城市', value: '匿名市', aliases: [], optionValues: ['城市候选乙'], pathValues: [['省乙']] },
    { id: 'basic.name', category: '基本信息', label: '姓名', value: '匿名甲', aliases: [], optionValues: ['退场候选甲'], pathValues: [['退场路径甲']] },
    { id: 'custom.name', category: '基本信息', label: '姓名', value: '匿名乙', aliases: [], optionValues: ['退场候选乙'], pathValues: [['退场路径乙']] }
  ], records: {} };
  const before = structuredClone(input);
  const { profile, report } = previewProfileMigration(input);
  assert.equal(profile.entries.find(row => row.id === 'basic.height').value, '180');
  assert.equal(profile.entries.find(row => row.id === 'location.native_place').value, '');
  assert.equal(profile.entries.find(row => row.id === 'location.birth_place').value, '');
  assert.equal(profile.entries.find(row => row.id === 'location.current').value, '');
  assert.equal(report.conflicts.length, 3);
  const otherValues = profile.entries.filter(row => row.category === '其他').map(row => row.value);
  for (const value of ['匿名地区', '匿名市', '匿名甲', '匿名乙']) assert.ok(otherValues.includes(value));
  const configurations = otherValues.filter(value => value.startsWith('{')).map(value => JSON.parse(value));
  assert.deepEqual(configurations, [
    { pathValues: [['匿名省']] },
    { pathValues: [['省甲']] },
    { optionValues: ['城市候选乙'], pathValues: [['省乙']] }
  ]);
  assert.equal(otherValues.some(value => /退场候选|退场路径/.test(value)), false);
  assert.deepEqual(report.conflicts.map(row => row.reason), ['id-label-disagreement', 'different-main-values', 'different-paths']);
  assert.deepEqual(report.conflicts[2].sources.map(row => row.sourceId), ['location.current', 'custom.current']);
  assert.deepEqual(report.removed.map(row => [row.sourceId, row.reason, row.fields]), [
    ['basic.name', 'unsupported-configuration', ['optionValues', 'pathValues']],
    ['custom.name', 'unsupported-configuration', ['optionValues', 'pathValues']]
  ]);
  assert.deepEqual(input, before);
  const reversed = previewProfileMigration({ ...input, entries: [...input.entries].reverse() });
  for (const id of ['basic.name', 'location.native_place', 'location.birth_place', 'location.current']) {
    assert.equal(profile.entries.find(row => row.id === id).value, '');
    assert.equal(reversed.profile.entries.find(row => row.id === id).value, '');
    assert.equal(profile.entries.find(row => row.id === id).pathValues, undefined);
  }
  assert.deepEqual(migrateProfile(profile), profile);
  const { toPortableProfile } = await import('../src/shared/ordinary-fields.js');
  assert.deepEqual(migrateProfile(toPortableProfile(profile)), profile);
  const manual = migrateProfile({ schemaVersion: 9, entries: [{ id: 'other.height', category: '其他', label: '身高', value: '不能自动归位' }], records: {} });
  assert.equal(manual.entries.find(row => row.id === 'basic.height').value, '');
  assert.equal(manual.entries.find(row => row.id === 'other.height').category, '其他');
});

test('only schema9 Other rows bypass the legacy retention list, including reused retired ids', async () => {
  const { previewProfileMigration } = await import('../src/shared/storage.js');
  const entries = [
    { id: 'other.old', category: '其他', label: '旧备注', value: '旧自由字段' },
    { id: 'other.empty', category: '其他', label: '旧空备注', value: '' },
    { id: 'profile.github', category: '其他', label: '手动主页', value: 'https://example.invalid' },
    { id: 'skills.summary', category: '其他', label: '技能汇总', value: '匿名技能' }
  ];
  const legacy = previewProfileMigration({ schemaVersion: 8, entries, records: {} });
  assert.deepEqual(legacy.profile.entries.filter(row => row.category === '其他').map(row => row.id), ['skills.summary']);
  assert.deepEqual(legacy.report.removed.map(row => row.sourceId).sort(), ['other.empty', 'other.old', 'profile.github']);
  const current = previewProfileMigration({ schemaVersion: 9, entries, records: {} });
  assert.deepEqual(current.profile.entries.filter(row => row.category === '其他').map(row => row.id), entries.map(row => row.id));
  assert.equal(current.report.requiresReview, false);
  const { toPortableProfile } = await import('../src/shared/ordinary-fields.js');
  assert.deepEqual(migrateProfile(toPortableProfile(current.profile)), current.profile);
});

test('canceled fixed configuration is previewed for deletion while allowed candidates and region paths survive', async () => {
  const { previewProfileMigration } = await import('../src/shared/storage.js');
  const { toPortableProfile } = await import('../src/shared/ordinary-fields.js');
  const source = { schemaVersion: 8, entries: [
    { id: 'basic.name', category: '基本信息', label: '姓名', value: '匿名姓名', optionValues: ['旧姓名候选'], pathValues: [['旧姓名路径']] },
    { id: 'basic.gender', category: '基本信息', label: '性别', value: '匿名性别', optionValues: ['匿名选项'], pathValues: [['旧性别路径']] },
    { id: 'location.current', category: '基本信息', label: '现居住城市', value: '匿名市', optionValues: ['匿名城市候选'], pathValues: [['匿名省'], ['匿名市']] }
  ], records: {} };
  const before = structuredClone(source);
  const { profile, report } = previewProfileMigration(source);
  assert.equal(profile.entries.filter(row => row.category === '其他').length, 0);
  assert.deepEqual(report.removed.map(row => [row.sourceId, row.reason, row.fields]), [
    ['basic.name', 'unsupported-configuration', ['optionValues', 'pathValues']],
    ['basic.gender', 'unsupported-configuration', ['pathValues']]
  ]);
  assert.equal(profile.entries.find(row => row.id === 'basic.name').value, '匿名姓名');
  assert.deepEqual(profile.entries.find(row => row.id === 'basic.gender').optionValues, ['匿名选项']);
  assert.deepEqual(profile.entries.find(row => row.id === 'location.current').pathValues, [['匿名省'], ['匿名市']]);
  assert.deepEqual(profile.entries.find(row => row.id === 'location.current').optionValues, ['匿名城市候选']);
  assert.doesNotMatch(JSON.stringify(report), /旧姓名候选|旧姓名路径|旧性别路径/);
  assert.deepEqual(source, before);
  assert.deepEqual(migrateProfile(toPortableProfile(profile)), profile);
  assert.equal(previewProfileMigration(profile).report.requiresReview, false);
});

test('different canceled paths cannot create a conflict between identical fixed main values', async () => {
  const { previewProfileMigration } = await import('../src/shared/storage.js');
  const source = { schemaVersion: 8, entries: [
    { id: 'basic.name', category: '基本信息', label: '姓名', value: '匿名姓名', aliases: [], pathValues: [['旧路径甲']] },
    { id: 'custom.name', category: '基本信息', label: '姓名', value: '匿名姓名', aliases: [], pathValues: [['旧路径乙']] }
  ], records: {} };
  const before = structuredClone(source);
  const { profile, report } = previewProfileMigration(source);
  assert.equal(profile.entries.find(row => row.id === 'basic.name').value, '匿名姓名');
  assert.equal(profile.entries.find(row => row.id === 'basic.name').pathValues, undefined);
  assert.deepEqual(profile.entries.filter(row => row.category === '其他'), []);
  assert.deepEqual(report.conflicts, []);
  assert.deepEqual(report.quarantined, []);
  assert.deepEqual(report.removed.map(row => [row.sourceId, row.reason, row.fields]), [
    ['basic.name', 'unsupported-configuration', ['pathValues']],
    ['custom.name', 'unsupported-configuration', ['pathValues']]
  ]);
  assert.deepEqual(source, before);
  assert.equal(migrateProfile({ ...source, entries: [...source.entries].reverse() }).entries.find(row => row.id === 'basic.name').value, '匿名姓名');
  assert.deepEqual(migrateProfile(profile), profile);
});

test('portable schema9 JSON validates, restores program metadata and writes only user-owned fixed configuration', async () => {
  const { toPortableProfile, fixedField } = await import('../src/shared/ordinary-fields.js');
  const { validateProfile } = await import('../src/shared/storage.js');
  const runtime = migrateProfile({ schemaVersion: 9, entries: [
    { id: 'location.birth_place', category: '基本信息', label: '出生地', value: '匿名市', aliases: ['私有别名'], optionValues: ['匿名城市'], pathValues: [['匿名省'], ['匿名市']] },
    { id: 'other.manual', category: '其他', label: '备注', value: '手动文本', aliases: ['不可匹配'] }
  ], records: { projects: [{ id: 'project.public', name: '匿名项目', fieldPaths: { start: [['2020年'], ['一月']] } }] } });
  const portable = toPortableProfile(runtime);
  const place = portable.entries.find(row => row.id === 'location.birth_place');
  assert.deepEqual(Object.keys(place).sort(), ['id','optionValues','pathValues','value']);
  assert.deepEqual(portable.entries.find(row => row.id === 'other.manual'), { id: 'other.manual', category: '其他', label: '备注', value: '手动文本' });
  assert.equal(validateProfile(portable), true);
  assert.deepEqual(migrateProfile(portable), runtime);
  assert.deepEqual(portable.records, runtime.records);
  assert.ok(!fixedField('location.native_place').aliases.includes('出生地'));
  assert.ok(!fixedField('career.graduation_date').aliases.includes('毕业时间'));
  assert.equal(fixedField('basic.birth_date').supportsPath, false);
});

test('Other migration retains only name and value and previews discarded selection configuration', async () => {
  const { previewProfileMigration } = await import('../src/shared/storage.js');
  for (const schemaVersion of [8, 9]) {
    const result = previewProfileMigration({ schemaVersion, entries: [{ id: 'skills.summary', category: schemaVersion === 8 ? '求职偏好' : '其他', label: '技能汇总', value: '匿名技能', aliases: [], optionValues: ['匿名候选'], pathValues: [['匿名层级']] }], records: {} });
    assert.equal(result.profile.entries.find(entry => entry.id === 'skills.summary').value, '匿名技能');
    assert.equal(result.profile.entries.filter(entry => entry.category === '其他').length, 1);
    assert.deepEqual(result.report.removed.map(row => [row.sourceId, row.reason, row.fields]), [['skills.summary', 'unsupported-configuration', ['optionValues', 'pathValues']]]);
    assert.equal(result.report.requiresReview, true);
    assert.deepEqual(migrateProfile(result.profile), result.profile);
  }
  const { validateProfile } = await import('../src/shared/storage.js');
  const invalid = { schemaVersion: 9, entries: [{ id: 'basic.gender', value: '虚构选项', optionValues: '不能是字符串' }], records: migrateProfile({ entries: [], records: {} }).records };
  assert.throws(() => validateProfile(invalid), /optionValues/);
});

test('the five designated legacy summary main values remain manual Other entries', () => {
  const source = { schemaVersion: 8, entries: [
    { id: 'legacy.plan', category: '求职偏好', label: '职业规划', value: '规划内容' },
    { id: 'skills.certificates_summary', category: '资格证书', label: '技能证书汇总', value: '证书内容' },
    { id: 'awards.summary', category: '奖项荣誉', label: '奖项荣誉汇总', value: '奖项内容' },
    { id: 'experience.campus_summary', category: '校园经历', label: '校园工作经历', value: '校园内容' },
    { id: 'skills.summary', category: '技术技能', label: '技能汇总', value: '技能内容' }
  ], records: {} };
  const profile = migrateProfile(source);
  assert.deepEqual(profile.entries.filter(row => row.category === '其他').map(row => [row.label, row.value]), [
    ['职业规划', '规划内容'], ['技能证书汇总', '证书内容'], ['奖项荣誉汇总', '奖项内容'], ['校园工作经历', '校园内容'], ['技能汇总', '技能内容']
  ]);
  assert.deepEqual(migrateProfile(profile), profile);
});

test('preview lists the self evaluation category move before an explicit save', async () => {
  const { previewProfileMigration } = await import('../src/shared/storage.js');
  const { profile, report } = previewProfileMigration({ schemaVersion: 8, entries: [{ id: 'profile.self_evaluation', category: '求职偏好', label: '自我评价', value: '匿名介绍', aliases: [] }], records: {} });
  assert.equal(profile.entries.find(entry => entry.id === 'profile.self_evaluation').category, '基本信息');
  assert.equal(report.moves.length, 1);
  assert.equal(report.moves[0].targetCategory, '基本信息');
});

test('fixed-entry eligibility rejects manual Other entries that reuse a reserved id', async () => {
  const { isFixedEntry } = await import('../src/shared/ordinary-fields.js');
  assert.equal(isFixedEntry({ id: 'basic.name', category: '基本信息' }), true);
  assert.equal(isFixedEntry({ id: 'basic.name', category: '其他' }), false);
  assert.equal(isFixedEntry({ id: 'basic.name' }), false);
  assert.equal(isFixedEntry(null), false);
});
