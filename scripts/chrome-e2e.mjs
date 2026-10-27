import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrateProfile } from "../src/shared/storage.js";
import { DEFAULT_PROFILE } from "../src/data/default-profile.js";
import { siteProfile } from "../src/shared/schema.js";
import { createHash } from "node:crypto";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testProfilePath = path.join(projectRoot, "src", "examples", "mori-cv-profile-example.json");
let TEST_PROFILE;
try {
  TEST_PROFILE = migrateProfile(JSON.parse(await readFile(testProfilePath, "utf8")));
} catch (error) {
  throw new Error(`E2E requires the anonymous example profile. Generate ${testProfilePath} with npm run generate:example.`, { cause: error });
}
const testSchools = ["示例大学", "示例科技大学"];
const testMajors = ["示例专业", "软件工程"];
for (const [index, education] of (TEST_PROFILE.records.educations || []).entries()) {
  education.school = testSchools[index] || `示例院校 ${index + 1}`;
  education.major = testMajors[index] || "示例专业";
}
const testEntry = (id) => TEST_PROFILE.entries.find((entry) => entry.id === id);
const testValue = (id) => testEntry(id)?.value || "";
// Candidates are user data: make the anonymous fixture profile explicit rather
// than expecting the engine to invent nationality or combine C-family records.
testEntry("basic.nationality").optionValues.push("中国大陆");
for (const skill of TEST_PROFILE.records.programmingLanguages) {
  if (["C", "C++"].includes(skill.name)) skill.fieldOptions = { name: ["C/C++"] };
}
const testAwards = TEST_PROFILE.records.awards || [];
const testCompetitions = testAwards.filter((award) => !/荣誉/.test(String(award.awardCategory || "")));
const testHonors = testAwards.filter((award) => /荣誉/.test(String(award.awardCategory || "")));
const mokaProgrammingLanguages = TEST_PROFILE.records.programmingLanguages;
const cdpBase = process.env.RESUME_HELPER_CDP || "http://127.0.0.1:9334";
const fixtureOrigin = process.env.RESUME_HELPER_FIXTURE_ORIGIN || "http://127.0.0.1:4173";
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(fixtureOrigin), "E2E is restricted to anonymous localhost fixtures");
const skipExtensionUi = process.env.RESUME_HELPER_SKIP_EXTENSION_UI === "1";
const artifactRoot = path.join(projectRoot, "test-results", "e2e");
await mkdir(artifactRoot, { recursive: true });
const ownedTargets = [];
const commandTimings = [];
const coreSource = await readFile(path.join(projectRoot, "src", "shared", "matcher-core.js"), "utf8");
const categorySource = await readFile(path.join(projectRoot, "src", "shared", "category-runtime.js"), "utf8");
const fillSource = await readFile(path.join(projectRoot, "src", "content", "fill.js"), "utf8");

class CDPClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message}: ${JSON.stringify(message.error.data || {})}`));
      else resolve(message.result);
    });
    return this;
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function targets() {
  const response = await fetch(`${cdpBase}/json/list`);
  if (!response.ok) throw new Error(`CDP target list failed: ${response.status}`);
  return response.json();
}

async function createTarget(url) {
  const response = await fetch(`${cdpBase}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`CDP target creation failed: ${response.status}`);
  const target = await response.json();
  ownedTargets.push(target.id);
  return target;
}

async function waitFor(predicate, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("Timed out waiting for browser state");
}

async function inspectExtensionPage(extensionId, pageName, selector, pageUrl = "") {
  const target = await createTarget(pageUrl || `chrome-extension://${extensionId}/${pageName}`);
  const client = await new CDPClient(target.webSocketDebuggerUrl).connect();
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: pageName.startsWith("sidepanel") ? 420 : 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  try {
    await waitFor(async () => client.evaluate(`document.readyState === "complete" && document.querySelector(${JSON.stringify(selector)}) !== null`));
  } catch (error) {
    const diagnostic = await client.evaluate(`({
      url: location.href,
      readyState: document.readyState,
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 800) || "",
      nodeCount: document.querySelectorAll(${JSON.stringify(selector)}).length
    })`);
    client.close();
    throw new Error(`${pageName} did not render ${selector}: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
  const inspection = await client.evaluate(`({ title: document.title, nodeCount: document.querySelectorAll(${JSON.stringify(selector)}).length, bodyText: document.body.innerText.slice(0, 500) })`);
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const screenshotPath = path.join(artifactRoot, `${pageName.replace(".html", "")}.png`);
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
  client.close();
  return { ...inspection, screenshotPath };
}

async function installContentHarness(client) {
  await client.evaluate(`
    (() => {
      delete globalThis.__resumeHelperContentInstalled;
      delete globalThis.ResumeHelperCore;
      globalThis.__resumeHelperListener = null;
      globalThis.chrome = { runtime: { onMessage: { addListener(fn) { globalThis.__resumeHelperListener = fn; } } } };
      (0, eval)(${JSON.stringify(coreSource)});
      (0, eval)(${JSON.stringify(categorySource)});
      (0, eval)(${JSON.stringify(fillSource)});
      return Boolean(globalThis.__resumeHelperListener && globalThis.ResumeHelperCore);
    })()
  `);
}

async function inspectOptionsModelUi() {
  const target = await createTarget(`${fixtureOrigin}/options-preview`);
  const client = await new CDPClient(target.webSocketDebuggerUrl).connect();
  try {
    await waitFor(() => client.evaluate(`document.querySelectorAll('[data-template-collection="educations"][data-template-field="educationLevel"]').length === 2`));
    return await client.evaluate(`(() => {
      const aliases = [...document.querySelectorAll('[data-template-collection="educations"][data-template-field="educationLevel"]')];
      const row = input => input.closest('.subfield-row');
      const candidate = input => row(input).querySelectorAll('.subfield-detail textarea')[1];
      const otherBefore = candidate(aliases[1]).value;
      aliases[0].value = '匿名学历别名，another education label';
      aliases[0].dispatchEvent(new Event('input', {bubbles:true}));
      const sharedAlias = aliases[1].value === aliases[0].value;
      candidate(aliases[0]).value = '匿名候选一，匿名候选二';
      candidate(aliases[0]).dispatchEvent(new Event('input', {bubbles:true}));
      const candidatesIndependent = candidate(aliases[1]).value === otherBefore;
      const degreeRows = [...document.querySelectorAll('.subfield-label')].filter(el => el.textContent === '学位');
      const separateDegree = degreeRows.length === 2 && degreeRows.every(el => el.closest('.subfield-row') !== row(aliases[0]) && el.closest('.subfield-row') !== row(aliases[1]));
      const noBuiltInMergedDegree = aliases.every(input => ![...row(input).querySelectorAll('small')].some(hint => hint.textContent.includes('学历/学位')));
      const studyAliases = [...document.querySelectorAll('[data-template-collection="educations"][data-template-field="studyType"]')];
      const mergedStudyType = studyAliases.length === 2 && !document.querySelector('[data-template-collection="educations"][data-template-field="educationType"]') && studyAliases.every(input => [...row(input).querySelectorAll('small')].some(hint => hint.textContent.includes('教育类型')));
      const venueAlias = document.querySelector('[data-template-collection="papers"][data-template-field="venue"]');
      const venueRow = venueAlias?.closest('.subfield-row');
      const paperVenue = Boolean(venueRow && venueRow.querySelector('.subfield-label')?.textContent === '发表刊物' && venueRow.querySelector('.subfield-main input')?.value === ${JSON.stringify(TEST_PROFILE.records.papers[0].venue)} && venueRow.querySelectorAll('.subfield-detail textarea').length === 2 && [...venueRow.querySelectorAll('small')].some(hint => hint.textContent.includes('发表会议')));
      const unwantedUi = /导出迁移前备份|清理 Chrome 历史备份|安全边界/.test(document.body.innerText);
      return {sharedAlias, candidatesIndependent, separateDegree, noBuiltInMergedDegree, mergedStudyType, paperVenue, unwantedUi};
    })()`);
  } finally { client.close(); }
}

async function contentCommand(client, command, payload) {
  if (payload?.profile) payload = { ...payload, profile: siteProfile(payload.profile) };
  const startedAt = Date.now();
  const result = await client.evaluate(`
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("content command timeout")), 180000);
      globalThis.__resumeHelperListener(
        ${JSON.stringify({ type: "RESUME_HELPER_COMMAND", command, payload })},
        null,
        (result) => { clearTimeout(timeout); resolve(result); }
      );
    })
  `);
  assert.ok(!result.error, result.error);
  commandTimings.push({ command, segment: payload?.segment, ms: Date.now() - startedAt });
  return result;
}

try {
const initialTargets = await targets();
let extensionId = process.env.RESUME_HELPER_EXTENSION_ID || "";
if (!extensionId) {
  const workers = initialTargets.filter((target) => target.type === "service_worker" && target.url.endsWith("/background.js"));
  for (const worker of workers) {
    const client = await new CDPClient(worker.webSocketDebuggerUrl).connect();
    await client.send("Runtime.enable");
    const manifestName = await client.evaluate(`chrome.runtime?.getManifest?.().name || ""`).catch(() => "");
    client.close();
    if (manifestName === "Mori CV · 简历助手") {
      extensionId = new URL(worker.url).hostname;
      break;
    }
  }
}
if (!skipExtensionUi) assert.ok(extensionId, "extension ID could not be discovered; set RESUME_HELPER_EXTENSION_ID for a stopped MV3 worker");

const sidepanel = skipExtensionUi
  ? await inspectExtensionPage("", "sidepanel-preview.html", ".category-card", `${fixtureOrigin}/preview`)
  : await inspectExtensionPage(extensionId, "sidepanel.html", ".category-card");
if (sidepanel) {
  assert.match(sidepanel.title, /Mori CV/);
  assert.equal(sidepanel.nodeCount, 12, "all fixed and record categories plus Other must be visible");
  assert.match(sidepanel.bodyText, /一键填写当前简历/);
  assert.match(sidepanel.bodyText, /撤销本次填写/);
  assert.match(sidepanel.bodyText, /尚未填写/);
  assert.match(sidepanel.bodyText, /已默认授权|当前页面不可访问/);
}

const filledMarkerPanel = skipExtensionUi
  ? await inspectExtensionPage("", "sidepanel-filled.html", ".filled-marker", `${fixtureOrigin}/preview-filled`)
  : null;
if (filledMarkerPanel) {
  assert.equal(filledMarkerPanel.nodeCount, 1, "a successful source expectation must mark exactly its source entry");
  assert.match(filledMarkerPanel.bodyText, /✓/);
}

const options = skipExtensionUi
  ? await inspectExtensionPage("", "options-preview.html", ".edit-card", `${fixtureOrigin}/options-preview`)
  : await inspectExtensionPage(extensionId, "options.html", ".edit-card");
if (options) {
  assert.match(options.title, /资料设置/);
  assert.ok(options.nodeCount >= 45, `options page rendered only ${options.nodeCount} entries`);
  assert.match(options.bodyText, /加载资料文件/);
  assert.match(options.bodyText, /另存资料文件/);
}
const optionsModelUi = skipExtensionUi ? await inspectOptionsModelUi() : null;
if (optionsModelUi) {
  assert.equal(optionsModelUi.sharedAlias, true);
  assert.equal(optionsModelUi.candidatesIndependent, true);
  assert.equal(optionsModelUi.separateDegree, true);
  assert.equal(optionsModelUi.noBuiltInMergedDegree, true);
  assert.equal(optionsModelUi.mergedStudyType, true);
  assert.equal(optionsModelUi.paperVenue, true);
  assert.equal(optionsModelUi.unwantedUi, false);
}

// Never reuse/reload an existing tab belonging to another browser workflow.
const fixtureTarget = await createTarget(`${fixtureOrigin}/`);
let fixture = await new CDPClient(fixtureTarget.webSocketDebuggerUrl).connect();
await fixture.send("Runtime.enable");
await fixture.evaluate("sessionStorage.clear(); true");
await fixture.send("Page.reload", { ignoreCache: true });
await waitFor(async () => fixture.evaluate(`document.readyState === "complete" && document.querySelector("#full-name")?.value === ""`));
await installContentHarness(fixture);

await fixture.evaluate(`{ const element = document.querySelector("#full-name"); element.focus(); element.dispatchEvent(new FocusEvent("focusin", { bubbles: true })); true }`);
const targetStatus = await contentCommand(fixture, "targetStatus", {});
assert.equal(targetStatus.ready, true);
assert.match(targetStatus.field, /姓名/);
const directFill = await contentCommand(fixture, "fillTarget", { entry: testEntry("basic.name") });
assert.equal(directFill.success, true);
assert.equal(await fixture.evaluate(`document.querySelector("#full-name").value`), testValue("basic.name"));
const undoDirect = await contentCommand(fixture, "undo", {});
assert.equal(undoDirect.restoredCount, 1);
assert.equal(await fixture.evaluate(`document.querySelector("#full-name").value`), "");

await fixture.evaluate(`{ const element = document.querySelector("#ant-graduation-date"); element.focus(); element.dispatchEvent(new FocusEvent("focusin", { bubbles: true })); true }`);
const antDateFill = await contentCommand(fixture, "fillTarget", {
  entry: {
    id: "education.master.end_date",
    label: "硕士毕业时间",
    value: "2027-06-20",
    aliases: ["硕士毕业时间"],
    optionValues: ["2027年6月20日"],
    autofill: true
  }
});
assert.equal(antDateFill.success, true, antDateFill.reason || "Ant Design date picker was not filled");
assert.equal(await fixture.evaluate(`document.querySelector("#ant-graduation-date").value`), "2027-06-20");
const undoAntDate = await contentCommand(fixture, "undo", {});
assert.equal(undoAntDate.restoredCount, 1);
assert.equal(await fixture.evaluate(`document.querySelector("#ant-graduation-date").value`), "");

await fixture.evaluate(`{ const element = document.querySelector("input[value='请保留这段内容']"); element.focus(); element.dispatchEvent(new FocusEvent("focusin", { bubbles: true })); true }`);
const overwriteGuard = await contentCommand(fixture, "fillTarget", { entry: testEntry("basic.name") });
assert.equal(overwriteGuard.requiresConfirmation, true);
assert.equal(await fixture.evaluate(`document.querySelector("input[value='请保留这段内容']").value`), "请保留这段内容");

const settings = { overwriteExisting: false, includeSensitive: true, confidenceThreshold: 90 };
const scan = await contentCommand(fixture, "scan", { profile: TEST_PROFILE, settings });
assert.ok(scan.scannedCount >= 10);
assert.ok(scan.suggestions.length >= 8, `only ${scan.suggestions.length} suggestions found`);

const fill = await contentCommand(fixture, "fill", { profile: TEST_PROFILE, settings });
assert.ok(!fill.skipped.some(item => ["competitions", "honors"].includes(item.field)), "derived award views cannot be treated as extra collections");
assert.ok(fill.filled.length >= 6, `only ${fill.filled.length} fields filled`);
for (const expectedId of [
  "basic.name", "basic.nationality", "contact.email", "contact.phone",
  "basic.birth_date", "career.fresh_graduate", "basic.highest_education_level",
  "contact.wechat", "hobby.summary", "profile.self_evaluation",
  "basic.given_name", "basic.family_name"
]) {
  assert.ok(
    fill.filled.some((item) => item.entryId === expectedId),
    `${expectedId} was not filled; filled=${fill.filled.map((item) => item.entryId).join(",")}; skipped=${fill.skipped.map((item) => `${item.entryId}:${item.reason}`).join("|")}`
  );
}

const formState = await fixture.evaluate(`({
  firstName: document.querySelector("#first-name").value,
  lastName: document.querySelector("#last-name").value,
  legalFirstName: document.querySelector("#legal-first-name").value,
  legalLastName: document.querySelector("#legal-last-name").value,
  name: document.querySelector("#full-name").value,
  email: document.querySelector("#email").value,
  confirmEmail: document.querySelector("#confirm-email").value,
  phone: document.querySelector("#mobile").value,
  wechat: document.querySelector("#wechat").value,
  hobby: document.querySelector("#hobby").value,
  birthday: document.querySelector("#birthday").value,
  nationality: document.querySelector("#nationality").value,
  household: document.querySelector("#household").value,
  freshGraduate: document.querySelector("input[name=freshGraduate]:checked")?.value,
  cities: Array.from(document.querySelectorAll("input[name=preferredCity]:checked"), (element) => element.value),
  school: document.querySelector("#school-display").innerText,
  major: document.querySelector("#major").value,
  selfEvaluation: document.querySelector("#self-evaluation").innerText,
  projectNames: Array.from(document.querySelectorAll('[data-repeat-item="projects"] input[name$="-name"]'), (element) => element.value),
  projectRoles: Array.from(document.querySelectorAll('[data-repeat-item="projects"] textarea[name$="-role"]'), (element) => element.value),
  awardNames: Array.from(document.querySelectorAll('[data-repeat-item="awards"] input[name$="-name"]'), (element) => element.value),
  awardDates: Array.from(document.querySelectorAll('[data-repeat-item="awards"] input[name$="-start"]'), (element) => element.value),
  skillNames: Array.from(document.querySelectorAll('[data-repeat-item="programmingLanguages"] input[name$="-name"]'), (element) => element.value),
  skillLevels: Array.from(document.querySelectorAll('[data-repeat-item="programmingLanguages"] select[name$="-level"]'), (element) => element.value),
  preserved: document.querySelector("input[value='请保留这段内容']")?.value,
  events: document.querySelector("#events").innerText
})`);
assert.equal(formState.firstName, testValue("basic.given_name"));
assert.equal(formState.lastName, testValue("basic.family_name"));
assert.equal(formState.legalFirstName, testValue("basic.given_name"));
assert.equal(formState.legalLastName, testValue("basic.family_name"));
assert.equal(formState.name, testValue("basic.name"));
assert.equal(formState.email, testValue("contact.email"));
assert.equal(formState.confirmEmail, testValue("contact.email"));
assert.equal(formState.phone, testValue("contact.phone").replace(/\D/g, "").slice(-11));
assert.equal(formState.wechat, testValue("contact.wechat"));
assert.equal(formState.hobby, testValue("hobby.summary"));
assert.equal(formState.birthday, testValue("basic.birth_date"));
assert.equal(formState.nationality, "中国大陆");
assert.equal(formState.household.replace(/\s*\/\s*/g, ""), testValue("location.household").replace(/\s+/g, ""));
assert.equal(formState.freshGraduate, testValue("career.fresh_graduate"));
assert.deepEqual(formState.cities, []);
assert.ok(fill.skipped.some((item) => item.entryId === "manual.intent" && /工作城市/.test(item.field)));
// Unscoped school/major controls must not silently borrow the first education.
assert.equal(formState.school, "");
assert.equal(formState.major, "");
assert.equal(formState.selfEvaluation, testValue("profile.self_evaluation"));
assert.deepEqual(formState.projectNames, TEST_PROFILE.records.projects.map((project) => project.name));
assert.deepEqual(formState.projectRoles, TEST_PROFILE.records.projects.map((project) => project.role));
const expectedAwards = testAwards;
assert.deepEqual(formState.awardNames, expectedAwards.map((award) => award.name));
assert.deepEqual(formState.awardDates, expectedAwards.map((award) => (
  (/^\d{4}-\d{2}/.test(award.start || "") ? award.start : award.end || award.start).slice(0, 7)
)));
assert.deepEqual(formState.skillNames, TEST_PROFILE.records.programmingLanguages.map((skill) => skill.name));
assert.deepEqual(formState.skillLevels, TEST_PROFILE.records.programmingLanguages.map((skill) => skill.level));
assert.equal(formState.preserved, "请保留这段内容");
assert.match(formState.events, /input:/);
assert.match(formState.events, /change:/);

await fixture.send("Page.reload", { ignoreCache: true });
await waitFor(async () => fixture.evaluate(`document.readyState === "complete" && document.querySelector("#full-name")?.value === ${JSON.stringify(testValue("basic.name"))}`));
await installContentHarness(fixture);
const verification = await contentCommand(fixture, "verify", {
  profile: TEST_PROFILE,
  expectations: fill.filled,
  documentToken: fill.documentToken
});
assert.equal(verification.reloaded, true);
assert.equal(
  verification.missingCount,
  0,
  `verification failures: ${verification.results.filter((item) => !item.confirmed).map((item) => `${item.entryId}:${item.reason}`).join("|")}`
);
assert.equal(verification.confirmedCount, fill.filled.length);
// Explicit child-field targeting retains search-select and text coverage without
// an implicit first-record projection into unscoped controls.
for (const [key, selector, readback] of [["school", "#school", "document.querySelector('#school-display').innerText"], ["major", "#major", "document.querySelector('#major').value"]]) {
  const education = TEST_PROFILE.records.educations[0];
  await fixture.evaluate(`{ const element = document.querySelector(${JSON.stringify(selector)}); element.focus(); element.dispatchEvent(new FocusEvent('focusin', { bubbles:true })); }`);
  const child = await contentCommand(fixture, "fillTarget", { entry: { id: `${education.id}.${key}`, label: key, value: education[key], optionValues: education.fieldOptions?.[key] || [] } });
  assert.equal(child.success, true, `explicit education ${key} failed: ${child.reason}`);
  assert.equal(await fixture.evaluate(readback), education[key]);
  const undone = await contentCommand(fixture, "undo", {});
  assert.equal(undone.restoredCount, 1, `${key} undo: ${JSON.stringify(undone)}`);
  assert.equal(await fixture.evaluate(readback), "");
}
fixture.close();

const zteTarget = await createTarget(`${fixtureOrigin}/zte`);
const zte = await new CDPClient(zteTarget.webSocketDebuggerUrl).connect();
await zte.send("Runtime.enable");
await waitFor(async () => zte.evaluate(`document.readyState === "complete" && document.querySelector("#add-project") !== null`));
await installContentHarness(zte);
const zteParts = [];
for (const [index, segment] of ["basics", "projects", "achievements"].entries()) {
  const segmentStartedAt = Date.now();
  console.error(`Starting MokaHR segment: ${segment}`);
  zteParts.push(await contentCommand(zte, "fillStructuredSegment", {
    profile: TEST_PROFILE,
    settings,
    adapter: "mokahr",
    segment,
    resetTransaction: index === 0
  }));
  console.error(`Completed MokaHR segment: ${segment} (${Date.now() - segmentStartedAt} ms)`);
}
const zteFill = {
  ...zteParts[0],
  plannedRecords: Object.assign({}, ...zteParts.map(part => part.plannedRecords)),
  suggestions: zteParts.flatMap((part) => part.suggestions || []),
  filled: zteParts.flatMap((part) => part.filled || []),
  skipped: zteParts.flatMap((part) => part.skipped || [])
};
assert.equal(zteFill.structured, true);
assert.equal(zteFill.plannedRecords.projects, TEST_PROFILE.records.projects.length);
assert.ok(zteFill.skipped.some((item) => item.entryId === "manual.intent" && item.field === "是否接受其他工作地调剂"));
const recordCounts = await zte.evaluate(`Object.fromEntries(['block-educationInfo','block-practiceInfo','block-projectInfo','block-34807','block-32781','block-32786','block-30701','block-30706'].map(id => [id, document.querySelectorAll('[data-nav-id="' + id + '"] > [class*=apply-fields]').length]))`);
assert.deepEqual(recordCounts, {
  "block-educationInfo": TEST_PROFILE.records.educations.length,
  "block-practiceInfo": TEST_PROFILE.records.internships.length,
  "block-projectInfo": TEST_PROFILE.records.projects.length,
  "block-34807": TEST_PROFILE.records.papers.length,
  "block-32781": testCompetitions.length,
  "block-32786": testHonors.length,
  "block-30701": mokaProgrammingLanguages.length,
  "block-30706": TEST_PROFILE.records.foreignLanguages.length
});
const projectState = await zte.evaluate(`Array.from(document.querySelectorAll('[data-nav-id="block-projectInfo"] > [class*=apply-fields]'), record => ({
  dates: Array.from(record.querySelectorAll('input[placeholder="年"],input[placeholder="月"]'), input => input.value),
  current: record.querySelector('input[type=checkbox]').checked,
  name: record.querySelector('input[placeholder="项目名称"]').value,
  sohuRole: Array.from(record.querySelectorAll('[class*=apply-field]')).find(field => field.querySelector('[class*=title]')?.textContent.trim() === '职责')?.querySelector('input,textarea')?.value || '',
  role: record.querySelector('textarea[placeholder="项目中职责"]').value,
  sohuDescription: Array.from(record.querySelectorAll('[class*=apply-field]')).find(field => field.querySelector('[class*=title]')?.textContent.trim() === '项目描述')?.querySelector('input,textarea')?.value || '',
  description: Array.from(record.querySelectorAll('[class*=apply-field]')).find(field => field.querySelector('[class*=title]')?.textContent.trim() === '项目描述及成果')?.querySelector('input,textarea')?.value || ''
}))`);
assert.deepEqual(projectState.map((item) => item.name), TEST_PROFILE.records.projects.map((item) => item.name));
assert.deepEqual(projectState.map((item) => item.role), TEST_PROFILE.records.projects.map((item) => item.role));
assert.deepEqual(projectState.map((item) => item.sohuRole), TEST_PROFILE.records.projects.map((item) => item.role));
assert.ok(projectState.every((item) => item.description.length > 20));
assert.deepEqual(projectState.map((item) => item.sohuDescription), TEST_PROFILE.records.projects.map((item) => item.description));
assert.equal(projectState.filter((item) => item.current).length, TEST_PROFILE.records.projects.filter((item) => item.current).length);
assert.equal(projectState[0].dates[0], TEST_PROFILE.records.projects[0].start.split("-")[0]);
assert.equal(projectState[0].dates[1], String(Number(TEST_PROFILE.records.projects[0].start.split("-")[1])));
const sectionValues = await zte.evaluate(`({
  educationSchools: Array.from(document.querySelectorAll('[data-nav-id="block-educationInfo"] > [class*=apply-fields] input[placeholder="请输入就读学校"]'), e => e.value),
  internshipCompany: document.querySelector('[data-nav-id="block-practiceInfo"] input[placeholder="公司名称"]')?.value,
  paperName: document.querySelector('[data-nav-id="block-34807"] input[placeholder="论文名称"]')?.value,
  paperVenue: document.querySelector('[data-nav-id="block-34807"] input[placeholder="发表会议"]')?.value,
  paperAuthorOrder: Array.from(document.querySelectorAll('[data-nav-id="block-34807"] .apply-field-test')).find(field => field.querySelector('.title-test')?.textContent === '作者顺序')?.querySelector('input')?.value || '',
  paperDate: document.querySelector('[data-nav-id="block-34807"] input[placeholder="日期（年月日）"]')?.value,
  competitionNames: Array.from(document.querySelectorAll('[data-nav-id="block-32781"] input[placeholder="竞赛名称"]'), e => e.value),
  competitionDates: Array.from(document.querySelectorAll('[data-nav-id="block-32781"] > [class*=apply-fields]'), r => Array.from(r.querySelectorAll('input[placeholder="年"],input[placeholder="月"]'), e => e.value)),
  honorNames: Array.from(document.querySelectorAll('[data-nav-id="block-32786"] input[placeholder="奖项名称"]'), e => e.value),
  honorDates: Array.from(document.querySelectorAll('[data-nav-id="block-32786"] > [class*=apply-fields]'), r => Array.from(r.querySelectorAll('input[placeholder="年"],input[placeholder="月"]'), e => e.value)),
  programmingLanguages: Array.from(document.querySelectorAll('[data-nav-id="block-30701"] > [class*=apply-fields]'), r => r.querySelector('input').value),
  foreignLanguage: document.querySelector('[data-nav-id="block-30706"] input')?.value,
  workAdjustment: Array.from(document.querySelectorAll('[data-nav-id="block-basicInfo"] .apply-field-test')).find(field => field.querySelector('.title-test')?.textContent === '是否接受其他工作地调剂')?.querySelector('input')?.value || ''
})`);
assert.deepEqual(sectionValues.educationSchools, TEST_PROFILE.records.educations.map((item) => item.school));
assert.equal(sectionValues.internshipCompany, TEST_PROFILE.records.internships[0].company);
assert.equal(sectionValues.paperName, TEST_PROFILE.records.papers[0].name);
assert.equal(sectionValues.paperVenue, TEST_PROFILE.records.papers[0].venue);
assert.equal(sectionValues.paperAuthorOrder, TEST_PROFILE.records.papers[0].authorOrder);
assert.equal(sectionValues.paperDate, TEST_PROFILE.records.papers[0].publishedAt);
assert.deepEqual(sectionValues.competitionNames, testCompetitions.map((item) => item.name));
assert.deepEqual(sectionValues.competitionDates, testCompetitions.map((item) => {
  const [startYear = "", startMonth = ""] = item.start.split("-");
  const [endYear = "", endMonth = ""] = item.end.split("-");
  return [startYear, startMonth ? String(Number(startMonth)) : "", endYear, endMonth ? String(Number(endMonth)) : ""];
}));
assert.deepEqual(sectionValues.honorNames, testHonors.map((item) => item.name));
assert.deepEqual(sectionValues.honorDates, testHonors.map((item) => {
  const [year = "", month = ""] = item.start.split("-");
  return [year, month ? String(Number(month)) : ""];
}));
assert.deepEqual(sectionValues.programmingLanguages, mokaProgrammingLanguages.map((item) => item.name === "Linux" ? "" : ["C", "C++"].includes(item.name) ? "C/C++" : item.name));
assert.ok(zteFill.skipped.some(item => item.entryId.startsWith('language.example_linux') && /未找到|未确认/.test(item.reason)), "Linux must be reported rather than discarded or inferred");
assert.equal(sectionValues.foreignLanguage, TEST_PROFILE.records.foreignLanguages[0].language);
assert.equal(sectionValues.workAdjustment, "");
assert.ok(zteFill.filled.some((item) => item.entryId === "basic.name"), "MokaHR basic fields must retain their exact profile source IDs");
zte.close();

const combinedAwardsTarget = await createTarget(`${fixtureOrigin}/zte`);
const combinedAwards = await new CDPClient(combinedAwardsTarget.webSocketDebuggerUrl).connect();
await combinedAwards.send("Runtime.enable");
await waitFor(async () => combinedAwards.evaluate(`document.readyState === "complete" && document.querySelector('[data-nav-id="block-32786"]') !== null`));
await combinedAwards.evaluate(`{
  document.querySelector('[data-nav-id="block-32781"]')?.remove();
  const awardsBlock = document.querySelector('[data-nav-id="block-32786"]');
  awardsBlock.dataset.testBlock = 'combined-awards';
  awardsBlock.removeAttribute('data-nav-id');
  const title = awardsBlock.querySelector('.blockTitle-test span');
  if (title) title.textContent = '获奖经历';
  true;
}`);
await installContentHarness(combinedAwards);
const combinedAwardFill = await contentCommand(combinedAwards, "fillStructuredSegment", {
  profile: TEST_PROFILE,
  settings,
  adapter: "mokahr",
  segment: "achievements",
  resetTransaction: true
});
const combinedAwardState = await combinedAwards.evaluate(`({
  count: document.querySelectorAll('[data-test-block="combined-awards"] > [class*=apply-fields]').length,
  names: Array.from(document.querySelectorAll('[data-test-block="combined-awards"] input[placeholder="奖项名称"]'), e => e.value),
  dates: Array.from(document.querySelectorAll('[data-test-block="combined-awards"] > [class*=apply-fields]'), r => Array.from(r.querySelectorAll('input[placeholder="年"],input[placeholder="月"]'), e => e.value))
})`);
const allAwards = testAwards;
assert.equal(combinedAwardState.count, allAwards.length);
assert.deepEqual(combinedAwardState.names, allAwards.map((item) => item.name));
assert.deepEqual(combinedAwardState.dates, allAwards.map((item) => {
  const value = /^\d{4}-\d{2}/.test(item.start || "") ? item.start : (item.end || item.start);
  const [year = "", month = ""] = value.split("-");
  return [year, month ? String(Number(month)) : ""];
}));
assert.ok(combinedAwardFill.filled.length >= allAwards.length * 2);
combinedAwards.close();

const zhiyeTarget = await createTarget(`${fixtureOrigin}/zhiye`);
const zhiye = await new CDPClient(zhiyeTarget.webSocketDebuggerUrl).connect();
await zhiye.send("Runtime.enable");
await waitFor(async () => zhiye.evaluate(`document.readyState === "complete" && document.querySelector("#zhiye-project_addButton") !== null`));
await installContentHarness(zhiye);
const zhiyeInitial = await zhiye.evaluate(`Array.from(document.querySelectorAll('div.form[id="zhiye-education"],div.form[id="zhiye-work"],div.form[id="zhiye-project"]'), form => ({ id: form.id, controls: Array.from(form.querySelectorAll('input,textarea'), e => [e.type, e.value, Boolean(e.checked)]) }))`);
const zhiyeScan = await contentCommand(zhiye, "scan", { profile: TEST_PROFILE, settings });
assert.equal(zhiyeScan.adapter, "zhiye");
assert.deepEqual(zhiyeScan.segments, ["identity", "education", "experience", "projects"]);
assert.ok(zhiyeScan.skipped.some((item) => item.entryId === "manual.intent" && item.field === "期望从事职业"));
assert.ok(zhiyeScan.skipped.some((item) => item.entryId === "manual.intent" && item.field === "期望工作城市"));

const zhiyeParts = [];
for (const [index, segment] of zhiyeScan.segments.entries()) {
  zhiyeParts.push(await contentCommand(zhiye, "fillStructuredSegment", {
    profile: TEST_PROFILE,
    settings,
    adapter: "zhiye",
    segment,
    resetTransaction: index === 0
  }));
}
const zhiyeFill = {
  ...zhiyeParts[0],
  suggestions: zhiyeParts.flatMap((part) => part.suggestions || []),
  filled: zhiyeParts.flatMap((part) => part.filled || []),
  skipped: zhiyeParts.flatMap((part) => part.skipped || [])
};
const zhiyeState = await zhiye.evaluate(`({
  name: document.querySelector('#zhiye-basic.form input')?.value,
  phone: document.querySelectorAll('#zhiye-basic.form input')[1]?.value,
  email: document.querySelectorAll('#zhiye-basic.form input')[2]?.value,
  selectedGender: document.querySelector('#zhiye-basic.form input[name=gender]:checked')?.value || '',
  intentCareer: document.querySelector('#zhiye-intent.form .form-item:nth-child(1) input')?.value || '',
  intentCity: document.querySelector('#zhiye-intent.form .form-item:nth-child(2) input')?.value || '',
  educationCount: document.querySelectorAll('div.form[id="zhiye-education"]').length,
  workCount: document.querySelectorAll('div.form[id="zhiye-work"]').length,
  projectCount: document.querySelectorAll('div.form[id="zhiye-project"]').length,
  schools: Array.from(document.querySelectorAll('div.form[id="zhiye-education"]'), form => form.querySelector('input')?.value || ''),
  projectNames: Array.from(document.querySelectorAll('div.form[id="zhiye-project"]'), form => form.querySelectorAll('input[type=text]')[0]?.value || ''),
  projectRoles: Array.from(document.querySelectorAll('div.form[id="zhiye-project"]'), form => form.querySelectorAll('input[type=text]')[1]?.value || ''),
  projectStarts: Array.from(document.querySelectorAll('div.form[id="zhiye-project"]'), form => form.querySelectorAll('.phoenix-select__input')[0]?.value || ''),
  projectEnds: Array.from(document.querySelectorAll('div.form[id="zhiye-project"]'), form => form.querySelectorAll('.phoenix-select__input')[1]?.value || ''),
  projectCurrent: Array.from(document.querySelectorAll('div.form[id="zhiye-project"]'), form => Boolean(form.querySelector('input[type=checkbox]')?.checked)),
  projectCommittedDates: Array.from(document.querySelectorAll('div.form[id="zhiye-project"] [data-month-picker] .phoenix-select__input'), input => input.dataset.committed || ''),
  educationDates: Array.from(document.querySelectorAll('div.form[id="zhiye-education"] [data-month-picker] .phoenix-select__input'), input => input.value || ''),
  workDates: Array.from(document.querySelectorAll('div.form[id="zhiye-work"] [data-month-picker] .phoenix-select__input'), input => input.value || ''),
  monthPickerCommitCount: window.monthPickerCommitCount,
  projectDescriptions: Array.from(document.querySelectorAll('div.form[id="zhiye-project"]'), form => form.querySelector('textarea')?.value || ''),
  events: document.querySelector('#events').textContent
})`);
assert.equal(zhiyeState.name, testValue("basic.name"));
assert.equal(zhiyeState.phone, testValue("contact.phone").replace(/^\+86\s*/, "").replace(/\s+/g, ""));
assert.equal(zhiyeState.email, testValue("contact.email"));
assert.ok(zhiyeFill.filled.some((item) => item.entryId === "basic.name"), "Zhiye basic fields must retain their exact profile source IDs");
assert.equal(zhiyeState.selectedGender, testValue("basic.gender"));
assert.equal(zhiyeState.intentCareer, "");
assert.equal(zhiyeState.intentCity, "");
assert.equal(zhiyeState.educationCount, TEST_PROFILE.records.educations.length);
assert.equal(zhiyeState.workCount, TEST_PROFILE.records.internships.length);
assert.equal(zhiyeState.projectCount, TEST_PROFILE.records.projects.length);
assert.deepEqual(zhiyeState.schools, TEST_PROFILE.records.educations.map((item) => item.school));
assert.deepEqual(zhiyeState.projectNames, TEST_PROFILE.records.projects.map((item) => item.name));
assert.deepEqual(zhiyeState.projectRoles, TEST_PROFILE.records.projects.map((item) => item.role));
assert.deepEqual(zhiyeState.projectStarts, TEST_PROFILE.records.projects.map((item) => item.start));
assert.deepEqual(zhiyeState.projectEnds, TEST_PROFILE.records.projects.map((item) => item.current ? "" : item.end));
assert.deepEqual(zhiyeState.projectCurrent, TEST_PROFILE.records.projects.map((item) => Boolean(item.current)));
assert.deepEqual(zhiyeState.projectCommittedDates, TEST_PROFILE.records.projects.flatMap((item) => [item.start, item.current ? "" : item.end]));
assert.deepEqual(zhiyeState.educationDates, TEST_PROFILE.records.educations.flatMap((item) => [item.start.slice(0, 7), item.end.slice(0, 7)]));
assert.deepEqual(zhiyeState.workDates, TEST_PROFILE.records.internships.flatMap((item) => [item.start, item.current ? "" : item.end]));
const expectedZhiyeMonthCommits = TEST_PROFILE.records.educations.length * 2
  + TEST_PROFILE.records.internships.length
  + TEST_PROFILE.records.internships.filter((item) => !item.current).length
  + TEST_PROFILE.records.projects.length
  + TEST_PROFILE.records.projects.filter((item) => !item.current).length;
assert.equal(zhiyeState.monthPickerCommitCount, expectedZhiyeMonthCommits, "Zhiye dates must be committed through the Phoenix month picker");
assert.deepEqual(zhiyeState.projectDescriptions, TEST_PROFILE.records.projects.map((item) => item.description));
assert.match(zhiyeState.events, /input:/);
assert.match(zhiyeState.events, /change:/);
assert.ok(zhiyeFill.filled.length >= 25, `only ${zhiyeFill.filled.length} Zhiye fields filled: ${zhiyeFill.skipped.map((item) => `${item.field}:${item.reason}`).join("|")}`);
const zhiyeUndo = await contentCommand(zhiye, "undo", {});
assert.equal(zhiyeUndo.failedCount || 0, 0, "Zhiye whole-batch undo must leave no failed items");
assert.deepEqual(await zhiye.evaluate(`Array.from(document.querySelectorAll('div.form[id="zhiye-education"],div.form[id="zhiye-work"],div.form[id="zhiye-project"]'), form => ({ id: form.id, controls: Array.from(form.querySelectorAll('input,textarea'), e => [e.type, e.value, Boolean(e.checked)]) }))`), zhiyeInitial, "Undo removes added groups but preserves and restores every original empty group");
assert.equal(await zhiye.evaluate(`document.querySelector('#zhiye-basic.form input[name=gender]:checked')?.value || ''`), "", "Gender selection is included in the same undo transaction");
assert.equal(await zhiye.evaluate(`document.querySelector('div.form[id="zhiye-project"] input')?.value || ''`), "");
zhiye.close();

const evidence = {
  verifiedAt: new Date().toISOString(),
  scope: skipExtensionUi ? "anonymous content harness and UI previews, not installed-extension acceptance" : "isolated anonymous extension and content harness",
  categoryRuntimeSha256: createHash("sha256").update(categorySource).digest("hex"),
  fillSourceSha256: createHash('sha256').update(fillSource).digest('hex'),
  commandTimings,
  extensionId,
  sidepanelEntries: sidepanel?.nodeCount ?? "skipped",
  filledSourceMarkers: filledMarkerPanel?.nodeCount ?? "skipped",
  optionsEntries: options?.nodeCount ?? "skipped",
  optionsModelUi,
  scannedFields: scan.scannedCount,
  suggestions: scan.suggestions.length,
  filledFields: fill.filled.length,
  targetedFill: directFill.success,
  antDatePickerFill: antDateFill.success,
  undoRestored: undoDirect.restoredCount,
  verifiedAfterReload: verification.confirmedCount,
  zteProjectRecords: projectState.length,
  zteRecordCounts: recordCounts,
  zteFieldsFilled: zteFill.filled.length,
  combinedMokaAwardRecords: combinedAwardState.count,
  zhiyeProjectRecords: zhiyeState.projectCount,
  zhiyeFieldsFilled: zhiyeFill.filled.length,
  zhiyeUndoRestored: zhiyeUndo.restoredCount,
  screenshots: [sidepanel?.screenshotPath, options?.screenshotPath].filter(Boolean)
};
await writeFile(path.join(artifactRoot, 'results.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
} finally {
  for (const id of ownedTargets) await fetch(`${cdpBase}/json/close/${id}`).catch(() => {});
}
