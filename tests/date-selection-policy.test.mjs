import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/content/fill.js", import.meta.url), "utf8");
const dateSource = source.slice(source.indexOf("  const DATE_MONTH_NAMES"), source.indexOf("  function isZhaopinPage("));
const dates = vm.runInNewContext(`${dateSource}; ({ controlDateParts, dateSelectionPolicy, dateLayerNumber })`, {});
const exactSource = source.slice(source.indexOf("  function exactOption("), source.indexOf("  function chooseNativeSelect("));
const tableSource = source.slice(source.indexOf("  function activeDateTable("), source.indexOf("  async function clearControlledDate("));
const tables = vm.runInNewContext(`${exactSource}; ${tableSource}; ({ dateTableOption })`, {
  isVisible: element => !element.hidden,
  compactText: value => String(value || "").trim()
});

test("date policy validates leap days and keeps slash or hyphen sources unchanged", () => {
  for (const value of ["2024-02-29", "2024/2/29"]) {
    const entry = { value };
    const policy = dates.dateSelectionPolicy(entry);
    assert.equal(policy.parts.date, "2024-02-29");
    assert.equal(entry.value, value);
  }
  for (const value of ["2023-02-29", "2024-04-31", "2024-13-01", "2024-00-01", "2024/02-29"]) {
    assert.match(dates.dateSelectionPolicy({ value }).reason, /无效或日期不存在/);
  }
});

test("day-precision record conflicts never accept another day in the same month", () => {
  const mappedSource = source.slice(source.indexOf("  function mappedRecordValueMatches("), source.indexOf("  function bestRecordSlot("));
  const api = vm.runInNewContext(mappedSource + "; ({mappedRecordValueMatches})", {
    controlDateParts: dates.controlDateParts, recordValueMatches: () => true
  });
  const data = { start: "2024/09/23" };
  assert.equal(api.mappedRecordValueMatches("2024-09-23", data, { value: "start", datePrecision: "day" }), true);
  assert.equal(api.mappedRecordValueMatches("2024-09-24", data, { value: "start", datePrecision: "day" }), false);
  assert.equal(api.mappedRecordValueMatches("2024-09", data, { value: "start", datePrecision: "day" }), false);
});

test("day precision refuses missing day while month precision does not invent one", () => {
  assert.match(dates.dateSelectionPolicy({ value: "2024-09" }).reason, /要求日期到日/);
  const monthOnly = dates.dateSelectionPolicy({ value: "2024/09" }, "month");
  assert.equal(monthOnly.parts.day, null);
  assert.equal(monthOnly.parts.date, "");
  assert.equal(monthOnly.parts.ym, "2024-09");
  assert.equal(monthOnly.candidates.length, 2);
  const fullSource = { value: "2024-09-23", pathValues: [["2024年"], ["九月"], ["23日"]] };
  const serialized = JSON.stringify(fullSource);
  const policy = dates.dateSelectionPolicy(fullSource, "month");
  assert.equal(policy.parts.ym, "2024-09");
  assert.equal(policy.candidates.length, 2);
  assert.equal(JSON.stringify(fullSource), serialized);
  assert.match(dates.dateSelectionPolicy({ value: "2024-09-23", pathValues: [["2024"], ["九月"], ["22日"]] }, "month").reason, /与主日期不一致/);
  assert.match(dates.dateSelectionPolicy({ value: "2024-09-23", pathValues: [[]] }, "month").reason, /格式错误/);
});

test("date paths accept equivalent stage labels and stop conflicting year, month or day", () => {
  const good = dates.dateSelectionPolicy({ value: "2024-09-23", pathValues: [["2024", "2024年"], ["9", "09月", "九月"], ["23", "23日"]] });
  assert.equal(good.reason, undefined);
  assert.ok(good.candidates[1].includes("九月"));
  for (const pathValues of [[["2025"]], [["2024"], ["十月"]], [["2024"], ["9月"], ["22日"]]]) {
    assert.match(dates.dateSelectionPolicy({ value: "2024-09-23", pathValues }).reason, /与主日期不一致/);
  }
  assert.match(dates.dateSelectionPolicy({ value: "2024-09-23", pathValues: [["2024"], [false]] }).reason, /格式错误/);
  assert.match(dates.dateSelectionPolicy({ value: "2024-09-23", pathValues: [["2024"], ["9"], ["23"], ["extra"]] }).reason, /依次为年、月、日/);
});

function cell(text, classes = "available", attributes = {}) {
  const leaf = { textContent: text };
  return {
    textContent: text, className: classes, disabled: false, hidden: false,
    getAttribute: key => attributes[key] ?? null,
    classList: { contains: key => classes.split(/\s+/).includes(key) },
    querySelector: () => leaf,
    leaf
  };
}

test("calendar options reject a disabled parent cell and neighboring-month duplicate days", () => {
  const previous = cell("1", "available prev-month");
  const disabled = cell("1", "available disabled");
  const disabledAria = cell("1", "available", { "aria-disabled": "true" });
  const next = cell("1", "available next-month");
  const current = cell("1");
  const predicate = element => element.classList.contains("available")
    && !element.classList.contains("prev-month") && !element.classList.contains("next-month");
  const table = { querySelectorAll: () => [previous, disabled, disabledAria, next, current] };
  assert.equal(tables.dateTableOption(table, ["1", "01"], predicate), current.leaf);
  table.querySelectorAll = () => [previous, disabled, disabledAria, next];
  assert.equal(tables.dateTableOption(table, ["1", "01"], predicate), null);
  table.querySelectorAll = () => [current, cell("1")];
  assert.equal(tables.dateTableOption(table, ["1"], predicate), null);
});

function linkedHarness(values, { failValue = "", failRestoration = false, clearOtherOnFailure = false } = {}) {
  const elements = values.map(value => ({ value, isConnected: true }));
  const failures = new WeakMap();
  const uncertain = new WeakSet();
  const clicks = [];
  let failed = false;
  const linkedSource = source.slice(source.indexOf("  function linkedDateConflict("), source.indexOf("  function isZhaopinSearchChoice("));
  const api = vm.runInNewContext(`${dateSource}; ${linkedSource}; ({ linkedDateConflict, linkedDateOrder, writeLinkedDates, restoreLinkedDates })`, {
    getCurrentValue: element => element.value,
    controlFailures: failures,
    unconfirmedScalarWrites: uncertain,
    clearControlledDate: async element => { element.value = ""; return true; },
    chooseElementDay: async (element, entry) => {
      const index = elements.indexOf(element);
      clicks.push([index, entry.value]);
      if (failRestoration && failed) return false;
      element.value = dates.controlDateParts(entry.value)?.date || "";
      // Simulate the site's linked endpoint clearing when an interval is reversed.
      if (index === 0 && elements[1].value && element.value > elements[1].value) elements[1].value = "";
      if (index === 1 && elements[0].value && element.value < elements[0].value) elements[0].value = "";
      if (entry.value === failValue && !failed) {
        failed = true;
        if (clearOtherOnFailure) elements[1 - index].value = "";
        return false;
      }
      return true;
    }
  });
  return { api, elements, failures, uncertain, clicks, pair: { elements }, undo: { elements, values: [...values] } };
}

test("linked dates refuse a single endpoint that would clear the protected other end", () => {
  const h = linkedHarness(["2020-09-01", "2024-06-01"]);
  const entries = new Map([[h.elements[0], dates.dateSelectionPolicy({ value: "2025-09-01" })]]);
  assert.match(h.api.linkedDateConflict(h.pair, entries), /填写会清空另一端/);
  assert.equal(h.clicks.length, 0);
  assert.equal(h.api.linkedDateConflict(h.pair, new Map([[h.elements[1], dates.dateSelectionPolicy({ value: "2020-01-01" })]])), "起止日期冲突；填写会清空另一端，未操作控件");
});

test("linked date ordering moves end first when the new start follows the old end", async () => {
  const h = linkedHarness(["2020-09-01", "2024-06-01"]);
  const entries = new Map([[h.elements[0], { value: "2025-09-01" }], [h.elements[1], { value: "2029-06-01" }]]);
  assert.equal(await h.api.writeLinkedDates(h.pair, entries, h.undo), true);
  assert.deepEqual(h.clicks, [[1, "2029-06-01"], [0, "2025-09-01"]]);
  assert.deepEqual(h.elements.map(element => element.value), ["2025-09-01", "2029-06-01"]);
  const earlier = linkedHarness(["2020-09-01", "2024-06-01"]);
  const previous = new Map([[earlier.elements[0], { value: "2015-09-01" }], [earlier.elements[1], { value: "2019-06-01" }]]);
  assert.equal(await earlier.api.writeLinkedDates(earlier.pair, previous, earlier.undo), true);
  assert.deepEqual(earlier.clicks, [[0, "2015-09-01"], [1, "2019-06-01"]]);
});

test("linked date policy stops invalid existing dates, contradictory paths and reversed target intervals before clicking", async () => {
  const cases = [
    { old: ["无法识别", "2024-06-01"], values: ["2020-09-01", "2024-06-01"] },
    { old: ["2025-09-01", "2024-06-01"], values: ["2020-09-01", "2024-06-01"] },
    { old: ["2020-09-01", "2024-06-01"], values: ["2029-09-01", "2025-06-01"] },
    { old: ["2020-09-01", "2024-06-01"], values: ["2025-09", "2029-06-01"] }
  ];
  for (const item of cases) {
    const h = linkedHarness(item.old);
    const entries = new Map(h.elements.map((element, index) => [element, { value: item.values[index] }]));
    assert.equal(await h.api.writeLinkedDates(h.pair, entries, h.undo), false);
    assert.equal(h.clicks.length, 0);
    assert.deepEqual(h.elements.map(element => element.value), item.old);
  }
  const h = linkedHarness(["2020-09-01", "2024-06-01"]);
  assert.equal(await h.api.writeLinkedDates(h.pair, new Map([[h.elements[0], { value: "2021-09-01", pathValues: [["2022"]] }]]), h.undo), false);
  assert.equal(h.clicks.length, 0);
});

test("linked date failure restores the whole previous interval, including an endpoint cleared by the failed step", async () => {
  const h = linkedHarness(["2020-09-01", "2024-06-01"], { failValue: "2025-09-01", clearOtherOnFailure: true });
  const entries = new Map([[h.elements[0], { value: "2025-09-01" }], [h.elements[1], { value: "2029-06-01" }]]);
  assert.equal(await h.api.writeLinkedDates(h.pair, entries, h.undo), false);
  assert.deepEqual(h.elements.map(element => element.value), h.undo.values);
  assert.match(h.failures.get(h.elements[0]), /已恢复整组旧值/);
  assert.match(h.failures.get(h.elements[1]), /已恢复整组旧值/);
  assert.equal(h.uncertain.has(h.elements[0]), false);
});

test("failed linked restoration retains both modified controls for later undo", async () => {
  const h = linkedHarness(["2020-09-01", "2024-06-01"], { failValue: "2025-09-01", failRestoration: true });
  const entries = new Map([[h.elements[0], { value: "2025-09-01" }], [h.elements[1], { value: "2029-06-01" }]]);
  assert.equal(await h.api.writeLinkedDates(h.pair, entries, h.undo), false);
  assert.match(h.failures.get(h.elements[0]), /恢复未完成/);
  assert.equal(h.uncertain.has(h.elements[0]), true);
  assert.equal(h.uncertain.has(h.elements[1]), true);
});

test("calendar panel ownership ignores unrelated visible calendars and refuses ambiguous new panels", () => {
  const known = new WeakMap();
  let visible = [];
  const ids = new Map();
  const panel = name => ({ name, isConnected: true, matches: selector => selector === ".el-date-picker" });
  const element = { getAttribute: () => "" };
  const other = panel("another input");
  const mine = panel("current input");
  const panelSource = source.slice(source.indexOf("  function elementDatePanel("), source.indexOf("  function elementDateHeader("));
  const find = vm.runInNewContext(`${panelSource}; elementDatePanel`, {
    elementDatePanels: known,
    document: { getElementById: id => ids.get(id), querySelectorAll: () => visible },
    isVisible: node => visible.includes(node)
  });
  visible = [other];
  assert.equal(find(element), null);
  const before = new Set(visible);
  visible = [other, mine, panel("second new calendar")];
  assert.equal(find(element, before), null);
  visible = [other, mine];
  assert.equal(find(element, before), mine);
  mine.isConnected = false;
  visible = [other];
  assert.equal(find(element), null);
  const ariaOwned = panel("aria owned");
  ids.set("date-owned", ariaOwned);
  visible = [other, ariaOwned];
  element.getAttribute = attribute => attribute === "aria-controls" ? "date-owned" : "";
  assert.equal(find(element), ariaOwned);
});

test("linked undo captures both dates and refuses to overwrite either user-modified endpoint", async () => {
  const elements = [{ value: "2020-09-01", isConnected: true }, { value: "2024-06-01", isConnected: true }];
  const pair = { scope: {}, elements };
  let restores = 0;
  const captureSource = source.slice(source.indexOf("  function captureFieldState("), source.indexOf("  function captureChoiceState("));
  const restoreSource = source.slice(source.indexOf("  async function restoreRecord("), source.indexOf("  function sealTransaction("));
  const sealSource = source.slice(source.indexOf("  function sealTransaction("), source.indexOf("  function protectChangedGroups("));
  const api = vm.runInNewContext(`${captureSource}; ${restoreSource}; ${sealSource}; ({ captureFieldState, sealTransaction, restoreRecord })`, {
    job51: null,
    linkedElementDates: () => pair,
    isChinalifeRadioGroup: () => false,
    getCurrentValue: element => element.value,
    cssLocator: () => "#start",
    lastTransaction: [],
    restoreLinkedDates: async record => { restores++; record.elements.forEach((element, index) => { element.value = record.values[index]; }); return true; }
  });
  const undo = api.captureFieldState({ element: elements[0] });
  assert.equal(undo.kind, "linkedDates");
  elements[0].value = "2025-09-01";
  elements[1].value = "2029-06-01";
  api.sealTransaction([undo]);
  elements[1].value = "2030-06-01";
  assert.equal(await api.restoreRecord(undo), false);
  assert.equal(restores, 0);
  elements[1].value = "2029-06-01";
  elements[1].isConnected = false;
  assert.equal(await api.restoreRecord(undo), false);
  assert.equal(restores, 0);
  elements[1].isConnected = true;
  assert.equal(await api.restoreRecord(undo), true);
  assert.deepEqual(elements.map(element => element.value), ["2020-09-01", "2024-06-01"]);
});
