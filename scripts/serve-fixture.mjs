import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PROFILE } from "../src/data/default-profile.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(projectRoot, "tests", "manual-fixture.html");
const html = await readFile(fixturePath);
const zteHtml = await readFile(path.join(projectRoot, "tests", "zte-mokahr-fixture.html"));
const zhiyeHtml = await readFile(path.join(projectRoot, "tests", "zhiye-fixture.html"));
const feishuHtml = await readFile(path.join(projectRoot, "tests", "feishu-fixture.html"));
const genericRecordsHtml = await readFile(path.join(projectRoot, "tests", "generic-records-fixture.html"), "utf8");
const bytedanceUdHtml = await readFile(path.join(projectRoot, "tests", "bytedance-ud-fixture.html"), "utf8");
const bytedanceCompetitionHtml = await readFile(path.join(projectRoot, "tests", "bytedance-competition-fixture.html"), "utf8");
const componentLibsHtml = await readFile(path.join(projectRoot, "tests", "component-libs-fixture.html"));
const sourceRoot = path.join(projectRoot, "src");
const sidepanelHtml = await readFile(path.join(sourceRoot, "sidepanel.html"), "utf8");
const optionsHtml = await readFile(path.join(sourceRoot, "options.html"), "utf8");
// 设置页预览只用虚构示例 JSON，绝不读取 local-profile-data。
const exampleProfile = JSON.parse(await readFile(path.join(sourceRoot, "examples", "mori-cv-profile-example.json"), "utf8"));
const markerProfile = structuredClone(DEFAULT_PROFILE);
markerProfile.entries = [{ id: "basic.name", category: "基本信息", label: "姓名", value: "示例姓名", aliases: [] }];

function recordRunner(html, adapter, count = 2, scenarios = false, controls = false) {
  const runner = `<script>
  globalThis.__resumeHelperListener = null;
  globalThis.chrome = { runtime: { onMessage: { addListener(fn) { globalThis.__resumeHelperListener = fn; } } } };
</script>
<script src="/src/shared/matcher-core.js"></script><script src="/src/shared/category-runtime.js"></script>
<script src="${adapter === 'mokahr-baseline' ? '/baseline-v1111/content/fill.js' : '/src/content/fill.js'}"></script>
<script>
  globalThis.__recordRunner = (async () => {
    if (${controls}) {
      const { runControls } = await import("/control-scenarios.js");
      const result = await runControls();
      globalThis.__recordProgress = result;
      document.documentElement.dataset.recordRunner = "done";
      return result;
    }
    if (${scenarios}) {
      if (${JSON.stringify(adapter)} === 'feishu-years') {
        const { runFeishuYears } = await import('/feishu-year-scenarios.js');
        const result = await runFeishuYears();
        globalThis.__recordProgress = result;
        document.documentElement.dataset.recordRunner = 'done';
        return result;
      }
      if (${JSON.stringify(adapter)} === 'feishu-projects') {
        const { runFeishuProjects } = await import('/feishu-project-scenarios.js');
        const result = await runFeishuProjects();
        globalThis.__recordProgress = result;
        document.documentElement.dataset.recordRunner = 'done';
        return result;
      }
      if (${JSON.stringify(adapter)} === 'ud' && new URLSearchParams(location.search).get('ud') === 'competitions') {
        const { runCompetitions } = await import('/competition-scenarios.js');
        const result = await runCompetitions();
        globalThis.__recordProgress = result;
        document.documentElement.dataset.recordRunner = 'done';
        return result;
      }
      if (${JSON.stringify(adapter)} === 'mokahr' && new URLSearchParams(location.search).get('moka') === '3peak') {
        const { runThreePeak } = await import('/3peak-scenarios.js');
        const result = await runThreePeak();
        globalThis.__recordProgress = result;
        document.documentElement.dataset.recordRunner = 'done';
        return result;
      }
      const { runScenarios } = await import("/record-scenarios.js");
      const result = await runScenarios(${JSON.stringify(adapter === 'mokahr-baseline' ? 'mokahr' : adapter)});
      globalThis.__recordProgress = result;
      document.documentElement.dataset.recordRunner = "done";
      return result;
    }
    const profile = ${JSON.stringify(exampleProfile)};
    if (${count} > 2) profile.records.educations = Array.from({ length: ${count} }, (_, index) => ({
      ...profile.records.educations[index % 2], id: "anonymous.education." + index,
      start: (2000 + index) + "-09", end: (2004 + index) + "-06"
    }));
    globalThis.__recordProgress = { results: [], startedAt: performance.now() };
    const settings = { overwriteExisting: false, confidenceThreshold: 78, rejectedMatches: [] };
    const run = (recordId, resetTransaction) => new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = setTimeout(() => reject(new Error("fillRecord timeout")), 120000);
      globalThis.__resumeHelperListener({
        type: "RESUME_HELPER_COMMAND",
        command: "fillRecord",
        payload: { profile, settings, collection: "educations", recordId, resetTransaction }
      }, null, (result) => {
        clearTimeout(timer);
        globalThis.__recordProgress.results.push({ recordId, elapsedMs: Math.round(performance.now() - startedAt), filled: result?.filled?.length || 0, skipped: result?.skipped?.length || 0, conflicts: result?.conflicts?.length || 0, error: result?.error || "" });
        result?.error ? reject(new Error(result.error)) : resolve(result);
      });
    });
    const first = await run(profile.records.educations[0].id, true);
    const second = await run(profile.records.educations[1].id, false);
    for (const record of profile.records.educations.slice(2)) await run(record.id, false);
    const repeat = await run(profile.records.educations[0].id, false);
    globalThis.__recordProgress.totalElapsedMs = Math.round(performance.now() - globalThis.__recordProgress.startedAt);
    globalThis.__recordProgress.done = true;
    document.documentElement.dataset.recordRunner = "done";
    return { adapter: ${JSON.stringify(adapter)}, first, second, repeat };
  })().catch((error) => {
    document.documentElement.dataset.recordRunner = "error";
    return { error: error.message };
  });
</script>`;
  return html.replace("</body>", `${runner}</body>`);
}

function previewStub(filled = false, profile = filled ? markerProfile : null) {
  const localState = profile ? { resumeHelperProfileV1: profile } : {};
  const sessionState = filled ? {
    resumeHelperSnapshotsV1: {
      1: { expectations: [{ entryId: "basic.name", field: "姓名", kind: "text" }] }
    }
  } : {};
  return `<script>
  const local = ${JSON.stringify(localState)};
  const session = ${JSON.stringify(sessionState)};
  // The production file module still reads through IndexedDB, File and crypto.
  // This handle is an in-memory anonymous file, never a workstation file.
  const sourceMode = new URLSearchParams(location.search).get('source') || 'linked';
  let anonymousContent = JSON.stringify(${JSON.stringify(profile || DEFAULT_PROFILE)});
  let anonymousModified = 1;
  const anonymousHandle = {
    name: 'anonymous-profile.json', kind: 'file',
    async queryPermission() { return sourceMode === 'denied' ? 'denied' : 'granted'; },
    async requestPermission() { return this.queryPermission(); },
    async getFile() {
      if (sourceMode === 'read-error') throw new Error('Anonymous fixture read error');
      return new File([sourceMode === 'invalid' ? '{invalid anonymous JSON' : anonymousContent], this.name,
        { type: 'application/json', lastModified: anonymousModified });
    },
    async createWritable() {
      let pendingContent = anonymousContent;
      return {
        async write(content) { pendingContent = String(content); },
        async close() { anonymousContent = pendingContent; anonymousModified += 1; }
      };
    }
  };
  let rememberedHandle = sourceMode === 'unlinked' ? null : anonymousHandle;
  const anonymousRequest = operation => {
    const request = {};
    queueMicrotask(() => {
      try { request.result = operation(); request.onsuccess?.(); }
      catch (error) { request.error = error; request.onerror?.(); }
    });
    return request;
  };
  const anonymousStore = {
    get(key) { return anonymousRequest(() => key === 'profile' ? rememberedHandle : undefined); },
    put(handle, key) { return anonymousRequest(() => { if (key === 'profile') rememberedHandle = handle; return key; }); },
    delete(key) { return anonymousRequest(() => { if (key === 'profile') rememberedHandle = null; }); }
  };
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open() { return anonymousRequest(() => ({
      objectStoreNames: { contains: name => name === 'handles' },
      createObjectStore() { return anonymousStore; },
      transaction() { return { objectStore: () => anonymousStore }; }, close() {}
    })); }
  } });
  const area = (store) => ({
    async get(keys) {
      if (keys == null) return { ...store };
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => key in store).map((key) => [key, store[key]]));
    },
    async set(values) { Object.assign(store, values); }
  });
  globalThis.chrome = {
    storage: { local: area(local), session: area(session), onChanged: { addListener() {} } },
    runtime: {
      async sendMessage() { return { ok: true, tabId: 1, result: { site: "generic", ready: false } }; },
      onMessage: { addListener() {} },
      openOptionsPage() {}
    },
    tabs: { async query() { return [{ id: 1, url: location.href }]; } }
  };
</script>`;
}

const mimeTypes = new Map([
  [".js", "text/javascript; charset=utf-8"], [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"], [".json", "application/json; charset=utf-8"]
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (['/runner/fixed-mokahr','/runner/fixed-feishu','/runner/fixed-zhiye','/fixed-site-scenarios.js'].includes(url.pathname)) {
      response.writeHead(200, {'Content-Type':url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});
      if(url.pathname.endsWith('.js')) {response.end(await readFile(path.join(projectRoot,'tests','fixed-site-scenarios.js')));return;}
      const content=String(url.pathname.endsWith('mokahr')?zteHtml:url.pathname.endsWith('feishu')?feishuHtml:zhiyeHtml);
      response.end(content.replace('</body>',`<script>globalThis.chrome={runtime:{onMessage:{addListener(fn){globalThis.__resumeHelperListener=fn;}}}};</script><script src="/src/shared/matcher-core.js"></script><script src="/src/shared/category-runtime.js"></script><script src="/src/content/fill.js"></script><script type="module">import{runFixedSites}from'/fixed-site-scenarios.js';globalThis.__recordRunner=runFixedSites().catch(error=>({error:error.stack,checks:globalThis.__recordProgress?.checks||[]}));</script></body>`));return;
    }
    if (['/runner/fixed-consumers','/fixed-consumer-scenarios.js'].includes(url.pathname)) {
      response.writeHead(200, {'Content-Type':url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});
      response.end(await readFile(path.join(projectRoot,'tests',url.pathname.endsWith('.js')?'fixed-consumer-scenarios.js':'fixed-consumer-fixture.html')));return;
    }
    if (url.pathname.startsWith('/job51-vendor/')) {
      const relative=url.pathname.slice('/job51-vendor/'.length);
      if(relative.includes('..')||relative.includes('\\'))throw Error('Invalid vendor route');
      const vendorRoot=path.resolve(process.env.RESUME_HELPER_JOB51_VENDOR_ROOT||path.join(projectRoot,'test-results/51job-20261019/vendor'));
      const file=path.join(vendorRoot,relative);
      response.writeHead(200,{'Content-Type':mimeTypes.get(path.extname(file))||({'.htm':'text/html; charset=utf-8','.gif':'image/gif','.jpg':'image/jpeg'}[path.extname(file)])||'application/octet-stream'});
      response.end(await readFile(file));return;
    }
    if (['/External/MyResume/FillInResume.aspx','/job51-scenarios.js','/job51-education-scenarios.js','/job51-records-scenarios.js'].includes(url.pathname)) {
      response.writeHead(200, {'Content-Type':url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});
      response.end(await readFile(path.join(projectRoot,'tests',url.pathname.endsWith('.js')?url.pathname.slice(1):['skills','work','language'].includes(url.searchParams.get('module'))?'job51-records-fixture.html':url.searchParams.get('module')==='education'?'job51-education-fixture.html':'job51-fixture.html')));return;
    }
    if (['/njzq-zhiye-fixture.html','/njzq-zhiye-scenarios.js'].includes(url.pathname)) {
      response.writeHead(200, { 'Content-Type': url.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(await readFile(path.join(projectRoot, 'tests', url.pathname.slice(1))));
      return;
    }
    if (['/sany-date-scenarios.js','/sany-controls-scenarios.js','/sany-papers-scenarios.js'].includes(url.pathname) || (url.pathname === '/form' && url.searchParams.get('tenant') === 'sany')) {
      response.writeHead(200, { 'Content-Type': url.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control':'no-store' });
      response.end(await readFile(path.join(projectRoot, 'tests', url.pathname.endsWith('.js') ? url.pathname.slice(1) : url.searchParams.has('papers') ? 'sany-papers-fixture.html' : url.searchParams.has('controls') ? 'sany-controls-fixture.html' : 'sany-date-fixture.html'))); return;
    }
    if (url.pathname === '/bosc-zhiye-scenarios.js' || (url.pathname === '/form' && url.searchParams.get('tenant') === 'bosc')) {
      response.writeHead(200, { 'Content-Type': url.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(await readFile(path.join(projectRoot, 'tests', url.pathname.endsWith('.js') ? 'bosc-zhiye-scenarios.js' : 'bosc-zhiye-fixture.html'))); return;
    }
    if (url.pathname === '/seyond-zhiye-scenarios.js' || (url.pathname === '/form' && url.searchParams.get('tenant') === 'seyond')) {
      response.writeHead(200, { 'Content-Type': url.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(await readFile(path.join(projectRoot, 'tests', url.pathname.endsWith('.js') ? 'seyond-zhiye-scenarios.js' : 'seyond-zhiye-fixture.html'))); return;
    }
    if (['/form','/chinalife-zhiye-controls.js','/chinalife-zhiye-scenarios.js'].includes(url.pathname)) {
      response.writeHead(200, { 'Content-Type': url.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(await readFile(path.join(projectRoot, 'tests', url.pathname === '/form' ? (url.searchParams.get('tenant') === 'njzq' ? 'njzq-zhiye-fixture.html' : 'chinalife-zhiye-fixture.html') : url.pathname.slice(1))));
      return;
    }
    if (url.pathname === '/center/resume' || url.pathname === '/cmb-scenarios.js') {
      response.writeHead(200, { 'Content-Type': url.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(await readFile(path.join(projectRoot, 'tests', url.pathname === '/center/resume' ? 'cmb-fixture.html' : 'cmb-scenarios.js')));
      return;
    }
    if (url.pathname === '/category-module-fixture.html' || url.pathname === '/category-module-scenarios.js') {
      response.writeHead(200, { 'Content-Type': url.pathname.endsWith('.js') ? 'text/javascript' : 'text/html', 'Cache-Control': 'no-store' });
      response.end(await readFile(path.join(projectRoot, 'tests', url.pathname.slice(1))));
      return;
    }
    if (["/preview", "/preview-filled", "/preview-example"].includes(url.pathname)) {
      const previewProfile = url.pathname === "/preview-example" ? exampleProfile : undefined;
      const preview = sidepanelHtml
        .replace('href="styles.css"', 'href="/src/styles.css"')
        .replace('<script type="module" src="sidepanel.js"></script>', `${previewStub(url.pathname === "/preview-filled", previewProfile)}<script type="module" src="/src/sidepanel.js"></script>`);
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(preview);
      return;
    }
    if (url.pathname === "/options-preview") {
      const preview = optionsHtml
        .replace('href="styles.css"', 'href="/src/styles.css"')
        .replace('href="options.css"', 'href="/src/options.css"')
        .replace('<script type="module" src="options.js"></script>', `${previewStub(false, url.searchParams.has('empty') ? DEFAULT_PROFILE : exampleProfile)}<script type="module" src="/src/options.js"></script>`);
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(preview);
      return;
    }
    if (url.pathname === "/zte") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(zteHtml);
      return;
    }
    if (['/zhaopin-fixture.html','/runner/zhaopin','/moka-date-region-fixture.html','/runner/moka-date-region'].includes(url.pathname)) {
      const mokaDateRegion = url.pathname.includes('moka-date-region');
      const adapter = mokaDateRegion ? 'moka-date-region' : 'zhaopin';
      const scenario = mokaDateRegion ? 'runMokaDateRegion' : 'runZhaopin';
      const fixture = await readFile(path.join(projectRoot, 'tests', `${adapter}-fixture.html`), 'utf8');
      const runner = `<script>
        globalThis.chrome = { runtime: { onMessage: { addListener(fn) { globalThis.__resumeHelperListener = fn; } } } };
      </script><script src="/src/shared/matcher-core.js"></script><script src="/src/shared/category-runtime.js"></script><script src="/src/content/fill.js"></script>
      <script type="module">
        if (new URLSearchParams(location.search).has('scenarios')) {
          const { ${scenario}: runScenarios } = await import('/${adapter}-scenarios.js');
          globalThis.__recordRunner = runScenarios().then(result => {
            globalThis.__recordProgress = result; document.documentElement.dataset.recordRunner = 'done'; return result;
          }).catch(error => {
            globalThis.__recordProgress = { adapter: '${adapter}', error: error.message, checks: globalThis.__recordProgress?.checks || [] };
            document.documentElement.dataset.recordRunner = 'error'; return globalThis.__recordProgress;
          });
        }
      </script>`;
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(fixture.replace('</body>', `${runner}</body>`));
      return;
    }
    if (url.pathname === '/runner/ud') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(recordRunner(url.searchParams.get('ud') === 'competitions' ? bytedanceCompetitionHtml : bytedanceUdHtml, 'ud', 14, true));
      return;
    }
    if (url.pathname === "/runner/generic") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(recordRunner(genericRecordsHtml, "generic", Number(url.searchParams.get("count") || 14), url.searchParams.has("scenarios")));
      return;
    }
    if (url.pathname === "/runner/mokahr") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(recordRunner(zteHtml.toString("utf8"), "mokahr", url.searchParams.get("count") === "14" ? 14 : 2, url.searchParams.has("scenarios")));
      return;
    }
    if (url.pathname === "/zhiye") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(zhiyeHtml);
      return;
    }
    if (url.pathname === "/runner/zhiye") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(recordRunner(zhiyeHtml.toString("utf8"), "zhiye", url.searchParams.get("count") === "14" ? 14 : 2, url.searchParams.has("scenarios"), url.searchParams.has("controls")));
      return;
    }
    if (url.pathname === "/feishu") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(feishuHtml);
      return;
    }
    if (url.pathname === "/runner/feishu") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(recordRunner(feishuHtml.toString("utf8"), "feishu", url.searchParams.get("count") === "14" ? 14 : 2, url.searchParams.has("scenarios")));
      return;
    }
    if (url.pathname === "/runner/feishu-projects") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(recordRunner(feishuHtml.toString("utf8"), "feishu-projects", 14, true));
      return;
    }
    if (url.pathname === "/runner/feishu-years") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(recordRunner(feishuHtml.toString("utf8"), "feishu-years", 14, true));
      return;
    }
    if (url.pathname === '/runner/mokahr-v1114') {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(recordRunner(zteHtml.toString('utf8'), 'mokahr-baseline', 14, true)
        .replace('/baseline-v1111/content/fill.js', '/baseline-v1114/content/fill.js'));
      return;
    }
    if (url.pathname === '/baseline-v1114/content/fill.js') {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      response.end(await readFile(path.join(projectRoot, 'test-results/baseline-v1114-20261005-implementation/src/content/fill.js')));
      return;
    }
    if (url.pathname === '/runner/mokahr-baseline') {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(recordRunner(zteHtml.toString('utf8'), 'mokahr-baseline', 14, true));
      return;
    }
    if (url.pathname === '/baseline-v1111/content/fill.js') {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      response.end(await readFile(path.join(projectRoot, 'test-results/moka-baseline-v1111/content/fill.js')));
      return;
    }
    if (url.pathname === "/component-libs") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(componentLibsHtml);
      return;
    }
    if (["/record-scenarios.js", "/control-scenarios.js", "/3peak-scenarios.js", "/competition-scenarios.js", "/feishu-project-scenarios.js", "/feishu-year-scenarios.js", "/zhaopin-scenarios.js", "/moka-date-region-scenarios.js"].includes(url.pathname)) {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      response.end(await readFile(path.join(projectRoot, "tests", url.pathname.slice(1))));
      return;
    }
    if (url.pathname.startsWith("/src/")) {
      const relative = url.pathname.slice("/src/".length);
      const resolved = path.resolve(sourceRoot, relative);
      if (!resolved.startsWith(`${sourceRoot}${path.sep}`)) throw new Error("invalid source path");
      const body = await readFile(resolved);
      response.writeHead(200, { "Content-Type": mimeTypes.get(path.extname(resolved)) || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(body);
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(html);
  } catch (error) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error.message);
  }
});

server.listen(Number(process.env.RESUME_HELPER_FIXTURE_PORT || 4173), "127.0.0.1", () => {
  console.log(`Fixture ready at http://127.0.0.1:${server.address().port} — press Ctrl+C to stop.`);
});
