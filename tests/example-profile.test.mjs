import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateProfile } from "../src/shared/storage.js";

const exampleUrl = new URL("../src/examples/mori-cv-profile-example.json", import.meta.url);

test("shareable example profile is detailed, valid, and anonymous", async () => {
  const text = await readFile(exampleUrl, "utf8");
  const profile = JSON.parse(text);
  assert.equal(validateProfile(profile), true);
  assert.equal(profile.schemaVersion, 9);
  assert.equal(profile.entries.filter(entry=>entry.category==='其他').length,5);
  assert.ok(profile.entries.filter(entry=>entry.category!=='其他').every(entry=>!Object.hasOwn(entry,'label')&&!Object.hasOwn(entry,'aliases')));
  assert.match(profile.name, /匿名示例/);
  assert.ok(profile.entries.filter((entry) => entry.value).length >= 39);
  for (const key of ["educations", "internships", "projects", "papers", "awards", "programmingLanguages", "foreignLanguages", "certifications", "relationships"]) {
    assert.ok(profile.records[key].length > 0, `example records.${key} must not be empty`);
  }
  assert.equal(profile.records.awards.length, 3);
  assert.match(profile.source, /公开匿名示例.*均为虚构/);
  assert.equal(profile.entries.find(entry => entry.id === "basic.name")?.value, "张三");
  assert.ok(profile.records.educations.every(record => /示例/.test(record.school)));
  assert.ok(profile.records.internships.every(record => /示例/.test(record.company)));
});
