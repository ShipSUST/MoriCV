import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/content/fill.js", import.meta.url), "utf8");
const start = source.indexOf("  const RECORD_IDENTITY_KEYS");
const end = source.indexOf("  async function fillMokaSingleRecord", start);
const normalize = (value) => String(value ?? "").toLowerCase().replace(/[\s-]/g, "");
const policy = vm.runInNewContext(`${source.slice(start, end)}; ({ bestRecordSlot, claimRecordSlot, recordConflicts, stopForRecordConflicts })`, {
  normalizedValueMatches: (a, b) => Boolean(normalize(a) && normalize(b)) && normalize(a) === normalize(b)
});
const mapping = ["school", "degree", "start"].map((value) => ({ value, label: value }));
const read = (row, item) => row[item.value];

test("record identity distinguishes different degrees at the same school", () => {
  assert.equal(policy.bestRecordSlot([{ school: "示例大学", degree: "本科" }, { school: "", degree: "", start: "" }], { school: "示例大学", degree: "硕士" }, mapping, read), 1);
  assert.equal(policy.bestRecordSlot([{ school: "示例大学", degree: "本科" }, { school: "示例大学", degree: "硕士" }], { school: "示例大学", degree: "硕士" }, mapping, read), 1);
});

test("relative relation alone is not identity", () => {
  const fields = ["relation", "name"].map((value) => ({ value }));
  assert.equal(policy.bestRecordSlot([{ relation: "父亲", name: "旧示例" }, { relation: "", name: "" }], { relation: "父亲", name: "新示例" }, fields, read), 1);
});

test("record conflicts return differences and block before confirmation even in overwrite mode", () => {
  const differences = policy.recordConflicts({ id: "anon", school: "示例大学", degree: "硕士" }, mapping, (item) => ({ school: "示例大学", degree: "本科" })[item.value]);
  assert.equal(differences.length, 1);
  assert.equal(differences[0].currentValue, "本科");
  const report = {};
  assert.equal(policy.stopForRecordConflicts(report, differences, { overwriteExisting: true }), true);
  assert.equal(report.requiresConfirmation, true);
  assert.equal(policy.stopForRecordConflicts({}, differences, { recordConflictConfirmed: true }), false);
});

test("empty or unchanged values do not require overwrite confirmation", () => {
  assert.equal(policy.recordConflicts({ id: "anon", school: "示例大学" }, mapping, () => "").length, 0);
  assert.equal(policy.recordConflicts({ id: "anon", school: "示例大学" }, mapping, (item) => item.value === "school" ? "示例大学" : "").length, 0);
});

test("different records sharing a dropdown candidate cannot reuse the same occupied group", () => {
  const rows = [{ name: "C/C++" }, { name: "" }];
  const fields = [{ value: "name" }];
  const first = { id: "first", name: "C", fieldOptions: { name: ["C/C++"] } };
  const second = { id: "second", name: "C++", fieldOptions: { name: ["C/C++"] } };
  assert.equal(policy.bestRecordSlot(rows, first, fields, read), 0);
  policy.claimRecordSlot(rows[0], first);
  assert.equal(policy.bestRecordSlot(rows, first, fields, read), 0);
  assert.equal(policy.bestRecordSlot(rows, second, fields, read), 1);
  rows[0].name = "";
  assert.equal(policy.bestRecordSlot(rows, second, fields, read), 0, "an emptied original group remains reusable");
});
