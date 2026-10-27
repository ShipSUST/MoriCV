import { anonymousTemplateProfile } from './anonymous-profile.js';
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROFILE } from "../src/data/default-profile.js";
import { migrateProfile, validateProfile } from "../src/shared/storage.js";
import { parsePathText, formatPathText, siteProfile, recordSchema, emptyRecord } from "../src/shared/schema.js";
import { buildProfileLibraryEntries } from "../src/shared/profile-view.js";

test("v7 education migration preserves original values and candidates, is idempotent and leaves source intact", () => {
  const source = structuredClone(DEFAULT_PROFILE);
  source.schemaVersion = 7;
  source.records.educations = [
    { id: "anon.one", school: "示例学校甲", degree: "硕士研究生", fieldOptions: { degree: ["研究生", "硕士"] }, fieldAliases: { degree: ["学历", "教育程度"] } },
    { id: "anon.two", school: "示例学校乙", degree: "本科", fieldOptions: { degree: ["大学本科"] }, fieldAliases: { degree: ["学历层次", "学历"] } }
  ];
  const before = structuredClone(source);
  const migrated = migrateProfile(source);
  assert.equal(validateProfile(migrated), true);
  assert.deepEqual(source, before);
  assert.deepEqual(migrated.records.educations.map((row) => [row.educationLevel, row.academicDegree]), [["硕士研究生", ""], ["本科", ""]]);
  assert.deepEqual(migrated.records.educations[0].fieldOptions.educationLevel, ["研究生", "硕士"]);
  assert.deepEqual(migrated.records.educations[1].fieldOptions.educationLevel, ["大学本科"]);
  assert.deepEqual(migrateProfile(migrated), migrated);
  const view = siteProfile(migrated);
  assert.deepEqual(view.records.educations[0].fieldAliases.educationLevel, view.records.educations[1].fieldAliases.educationLevel);
  assert.ok(view.records.educations[0].fieldAliases.educationLevel.includes("教育程度"));
  assert.ok(view.records.educations[0].fieldAliases.educationLevel.includes("学历层次"));
  const child = buildProfileLibraryEntries(migrated).flatMap((row) => row.children || []).find((row) => row.id === "anon.one.educationLevel");
  assert.deepEqual(child.optionValues, ["研究生", "硕士"]);
});

test("cascade text has ordered levels and independently ordered alternatives", () => {
  const path = [["虚构省", "虚构"], ["示例市", "示例"], ["测试区", "测试"]];
  assert.deepEqual(parsePathText("虚构省, 虚构\n示例市，示例\n测试区, 测试"), path);
  assert.deepEqual(parsePathText(formatPathText(path)), path);
  const source = structuredClone(DEFAULT_PROFILE);
  source.schemaVersion = 7;
  source.entries = [{ id: "location.household", category: "基本信息", label: "户口所在地", value: "虚构", aliases: [], pathValues: ["虚构", "示例"] }];
  assert.deepEqual(migrateProfile(source).entries.find(e=>e.id==='location.household').pathValues, [["虚构"], ["示例"]]);
  source.schemaVersion = 8;
  assert.throws(() => validateProfile(source), /级联路径格式/);
});

test("education has no built-in merged degree alias but preserves user aliases", () => {
  const level = recordSchema("educations").fields.find(field => field.key === "educationLevel");
  assert.equal(level.aliases.includes("学历/学位"), false);
  const source = structuredClone(DEFAULT_PROFILE);
  source.records.educations = [{ id: "anon.education", educationLevel: "本科", academicDegree: "学士" }];
  source.recordTemplates = { educations: { fieldAliases: { educationLevel: ["学历/学位"] } } };
  const migrated = migrateProfile(source);
  assert.ok(siteProfile(migrated).records.educations[0].fieldAliases.educationLevel.includes("学历/学位"));
});

test("paper venue is the seventh template field and appears in summaries and child candidates", () => {
  const schema = recordSchema("papers");
  assert.equal(schema.fields.length, 7);
  const venue = schema.fields.find(field => field.key === "venue");
  assert.equal(venue.label, "发表刊物");
  assert.ok(venue.aliases.includes("发表会议"));
  assert.equal(emptyRecord("papers", "anon.new").venue, "");
  const source = structuredClone(DEFAULT_PROFILE);
  source.records.papers = [{ id: "anon.paper", name: "示例论文", venue: "虚构刊物", fieldOptions: { venue: ["虚构刊物英文名"] } }];
  source.recordTemplates = { papers: { fieldAliases: { venue: ["出版载体"] } } };
  const migrated = migrateProfile(source);
  assert.equal(validateProfile(migrated), true);
  assert.deepEqual(migrateProfile(migrated), migrated);
  assert.equal(JSON.parse(JSON.stringify(migrated)).records.papers[0].venue, "虚构刊物");
  const entry = buildProfileLibraryEntries(migrated).find(row => row.sourceId === "anon.paper");
  assert.ok(entry.value.includes("虚构刊物"));
  const child = entry.children.find(row => row.id === "anon.paper.venue");
  assert.equal(child.label, "发表刊物");
  assert.ok(child.aliases.includes("发表会议"));
  assert.ok(child.aliases.includes("出版载体"));
  assert.deepEqual(child.optionValues, ["虚构刊物英文名"]);
});

test("old paper records do not infer a venue or modify existing values", () => {
  const source = structuredClone(DEFAULT_PROFILE);
  source.records.papers = [{ id: "anon.oldpaper", name: "旧论文", type: "会议论文", description: "原描述" }];
  const before = structuredClone(source);
  const migrated = migrateProfile(source);
  assert.deepEqual(source, before);
  assert.equal(migrated.records.papers[0].venue || "", "");
  assert.equal(migrated.records.papers[0].type, "会议论文");
  assert.equal(migrated.records.papers[0].description, "原描述");
});

test("education type merges into study type without overwriting values or mixing record candidates", () => {
  const source = structuredClone(DEFAULT_PROFILE);
  source.schemaVersion = 8;
  source.records.educations = [
    { id: 'anon.form.one', studyType: '用户主值', educationType: '旧教育类型',
      fieldOptions: { studyType: ['已设候选', '旧教育类型'], educationType: ['旧候选'] },
      fieldAliases: { educationType: ['旧记录别名'] } },
    { id: 'anon.form.two', educationType: '第二条旧主值', fieldOptions: { educationType: ['第二条候选'] } }
  ];
  source.recordTemplates = { educations: { fieldAliases: { studyType: ['现有别名'], educationType: ['旧类别别名'] } } };
  const before = structuredClone(source);
  const result = migrateProfile(source);
  assert.deepEqual(source, before);
  assert.equal(validateProfile(result), true);
  assert.deepEqual(migrateProfile(result), result);
  const [one, two] = result.records.educations;
  assert.equal(one.studyType, '用户主值');
  assert.deepEqual(one.fieldOptions.studyType, ['已设候选', '旧教育类型', '旧候选']);
  assert.equal(two.studyType, '第二条旧主值');
  assert.deepEqual(two.fieldOptions.studyType, ['第二条候选']);
  for (const row of [one, two]) {
    assert.equal(Object.hasOwn(row, 'educationType'), false);
    assert.equal(Object.hasOwn(row.fieldOptions, 'educationType'), false);
  }
  assert.deepEqual(result.recordTemplates.educations.fieldAliases.studyType, ['现有别名', '旧类别别名', '旧记录别名']);
  assert.equal(Object.hasOwn(result.recordTemplates.educations.fieldAliases, 'educationType'), false);
  const fields = recordSchema('educations').fields;
  assert.equal(fields.some(field => field.key === 'educationType'), false);
  assert.ok(fields.find(field => field.key === 'studyType').aliases.includes('教育类型'));
  const children = buildProfileLibraryEntries(result).flatMap(row => row.children || []);
  assert.equal(children.some(row => row.id.endsWith('.educationType')), false);
  const child = children.find(row => row.id === 'anon.form.one.studyType');
  assert.deepEqual(child.optionValues, ['已设候选', '旧教育类型', '旧候选']);
  assert.ok(child.aliases.includes('学历类型'));
});
