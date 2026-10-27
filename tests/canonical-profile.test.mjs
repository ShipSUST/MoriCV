import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { DEFAULT_PROFILE } from "../src/data/default-profile.js";
import { buildProfileLibraryEntries, libraryEntryWasFilled, categorySequence } from "../src/shared/profile-view.js";
import { siteProfile } from "../src/shared/schema.js";
import { readCanonicalProfileSnapshot, resolveCanonicalEntry, verificationProfileFromExpectations } from "../src/shared/canonical-profile.js";

const panelSource = (await readFile(new URL("../src/sidepanel.js", import.meta.url), "utf8"))
  .replace(/^import[\s\S]*?;\r?\n/gm, "");
const panelWithoutInit = panelSource.slice(0, panelSource.lastIndexOf("init().catch("));

function anonymousProfile(value = "匿名甲") {
  const profile = structuredClone(DEFAULT_PROFILE);
  profile.entries = [{ id: "basic.name", category: "基本信息", label: "姓名", value, aliases: [] }];
  profile.records.educations = [{ id: "anonymous.education", school: "虚构大学", educationLevel: "本科", start: "2020-09-01", end: "2024-06-01" }];
  return profile;
}

// A virtual file handle supplies text, permission and missing-file behavior.
function virtualFile(profile = anonymousProfile()) {
  const state = { text: JSON.stringify(profile), permission: "granted", linked: true, missing: false, reads: 0, cached: [] };
  const handle = {
    name: "anonymous.json",
    queryPermission: async () => state.permission,
    getFile: async () => {
      if (state.missing) throw new Error("文件已移走");
      return { text: async () => state.text };
    }
  };
  const readLinked = async () => {
    state.reads++;
    if (!state.linked) return { linked: false };
    if (await handle.queryPermission({ mode: "read" }) !== "granted") return { linked: true, readable: false, name: handle.name, reason: "读取授权失效" };
    try {
      return { linked: true, readable: true, name: handle.name, text: await (await handle.getFile()).text(), revision: String(state.reads) };
    } catch (error) {
      return { linked: true, readable: false, name: handle.name, reason: error.message };
    }
  };
  const load = () => readCanonicalProfileSnapshot({ readLinked, cache: async (data) => state.cached.push(structuredClone(data)) });
  return { state, handle, load };
}

function node(tag = "div") {
  return {
    tagName: tag.toUpperCase(), dataset: {}, value: "", textContent: "", hidden: false, disabled: false,
    children: [], listeners: {}, classList: { toggle() {}, add() {}, remove() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(event, callback) { this.listeners[event] = callback; },
    setAttribute() {}, remove() {},
    querySelector() { return this.children.at(-1) || node("span"); },
    get childElementCount() { return this.children.length; }
  };
}

function harness() {
  const file = virtualFile();
  const elements = new Map();
  const created = [];
  const calls = [];
  const copied = [];
  const callbacks = {};
  const stored = { resumeHelperProfileV1: anonymousProfile("缓存旧值") };
  let snapshot = { documentToken: "original", expectations: [{ entryId: "basic.name", label: "姓名", field: "姓名", expectedValue: "历史填写值", locator: "#name", kind: "field" }] };
  let onCommand = () => {};
  const document = {
    querySelector(selector) { if (!elements.has(selector)) elements.set(selector, node()); return elements.get(selector); },
    querySelectorAll() { return created.filter((item) => item.dataset.profileAction === "true"); },
    createElement(tag) { const element = node(tag); created.push(element); return element; },
    createTextNode(text) { return { textContent: text }; }
  };
  const chrome = {
    runtime: {
      sendMessage: async (message) => {
        if (message.type === "GET_ACTIVE_TAB_ACCESS") return { ok: true, defaultAccess: true, label: "匿名测试" };
        calls.push(message);
        const extra = await onCommand(message) || {};
        const base = { filled: [], skipped: [], suggestions: [], site: "generic", results: [], confirmedCount: 0, missingCount: 0, restoredCount: 0 };
        return { ok: true, tabId: 1, result: { ...base, ...(message.command === "prepareTargeting" ? { ready: false } : {}), ...extra } };
      },
      onMessage: { addListener(callback) { callbacks.message = callback; } },
      openOptionsPage() {}
    },
    tabs: { query: async () => [{ id: 1 }], onActivated: { addListener(callback) { callbacks.activated = callback; } } },
    storage: { local: { get: async () => stored }, onChanged: { addListener(callback) { callbacks.storage = callback; } } }
  };
  const context = {
    document, chrome, DEFAULT_PROFILE, buildProfileLibraryEntries, libraryEntryWasFilled, siteProfile, categorySequence,
    readCanonicalProfileSnapshot: () => file.load(), resolveCanonicalEntry, verificationProfileFromExpectations,
    getSettings: async () => ({ overwriteExisting: false, rejectedMatches: [], confidenceThreshold: 78 }),
    saveSettings: async (settings) => settings,
    getSnapshot: async () => snapshot,
    saveSnapshot: async (_tabId, value) => { snapshot = value; },
    navigator: { clipboard: { writeText: async (text) => copied.push(text) } },
    structuredClone, confirm: () => true, setTimeout: () => 1, clearTimeout() {}
  };
  const api = vm.runInNewContext(`${panelWithoutInit}\n({ init, copyEntry, copyCategory, scanPage, fillEntry, fillPage, fillCollectionEntries, verifyPage, undoFill, refreshProfileFromCanonical, resultLine, renderFillResult });`, context);
  return { file, api, calls, copied, elements, callbacks, created, get snapshot() { return snapshot; }, commandHook(callback) { onCommand = callback; } };
}

test("empty JSON displays twelve categories and blank fixed structure without copy or batch values", async () => {
  const h = harness();
  h.file.state.text = JSON.stringify(DEFAULT_PROFILE);
  await h.api.init();
  const cards = h.elements.get("#profile-list").children;
  assert.equal(cards.length, 12);
  assert.deepEqual(cards.map(card => card.children[0].children[0].children[0].textContent), categorySequence());
  assert.ok(cards.every(card => card.children[0].children[1].children[0].disabled));
  assert.equal(h.elements.get("#entry-count").textContent, "44/44");
});

test("canonical reads see external edits without changing the earlier operation snapshot", async () => {
  const file = virtualFile();
  const first = await file.load();
  file.state.text = JSON.stringify(anonymousProfile("匿名乙"));
  const second = await file.load();
  assert.equal(resolveCanonicalEntry(first.profile, { id: "basic.name" }).value, "匿名甲");
  assert.equal(resolveCanonicalEntry(second.profile, { id: "basic.name" }).value, "匿名乙");
  assert.equal(file.state.cached.length, 2);
});

test("unlinked, revoked, missing and damaged files reject and never publish stale cache", async () => {
  for (const failure of [
    (state) => { state.linked = false; },
    (state) => { state.permission = "denied"; },
    (state) => { state.missing = true; },
    (state) => { state.text = "{broken"; },
    (state) => { state.text = '{"entries":[]}'; }
  ]) {
    const file = virtualFile();
    await file.load();
    failure(file.state);
    await assert.rejects(file.load);
    assert.equal(file.state.cached.length, 1);
  }
});

test("stable references resolve fresh parent and child data and reject deleted records", async () => {
  const file = virtualFile();
  const { profile } = await file.load();
  assert.equal(resolveCanonicalEntry(profile, { id: "structured.anonymous.education", sourceId: "anonymous.education", recordCollection: "educations" }).label, "虚构大学｜本科");
  assert.equal(resolveCanonicalEntry(profile, { id: "anonymous.education.start", parentSourceId: "anonymous.education" }).value, "2020-09-01");
  profile.records.educations = [];
  assert.throws(() => resolveCanonicalEntry(profile, { id: "anonymous.education.start" }), /已从 JSON 主档删除/);
});

test("copy buttons and groups use fresh JSON rather than captured values", async () => {
  const h = harness();
  await h.api.init();
  const old = { id: "basic.name", label: "姓名", value: "捕获旧值" };
  h.file.state.text = JSON.stringify(anonymousProfile("外部新值"));
  await h.api.copyEntry(old);
  await h.api.copyCategory("基本信息");
  assert.equal(h.copied[0], "外部新值");
  assert.match(h.copied[1], /外部新值/);
  assert.doesNotMatch(h.copied.join("\n"), /捕获旧值|缓存旧值/);
  assert.equal(h.file.state.reads, 3);
});

test("a new copy reads again after a background refresh captured an older file", async () => {
  const h = harness();
  await h.api.init();
  const load = h.file.load;
  let captured, release;
  const capture = new Promise(resolve => { captured = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let delayed = true;
  h.file.load = async () => {
    const snapshot = await load();
    if (delayed) { delayed = false; captured(); await gate; }
    return snapshot;
  };
  const background = h.callbacks.storage({ resumeHelperProfileV1: {} }, "local");
  await capture;
  h.file.state.text = JSON.stringify(anonymousProfile("外改后的新值"));
  const copy = h.api.copyEntry({ id: "basic.name", value: "旧按钮值" });
  release();
  await Promise.all([background, copy]);
  assert.equal(h.file.state.reads, 3);
  assert.deepEqual(h.copied, ["外改后的新值"]);
  assert.equal(h.file.state.cached.at(-1).entries[0].value, "外改后的新值");
});

test("scan, scalar, parent and collection actions each refresh their own file snapshot", async () => {
  const h = harness();
  await h.api.init();
  h.calls.length = 0;
  h.file.state.text = JSON.stringify(anonymousProfile("新来源"));
  await h.api.scanPage();
  await h.api.fillEntry({ id: "basic.name" }, node("button"));
  await h.api.fillEntry({ id: "structured.anonymous.education", sourceId: "anonymous.education", recordCollection: "educations" }, node("button"));
  await h.api.fillCollectionEntries({ recordCollection: "educations", category: "教育经历" }, node("button"));
  assert.deepEqual(h.calls.map((item) => item.command), ["scan", "fillTarget", "fillRecord", "fillRecord"]);
  assert.equal(h.calls[1].payload.entry.value, "新来源");
  assert.equal(h.calls[2].payload.profile.records.educations[0].school, "虚构大学");
  assert.equal(h.file.state.reads, 5);
});

test("every new entry point rechecks the source after a pending background read", async () => {
  const actions = [
    h => h.api.copyCategory("基本信息"),
    h => h.api.scanPage(),
    h => h.api.fillEntry({ id: "basic.name" }, node("button")),
    h => h.api.fillCollectionEntries({ recordCollection: "educations", category: "教育经历" }, node("button")),
    h => h.api.fillPage()
  ];
  for (const action of actions) {
    const h = harness();
    await h.api.init();
    const load = h.file.load;
    let captured, release;
    const capture = new Promise(resolve => { captured = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    let delayed = true;
    h.file.load = async () => {
      const snapshot = await load();
      if (delayed) { delayed = false; captured(); await gate; }
      return snapshot;
    };
    const background = h.callbacks.storage({ resumeHelperProfileV1: {} }, "local");
    await capture;
    h.calls.length = 0;
    h.file.state.permission = "denied";
    const operation = action(h);
    release();
    await Promise.all([background, operation]);
    assert.equal(h.file.state.reads, 3);
    assert.equal(h.calls.length, 0);
    assert.equal(h.copied.length, 0);
    assert.match(h.elements.get("#result").textContent, /读取授权失效/);
    h.file.state.permission = "granted";
    await h.api.copyEntry({ id: "basic.name" });
    assert.equal(h.copied.at(-1), "匿名甲");
  }
});

test("a failed pending background read does not poison the next operation", async () => {
  const h = harness();
  await h.api.init();
  const load = h.file.load;
  let captured, release;
  const capture = new Promise(resolve => { captured = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  h.file.load = async () => { captured(); await gate; throw new Error("后台读取失败"); };
  const background = h.callbacks.storage({ resumeHelperProfileV1: {} }, "local");
  await capture;
  h.file.load = load;
  h.file.state.text = JSON.stringify(anonymousProfile("重试新值"));
  const operation = h.api.copyEntry({ id: "basic.name" });
  release();
  await Promise.all([background, operation]);
  assert.deepEqual(h.copied, ["重试新值"]);
  assert.equal(h.elements.get("#profile-status").hidden, true);
});

test("deleted source buttons cannot send old values or write to the page", async () => {
  const h = harness();
  await h.api.init();
  h.calls.length = 0;
  const deleted = anonymousProfile();
  deleted.entries = deleted.entries.filter((entry) => entry.id !== "basic.name");
  h.file.state.text = JSON.stringify(deleted);
  await h.api.copyEntry({ id: "basic.name", value: "旧值" });
  await h.api.fillEntry({ id: "basic.name", value: "旧值" }, node("button"));
  assert.equal(h.copied.length, 0);
  assert.equal(h.calls.length, 0);
  assert.match(h.elements.get("#result").textContent, /没有填写内容/);
});

test("whole-page batch keeps one snapshot when its file changes between commands", async () => {
  const h = harness();
  await h.api.init();
  h.calls.length = 0;
  const beforeReads = h.file.state.reads;
  h.commandHook(async (message) => {
    if (message.command === "scan") {
      const changed = anonymousProfile("批量中改动");
      changed.records.educations.push({ id: "new.education", school: "另一虚构大学" });
      h.file.state.text = JSON.stringify(changed);
    }
  });
  await h.api.fillPage();
  assert.deepEqual(h.calls.map((item) => item.command), ["scan", "fillFlatEntries", "fillRecord"]);
  assert.equal(h.file.state.reads - beforeReads, 1);
  for (const call of h.calls) {
    assert.equal(call.payload.profile.entries.find((entry) => entry.id === "basic.name").value, "匿名甲");
    assert.equal(call.payload.profile.records.educations.length, 1);
  }
});

test("failed file source blocks every data action but preserves undo and historical verify", async () => {
  const h = harness();
  await h.api.init();
  h.calls.length = 0;
  h.file.state.permission = "denied";
  await h.api.copyEntry({ id: "basic.name" });
  await h.api.copyCategory("基本信息");
  await h.api.scanPage();
  await h.api.fillEntry({ id: "basic.name" }, node("button"));
  await h.api.fillPage();
  await h.api.fillCollectionEntries({ recordCollection: "educations", category: "教育经历" }, node("button"));
  assert.equal(h.copied.length, 0);
  assert.equal(h.calls.length, 0);
  assert.equal(h.elements.get("#fill-page").disabled, true);
  assert.equal(h.elements.get("#scan-page").disabled, true);
  assert.equal(h.elements.get("#undo-fill").disabled, false);
  const beforeReads = h.file.state.reads;
  await h.api.undoFill();
  await h.api.verifyPage();
  assert.deepEqual(h.calls.map((item) => item.command), ["undo", "verify"]);
  assert.equal(h.file.state.reads, beforeReads);
  assert.equal(h.calls[1].payload.profile.entries[0].value, "历史填写值");
  assert.equal(h.calls[1].payload.expectations[0].expectedValue, "历史填写值");
});

test("startup failure labels cached display and a retry re-enables successful JSON operations", async () => {
  const h = harness();
  h.file.state.permission = "denied";
  await h.api.init();
  assert.equal(h.elements.get("#fill-page").disabled, true);
  assert.match(h.elements.get("#profile-status").children[0].textContent, /缓存可能过期，仅供查看/);
  assert.equal(h.file.state.cached.length, 0);
  h.file.state.permission = "granted";
  const retry = h.elements.get("#profile-status").children[1];
  await retry.listeners.click();
  assert.equal(h.elements.get("#fill-page").disabled, false);
  assert.equal(h.elements.get("#profile-status").hidden, true);
  await h.api.copyEntry({ id: "basic.name" });
  assert.equal(h.copied[0], "匿名甲");
});

test("historical verification merges source vocabulary without consulting new personal data", () => {
  const profile = verificationProfileFromExpectations([
    { entryId: "record.start", field: "入学时间", label: "开始时间", expectedValue: "2020-09-01" },
    { entryId: "record.start", field: "开始日期", label: "开始时间", expectedValue: "2020-09-01" }
  ]);
  assert.equal(profile.entries.length, 1);
  assert.deepEqual(profile.entries[0].aliases, ["入学时间", "开始时间", "开始日期"]);
  assert.equal(profile.entries[0].value, "2020-09-01");
});

test("valid JSON with an unavailable Chrome cache reports the failing stage", async () => {
  const file = virtualFile();
  await assert.rejects(() => readCanonicalProfileSnapshot({
    readLinked: async () => ({ linked: true, readable: true, text: file.state.text }),
    cache: async () => { throw new Error("缓存额度不足"); }
  }), /JSON 主档已成功读取，但 Chrome 工作副本更新失败：缓存额度不足/);
});

test("a cleared child field reports missing data rather than using its old date", async () => {
  const file = virtualFile();
  const profile = (await file.load()).profile;
  profile.records.educations[0].start = "";
  assert.throws(() => resolveCanonicalEntry(profile, {
    id: "anonymous.education.start", parentSourceId: "anonymous.education", recordCollection: "educations", recordField: "start"
  }), /主档中没有填写内容/);
});

test("collection batch uses one snapshot across all record commands", async () => {
  const h = harness();
  const original = anonymousProfile();
  original.records.educations.push({ id: "anonymous.second", school: "虚构学院" });
  h.file.state.text = JSON.stringify(original);
  await h.api.init();
  h.calls.length = 0;
  const beforeReads = h.file.state.reads;
  h.commandHook(() => {
    const changed = anonymousProfile("外部批量改动");
    h.file.state.text = JSON.stringify(changed);
  });
  await h.api.fillCollectionEntries({ recordCollection: "educations", category: "教育经历" }, node("button"));
  assert.deepEqual(h.calls.map((call) => call.payload.recordId), ["anonymous.education", "anonymous.second"]);
  assert.equal(h.file.state.reads - beforeReads, 1);
  assert.equal(h.calls[1].payload.profile.records.educations[1].school, "虚构学院");
});

test("record overwrite confirmation reuses its original operation snapshot", async () => {
  const h = harness();
  await h.api.init();
  h.calls.length = 0;
  const beforeReads = h.file.state.reads;
  let first = true;
  h.commandHook((message) => {
    if (message.command === "fillRecord" && first) {
      first = false;
      h.file.state.text = JSON.stringify(anonymousProfile("确认期间外部变化"));
      return { requiresConfirmation: true, conflicts: [{ field: "学校", currentValue: "已有值", expectedValue: "虚构大学" }] };
    }
  });
  await h.api.fillEntry({ id: "structured.anonymous.education", sourceId: "anonymous.education", recordCollection: "educations" }, node("button"));
  assert.deepEqual(h.calls.map((call) => call.command), ["fillRecord", "fillRecord"]);
  assert.equal(h.file.state.reads - beforeReads, 1);
  assert.equal(h.calls[1].payload.profile.entries.find((entry) => entry.id === "basic.name").value, "匿名甲");
  assert.equal(h.calls[1].payload.settings.recordConflictConfirmed, true);
  assert.equal(h.calls[1].payload.resetTransaction, false);
});

test("month precision notes stay visible for single-field and batch results", async () => {
  const h = harness();
  await h.api.init();
  const precisionNote = "网站仅支持年月，已填写 2020-09；资料中的日未使用";
  h.commandHook(() => ({
    success: true,
    field: "入学时间",
    expectation: { entryId: "anonymous.education.start", field: "入学时间", expectedValue: "2020-09", precisionNote, locator: "#start" }
  }));
  await h.api.fillEntry({
    id: "anonymous.education.start", parentSourceId: "anonymous.education", recordCollection: "educations", recordField: "start"
  }, node("button"));
  assert.match(h.elements.get("#result").textContent, /网站仅支持年月/);
  assert.equal(h.snapshot.expectations.find((item) => item.entryId === "anonymous.education.start").precisionNote, precisionNote);
  h.api.renderFillResult({ site: "generic", filled: [{ field: "入学时间", label: "开始时间", precisionNote }], skipped: [] }, "fill");
  assert.ok(h.created.some((element) => element.tagName === "LI" && element.textContent.includes(precisionNote)));
});
