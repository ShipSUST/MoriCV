import test from "node:test";
import assert from "node:assert/strict";
import { siteProfile } from "../src/shared/schema.js";

test("language certificates match text and not array position", () => {
  const profile = { records: {
    foreignLanguages: [{ id: "en", language: "英语", proficiency: "熟练", listeningSpeaking: "良好", readingWriting: "熟练" }, { id: "jp", language: "日语" }],
    certifications: [{ name: "JLPT N2", score: "150" }, { name: "CET-6", score: "455" }, { name: "IELTS", score: "7" }],
    awards: [{ id: "contest", awardCategory: "竞赛" }, { id: "honor", awardCategory: "荣誉称号" }]
  } };
  const view = siteProfile(profile);
  assert.equal(view.records.foreignLanguages[0].certification, "CET-6");
  assert.equal(view.records.foreignLanguages[0].score, "455");
  assert.equal(view.records.foreignLanguages[0].listeningSpeaking, "良好");
  assert.equal(view.records.foreignLanguages[1].certification, "JLPT N2");
  assert.equal(view.records.competitions[0].id, "contest");
  assert.equal(view.records.honors[0].id, "honor");
  assert.equal(profile.records.foreignLanguages[0].certification, undefined);
});

test("ambiguous and unnamed language certificates are not associated", () => {
  const view = siteProfile({ records: { foreignLanguages: [{ language: "英语" }, { language: "日语" }], certifications: [{ name: "英语和日语能力证书", score: "99" }] } });
  assert.deepEqual(view.records.foreignLanguages.map((item) => item.certification), ["", ""]);
  const unnamed = siteProfile({ records: { foreignLanguages: [{ language: "英语" }], certifications: [{ certType: "外语", name: "未指明语种证书" }] } });
  assert.equal(unnamed.records.foreignLanguages[0].certification, "");
});
