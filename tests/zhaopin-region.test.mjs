import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/content/fill.js", import.meta.url), "utf8");
const drivers = source.slice(source.indexOf("  function controlledChoicePanel("), source.indexOf("  async function chooseElementDay("));
const exact = source.slice(source.indexOf("  function exactOption("), source.indexOf("  function chooseNativeSelect("));
const retain = source.slice(source.indexOf("  function retainFailedScalarWrite("), source.indexOf("  async function writeField("));

function region({ before = "", rewrite = [], clearFails = false, disabled = false, ambiguous = false, unrelated = false } = {}) {
  const failures = new WeakMap(), unconfirmed = new WeakSet();
  let open = false, commits = 0;
  const labels = ["Region-A", "City (B)"];
  const selected = [];
  const clear = { disabled: false, click() { if (!clearFails) input.value = ""; }, visible: true };
  const host = { dispatchEvent() {}, querySelectorAll() { return [clear]; } };
  const input = {
    value: before, isConnected: true, focus() {}, blur() {},
    closest() { return host; }, getAttribute() { return "owned-region"; },
    click() { open = true; selected.length = 0; },
    dispatchEvent(event) { if (event.key === "Escape") open = false; }
  };
  const lists = labels.map((label, index) => ({
    visible: true,
    querySelectorAll() {
      const make = () => ({ textContent: label, visible: true, disabled,
        getAttribute() { return null; }, click() { selected[index] = label; } });
      return ambiguous ? [make(), make()] : [make()];
    }
  }));
  const confirm = { textContent: "确认", visible: true, disabled: false, click() {
    input.value = rewrite[commits++] ?? selected.join("/"); open = false;
  } };
  const panel = { matches() { return true; }, get visible() { return open; },
    querySelectorAll(selector) { return selector === "button" ? [confirm] : lists; } };
  const stranger = { ...panel, visible: true };
  const context = {
    document: { getElementById() { return unrelated ? null : panel; }, querySelectorAll() { return unrelated ? [stranger] : open ? [panel] : []; } },
    isVisible: node => Boolean(node?.visible), isZhaopinPage: () => true,
    getCurrentValue: element => element.value,
    compactText: text => String(text || "").trim().replace(/\s+/g, " "),
    controlFailures: failures, unconfirmedScalarWrites: unconfirmed,
    core: { normalize: value => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") },
    wait: async () => {}, waitUntil: async predicate => predicate() || null,
    KeyboardEvent: class { constructor(type, values) { Object.assign(this, { type }, values); } },
    MouseEvent: class {},
  };
  const api = vm.runInNewContext(`${exact}\n${drivers}\n${retain}; ({chooseZhaopinRegion,retainFailedScalarWrite});`, context);
  const entry = { value: labels.join("/"), pathValues: labels.map(label => [label]) };
  return { api, input, entry, failures, unconfirmed, get commits() { return commits; } };
}

test("a rewritten region is rejected and an originally empty selection is restored", async () => {
  const h = region({ rewrite: ["RegionA/City B"] });
  assert.equal(await h.api.chooseZhaopinRegion(h.input, h.entry), false);
  assert.equal(h.input.value, "");
  assert.equal(h.unconfirmed.has(h.input), false);
});

test("a wrong region commit restores the original nonempty region through its own control", async () => {
  const h = region({ before: "Region-A/City (B)", rewrite: ["Unexpected"] });
  assert.equal(await h.api.chooseZhaopinRegion(h.input, h.entry), false);
  assert.equal(h.input.value, "Region-A/City (B)");
  assert.equal(h.commits, 2);
  assert.equal(h.unconfirmed.has(h.input), false);
});

test("incomplete region recovery keeps a failed write eligible for undo", async () => {
  const h = region({ rewrite: ["Unexpected"], clearFails: true });
  assert.equal(await h.api.chooseZhaopinRegion(h.input, h.entry), false);
  const transaction = [];
  h.api.retainFailedScalarWrite(transaction, { element: h.input, value: "" });
  assert.equal(transaction.length, 1);
  assert.match(h.failures.get(h.input), /恢复未完成/);
});

test("region readback accepts hierarchy separator formatting while preserving label punctuation", async () => {
  const h = region({ rewrite: ["Region-A > City (B)"] });
  assert.equal(await h.api.chooseZhaopinRegion(h.input, h.entry), true);
  assert.equal(h.commits, 1);
});

test("region selection never uses an unrelated modal or disabled and ambiguous options", async () => {
  for (const options of [{ unrelated: true }, { disabled: true }, { ambiguous: true }]) {
    const h = region(options);
    assert.equal(await h.api.chooseZhaopinRegion(h.input, h.entry), false);
    assert.equal(h.commits, 0);
    assert.equal(h.input.value, "");
  }
});
