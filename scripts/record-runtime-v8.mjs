import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Only an isolated, local anonymous fixture browser is permitted here.
const endpoint = process.env.RESUME_HELPER_CDP || "http://127.0.0.1:9334";
const fixtureOrigin = process.env.RESUME_HELPER_FIXTURE_ORIGIN || "http://127.0.0.1:4174";
assert.equal(new URL(fixtureOrigin).hostname, '127.0.0.1', 'Anonymous runner requires localhost');
const artifactRoot = new URL("../test-results/v8-runtime/", import.meta.url);
await mkdir(artifactRoot, { recursive: true });
class Client {
  constructor(url) { this.url = url; this.pending = new Map(); this.id = 0; }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => { this.socket.addEventListener("open", resolve, { once: true }); this.socket.addEventListener("error", reject, { once: true }); });
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data); const pending = this.pending.get(message.id); if (!pending) return;
      this.pending.delete(message.id); message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); }); }
  async read(expression) { const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
}
const scenarios = process.env.RESUME_HELPER_SCENARIOS === "1";
const controls = process.env.RESUME_HELPER_CONTROLS;
const moka = process.env.RESUME_HELPER_MOKA;
const ud = process.env.RESUME_HELPER_UD;
const quick = process.env.RESUME_HELPER_QUICK === "1";
for (const adapter of (process.env.RESUME_HELPER_ADAPTERS || "zhiye,feishu,mokahr").split(",")) {
  const mokaMode = adapter === "mokahr" ? moka : undefined;
  const udMode = adapter === 'ud' ? ud : undefined;
  const response = await fetch(`${endpoint}/json/new?${encodeURIComponent(`${fixtureOrigin}/runner/${adapter}?count=14${adapter === 'feishu-years' ? '&years=1' : ''}${scenarios ? "&scenarios=1" : ""}${controls ? `&controls=1&phoenix=${controls}` : ""}${mokaMode ? `&moka=${encodeURIComponent(mokaMode)}` : ""}${udMode ? `&ud=${encodeURIComponent(udMode)}` : ''}${quick ? '&quick=1' : ''}`)}`, { method: "PUT" });
  const target = await response.json();
  const client = new Client(target.webSocketDebuggerUrl); await client.connect();
  const deadline = Date.now() + 360000;
  let progress;
  try {
    while (Date.now() < deadline) {
      progress = await client.read("({ status: document.documentElement?.dataset.recordRunner, progress: globalThis.__recordProgress })");
      if (["done", "error"].includes(progress.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const screenshot = await client.send("Page.captureScreenshot", { format: "png" });
    if (["done", "error"].includes(progress.status)) progress.details = await client.read("globalThis.__recordRunner");
    const evidenceName = [adapter, scenarios ? "records" : "basic", controls, mokaMode, udMode, quick ? "quick" : ""].filter(Boolean).join("-").replace(/[^a-zA-Z0-9_-]/g, "-") + ".png";
    await writeFile(new URL(evidenceName, artifactRoot), Buffer.from(screenshot.data, "base64"));
    const results = await readFile(new URL("results.json", artifactRoot), "utf8").then(JSON.parse).catch(() => []);
    const prior = results.findIndex((row) => row.adapter === adapter && Boolean(row.scenarios) === scenarios && row.controls === controls && row.moka === mokaMode && row.ud === udMode && Boolean(row.quick) === quick);
    if (prior >= 0) results.splice(prior, 1);
    results.push({ adapter, scenarios, controls, moka: mokaMode, ud:udMode, quick, verifiedAt: new Date().toISOString(), screenshot: evidenceName, ...progress });
    await writeFile(new URL("results.json", artifactRoot), JSON.stringify(results, null, 2));
    assert.equal(progress.status, "done", `${adapter} runner did not complete`);
    if (scenarios || controls) {
      assert.ok(progress.details.checks.length >= 8);
      assert.ok(progress.details.timings.filter((row) => row.command === "fillRecord").every((row) => row.ms < 115000));
      console.log(`${adapter}: ${progress.details.checks.length} scenario checks passed`);
      continue;
    }
    assert.equal(progress.progress.results.length, 15);
    assert.ok(progress.progress.results.slice(0, 14).every((row) => !row.error && row.filled > 0), `${adapter} some records not filled`);
    assert.equal(progress.progress.results.at(-1).filled, 0, `${adapter} repeat added duplicate data`);
    console.log(`${adapter}: ${progress.progress.totalElapsedMs}ms; max single ${Math.max(...progress.progress.results.map((row) => row.elapsedMs))}ms`);
  } finally { client.socket.close(); await fetch(`${endpoint}/json/close/${target.id}`); }
}
