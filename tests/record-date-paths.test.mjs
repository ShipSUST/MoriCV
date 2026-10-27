import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { DEFAULT_PROFILE } from "../src/data/default-profile.js";
import {
  RECORD_SCHEMAS, recordSchema, recordSchemaForCategory, extraRecordKeys,
  emptyRecord, parsePathText, formatPathText, siteProfile
} from "../src/shared/schema.js";
import {
  migrateProfile, previewProfileMigration, validateProfile, createCustomProfileEntry,
  DEFAULT_SETTINGS, CONFIDENCE_PRESETS, confidencePresetFor, normalizeConfidence
} from "../src/shared/storage.js";
import { buildProfileLibraryEntries, categorySequence, categoryRank, unknownRecordCollections } from "../src/shared/profile-view.js";
import { fixedField, toPortableProfile } from '../src/shared/ordinary-fields.js';

const optionsSource = await readFile(new URL("../src/options.js", import.meta.url), "utf8");

function sampleProfile() {
  const profile = structuredClone(DEFAULT_PROFILE);
  profile.records.educations = [
    { id: "anonymous.education.a", school: "匿名学校甲", start: "2020-09-05", end: "2024-06-20", fieldPaths: { start: [["2020", "2020年"], ["09", "9月"], ["5", "5日"]], end: [["2024"], ["6"], ["20"]] }, customNote: { kept: ["原有内容"] } },
    { id: "anonymous.education.b", school: "匿名学校乙", start: "2024-09", end: "2027-06", fieldPaths: { start: [["2024"], ["9"]], end: [["2027"], ["6"]] } }
  ];
  profile.records.internships = [{ id: "anonymous.internship", company: "匿名公司", start: "2023-07-01", end: "2023-08-31", fieldPaths: { start: [["2023"], ["7"], ["1"]], end: [["2023"], ["8"], ["31"]] } }];
  return profile;
}

class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.dataset = {};
    this.value = ""; this.className = ""; this.textContent = "";
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  setAttribute(key, value) { this[key] = value; }
  querySelector(selector) {
    for (const child of this.children) {
      if (selector === "textarea" && child.tagName === "TEXTAREA") return child;
      if (selector.startsWith(".") && child.className?.split(" ").includes(selector.slice(1))) return child;
      const nested = child.querySelector?.(selector);
      if (nested) return nested;
    }
    return null;
  }
  async trigger(type) { for (const listener of this.listeners[type] || []) await listener({ target: this }); }
}

function optionsHarness(overrides = {}) {
  const all = [], nodes = new Map(), calls = [];
  const document = {
    querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, new Element("div")); return nodes.get(selector); },
    querySelectorAll() { return all.filter(element => element.dataset.templateCollection); },
    createElement(tag) { const element = new Element(tag); all.push(element); return element; },
    createTextNode(text) { return { textContent: text }; },
    createDocumentFragment() { return new Element("fragment"); }
  };
  const canonical = { profile: sampleProfile(), name: "anonymous.json", revision: "revision.a" };
  const context = vm.createContext({
    structuredClone, DEFAULT_PROFILE, DEFAULT_SETTINGS, RECORD_SCHEMAS, recordSchema, recordSchemaForCategory, extraRecordKeys,
    emptyRecord, parsePathText, formatPathText, migrateProfile, previewProfileMigration, validateProfile, createCustomProfileEntry, fixedField, toPortableProfile,
    CONFIDENCE_PRESETS, confidencePresetFor, normalizeConfidence, orderCategories: categorySequence, categoryRank, unknownRecordCollections,
    document, setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: callback => callback(), CSS: { escape: String },
    confirm: () => true, alert: message => calls.push(["alert", message]),
    getSettings: async () => ({ ...DEFAULT_SETTINGS }),
    saveProfile: async profile => calls.push(["cache", structuredClone(profile)]),
    saveSettings: async settings => calls.push(["settings", settings]),
    readCanonicalProfileSnapshot: async options => { calls.push(["read", options]); return structuredClone(canonical); },
    linkedProfileName: async () => "anonymous.json",
    saveToLinkedProfile: async profile => { calls.push(["file", structuredClone(profile)]); return { synced: true, name: "anonymous.json", revision: "revision.b" }; },
    chooseProfileToSave: async () => ({ synced: true, name: "new-anonymous.json", revision: "revision.new" }),
    chooseProfileToOpen: async () => null,
    getProfileHandle: async () => null,
    rememberProfileHandle: async handle => calls.push(["remember", handle]),
    forgetProfileHandle: async () => calls.push(["forget"]),
    ...overrides
  });
  const code = optionsSource.replace(/^import[\s\S]*?;\s*/gm, "").replace(/init\(\)\.catch\([\s\S]*$/, "");
  vm.runInContext(`${code}
    renderEditor = () => {};
    downloadProfile = async () => {};
    globalThis.api = { subfieldRow, saveAll, exportProfile, importProfile, loadCanonicalProfile, init,
      setProfile(value, revision = "revision.a") { profile = value; linkedRevision = revision; settings = { ...DEFAULT_SETTINGS }; },
      state() { return { profile, linkedRevision, draft }; }
    };`, context);
  return { api: context.api, nodes, calls };
}

test("only four education and internship dates expose independent path configuration", () => {
  const fields = RECORD_SCHEMAS.flatMap(schema => schema.fields.filter(field => field.pathConfig).map(field => `${schema.key}.${field.key}`));
  assert.deepEqual(fields, ["educations.start", "educations.end", "internships.start", "internships.end"]);
});

test("record paths survive migration and JSON round trip without changing source or unrelated data", () => {
  const source = sampleProfile(), before = structuredClone(source);
  const migrated = migrateProfile(source);
  assert.equal(validateProfile(migrated), true);
  assert.deepEqual(source, before);
  assert.deepEqual(migrateProfile(migrated), migrated);
  assert.deepEqual(JSON.parse(JSON.stringify(migrated)).records, migrated.records);
  assert.deepEqual(migrated.records.educations[0].customNote, before.records.educations[0].customNote);
  for (const collection of ["educations", "internships"]) {
    assert.deepEqual(migrated.records[collection].map(record => [record.start, record.end, record.fieldPaths]),
      before.records[collection].map(record => [record.start, record.end, record.fieldPaths]));
  }
});

test("optional record path validation rejects malformed paths without coercing user values", () => {
  for (const fieldPaths of [null, [], "2020", { start: ["2020"] }, { start: [[2020]] }, { start: [[]] }, { start: [[" "]] }]) {
    const source = sampleProfile(); source.records.educations[0].fieldPaths = fieldPaths;
    const before = structuredClone(source);
    assert.throws(() => validateProfile(source), /fieldPaths|级联路径/);
    assert.deepEqual(source, before);
  }
  const source = sampleProfile(); source.records.educations[0].fieldPaths = { start: [[" 2020 ", "2020", "2020年"], ["9", "09"]], end: [] };
  const migrated = migrateProfile(source);
  assert.deepEqual(migrated.records.educations[0].fieldPaths, { start: [["2020", "2020年"], ["9", "09"]] });
  assert.equal(source.records.educations[0].fieldPaths.start[0][0], " 2020 ");
});

test("legacy records receive no generated paths and empty paths do not leak as extra fields", () => {
  const source = sampleProfile();
  delete source.records.educations[0].fieldPaths;
  source.records.educations[1].fieldPaths = { start: [], end: [] };
  const migrated = migrateProfile(source);
  assert.ok(migrated.records.educations.every(record => !Object.hasOwn(record, "fieldPaths")));
  assert.deepEqual(extraRecordKeys("educations", source.records.educations[1]), []);
  assert.deepEqual(extraRecordKeys("educations", source.records.educations[0]), ["customNote"]);
});

test("site and child projections carry date semantics and deep-copy record paths", () => {
  const source = sampleProfile(), before = structuredClone(source), view = siteProfile(source);
  view.records.educations[0].fieldPaths.start[0].push("临时候选");
  assert.deepEqual(source, before);
  const children = buildProfileLibraryEntries(source).flatMap(entry => entry.children || []);
  const child = children.find(entry => entry.id === "anonymous.education.a.start");
  assert.equal(child.fieldType, "date"); assert.equal(child.recordCollection, "educations"); assert.equal(child.recordField, "start");
  assert.deepEqual(child.pathValues, before.records.educations[0].fieldPaths.start);
  child.pathValues[0].push("另一个临时候选");
  assert.deepEqual(source, before);
  assert.equal(children.some(entry => /fieldPaths/.test(entry.id)), false);
  assert.equal(new Set(children.map(entry => entry.sourceId)).size, children.length);
});

test("editing one record date path leaves other records independent while aliases remain shared", async () => {
  const harness = optionsHarness(), profile = sampleProfile(); harness.api.setProfile(profile);
  const item = recordSchema("educations").fields.find(field => field.key === "start");
  const first = harness.api.subfieldRow("educations", profile.records.educations[0], item);
  const second = harness.api.subfieldRow("educations", profile.records.educations[1], item);
  const details = row => row.children[1].children;
  const firstPath = details(first)[2].querySelector("textarea"), secondPath = details(second)[2].querySelector("textarea");
  const originalSecond = secondPath.value;
  firstPath.value = "2021，2021年\n6，06\n20"; await firstPath.trigger("input");
  assert.deepEqual(profile.records.educations[0].fieldPaths.start, [["2021", "2021年"], ["6", "06"], ["20"]]);
  assert.equal(secondPath.value, originalSecond);
  assert.deepEqual(profile.records.educations[1].fieldPaths.start, [["2024"], ["9"]]);
  const firstAlias = details(first)[0].querySelector("textarea"), secondAlias = details(second)[0].querySelector("textarea");
  firstAlias.value = "入学日期"; await firstAlias.trigger("input");
  assert.equal(secondAlias.value, "入学日期");
  firstPath.value = ""; await firstPath.trigger("input");
  assert.equal(Object.hasOwn(profile.records.educations[0].fieldPaths, "start"), false);
  const endItem = recordSchema("educations").fields.find(field => field.key === "end");
  const endPath = details(harness.api.subfieldRow("educations", profile.records.educations[0], endItem))[2].querySelector("textarea");
  endPath.value = ""; await endPath.trigger("input");
  assert.equal(Object.hasOwn(profile.records.educations[0], "fieldPaths"), false);
});

test("unlinked saves keep the editor draft and publish neither profile cache nor settings", async () => {
  const harness = optionsHarness({ linkedProfileName: async () => "" }), profile = sampleProfile(), before = structuredClone(profile);
  harness.api.setProfile(profile, "");
  await assert.rejects(harness.api.saveAll(), /未保存草稿|另存/);
  assert.deepEqual(harness.api.state().profile, before);
  assert.deepEqual(harness.calls, []);
});

test("JSON write failure and external revision conflict preserve drafts without publishing caches", async () => {
  for (const overrides of [
    { saveToLinkedProfile: async () => ({ synced: false, reason: "磁盘写入失败" }) },
    { readCanonicalProfileSnapshot: async () => ({ profile: sampleProfile(), revision: "revision.changed" }) }
  ]) {
    const harness = optionsHarness(overrides), profile = sampleProfile(), before = structuredClone(profile);
    harness.api.setProfile(profile);
    await assert.rejects(harness.api.saveAll(), /磁盘写入失败|外部发生变化/);
    assert.deepEqual(harness.api.state().profile, before);
    assert.equal(harness.calls.some(([kind]) => ["cache", "settings", "file"].includes(kind)), false);
  }
});

test("successful save publishes profile cache only after the JSON write succeeds", async () => {
  const harness = optionsHarness(), profile = sampleProfile(), before = structuredClone(profile);
  harness.api.setProfile(profile); await harness.api.saveAll();
  assert.deepEqual(harness.calls.map(([kind]) => kind), ["read", "file", "cache", "settings"]);
  assert.equal(harness.calls[0][1].cache, null);
  assert.deepEqual(harness.calls[1][1], harness.calls[2][1]);
  assert.equal(harness.api.state().linkedRevision, "revision.b");
  assert.deepEqual(profile, before);
});

test("cache failure after a successful file save reports the saved JSON and keeps its revision", async () => {
  const harness = optionsHarness({ saveProfile: async () => { throw new Error("缓存写入失败"); } });
  harness.api.setProfile(sampleProfile());
  await assert.rejects(harness.api.saveAll(), /JSON 主档已写入.*缓存/);
  assert.equal(harness.calls.filter(([kind]) => kind === "file").length, 1);
  assert.equal(harness.api.state().linkedRevision, "revision.b");
  assert.match(harness.nodes.get("#file-status").textContent, /JSON 主档已保存/);
});

test("reset clears only the editor draft until the user explicitly saves it", async () => {
  const harness = optionsHarness(); await harness.api.init();
  const beforeWrites = harness.calls.filter(([kind]) => ["cache", "file"].includes(kind)).length;
  await harness.nodes.get("#reset-profile").trigger("click");
  assert.deepEqual(harness.api.state().profile, migrateProfile(DEFAULT_PROFILE));
  assert.equal(harness.api.state().linkedRevision, "revision.a");
  assert.equal(harness.calls.filter(([kind]) => ["cache", "file"].includes(kind)).length, beforeWrites);
  await harness.api.saveAll();
  assert.ok(harness.calls.find(([kind, value]) => kind === "file" && Object.values(value.records).every(rows => rows.length === 0)));
});

test("an import without a file handle is an editable draft and never publishes profile cache", async () => {
  const harness = optionsHarness(), imported = sampleProfile();
  await harness.api.importProfile({ name: "imported-anonymous.json", text: async () => JSON.stringify(imported) });
  assert.deepEqual(harness.api.state().profile, migrateProfile(imported));
  assert.equal(harness.api.state().linkedRevision, "");
  assert.deepEqual(harness.calls.map(([kind]) => kind), ["forget"]);
  assert.match(harness.nodes.get("#file-status").textContent, /未保存草稿/);
});

test("loading an unreadable source cannot revive cached data or discard an editor draft", async () => {
  const harness = optionsHarness({ readCanonicalProfileSnapshot: async () => { throw new Error("JSON 不可读"); } });
  const profile = sampleProfile(); harness.api.setProfile(profile);
  assert.equal(await harness.api.loadCanonicalProfile(), false);
  assert.deepEqual(harness.api.state().profile, profile);
  assert.equal(harness.api.state().linkedRevision, "");
  assert.equal(harness.calls.length, 0);
  assert.match(harness.nodes.get("#file-status").textContent, /复制和填写暂停/);
});

test("save and save-as failures retain the whole draft and never publish profile cache", async () => {
  for (const [action, overrides] of [
    ["saveAll", { readCanonicalProfileSnapshot: async () => { throw new Error("JSON 读取失败"); } }],
    ["exportProfile", { chooseProfileToSave: async () => ({ synced: false, reason: "另存失败" }) }]
  ]) {
    const harness = optionsHarness(overrides), profile = sampleProfile(), before = structuredClone(profile);
    harness.api.setProfile(profile);
    await assert.rejects(harness.api[action](), /失败/);
    assert.deepEqual(harness.api.state().profile, before);
    assert.equal(harness.calls.length, 0);
  }
});

test("failed associated import restores the previous source without publishing the new draft", async () => {
  const previous = { name: "previous-anonymous.json" }, selected = { name: "selected-anonymous.json" };
  const harness = optionsHarness({ getProfileHandle: async () => previous,
    readCanonicalProfileSnapshot: async () => { throw new Error("选择的 JSON 无法读取"); } });
  const profile = sampleProfile(), before = structuredClone(profile); harness.api.setProfile(profile);
  await assert.rejects(harness.api.importProfile({ name: selected.name, text: async () => JSON.stringify(sampleProfile()) }, selected), /无法读取/);
  assert.deepEqual(harness.calls, [["remember", selected], ["remember", previous]]);
  assert.deepEqual(harness.api.state().profile, before);
  assert.equal(harness.api.state().linkedRevision, "revision.a");
});

test("settings initialization never migrates or replaces the cached personal profile", async () => {
  const storage = await readFile(new URL("../src/shared/storage.js", import.meta.url), "utf8"), writes = [];
  const cached = sampleProfile(), before = structuredClone(cached);
  const code = storage.slice(storage.indexOf("export async function getSettings()"), storage.indexOf("export async function saveSettings("))
    .replace("export async function", "async function");
  const getSettings = vm.runInNewContext(`${code}; getSettings`, { SETTINGS_KEY: "settings", DEFAULT_SETTINGS,
    normalizeConfidence, normalizeRejectedMatches: () => [],
    chrome: { storage: { local: { get: async key => key === "settings" ? {} : { profile: cached }, set: async value => writes.push(value) } } }
  });
  await getSettings();
  assert.deepEqual(cached, before);
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0]), ["settings"]);
});
