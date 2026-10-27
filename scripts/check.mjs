import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PROFILE } from "../src/data/default-profile.js";
import { ordinaryEntryTemplates } from "../src/shared/categories/templates.js";
import { checkCategoryRuntime } from './category-runtime.mjs';

await checkCategoryRuntime();

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "src");

async function walk(directory) {
  const output = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, item.name);
    if (item.isDirectory()) output.push(...await walk(fullPath));
    else output.push(fullPath);
  }
  return output;
}

const files = await walk(sourceRoot);
const jsFiles = files.filter((file) => file.endsWith(".js"));

const manifest = JSON.parse(await readFile(path.join(sourceRoot, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("manifest_version 必须为 3。");
const packageMetadata = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(manifest.version) || manifest.version !== packageMetadata.version) {
  throw new Error("Manifest 必须使用三段版本号，并与 package.json 一致。");
}
const allowedHostOrigins = new Set(["http://*/*", "https://*/*"]);
for (const origin of manifest.host_permissions || []) {
  if (!allowedHostOrigins.has(origin)) throw new Error(`发现未批准的网站权限：${origin}`);
}
if (!allowedHostOrigins.size || ![...allowedHostOrigins].every((origin) => manifest.host_permissions?.includes(origin))) {
  throw new Error("必须声明普通 HTTP/HTTPS 网页的默认访问权限。");
}
if (manifest.optional_host_permissions?.length) throw new Error("默认全站授权模式不应再声明可选网站权限。");
if (manifest.permissions.includes("<all_urls>")) throw new Error("<all_urls> 不应放入 permissions。");
for (const forbidden of ["cookies", "history", "webRequest", "debugger", "clipboardRead"]) {
  if (manifest.permissions.includes(forbidden)) throw new Error(`发现禁止权限：${forbidden}`);
}

if (DEFAULT_PROFILE.entries.length) {
  throw new Error("默认个人资料必须没有普通词条。");
}
if (DEFAULT_PROFILE.schemaVersion !== 9) {
  throw new Error("默认资料模板必须使用 schema v9。");
}
if (DEFAULT_PROFILE.entries.some((entry) => Object.hasOwn(entry, "autofill") || Object.hasOwn(entry, "batchAutofill"))) {
  throw new Error("默认资料中不应保留逐条 autofill 开关。");
}
if (DEFAULT_PROFILE.entries.some((entry) => Object.hasOwn(entry, "siteAliases"))) {
  throw new Error("默认资料中不应混入网站专属别名。");
}
if (Object.values(DEFAULT_PROFILE.records).some((records) => records.length)) {
  throw new Error("默认资料模板包含结构化个人经历。");
}
if (DEFAULT_PROFILE.entries.some((entry) => entry.id.startsWith("project.") || entry.id.startsWith("paper."))) {
  throw new Error("默认资料模板包含个人项目或论文条目。");
}
if (DEFAULT_PROFILE.entries.some((entry) => ["附件路径", "其他"].includes(entry.category))) {
  throw new Error("默认资料模板不应包含附件路径或其他分类。");
}
if (DEFAULT_PROFILE.entries.some((entry) => (entry.pathValues || []).some((value) => String(value).trim()))) {
  throw new Error("默认资料模板不应内置 pathValues 个人路径数据。");
}
// Fail closed for new data-bearing properties: only reviewed template metadata
// may be populated. Nested values outside metadata must remain empty as well.
const templateMetadata = new Set(["id", "category", "label", "aliases", "type", "multi", "format", "supportsOptions", "supportsPath"]);
function containsData(value) {
  if (Array.isArray(value)) return value.some(containsData);
  if (value && typeof value === "object") return Object.values(value).some(containsData);
  return typeof value === "string" ? Boolean(value.trim()) : Boolean(value);
}
for (const entry of ordinaryEntryTemplates()) {
  for (const [key, value] of Object.entries(entry)) {
    if (!templateMetadata.has(key) && containsData(value)) {
      throw new Error(`默认条目 ${entry.id} 的未批准数据属性 ${key} 非空。`);
    }
  }
}
const profileMetadata = new Set(["schemaVersion", "name", "updatedAt", "source", "entries", "records"]);
for (const [key, value] of Object.entries(DEFAULT_PROFILE)) {
  if (!profileMetadata.has(key) && containsData(value)) throw new Error(`默认资料包含未批准数据属性 ${key}。`);
}

for (const file of files.filter((item) => /\.(js|html)$/.test(item))) {
  const text = await readFile(file, "utf8");
  for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /new\s+WebSocket/, /navigator\.sendBeacon/]) {
    if (pattern.test(text)) throw new Error(`发现潜在外部网络代码 ${pattern}：${file}`);
  }
  if (file.endsWith(".html") && /(?:src|href)=["']https?:\/\//i.test(text)) {
    throw new Error(`发现远程页面资源：${file}`);
  }
}

console.log(`Checked manifest permissions and offline-only policy across ${jsFiles.length} JavaScript files.`);

// 私人资料绝不能进入源码树（dist 与 ZIP 都从 src 构建）。
for (const file of files) {
  const name = path.basename(file);
  if (/mori-cv-profile\.json$|resume-helper-profile-private|pre-v5|BeforeV6/i.test(name) && !file.includes(`${path.sep}examples${path.sep}`)) {
    throw new Error(`源码目录中出现私人资料文件：${file}`);
  }
}
if (/"sensitive"/.test(JSON.stringify(DEFAULT_PROFILE))) throw new Error("默认资料模板不应再包含 sensitive 标记。");
