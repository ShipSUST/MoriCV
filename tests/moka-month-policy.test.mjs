import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/content/fill.js", import.meta.url), "utf8");
const start = source.indexOf("  function mokaMonthRangeState(");
const end = source.indexOf("  async function recordMokaWrite(", start);
const dateHelpers = source.slice(source.indexOf("  const DATE_MONTH_NAMES ="), source.indexOf("  function isZhaopinPage("));
const control = (shown = "", value = "") => ({
  type: "text", shown, value,
  closest: () => ({ querySelector: () => ({}) })
});
const writes = [];
const policy = vm.runInNewContext(`${dateHelpers}\n${source.slice(start, end)}; ({ mokaMonthRangeState, fillMokaMonthRange })`, {
  mokaControls: (row) => row,
  getCurrentValue: (element) => element?.value || element?.shown || "",
  recordMokaWrite: async (report, element, value, label, id, settings, candidates, path, force) => {
    writes.push({ value, label, force }); element.shown = value;
    // The real widget may reset its month display when its year is selected.
    if (element.month) element.month.shown = "1";
  }
});

const valueStart = source.indexOf("  function getCurrentValue(");
const valueEnd = source.indexOf("  // 组合框的显示层", valueStart);
const valuePolicy = vm.runInNewContext(`${source.slice(valueStart, valueEnd)}; getCurrentValue`, {
  job51: null,
  isSeyondRecordControl:()=>false,
  HTMLSelectElement: class {}, compactText: (text) => String(text || '').trim(), isChinalifeRadioGroup: () => false, isChinalifeZhiyePage: () => false
});
test("Moka selected display, not its search query, is the authoritative readback", () => {
  const input = { value: "9", closest: () => ({ querySelector: () => ({ textContent: "1" }) }) };
  assert.equal(valuePolicy(input), "1");
  input.closest = () => ({ querySelector: () => ({ textContent: "" }) });
  assert.equal(valuePolicy(input), "");
});

test("generic searchable select also reads the committed display before its query", () => {
  const selected = { textContent: "已选示例" };
  const input = { value: "查询文字", getAttribute: () => "combobox", closest: (selector) => selector.includes('sd-Select') ? null : { querySelector: () => selected } };
  assert.equal(valuePolicy(input), "已选示例");
  selected.textContent = "";
  assert.equal(valuePolicy(input), "", "an uncommitted query is not a selection");
});

test("display-only default January is empty only while its year is unselected", () => {
  const row = [control(), control("1"), control("2024"), control("1")];
  assert.equal(JSON.stringify(policy.mokaMonthRangeState(row, "就读时间").values), JSON.stringify(["", "", "2024", "1"]));
  row[1].shown = "9";
  assert.equal(policy.mokaMonthRangeState(row, "就读时间").values[1], "9");
  row[1].shown = "1"; row[1].value = "1";
  assert.equal(policy.mokaMonthRangeState(row, "就读时间").values[1], "1");
});

test("year initialization cannot turn a previously empty month into an overwrite skip", async () => {
  writes.length = 0;
  const row = [control(), control("1"), control(), control("1")];
  row[0].month = row[1]; row[2].month = row[3];
  await policy.fillMokaMonthRange(row, "就读时间", { id: "anonymous", start: "2024-09", end: "2027-06" }, {}, { skipped: [] });
  assert.deepEqual(writes.map(({ value, force }) => ({ value, force })), [
    { value: "2024", force: false }, { value: "9", force: true },
    { value: "2027", force: false }, { value: "6", force: true }
  ]);
});

test("complete existing January never receives implicit force", async () => {
  writes.length = 0;
  await policy.fillMokaMonthRange([control("2024"), control("1")], "就读时间", { id: "anonymous", start: "2024-09" }, {}, { skipped: [] });
  assert.equal(writes[1].force, false);
});
