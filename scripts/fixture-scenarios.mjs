import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { siteProfile } from "../src/shared/schema.js";

const origin = process.env.RESUME_HELPER_FIXTURE_ORIGIN || "http://127.0.0.1:4173";
const cdp = process.env.RESUME_HELPER_CDP || "http://127.0.0.1:9346";
const scenarioTimeout = Number(process.env.RESUME_HELPER_SCENARIO_TIMEOUT_MS) || 420000;
if (![origin, cdp].every(value => /^http:\/\/127\.0\.0\.1:\d+$/.test(value))) throw new Error("Only anonymous localhost fixtures are permitted");
const routes = process.argv.slice(2);
if (!routes.length) routes.push("/zhaopin-fixture.html?scenarios=1");
// Keep evidence tied to every content module, including optional site drivers
// and MAIN readers. A hash records source identity, not successful injection.
const runtimePaths = ["src/shared/matcher-core.js", "src/shared/category-runtime.js",
  ...(await readdir("src/content")).filter(name => name.endsWith(".js")).map(name => `src/content/${name}`)];
const runtimeHashes = Object.fromEntries(await Promise.all(runtimePaths.map(async file =>
  [file, createHash("sha256").update(await readFile(file)).digest("hex")])));
const results = await readFile("test-results/v1116-runtime/results.json", "utf8").then(JSON.parse).catch(() => []);
let failedRun = false;
await mkdir("test-results/v1116-runtime", { recursive: true });
for (const route of routes) {
  if (!route.startsWith("/") || route.startsWith("//")) throw new Error("Fixture route must be local");
  const sourcePath = route.startsWith("/runner/mokahr-v1114")
    ? "test-results/baseline-v1114-20261005-implementation/src/content/fill.js"
    : "src/content/fill.js";
  const categoryRuntimeHash = createHash("sha256").update(await readFile("src/shared/category-runtime.js")).digest("hex");
  const sourceHash = createHash("sha256").update(await readFile(sourcePath)).digest("hex");
  const prior = results.findIndex(result => result.route === route);
  if (prior >= 0) results.splice(prior, 1);
  const target = await (await fetch(cdp + "/json/new?" + encodeURIComponent(origin + route), { method: "PUT" })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const callId = ++id; pending.set(callId, { resolve, reject }); socket.send(JSON.stringify({ id: callId, method, params })); });
  let executionContextId;
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true,
      ...(executionContextId ? { contextId: executionContextId } : {}) });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  try {
    await send("Runtime.enable");
    await send("Page.bringToFront");
    await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    if(route.startsWith('/External/MyResume/FillInResume.aspx?')&&new URL(route,origin).searchParams.has('isolated')){
      const loaded=Date.now()+30000;while(!await evaluate('Boolean(globalThis.Job51EducationReady)')){if(Date.now()>loaded)throw Error('Education MAIN components not ready');await new Promise(resolve=>setTimeout(resolve,100));}
      const {frameTree}=await send('Page.getFrameTree');({executionContextId}=await send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'mori-job51-anonymous-test'}));
      await evaluate("globalThis.chrome={runtime:{onMessage:{addListener(fn){globalThis.__resumeHelperListener=fn;}}}};");
      for(const file of ['src/shared/matcher-core.js','src/shared/category-runtime.js','src/content/job51.js','src/content/fill.js'])await evaluate(await readFile(file,'utf8'));
      const recordsRoute=['skills','work','language'].includes(new URL(route,origin).searchParams.get('module'));
      let scenarios=await readFile(recordsRoute?'tests/job51-records-scenarios.js':'tests/job51-education-scenarios.js','utf8');scenarios=scenarios.replace("import {DEFAULT_PROFILE} from '/src/data/default-profile.js';",'const DEFAULT_PROFILE={entries:[],records:{}};').replace('export async function','async function');await evaluate(scenarios+';globalThis.__recordRunner='+(recordsRoute?'runRecords':'runEducation')+'().catch(error=>({error:error.stack,checks:globalThis.__recordProgress?.checks||[]}));');
    }
    if (route.startsWith('/form?') && new URL(route,origin).searchParams.get('tenant')==='sany') {
      const loaded=Date.now()+30000;while(!await evaluate('Boolean(globalThis.SanyFixtureReady)')){if(Date.now()>loaded)throw Error('Sany MAIN fixture not ready');await new Promise(resolve=>setTimeout(resolve,50));}
      const {frameTree}=await send('Page.getFrameTree');({executionContextId}=await send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'mori-sany-anonymous-test'}));
      await evaluate("globalThis.chrome={runtime:{onMessage:{addListener(fn){globalThis.__resumeHelperListener=fn;}}}};");
      for(const file of ['src/shared/matcher-core.js','src/shared/category-runtime.js','src/content/sany.js'])await evaluate(await readFile(file,'utf8'));
      const papers=new URL(route,origin).searchParams.has('papers');
      await evaluate('globalThis.__sanySiteProfile='+JSON.stringify(siteProfile({entries:[],records:papers?{papers:[{id:'anonymous-paper',name:'匿名论文甲',description:'匿名论文贡献说明'}]}:{awards:[{id:'anonymous-award',name:'匿名奖项甲',start:'2021-04-10',type:'省级',grade:'一等奖',awardCategory:'竞赛获奖'}]}}))+';');
      await evaluate("ResumeHelperCore.detectSite=()=> 'zhiye';ResumeHelperCore.detectZhiyeTemplate=()=> 'sany';");
      await evaluate(await readFile('src/content/fill.js','utf8'));
      const scenarios=(await readFile(papers?'tests/sany-papers-scenarios.js':new URL(route,origin).searchParams.has('controls')?'tests/sany-controls-scenarios.js':'tests/sany-date-scenarios.js','utf8')).replace('export async function','async function');await evaluate(scenarios+';globalThis.__recordRunner=runSany().catch(error=>({error:error.stack,checks:globalThis.__recordProgress?.checks||[]}));');
    } else if (route.startsWith('/form?') && new URL(route,origin).searchParams.get('tenant')==='bosc') {
      const loaded=Date.now()+30000;
      while(!await evaluate('Boolean(globalThis.BoscFixtureReady)')){if(Date.now()>loaded)throw Error('BOSC MAIN fixture not ready');await new Promise(resolve=>setTimeout(resolve,50));}
      const {frameTree}=await send('Page.getFrameTree');
      ({executionContextId}=await send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'mori-bosc-anonymous-test'}));
      await evaluate("globalThis.chrome={runtime:{onMessage:{addListener(fn){globalThis.__resumeHelperListener=fn;}}}};");
      for(const file of ['src/shared/matcher-core.js','src/shared/category-runtime.js','src/content/bosc.js'])await evaluate(await readFile(file,'utf8'));
      await evaluate("const boscTemplate=ResumeHelperCore.detectZhiyeTemplate('bosc.zhiye.com');ResumeHelperCore.detectSite=()=> 'zhiye';ResumeHelperCore.detectZhiyeTemplate=()=>boscTemplate;");
      await evaluate(await readFile('src/content/fill.js','utf8'));
      const scenarios=(await readFile('tests/bosc-zhiye-scenarios.js','utf8')).replace('export async function','async function');
      await evaluate(scenarios+';globalThis.__recordRunner=runBosc().catch(error=>({error:error.stack,checks:globalThis.__recordProgress?.checks||[]}));');
    } else if (route.startsWith('/form?') && new URL(route,origin).searchParams.get('tenant')==='seyond' && new URL(route,origin).searchParams.has('isolated')) {
      const loaded=Date.now()+30000;
      while(!await evaluate('Boolean(globalThis.SeyondFixtureReady)')){if(Date.now()>loaded)throw Error('Seyond MAIN fixture did not load');await new Promise(resolve=>setTimeout(resolve,100));}
      const {frameTree}=await send('Page.getFrameTree');
      ({executionContextId}=await send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'mori-seyond-anonymous-test'}));
      await evaluate("globalThis.chrome={runtime:{onMessage:{addListener(fn){globalThis.__resumeHelperListener=fn;}}}};");
      for(const file of ['src/shared/matcher-core.js','src/shared/category-runtime.js'])await evaluate(await readFile(file,'utf8'));
      await evaluate("ResumeHelperCore.detectSite=()=> 'zhiye';ResumeHelperCore.detectZhiyeTemplate=()=> 'seyond';");
      await evaluate(await readFile('src/content/fill.js','utf8'));
      const scenarios=(await readFile('tests/seyond-zhiye-scenarios.js','utf8')).replace("import {DEFAULT_PROFILE} from '/src/data/default-profile.js';",'const DEFAULT_PROFILE={entries:[],records:{}};').replace('export async function','async function');
      await evaluate(scenarios+';globalThis.__recordRunner=runSeyond().catch(error=>({error:error.stack,checks:globalThis.__recordProgress?.checks||[]}));');
    } else if (route.startsWith('/form?') && new URL(route,origin).searchParams.has('isolated')) {
      const loaded = Date.now()+30000;
      while (!await evaluate('Boolean(globalThis.ChinalifeFixture)')) {
        if (Date.now()>loaded) throw new Error('Anonymous MAIN fixture did not load');
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      const {frameTree}=await send('Page.getFrameTree');
      ({executionContextId}=await send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'mori-chinalife-anonymous-test'}));
      await evaluate("globalThis.chrome={runtime:{onMessage:{addListener(fn){globalThis.__resumeHelperListener=fn;}}}};");
      for (const file of ['src/shared/matcher-core.js','src/shared/category-runtime.js']) await evaluate(await readFile(file,'utf8'));
      await evaluate("if(location.hostname!=='127.0.0.1')throw Error('Anonymous localhost only');ResumeHelperCore.detectSite=()=> 'zhiye';ResumeHelperCore.detectZhiyeTemplate=()=> 'chinalife';");
      await evaluate(await readFile('src/content/fill.js','utf8'));
      await evaluate(await readFile('tests/chinalife-zhiye-isolated-scenarios.js','utf8'));
    }
    const deadline = Date.now() + 30000;
    let ready = false;
    while (Date.now() < deadline) {
      ready = await evaluate("Boolean(globalThis.__recordRunner)");
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error("Fixture runner not available");
    const run = await evaluate("Promise.race([globalThis.__recordRunner.then(result => ({ok:true,result})).catch(error => ({ok:false,error:String(error.stack || error),progress:globalThis.__recordProgress})),new Promise(resolve => setTimeout(() => resolve({ok:false,error:'Scenario timeout',progress:globalThis.__recordProgress})," + scenarioTimeout + "))])");
    if (run.ok && run.result?.error) { run.ok = false; run.error = run.result.error; run.progress = run.result; }
    failedRun ||= !run.ok;
    results.push({ route, verifiedAt: new Date().toISOString(), sourceHash, categoryRuntimeHash, runtimeHashes, ...run });
    console.log(JSON.stringify({ route, ok: run.ok, checks: run.result?.checks?.length || run.progress?.checks?.length || 0, error: run.error }));
    if (!run.ok) {
      const screenshot = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join("test-results/v1116-runtime", route.split("?")[0].replaceAll("/", "_") + ".png"), Buffer.from(screenshot.data, "base64"));
      console.log(JSON.stringify(await evaluate("({values:Array.from(document.querySelectorAll('input')).filter(e=>e.offsetWidth).slice(0,25).map(e=>({name:e.name,value:e.value})),model:globalThis.ZhaopinFixture?.snapshot()})")));
    }
  } catch (error) {
    failedRun = true;
    results.push({ route, verifiedAt: new Date().toISOString(), sourceHash, categoryRuntimeHash, runtimeHashes, ok: false, error: String(error.stack || error) });
    console.log(JSON.stringify(results.at(-1)));
  } finally {
    socket.close();
    await fetch(cdp + "/json/close/" + target.id);
  }
}
await writeFile("test-results/v1116-runtime/results.json", JSON.stringify(results, null, 2));
if (failedRun) process.exitCode = 1;
