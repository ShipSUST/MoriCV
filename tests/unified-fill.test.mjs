import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/content/fill.js", import.meta.url), "utf8");
const start = source.indexOf("  async function fillUnified(");
const end = source.indexOf("  chrome.runtime.onMessage", start);

function harness() {
  const calls = [];
  const fill = vm.runInNewContext(`let lastTransaction = []; ${source.slice(start, end)}; fillUnified`, {
    GENERIC_REPEAT_SCHEMAS: ["educations", "projects", "awards"].map(key => ({ key })),
    fillFlatEntries: async () => { calls.push("flat"); return { filled: [{ entryId: "flat" }] }; },
    fillCollection: async (profile, settings, collection, reset) => {
      calls.push({ collection, reset });
      return { filled: [{ entryId: collection }], plannedRecords: { [collection]: profile.records[collection].length } };
    },
    collectionResult: report => report
  });
  return { calls, fill };
}

test("whole page fills canonical collections once and never treats derived award views as user records", async () => {
  const h = harness();
  const records = { educations: [{ id: "education" }], awards: [{ id: "award" }], competitions: [{ id: "award" }], honors: [{ id: "award" }] };
  const report = await h.fill({ entries: [], records }, {}, "all", true);
  assert.deepEqual(h.calls, ["flat", { collection: "educations", reset: false }, { collection: "awards", reset: false }]);
  assert.equal(report.filled.length, 3);
  assert.equal(report.plannedRecords.awards, 1);
});

test("structured segment keeps a shared transaction and uses the same collection core", async () => {
  const h = harness();
  await h.fill({ entries: [], records: { projects: [{ id: "project" }] } }, {}, "projects", false);
  assert.deepEqual(h.calls, [{ collection: "projects", reset: false }]);
  await assert.rejects(() => h.fill({ entries: [], records: {} }, {}, "invalid"), /未知填写区块/);
});
