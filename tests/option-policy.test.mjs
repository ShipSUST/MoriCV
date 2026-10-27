import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../src/content/fill.js", import.meta.url), "utf8");
const start = source.indexOf("  function exactOption(");
const end = source.indexOf("  function wait(ms)", start);
let edits = 0;
const policy = vm.runInNewContext(`${source.slice(start, end)}; ({exactOption, chooseNativeSelect})`, {
  targetValues: (entry) => [entry.value, ...(entry.optionValues || [])],
  dispatchEditEvents: () => edits++,
  getCurrentValue: (element) => element.options.find((option) => option.value === element.value)?.textContent,
  normalizedValueMatches: (actual, expected) => actual === expected
});
const option = (text, value = text, extra = {}) => ({ textContent: text, value, getAttribute: () => null, ...extra });
test("native dropdown prioritizes main value over earlier DOM candidates", () => {
  edits = 0;
  const select = { options: [option("硕士"), option("硕士研究生")] };
  assert.equal(policy.chooseNativeSelect(select, { value: "硕士研究生", optionValues: ["硕士"] }), true);
  assert.equal(select.value, "硕士研究生");
  assert.equal(edits, 1);
});
test("native dropdown respects ordered user alternatives without substring inference", () => {
  const select = { options: [option("硕士"), option("研究生")] };
  assert.equal(policy.chooseNativeSelect(select, { value: "硕士研究生", optionValues: ["研究生", "硕士"] }), true);
  assert.equal(select.value, "研究生");
  assert.equal(policy.chooseNativeSelect({ options: [option("硕士")] }, { value: "硕士研究生" }), false);
});
test("disabled and ambiguous exact options never cause a selection", () => {
  assert.equal(policy.exactOption([option(" A ", "1"), option("a", "2")], "a"), null);
  assert.equal(policy.exactOption([option("A", "1", { disabled: true })], "A"), null);
  assert.equal(policy.exactOption([option("A", "1", { className: "option-disabled" })], "A"), null);
  assert.equal(policy.exactOption([option(" A ", "1")], "a").value, "1");
});

test("nested text nodes of one option are not treated as two alternatives", () => {
  const leaf = option("硕士");
  const parent = option("硕士", "parent", { contains: (node) => node === leaf });
  assert.equal(policy.exactOption([parent, leaf], "硕士"), leaf);
  assert.equal(policy.exactOption([parent, leaf, option("硕士", "other")], "硕士"), null);
});
