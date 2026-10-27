import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PROFILE } from "../src/data/default-profile.js";
import { CATEGORY_SCHEMA } from "../src/shared/schema.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function walk(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...await walk(target)); else files.push(target);
  }
  return files;
}
const source = await walk(path.join(root, "src"));
const built = await walk(path.join(root, "dist"));
const relative = (file, base) => path.relative(path.join(root, base), file).replaceAll("\\", "/");
assert.deepEqual(built.map(file => relative(file, "dist")).sort(), source.map(file => relative(file, "src")).sort(), "dist contains missing or extra files");
for (const file of source) {
  const name = relative(file, "src");
  assert.ok(!/local-profile-data|test-results|pre-v\d|backup|\.zip$|mori-cv-profile\.json$/i.test(name), "Private files, backups or evidence cannot ship");
  const contents = await readFile(file);
  assert.equal(createHash("sha256").update(contents).digest("hex"), createHash("sha256").update(await readFile(path.join(root, "dist", name))).digest("hex"), `Built file differs: ${name}`);
}
// All data-carrying default properties, including any future additions, are
// checked by scripts/check.mjs. Here also inspect the built template itself.
const builtDefault = await import(new URL("../dist/data/default-profile.js", import.meta.url));
assert.deepEqual(builtDefault.DEFAULT_PROFILE, DEFAULT_PROFILE);
assert.ok(DEFAULT_PROFILE.entries.every(entry => !entry.value && !(entry.optionValues || []).length && !(entry.pathValues || []).length));
assert.ok(Object.values(DEFAULT_PROFILE.records).every(records => records.length === 0));

// Read-only local comparison; never emit the private strings or copy the JSON.
// Short generic enums, ordinary dates and template labels are not personal
// identifiers. Inspect every carrier, and scan high-signal values separately.
const privatePath = path.join(root, "local-profile-data", "mori-cv-profile.json");
let privateProfile;
try { privateProfile = JSON.parse(await readFile(privatePath, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const tokens = new Map(); let inspectedCarriers = 0;
const templateStrings = new Set();
function collectTemplateStrings(value) {
  if (typeof value === "string") templateStrings.add(value);
  else if (Array.isArray(value)) value.forEach(collectTemplateStrings);
  else if (value && typeof value === "object") Object.values(value).forEach(collectTemplateStrings);
}
collectTemplateStrings(CATEGORY_SCHEMA);
// Reviewed public field vocabulary also used by the site adapters, not user
// identity or record values. Keep this explicit rather than excluding aliases.
for (const alias of ["education level", "education type", "field of study", "graduation date"]) templateStrings.add(alias);
for (const entry of DEFAULT_PROFILE.entries) collectTemplateStrings(Object.fromEntries(Object.entries(entry).filter(([key]) => !["value", "optionValues", "pathValues"].includes(key))));
const publicTechnology = new Set(["C", "C++", "C/C++", "Python", "Java", "JavaScript", "TypeScript", "MATLAB", "Matlab", "Linux", "SQL", "MySQL", "Git", "CET-4", "CET-6", "大学英语四级", "大学英语六级"]);
function inspect(value, reference, identity = false) {
  if (typeof value === "string") {
    inspectedCarriers++;
    const text = value.trim();
    if (text && !templateStrings.has(text) && !publicTechnology.has(text) && (identity || text.length >= 12)) tokens.set(text, reference);
  } else if (Array.isArray(value)) value.forEach((item, index) => inspect(item, `${reference}[${index}]`, identity));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => inspect(item, `${reference}.${key}`, identity));
}
for (const [index, entry] of (privateProfile?.entries || []).entries()) {
  const identity = /(?:^basic\.(?:name|family_name|given_name|birth_date|id_card)|contact\.(?:phone|email|address)|location\.(?:home|native_place|household))$/.test(entry.id || "");
  for (const [key, value] of Object.entries(entry)) {
    if (!["id", "category", "label", "type", "format", "multi"].includes(key)) inspect(value, `entries[${index}].${key}`, identity && key === "value");
  }
}
for (const [collection, records] of Object.entries(privateProfile?.records || {})) {
  records.forEach((record, index) => {
    for (const [key, value] of Object.entries(record)) {
      const namedRecord = !["programmingLanguages", "foreignLanguages", "certifications"].includes(collection);
      if (key !== "id") inspect(value, `records.${collection}[${index}].${key}`, ["school", "college", "company", "employer", "advisor"].includes(key) || (namedRecord && key === "name"));
    }
  });
}
inspect(privateProfile?.recordTemplates, "recordTemplates");
const tests = await walk(path.join(root, "tests"));
const fixtures = tests.filter(file => /\.html$|-scenarios\.js$/.test(file));
const scripts = await walk(path.join(root, "scripts"));
// Include unit tests and development helpers: a private denial-list literal
// inside a test leaks just as much as a value inside a runtime fixture.
const publicDocuments = ["README.md", "LICENSE", "package.json", "GLOSSARY.md", "docs/category-modules.md", "docs/DEVELOPMENT.md"].map(name => path.join(root, name));
const releaseFiles = [...new Set([...source, ...built, ...tests, ...scripts, ...publicDocuments])];
const findings = [];
for (const file of releaseFiles) {
  const contents = await readFile(file, "utf8");
  for (const [token, reference] of tokens) {
    const match = token.length < 3
      ? contents.includes(JSON.stringify(token)) || contents.includes(`'${token}'`) || contents.includes(`>${token}<`)
      : contents.includes(token);
    if (match) findings.push({ file: path.relative(root, file), reference });
  }
}
console.log(JSON.stringify({ filesInSource: source.length, filesInDist: built.length, fixtureFiles: fixtures.length, totalReleaseFilesScanned: releaseFiles.length, defaultAndBuiltTemplate: "blank and identical", privateComparison: privateProfile ? "performed" : "unavailable", inspectedCarriers, highSignalTokens: tokens.size, findingCount: findings.length, findings: findings.slice(0, 25) }, null, 2));
assert.equal(findings.length, 0, "Potential private-data overlap requires review; values are intentionally not printed");
