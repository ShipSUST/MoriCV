import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProfileLibraryEntries, formatProfileDate, libraryEntrySourceId,
  libraryEntryWasFilled, sortProfileEntries, unknownRecordCollections
} from "../src/shared/profile-view.js";
import { siteProfile } from '../src/shared/schema.js';

test("profile library exposes each structured award while retaining the large-text summary", () => {
  const profile = {
    entries: [{
      id: "awards.summary",
      category: "奖项荣誉",
      label: "奖项荣誉汇总（大文本框）",
      value: "汇总文本",
      aliases: []
    }],
    records: {
      projects: [],
      awards: [
        { id: "competition.one", name: "虚构竞赛甲一等奖", awardCategory: "竞赛获奖", start: "2021-04", description: "项目说明" },
        { id: "honor.one", name: "虚构校级荣誉乙", awardCategory: "荣誉称号", start: "2023-06", description: "荣誉说明" }
      ]
    }
  };

  const library = buildProfileLibraryEntries(profile);
  assert.equal(library.length, 3, 'site-only competition/honor subsets must not add duplicate library entries');
  assert.ok(library.every(entry => entry.category === '奖项荣誉'));
  const awards = library.filter((entry) => entry.category === "奖项荣誉");
  assert.equal(awards.length, 3);
  assert.equal(awards[0].id, "awards.summary");
  assert.deepEqual(awards.slice(1).map((entry) => entry.label), ["虚构竞赛甲一等奖", "虚构校级荣誉乙"]);
  assert.match(awards[1].value, /^2021年4月｜虚构竞赛甲一等奖\n项目说明$/);
  assert.ok(awards.slice(1).every((entry) => entry.structured && entry.recordType === "award"));
});

test('Award library keeps one Chinese category and canonical batch sources while site subsets still work', () => {
  const profile = { entries: [], records: { awards: Array.from({ length: 14 }, (_, i) => ({ id: `anonymous.award.${i}`, name: `匿名奖项${i}`, awardCategory: i % 2 ? '荣誉称号' : '竞赛获奖', description: '匿名说明' })) } };
  const before = structuredClone(profile), projected = siteProfile(profile);
  assert.equal(projected.records.competitions.length, 7); assert.equal(projected.records.honors.length, 7);
  assert.deepEqual(unknownRecordCollections(projected), []);
  for (const input of [profile, projected]) {
    const library = buildProfileLibraryEntries(input);
    assert.equal(library.length, 14);
    assert.ok(library.every(entry => entry.category === '奖项荣誉' && entry.recordCollection === 'awards' && entry.recordType === 'award'));
    assert.equal(new Set(library.map(entry => entry.sourceId)).size, 14);
    assert.ok(library.every(entry => entry.children.some(child => child.id === `${entry.sourceId}.description`)));
  }
  assert.deepEqual(profile, before);
});

test("profile date display keeps known day precision", () => {
  assert.equal(formatProfileDate("2021-05-19"), "2021年5月19日");
  assert.equal(formatProfileDate("2021-08"), "2021年8月");
  assert.equal(formatProfileDate("至今"), "至今");
});

test("profile library exposes the remaining structured record types", () => {
  const profile = {
    entries: [],
    records: {
      educations: [{ id: "education.one", school: "示例大学", educationLevel: "硕士", major: "计算机", start: "2024-09", end: "2027-06" }],
      internships: [{ id: "internship.one", company: "示例公司", position: "实习生", start: "2025-01", end: "2025-03", description: "示例职责" }],
      projects: [{ id: "project.one", name: "示例项目", role: "负责人", start: "2025-04", current: true, description: "示例项目描述" }],
      papers: [{ id: "paper.one", name: "示例论文", type: "会议", publishedAt: "2026-05-20", description: "示例论文描述" }],
      awards: [],
      programmingLanguages: [{ id: "language.one", name: "Python", level: "熟悉" }],
      foreignLanguages: [{ id: "foreign.one", language: "英语", proficiency: "熟练", listeningSpeaking: "日常沟通", readingWriting: "技术文档" }],
      certifications: [{ id: "cert.one", name: "CET-6", certType: "外语", score: "550" }],
      relationships: [{ id: "relative.one", relation: "母亲", name: "示例", employer: "示例单位" }]
    }
  };
  const entries = buildProfileLibraryEntries(profile);
  assert.deepEqual(entries.map((entry) => entry.recordType), ["education", "internship", "project", "paper", "skill", "foreignLanguage", "certification", "relationship"]);
  assert.match(entries.find((entry) => entry.recordType === "education").value, /2024年9月 至 2027年6月/);
  assert.equal(entries.find((entry) => entry.recordType === "skill").value, "Python｜熟悉");
  assert.equal(entries.find((entry) => entry.recordType === "foreignLanguage").value, "英语｜熟练｜听说：日常沟通｜读写：技术文档");
  assert.match(entries.find((entry) => entry.recordType === "certification").value, /CET-6/);
  assert.deepEqual(
    entries.find((entry) => entry.recordType === "project").children.map((entry) => entry.label),
    ["项目名称", "开始时间", "项目职责", "项目描述及成果"]
  );
});

test("profile library keeps blank settings entries visible and maps structured fill sources", () => {
  const profile = {
    entries: [
      { id: "basic.name", category: "基本信息", label: "姓名", value: "", aliases: [] },
      { id: "project.manual_note", category: "项目经历", label: "项目补充", value: "", aliases: [] }
    ],
    records: {
      educations: [], internships: [], papers: [], awards: [],
      programmingLanguages: [], foreignLanguages: [],
      projects: [{ id: "project.one", name: "示例项目", role: "负责人", description: "描述" }]
    }
  };
  const entries = buildProfileLibraryEntries(profile);
  assert.deepEqual(entries.slice(0, 2).map((entry) => entry.id), ["basic.name", "project.manual_note"]);
  const structured = entries.find((entry) => entry.id === "structured.project.one");
  assert.equal(libraryEntrySourceId(structured), "project.one");
  assert.equal(libraryEntryWasFilled(structured, new Set(["project.one"])), true);
  assert.equal(libraryEntryWasFilled(structured, new Set(["project.one.description"])), true);
  assert.equal(libraryEntryWasFilled(profile.entries[0], new Set(["basic.name"])), true);
});

test("profile library renders one card when an entry and record share the same source id", () => {
  const profile = {
    entries: [
      { id: "project.one", category: "项目经历", label: "旧摘要", value: "重复摘要", aliases: [] },
      { id: "profile.github", category: "论文成果", label: "GitHub", value: "https://github.com/example", aliases: [] }
    ],
    records: {
      educations: [], internships: [], papers: [], awards: [],
      programmingLanguages: [], foreignLanguages: [],
      projects: [{ id: "project.one", displayName: "项目一", summary: "唯一摘要", name: "完整项目名", role: "负责人" }]
    }
  };
  const entries = buildProfileLibraryEntries(profile);
  assert.equal(entries.filter((entry) => libraryEntrySourceId(entry) === "project.one").length, 1);
  assert.equal(entries.find((entry) => libraryEntrySourceId(entry) === "project.one").value, "唯一摘要");
  assert.equal(entries.some((entry) => entry.id === "profile.github"), true);
});

test("settings and side panel category sorting share the same stable order", () => {
  const source = [
    { category: "其他", label: "O" },
    { category: "项目经历", label: "P1" },
    { category: "自定义分类", label: "C" },
    { category: "基本信息", label: "B" },
    { category: "项目经历", label: "P2" }
  ];
  assert.deepEqual(sortProfileEntries(source).map((entry) => entry.label), ["B", "P1", "P2", "C", "O"]);
});
