import test from "node:test";
import assert from "node:assert/strict";
import { anonymousTemplateProfile } from './anonymous-profile.js';
import { CATEGORY_ORDER } from '../src/shared/schema.js';
import { DEFAULT_PROFILE } from "../src/data/default-profile.js";
import { createCustomProfileEntry, migrateProfile, validateProfile } from "../src/shared/storage.js";

test("default profile passes schema validation", () => {
  assert.equal(validateProfile(DEFAULT_PROFILE), true);
  assert.equal(DEFAULT_PROFILE.schemaVersion, 9);
  assert.deepEqual(DEFAULT_PROFILE.entries, []);
  assert.equal(DEFAULT_PROFILE.entries.filter((entry) => entry.value).length, 0);
  assert.equal(DEFAULT_PROFILE.entries.some((entry) => entry.siteAliases), false);
  assert.equal(DEFAULT_PROFILE.entries.some((entry) => Object.hasOwn(entry, "autofill")), false);
  assert.ok(Object.values(DEFAULT_PROFILE.records).every((records) => records.length === 0));
});

test("v2 profiles migrate the legacy ZTE education type without losing records", () => {
  const legacy = anonymousTemplateProfile();
  legacy.schemaVersion = 2;
  legacy.records.educations = [
    { id: "education.one", educationType: "硕士" },
    { id: "education.two", educationType: "本科" }
  ];
  const migrated = migrateProfile(legacy);
  assert.equal(migrated.schemaVersion, 9);
  assert.deepEqual(migrated.records.educations.map((item) => item.studyType), ["普通高等教育", "普通高等教育"]);
  assert.ok(migrated.records.educations.every(item => !Object.hasOwn(item, 'educationType')));
  assert.equal(migrated.records.projects.length, 0);
});

test("v3 profiles remove obsolete company-specific ordinary fields", () => {
  const legacy = anonymousTemplateProfile();
  legacy.schemaVersion = 3;
  legacy.entries.push(
    { id: "career.expected_cities", label: "期望工作城市", value: "上海", aliases: ["期望工作城市"] },
    { id: "career.zte_role_1", label: "中兴意向岗位 1", value: "软件开发", aliases: ["意向岗位1"] },
    { id: "career.zte_city_1", label: "中兴意向工作地 1", value: "上海", aliases: ["意向工作地1"] }
  );
  legacy.entries[0].siteAliases = { mokahr: ["姓名"] };
  legacy.entries.find((entry) => entry.id === "basic.name").value = "张三";
  legacy.records.projects.push({ id: "project.keep", name: "保留项目" });
  const migrated = migrateProfile(legacy);
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(migrated.entries.some(entry => entry.id === "career.expected_cities" || entry.id.startsWith("career.zte_")), false);
  assert.equal(migrated.entries.find((entry) => entry.id === "basic.name").value, "张三");
  assert.equal(migrated.entries.some((entry) => entry.siteAliases), false);
  assert.equal(migrated.records.projects[0].name, "保留项目");
});

test("legacy autofill flags are removed because every non-empty entry participates", () => {
  const legacy = anonymousTemplateProfile();
  const entry = legacy.entries.find((item) => item.id === "basic.name");
  delete entry.autofill;
  entry.batchAutofill = false;
  const migrated = migrateProfile(legacy);
  const restored = migrated.entries.find((item) => item.id === entry.id);
  assert.equal(Object.hasOwn(restored, "autofill"), false);
  assert.equal(Object.hasOwn(restored, "batchAutofill"), false);
});

test("legacy combined master period migrates into the canonical education record", () => {
  const legacy = anonymousTemplateProfile();
  legacy.entries = legacy.entries.filter((entry) => !entry.id.endsWith(".start_date") && !entry.id.endsWith(".end_date"));
  legacy.entries.push({
    id: "education.master.period",
    category: "教育经历",
    label: "硕士学习时间",
    value: "2024-09 至 2027-06",
    aliases: ["硕士学习时间"],
    autofill: false
  });
  const migrated = migrateProfile(legacy);
  assert.equal(migrated.entries.some((entry) => entry.id === "education.master.period"), false);
  const master = migrated.records.educations.find((entry) => entry.id === "education.master");
  assert.equal(master.start, "2024-09");
  assert.equal(master.end, "2027-06");
});

test("blank template keeps scalar categories without duplicating structured experience fields", () => {
  const categories = new Set(CATEGORY_ORDER.slice(0, 2));
  for (const expected of ["基本信息", "求职偏好"]) {
    assert.ok(categories.has(expected), `missing category ${expected}`);
  }
  assert.equal(DEFAULT_PROFILE.entries.some((entry) => entry.id.startsWith("project.") || entry.id.startsWith("paper.")), false);
  assert.equal(DEFAULT_PROFILE.entries.some((entry) => /^(education\.(?:master|bachelor)\.|internship\.|language\.)/.test(entry.id)), false);
});

test("passwords and verification codes are absent", () => {
  const serialized = JSON.stringify(anonymousTemplateProfile());
  assert.doesNotMatch(serialized, /密码|验证码|password|verification code/i);
});

test("new installations contain no built-in structured personal records", () => {
  for (const records of Object.values(DEFAULT_PROFILE.records)) assert.deepEqual(records, []);
});

test("invalid imports are rejected without mutating the source", () => {
  const invalid = anonymousTemplateProfile();
  invalid.entries[1].id = invalid.entries[0].id;
  const before = structuredClone(invalid);
  assert.throws(() => validateProfile(invalid), /id 重复/);
  assert.deepEqual(invalid, before);
});

test("duplicate structured record IDs are rejected across record collections", () => {
  const invalid = anonymousTemplateProfile();
  invalid.records.projects.push({ id: "record.duplicate", name: "示例项目" });
  invalid.records.awards.push({ id: "record.duplicate", name: "示例荣誉" });
  assert.throws(() => validateProfile(invalid), /结构化经历 id 重复/);
});

test("existing locally stored values survive migration to the blank distribution template", () => {
  const existing = anonymousTemplateProfile();
  existing.name = "本机资料";
  existing.entries[0].value = "张三";
  existing.records.projects.push({ id: "project.local", name: "本机项目" });
  const migrated = migrateProfile(existing);
  assert.equal(migrated.entries[0].value, "张三");
  assert.equal(migrated.records.projects[0].name, "本机项目");
});

test("profile JSON round trip preserves entries and structured records", () => {
  const source = anonymousTemplateProfile();
  source.entries[0].value = "张三";
  source.records.projects.push({ id: "project.demo", name: "示例项目" });
  const restored = JSON.parse(JSON.stringify(source));
  assert.equal(validateProfile(restored), true);
  assert.deepEqual(restored, source);
});

test("new custom entries belong only to manual Other", () => {
  const entry = createCustomProfileEntry("custom.test");
  assert.equal(entry.id, "custom.test");
  assert.equal(entry.category, "其他");
  assert.equal(Object.hasOwn(entry, "autofill"), false);
  assert.equal(entry.value, "");
});

test("legacy Other entries are removed while blank fixed fields are supplied", () => {
  const migrated = migrateProfile({
    schemaVersion: 4,
    name: "精简资料",
    entries: [{ id: "custom.only", category: "其他", label: "唯一条目", value: "值", aliases: [] }],
    records: {}
  });
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(migrated.entries.length, 44);
  assert.equal(migrated.entries.filter(entry => entry.value).length, 0);
  assert.equal(migrated.entries.some(entry => entry.id === "custom.only"), false);
  assert.ok(Object.values(migrated.records).every(Array.isArray));
});

test("same-id flat summaries migrate into structured records without losing independent entries", () => {
  const migrated = migrateProfile({
    schemaVersion: 4,
    entries: [
      { id: "project.one", category: "项目经历", label: "短名称", value: "整段摘要", aliases: ["示例项目"], autofill: false },
      { id: "profile.github", category: "论文成果", label: "GitHub", value: "https://github.com/example", aliases: [] }
    ],
    records: {
      projects: [{ id: "project.one", name: "完整项目名称", role: "负责人", description: "描述" }]
    }
  });
  assert.equal(migrated.entries.some((entry) => entry.id === "project.one"), false);
  assert.equal(migrated.entries.some((entry) => entry.id === "profile.github"), false);
  assert.deepEqual(migrated.records.projects[0], {
    id: "project.one",
    name: "完整项目名称",
    role: "负责人",
    description: "描述",
    displayName: "短名称",
    summary: "整段摘要",
    aliases: ["示例项目"]
  });
});

test("v5 profiles migrate into the strict v7 templates", () => {
  const legacy = {
    schemaVersion: 5,
    name: "迁移样例",
    entries: [
      { id: "skills.summary", category: "技能证书", label: "技能汇总", value: "Python", aliases: [], sensitive: true },
      { id: "custom.unknown", category: "自定义分类", label: "自定义", value: "保留", aliases: [] }
    ],
    records: {
      educations: [], internships: [], projects: [], papers: [], programmingLanguages: [],
      competitions: [{ id: "competition.one", name: "示例竞赛", type: "省级", result: "一等奖", start: "2021-04" }],
      honors: [{ id: "honor.one", name: "示例荣誉", start: "2022-06" }],
      foreignLanguages: [{ id: "foreign.one", language: "英语", level: "熟练", certification: "CET-6", score: "550" }],
      customCollection: [{ id: "custom.record", title: "未知大类记录" }]
    }
  };
  const migrated = migrateProfile(legacy);
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(validateProfile(migrated), true);
  assert.equal(Object.hasOwn(migrated.records, "competitions"), false);
  assert.equal(Object.hasOwn(migrated.records, "honors"), false);
  assert.deepEqual(migrated.records.awards.map((award) => [award.id, award.awardCategory, award.name]), [
    ["competition.one", "竞赛获奖", "示例竞赛"],
    ["honor.one", "荣誉称号", "示例荣誉"]
  ]);
  assert.equal(migrated.records.awards[0].result, "一等奖");
  assert.equal(migrated.records.awards[0].start, "2021-04");
  assert.deepEqual(migrated.records.foreignLanguages, [{ id: "foreign.one", language: "英语", proficiency: "熟练" }]);
  assert.equal(migrated.records.certifications.length, 1);
  assert.equal(migrated.records.certifications[0].name, "CET-6");
  assert.equal(migrated.records.certifications[0].score, "550");
  assert.deepEqual(migrated.records.relationships, []);
  assert.equal(Object.hasOwn(migrated.records, "customCollection"), false);
  const skills = migrated.entries.find((entry) => entry.id === "skills.summary");
  assert.equal(skills.category, "其他");
  assert.equal(skills.value, "Python");
  assert.equal(Object.hasOwn(skills, "sensitive"), false);
  assert.equal(migrated.entries.some(entry => entry.id === "custom.unknown"), false);
});

test("legacy unknown ordinary values are removed and allowed region paths survive", () => {
  const migrated = migrateProfile({
    schemaVersion: 6,
    entries: [
      { id: "location.current", category: "基本信息", label: "现居地", value: "上海市", aliases: [], pathValues: ["上海市"] },
      { id: "attachment.resume", category: "附件路径", label: "简历", value: "C:\\private.pdf", aliases: [] },
      { id: "other.note", category: "其他", label: "备注", value: "删除", aliases: [] }
    ],
    records: {}
  });
  assert.equal(migrated.entries.some(entry => entry.id === "attachment.resume"), false);
  assert.equal(migrated.entries.some(entry => entry.id === "other.note"), false);
  assert.deepEqual(migrated.entries.find(entry => entry.id === "location.current").pathValues, [["上海市"]]);
});

test('first runtime storage read contains blank fixed fields without personal defaults', async () => {
  const { getProfile } = await import('../src/shared/storage.js');
  const previous = globalThis.chrome;
  const stored = {};
  globalThis.chrome = { storage: { local: { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, stored[key]])), set: async value => Object.assign(stored, value) } } };
  try {
    const result = await getProfile();
    assert.equal(result.entries.length, 44);
    assert.ok(result.entries.every(entry => entry.value === ''));
    assert.ok(Object.values(result.records).every(records => records.length === 0));
  } finally { globalThis.chrome = previous; }
});
