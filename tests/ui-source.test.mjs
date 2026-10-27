import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (name) => readFile(new URL(`../src/${name}`, import.meta.url), "utf8");

test("settings UI hides internal ids and removes per-entry autofill controls", async () => {
  const [html, script, storage] = await Promise.all([
    source("options.html"),
    source("options.js"),
    source("shared/storage.js")
  ]);
  assert.doesNotMatch(html, /结构化记录 JSON|structured-records|edit-card-id/);
  assert.doesNotMatch(script, /加入一键填写|entry\.autofill/);
  assert.match(storage, /FIXED_FIELDS/);
  assert.doesNotMatch(html, /id="add-entry"/);
  assert.doesNotMatch(script, /categorySelectFor|changeDraftCategory/);
  assert.doesNotMatch(script, /RECORD_GROUPS/);
  assert.match(script, /RECORD_SCHEMAS/);
  assert.match(script, /fieldAliases/);
  assert.match(script, /fieldOptions/);
});

test("side panel exposes fill actions for structured summaries and child fields", async () => {
  const [script, fillScript] = await Promise.all([source("sidepanel.js"), source("content/fill.js")]);
  assert.doesNotMatch(script, /entry\.structured\)\s*fill\.hidden/);
  assert.match(script, /展开分字段/);
  assert.match(script, /record-child-list/);
  assert.match(script, /marker\.textContent = "✓"/);
  assert.match(script, /copy\.textContent = "复制已有"/);
  assert.match(script, /正在处理 \$\{index \+ 1\}\/\$\{total\}/);
  assert.match(script, /runCommand\("fillRecord"/);
  assert.doesNotMatch(fillScript, /BATCH_LIMIT|slice\(0,\s*10\)/);
});
