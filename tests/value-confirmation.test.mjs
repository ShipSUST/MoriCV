import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/content/fill.js", import.meta.url), "utf8");
const start = source.indexOf("  function normalizedValueMatches(");
const end = source.indexOf("  function targetValues(", start);
const matches = vm.runInNewContext(`${source.slice(start, end)}; normalizedValueMatches`);

test("readback confirmation never accepts a substring or a truncated date", () => {
  assert.equal(matches("硕士", "硕士研究生"), false);
  assert.equal(matches("2024", "2024-09"), false);
  assert.equal(matches("2024-01", "2024-10"), false);
  assert.equal(matches("示例大学 分校", "示例大学"), false);
  assert.equal(matches("", ""), false);
});

test("readback allows only whitespace and English case normalization", () => {
  assert.equal(matches("  Example   University ", "example university"), true);
  assert.equal(matches("C++", "C"), false);
  assert.equal(matches("2024/09", "2024-09"), false);
});
