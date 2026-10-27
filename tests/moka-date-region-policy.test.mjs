import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/content/fill.js", import.meta.url), "utf8");
const helpers = source.slice(source.indexOf("  const DATE_MONTH_NAMES ="), source.indexOf("  function isZhaopinPage("));
const drivers = source.slice(source.indexOf("  function isMokaDayPicker("), source.indexOf("  async function recordMokaWrite("));

class Node {
  constructor(tag = "div", className = "", text = "") {
    this.tagName = tag; this.className = className; this.text = text; this.children = []; this.attrs = {};
    this.hidden = false; this.value = ""; this.clicks = 0; this.readOnly = false; this.placeholder = "";
  }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(""); }
  get innerText() { return this.textContent; }
  get isConnected() { return true; }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  getAttribute(key) { return this.attrs[key] || null; }
  matches(selector) {
    return selector.split(",").some(raw => {
      const part = raw.trim();
      if (part.startsWith(".")) return this.className.split(" ").includes(part.slice(1));
      const contains = /^\[class\*=([^\]]+)\]$/.exec(part);
      if (contains) return this.className.includes(contains[1].replace(/^['"]|['"]$/g, ""));
      const attr = /^\[([^=\]]+)(?:=([^\]]+))?\]$/.exec(part);
      if (attr) return attr[1] === "disabled" ? Boolean(this.disabled) : attr[2] ? this.attrs[attr[1]] === attr[2].replace(/^['"]|['"]$/g, "") : this.attrs[attr[1]] !== undefined;
      return this.tagName === part;
    });
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  click() { this.clicks += 1; this.onClick?.(); }
  focus() {}
  dispatchEvent(event) { this.onEvent?.(event); }
}

const visible = node => Boolean(node) && !node.hidden && (!node.parentElement || visible(node.parentElement));
function harness() {
  const roots = [], failures = new WeakMap(), notes = new WeakMap(), unconfirmed = new WeakSet(), optionCalls = [], writes = [];
  const document = { activeElement: null, querySelectorAll: selector => roots.flatMap(root => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)]) };
  const context = {
    document, controlFailures: failures, datePrecisionNotes: notes, unconfirmedScalarWrites: unconfirmed,
    compactText: text => String(text || "").trim().replace(/\s+/g, " "), isVisible: visible,
    wait: async () => {}, waitUntil: async predicate => { for (let i = 0; i < 12; i += 1) { const result = predicate(); if (result) return result; await Promise.resolve(); } return null; },
    exactOption: (options, value, text = option => option.innerText || option.textContent) => {
      const matches = options.filter(option => String(text(option)).trim().toLowerCase() === String(value).trim().toLowerCase());
      return matches.length === 1 ? matches[0] : null;
    },
    getCurrentValue: element => element?.value || element?.shown || "", captureFieldState: ({ element }) => ({ element, value: element.value }), highlight() {},
    clearControlledDate: async element => {
      const clear = element.closest("[class*=sd-Dropdown-container]")?.querySelectorAll(".sd-Input-clear-icon-local").filter(node => visible(node) && !node.disabled) || [];
      if (clear.length !== 1) return false;
      clear[0].click(); return !element.value;
    },
    chooseMokaOption: async (element, values) => { optionCalls.push([...values]); element.value = values[1] || values[0]; return true; },
    writeScalarValue: async (element, value) => { element.value = value; return { success: true }; },
    mokaControls: controls => controls, optionSelected: control => Boolean(control.checked), captureChoiceState: () => ({}), cssLocator: () => "anonymous",
    recordMokaWrite: async (report, element, value, label, id, settings, candidates, path, force) => {
      writes.push({ value, label, candidates: [...candidates], force }); element.shown = value;
      if (element.month) element.month.shown = "1";
    },
    KeyboardEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } }
  };
  const api = vm.runInNewContext(`${helpers}\n${drivers}; ({ isMokaMonthPicker, isMokaRegionControl, chooseMokaMonth, chooseMokaDay, chooseMokaPath, restoreMokaRegionValue, writeMokaValue, fillMokaMonthRange })`, context);
  return { api, roots, document, failures, notes, unconfirmed, optionCalls, writes };
}

function monthWidget(h, { open = true, year = 2026, disabledMonth = 0, stoppedYear = false, portal = false, wrongCommits = 0, cannotClear = false } = {}) {
  const wrapper = new Node("div", "sd-Dropdown-container-test"), input = new Node("input"), popup = new Node("div", "sd-Dropdown-dropdown-test"), panel = new Node("div", "sd-panal-menu-wrapper-test");
  input.readOnly = true; input.placeholder = "出生日期 (年龄)"; popup.hidden = !open;
  const clear = new Node("span", "sd-Input-clear-icon-local"); clear.disabled = cannotClear;
  clear.onClick = () => { input.value = ""; popup.hidden = true; };
  wrapper.append(input, clear); popup.append(panel); if (!portal) wrapper.append(popup);
  h.roots.push(wrapper); if (portal && open) h.roots.push(popup);
  const render = () => {
    const header = new Node("span", "sd-basic-selector-year-test", String(year));
    const prev = new Node("span", "sd-basic-prev-icon-test"), next = new Node("span", "sd-basic-next-icon-test");
    prev.onClick = () => { if (!stoppedYear) { year -= 1; render(); } };
    next.onClick = () => { if (!stoppedYear) { year += 1; render(); } };
    const names = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    const months = names.map((name, index) => {
      const month = new Node("div", "sd-basic-year-item-test", name);
      month.disabled = index + 1 === disabledMonth;
      month.onClick = () => {
        const chosenMonth = wrongCommits > 0 ? (index + 1) % 12 + 1 : index + 1;
        if (wrongCommits > 0) wrongCommits -= 1;
        input.value = `${year}-${String(chosenMonth).padStart(2, "0")}-01`; popup.hidden = true;
      };
      return month;
    });
    panel.replaceChildren(header, prev, next, ...months);
  };
  input.onClick = () => { popup.hidden = !popup.hidden; if (portal && !h.roots.includes(popup)) h.roots.push(popup); };
  render(); return { wrapper, input, popup, panel, clear };
}

function regionWidget(h, { open = true, missing = -1, ambiguous = false, deferred = false, values = ["虚构省", "示例市", "测试县"] } = {}) {
  const wrapper = new Node("div", "sd-Dropdown-container-test"), input = new Node("input"), popup = new Node("div", "sd-Dropdown-dropdown-test"), page = new Node("div", "page-container");
  input.placeholder = "请输入籍贯"; input.readOnly = true; popup.hidden = !open; wrapper.append(input); h.roots.push(wrapper);
  const chosen = [], tabs = ["省份", "城市", "县区"].map(text => new Node("span", "tab-test", text));
  const activate = level => {
    tabs.forEach((tab, index) => { tab.attrs["aria-selected"] = index === level ? "true" : "false"; });
    const option = new Node("span", "sd-Tag-container-test", level === missing ? "其他选项" : values[level]);
    option.onClick = () => { chosen[level] = values[level]; if (level === 2) { input.value = chosen.join("/"); popup.hidden = true; } };
    const replacement = [option];
    if (ambiguous && level === 0) replacement.push(new Node("span", "sd-Tag-container-test", values[level]));
    if (deferred) Promise.resolve().then(() => page.replaceChildren(...replacement));
    else page.replaceChildren(...replacement);
  };
  tabs.forEach((tab, level) => { tab.onClick = () => activate(level); });
  popup.append(...tabs, page); activate(0);
  input.onClick = () => { if (!wrapper.children.includes(popup)) wrapper.append(popup); popup.hidden = !popup.hidden; };
  input.onEvent = event => { if (event.key === "Escape") popup.hidden = true; };
  if (open) wrapper.append(popup);
  return { wrapper, input, popup, chosen, values };
}

test("Moka birthday month panel reuses an open popup and accepts slash dates across years", async () => {
  const h = harness(), widget = monthWidget(h);
  assert.equal(h.api.isMokaMonthPicker(widget.input), true);
  assert.equal(await h.api.chooseMokaMonth(widget.input, "1998/6/20"), true);
  assert.equal(widget.input.value, "1998-06-01");
  assert.equal(widget.input.clicks, 0);
  assert.equal(h.notes.get(widget.input), "网站仅支持年月，已按年月填写");
});

test("month parsing and path mismatches stop before touching the picker", async () => {
  for (const [value, path] of [["2023-02-30", []], ["2020-09-05", [["2021"], ["9"]]]]) {
    const h = harness(), widget = monthWidget(h, { open: false });
    assert.equal(await h.api.chooseMokaMonth(widget.input, value, path), false);
    assert.equal(widget.input.clicks, 0); assert.equal(widget.input.value, "");
    assert.match(h.failures.get(widget.input), /无效|不存在|不一致/);
  }
});

test("month-only widgets validate the source path and refuse disabled or stalled navigation", async () => {
  const h = harness(), widget = monthWidget(h, { open: false });
  assert.equal(await h.api.chooseMokaMonth(widget.input, "2026-06-20", [["2026年"], ["六月"], ["20日"]]), true);
  assert.equal(await h.api.chooseMokaMonth(widget.input, "2026-06-20", [["2026年"], ["六月"], ["1日"]]), false);
  for (const options of [{ disabledMonth: 6 }, { stoppedYear: true }]) {
    const blocked = harness(), control = monthWidget(blocked, options);
    assert.equal(await blocked.api.chooseMokaMonth(control.input, options.stoppedYear ? "2025-06-20" : "2026-06-20"), false);
    assert.equal(control.input.value, "");
  }
});

test("a newly opened portaled date panel is associated with its input instead of another popup", async () => {
  const h = harness(), other = monthWidget(h, { year: 2000 }), widget = monthWidget(h, { portal: true, open: false });
  assert.equal(await h.api.chooseMokaMonth(widget.input, "2026-02-20"), true);
  assert.equal(other.input.value, ""); assert.equal(other.popup.hidden, false);
  assert.equal(widget.input.value, "2026-02-01");
});

test("month picker refuses an unowned floating date panel even when its input has focus", async () => {
  const h = harness(), foreign = monthWidget(h, { portal: true }), widget = monthWidget(h, { portal: true, open: false });
  h.document.activeElement = widget.input; widget.input.onClick = () => {};
  assert.equal(await h.api.chooseMokaMonth(widget.input, "2026-02-20"), false);
  assert.equal(foreign.input.value, ""); assert.equal(foreign.popup.hidden, false);
});

test("failed month commits restore an existing date or clear an originally blank control", async () => {
  const h = harness(), existing = monthWidget(h, { wrongCommits: 1 }); existing.input.value = "2020-09-01";
  assert.equal(await h.api.chooseMokaMonth(existing.input, "2026-06-20"), false);
  assert.equal(existing.input.value, "2020-09-01"); assert.equal(h.unconfirmed.has(existing.input), false);
  assert.equal(h.notes.has(existing.input), false);
  const blank = monthWidget(h, { wrongCommits: 1 });
  assert.equal(await h.api.chooseMokaMonth(blank.input, "2026-06-20"), false);
  assert.equal(blank.input.value, ""); assert.equal(blank.clear.clicks, 1); assert.equal(h.unconfirmed.has(blank.input), false);
});

test("failed month commits keep a retryable undo marker when real clearing is unavailable", async () => {
  const h = harness(), widget = monthWidget(h, { wrongCommits: 1, cannotClear: true });
  const outcome = await h.api.writeMokaValue(widget.input, "2026-06-20", { overwrite: true });
  assert.equal(outcome.success, false); assert.equal(outcome.needsUndo, true);
  assert.equal(h.unconfirmed.has(widget.input), true); assert.match(outcome.reason, /可重试撤销/);
});

test("Moka region tabs use only the active local page without toggling an already open popup", async () => {
  const h = harness(), widget = regionWidget(h, { deferred: true }), other = regionWidget(h);
  await Promise.resolve();
  assert.equal(await h.api.chooseMokaPath(widget.input, widget.values.map(value => [value])), true);
  assert.equal(widget.input.value, widget.values.join("/")); assert.equal(widget.input.clicks, 0);
  assert.equal(other.input.value, ""); assert.deepEqual(other.chosen, []);
});

test("same-name region levels wait for the new option page after an asynchronous tab switch", async () => {
  const h = harness(), widget = regionWidget(h, { deferred: true, values: ["示例区", "示例区", "末级县"] });
  await Promise.resolve();
  assert.equal(await h.api.chooseMokaPath(widget.input, widget.values.map(value => [value])), true);
  assert.deepEqual(widget.chosen, widget.values);
});

test("region undo derives only exact observed old labels and rejects an incomplete or ambiguous prefix", async () => {
  for (const separated of [false, true]) {
    const h = harness(), widget = regionWidget(h); widget.input.value = "待恢复的网页值";
    const old = widget.values.join(separated ? "/" : "");
    assert.equal(await h.api.restoreMokaRegionValue(widget.input, old), true);
    assert.equal(widget.input.value, widget.values.join("/"));
  }
  for (const options of [{}, { ambiguous: true }]) {
    const h = harness(), widget = regionWidget(h, options); widget.input.value = "当前网页值";
    const old = options.ambiguous ? widget.values.join("") : "虚构省未知城市";
    assert.equal(await h.api.restoreMokaRegionValue(widget.input, old), false);
    assert.equal(widget.input.value, "当前网页值"); assert.equal(widget.popup.hidden, true);
  }
});

test("an identified region without a path reports failure and closes its popup", async () => {
  const h = harness(), widget = regionWidget(h);
  const result = await h.api.writeMokaValue(widget.input, "地区主值", { optionValues: ["普通候选"], overwrite: true });
  assert.equal(result.success, false); assert.match(result.reason, /路径/);
  assert.equal(widget.popup.hidden, true); assert.equal(h.optionCalls.length, 0);
});

test("a region rendered only on opening is recognized before choosing its path", async () => {
  const h = harness(), widget = regionWidget(h, { open: false });
  assert.equal(h.api.isMokaRegionControl(widget.input), false);
  const result = await h.api.writeMokaValue(widget.input, "虚构省示例市测试县", { pathValues: widget.values.map(value => [value]), overwrite: true });
  assert.equal(result.success, true); assert.equal(widget.input.clicks, 1);
  assert.equal(h.optionCalls.length, 0);
});

test("missing and ambiguous region levels stop without falling back to ordinary dropdown candidates", async () => {
  for (const options of [{ missing: 1 }, { ambiguous: true }]) {
    const h = harness(), widget = regionWidget(h, options);
    const result = await h.api.writeMokaValue(widget.input, "资料地区", { pathValues: widget.values.map(value => [value]), optionValues: ["普通备选"], overwrite: true });
    assert.equal(result.success, false); assert.equal(widget.input.value, ""); assert.equal(h.optionCalls.length, 0);
    assert.match(result.reason, options.missing === 1 ? /第 2 级/ : /第 1 级/);
    assert.equal(widget.chosen.length, options.missing === 1 ? 1 : 0);
  }
});

test("ordinary Moka dropdowns keep primary and ordered candidates despite configured paths", async () => {
  const h = harness(), wrapper = new Node("div", "sd-Dropdown-container-test"), input = new Node("input"), popup = new Node("div", "sd-Dropdown-dropdown-test");
  popup.append(new Node("span", "sd-Tag-container-test", "普通候选")); popup.hidden = true; wrapper.append(input, popup); h.roots.push(wrapper);
  input.onClick = () => { popup.hidden = !popup.hidden; }; input.onEvent = event => { if (event.key === "Escape") popup.hidden = true; };
  const result = await h.api.writeMokaValue(input, "主值", { optionValues: ["普通候选"], pathValues: [["无关路径"]], overwrite: true });
  assert.equal(result.success, true); assert.deepEqual(h.optionCalls, [["主值", "普通候选"]]);
});

test("split year/month fields validate independent paths while keeping the January protection", async () => {
  const h = harness();
  const control = (shown = "") => ({ type: "text", value: "", shown, closest: () => ({ querySelector: () => ({}) }) });
  const row = [control(), control("1"), control(), control("1")]; row[0].month = row[1]; row[2].month = row[3];
  const report = { skipped: [] };
  await h.api.fillMokaMonthRange(row, "起止时间", { id: "anonymous", start: "2024/9/5", end: "2025/6/20", fieldPaths: { start: [["2024年"], ["9月"]], end: [["2025"], ["六月"]] } }, {}, report);
  assert.deepEqual(h.writes.map(({ value, force }) => ({ value, force })), [
    { value: "2024", force: false }, { value: "9", force: true }, { value: "2025", force: false }, { value: "6", force: true }
  ]);
  assert.ok(h.writes[1].candidates.includes("9月")); assert.equal(report.skipped.length, 0);
  const mismatch = { skipped: [] }; h.writes.length = 0;
  await h.api.fillMokaMonthRange(row, "起止时间", { id: "anonymous", start: "2024-09", fieldPaths: { start: [["2023"], ["9"]] } }, {}, mismatch);
  assert.equal(h.writes.length, 0); assert.match(mismatch.skipped[0].reason, /不一致/);
});

test("a typed date child writes only the exact year or month layer in a confirmed Moka time field", async () => {
  for (const [placeholder, expected, note] of [["年", "2024年", /年份/], ["月", "09", /月份/]]) {
    const h = harness(), field = new Node("div", "apply-field-test"), select = new Node("div", "sd-Select-container-test"), input = new Node("input");
    input.placeholder = placeholder; field.append(new Node("div", "title-test", "就读时间"), select); select.append(input); h.roots.push(field);
    const result = await h.api.writeMokaValue(input, "2024/9/5", { fieldType: "date", pathValues: [["2024年"], ["9月"]], overwrite: true });
    assert.equal(result.success, true); assert.equal(input.value, expected); assert.match(result.note, note);
    assert.equal(h.optionCalls.length, 1); assert.equal(h.optionCalls[0].some(candidate => candidate.includes("/")), false);
    const clicks = h.optionCalls.length;
    const mismatch = await h.api.writeMokaValue(input, "2024-09-05", { fieldType: "date", pathValues: [["2023"], ["9"]], overwrite: true });
    assert.equal(mismatch.success, false); assert.equal(h.optionCalls.length, clicks); assert.match(mismatch.reason, /不一致/);
    const unchanged = await h.api.writeMokaValue(input, "2024-09-05", { fieldType: "date" });
    assert.equal(unchanged.success, true); assert.equal(unchanged.unchanged, true);
  }
});

test("typed record dates reject contradictory paths before opening and never probe a region", async () => {
  const h = harness(), widget = monthWidget(h, { open: false });
  const result = await h.api.writeMokaValue(widget.input, "2024-09-05", {
    fieldType: "date", pathValues: [["2024"], ["9"], ["6"]], overwrite: true
  });
  assert.equal(result.success, false); assert.match(result.reason, /不一致/);
  assert.equal(widget.input.clicks, 0); assert.equal(widget.input.value, "");
  const region = regionWidget(h, { open: false });
  const unknown = await h.api.writeMokaValue(region.input, "2024-09-05", {
    fieldType: "date", pathValues: [["2024"], ["9"], ["5"]], overwrite: true
  });
  assert.equal(unknown.success, true); assert.equal(region.input.clicks, 0);
  assert.deepEqual(region.chosen, []); assert.deepEqual(h.optionCalls, [["2024-09-05"]]);
});
