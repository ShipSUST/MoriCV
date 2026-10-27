import test from "node:test";
import assert from "node:assert/strict";

let messageListener;
let actionListener;
let injected;
let forwarded;
let panelBehavior;
const actionCallOrder = [];
const sessionStore = {};

globalThis.chrome = {
  runtime: {
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: { addListener(listener) { messageListener = listener; } }
  },
  action: { onClicked: { addListener(listener) { actionListener = listener; } } },
  sidePanel: {
    async setPanelBehavior(value) { panelBehavior = value; },
    async open() { throw new Error("sidePanel.open must not be called"); }
  },
  storage: {
    local: { async get() { return {}; }, async set() {} },
    session: {
      async get(key) { return { [key]: sessionStore[key] }; },
      async set(values) { actionCallOrder.push("store"); Object.assign(sessionStore, values); }
    }
  },
  tabs: {
    async query() { return [{ id: 42, url: "https://example.com/resume" }]; },
    async sendMessage(tabId, message) {
      forwarded = { tabId, message };
      return { filled: [{ entryId: "basic.name" }] };
    }
  },
  scripting: {
    async executeScript(options) { injected = options; }
  }
};

await import(`../src/background.js?test=${Date.now()}`);

function invoke(message) {
  return new Promise((resolve) => {
    const keepAlive = messageListener(message, null, resolve);
    assert.equal(keepAlive, true);
  });
}

test("background injects the matcher and content script before forwarding a command", async () => {
  const response = await invoke({ type: "RUN_IN_ACTIVE_TAB", command: "fill", payload: { hello: "world" } });
  assert.equal(response.ok, true);
  assert.deepEqual(injected, {
    target: { tabId: 42 },
    files: ["shared/matcher-core.js", "shared/category-runtime.js", "content/job51.js", "content/bosc.js", "content/fill.js"]
  });
  assert.equal(forwarded.tabId, 42);
  assert.equal(forwarded.message.command, "fill");
  assert.deepEqual(forwarded.message.payload, { hello: "world" });
});

test("toolbar action records the granted tab while Chrome opens the panel automatically", async () => {
  actionCallOrder.length = 0;
  const returned = actionListener({ id: 42, windowId: 3, url: "https://app.mokahr.com/resume" });
  await Promise.resolve();
  assert.equal(returned, undefined, "action listener must not await before sidePanel.open");
  assert.deepEqual(actionCallOrder, ["store"]);
  assert.deepEqual(panelBehavior, { openPanelOnActionClick: true });
  assert.equal(sessionStore.resumeHelperActionContextV1.tabId, 42);
  assert.equal(sessionStore.resumeHelperActionContextV1.url, "https://app.mokahr.com/resume");
});

test('China Life injects only its read-only reader in MAIN before the isolated driver', async () => {
  const query = chrome.tabs.query, execute = chrome.scripting.executeScript;
  const calls = [];
  chrome.tabs.query = async () => [{id:42,url:'https://chinalife.zhiye.com/form?fromPage=editMyResume'}];
  chrome.scripting.executeScript = async options => calls.push(options);
  try {
    const response = await invoke({type:'RUN_IN_ACTIVE_TAB',command:'scan',payload:{}});
    assert.equal(response.ok,true);
    assert.deepEqual(calls.map(call => ({world:call.world,files:call.files})),[
      {world:'MAIN',files:['content/chinalife-readback.js']},
      {world:undefined,files:['shared/matcher-core.js','shared/category-runtime.js','content/job51.js','content/bosc.js','content/fill.js']}
    ]);
    calls.length=0;
    chrome.tabs.query=async()=>[{id:42,url:'https://chinalife.zhiye.com/jobs'}];
    await invoke({type:'RUN_IN_ACTIVE_TAB',command:'scan',payload:{}});
    assert.equal(calls.length,1);
    assert.equal(calls[0].world,undefined);
  } finally { chrome.tabs.query=query;chrome.scripting.executeScript=execute; }
});

test('Seyond injects the guarded Phoenix reader only on its exact form URL', async () => {
  const query=chrome.tabs.query,execute=chrome.scripting.executeScript,calls=[];
  chrome.scripting.executeScript=async options=>calls.push(options);
  try {
    chrome.tabs.query=async()=>[{id:42,url:'https://seyond.zhiye.com/form?fromPage=job'}];
    assert.equal((await invoke({type:'RUN_IN_ACTIVE_TAB',command:'scan',payload:{}})).ok,true);
    assert.deepEqual(calls.map(call=>({world:call.world,files:call.files})),[{world:'MAIN',files:['content/chinalife-readback.js']},{world:undefined,files:['shared/matcher-core.js','shared/category-runtime.js','content/job51.js','content/bosc.js','content/fill.js']}]);
    for(const url of ['https://seyond.zhiye.com/jobs','https://seyond.zhiye.com.attacker.invalid/form']){
      calls.length=0;chrome.tabs.query=async()=>[{id:42,url}];await invoke({type:'RUN_IN_ACTIVE_TAB',command:'scan',payload:{}});assert.equal(calls.length,1);assert.equal(calls[0].world,undefined);
    }
  } finally {chrome.tabs.query=query;chrome.scripting.executeScript=execute;}
});

test("reports default persistent access for an ordinary MokaHR tab", async () => {
  chrome.tabs.query = async () => [{ id: 42, url: "https://app.mokahr.com/resume" }];
  const response = await invoke({ type: "GET_ACTIVE_TAB_ACCESS" });
  assert.equal(response.ok, true);
  assert.equal(response.site, "mokahr");
  assert.equal(response.originPattern, null);
  assert.equal(response.defaultAccess, true);
  assert.equal(response.invokedForCurrentTab, true);
  assert.equal(response.persistent, true);
});

test('Sany receives its scoped contracts in both worlds before the reader and driver',async()=>{
 const query=chrome.tabs.query,execute=chrome.scripting.executeScript,calls=[];
 chrome.scripting.executeScript=async options=>calls.push(options);
 try{
  chrome.tabs.query=async()=>[{id:42,url:'https://sanycampus.zhiye.com/form?fromPage=job'}];
  assert.equal((await invoke({type:'RUN_IN_ACTIVE_TAB',command:'scan',payload:{}})).ok,true);
  assert.deepEqual(calls.map(call=>({world:call.world,files:call.files})),[
   {world:'MAIN',files:['content/sany.js','content/chinalife-readback.js']},
   {world:undefined,files:['shared/matcher-core.js','shared/category-runtime.js','content/job51.js','content/bosc.js','content/sany.js','content/fill.js']}
  ]);
  for(const url of ['https://sanycampus.zhiye.com/jobs','https://sanycampus.zhiye.com.attacker.invalid/form']){
   calls.length=0;chrome.tabs.query=async()=>[{id:42,url}];await invoke({type:'RUN_IN_ACTIVE_TAB',command:'scan',payload:{}});
   assert.equal(calls.length,1);assert.equal(calls[0].world,undefined);assert.ok(!calls[0].files.includes('content/sany.js'));
  }
 }finally{chrome.tabs.query=query;chrome.scripting.executeScript=execute;}
});

test('BOSC form receives its public contracts in both worlds and the read-only MAIN bridge',async()=>{
 const query=chrome.tabs.query,execute=chrome.scripting.executeScript,calls=[];
 chrome.scripting.executeScript=async options=>calls.push(options);
 try{
  chrome.tabs.query=async()=>[{id:42,url:'https://bosc.zhiye.com/form?fromPage=job'}];
  assert.equal((await invoke({type:'RUN_IN_ACTIVE_TAB',command:'scan',payload:{}})).ok,true);
  assert.deepEqual(calls.map(call=>({world:call.world,files:call.files})),[
   {world:'MAIN',files:['content/bosc.js','content/chinalife-readback.js']},
   {world:undefined,files:['shared/matcher-core.js','shared/category-runtime.js','content/job51.js','content/bosc.js','content/fill.js']}
  ]);
  for(const url of ['https://bosc.zhiye.com/jobs','https://bosc.zhiye.com.attacker.invalid/form']){
   calls.length=0;chrome.tabs.query=async()=>[{id:42,url}];await invoke({type:'RUN_IN_ACTIVE_TAB',command:'scan',payload:{}});assert.equal(calls.length,1);assert.equal(calls[0].world,undefined);
  }
 }finally{chrome.tabs.query=query;chrome.scripting.executeScript=execute;}
});

test("reports default persistent access for a generic HTTPS site without a toolbar click", async () => {
  chrome.tabs.query = async () => [{ id: 99, url: "https://boards.greenhouse.io/example/jobs/1" }];
  const response = await invoke({ type: "GET_ACTIVE_TAB_ACCESS" });
  assert.equal(response.ok, true);
  assert.equal(response.site, "generic");
  assert.equal(response.defaultAccess, true);
  assert.equal(response.persistent, true);
  assert.equal(response.invokedForCurrentTab, false);
});

test("reports default persistent access for an ordinary HTTP page", async () => {
  chrome.tabs.query = async () => [{ id: 17, windowId: 2, url: "http://127.0.0.1:4173/form" }];
  const response = await invoke({ type: "GET_ACTIVE_TAB_ACCESS" });
  assert.equal(response.ok, true);
  assert.equal(response.defaultAccess, true);
  assert.equal(response.persistent, true);
  assert.equal(response.site, "generic");
  assert.equal(response.label, "127.0.0.1");
});

test("reports the Zhiye platform label before the first scan", async () => {
  chrome.tabs.query = async () => [{ id: 18, windowId: 2, url: "https://example.zhiye.com/form" }];
  const response = await invoke({ type: "GET_ACTIVE_TAB_ACCESS" });
  assert.equal(response.ok, true);
  assert.equal(response.site, "zhiye");
  assert.equal(response.label, "Zhiye");
});

test("background rejects Chrome internal pages with an actionable hint", async () => {
  chrome.tabs.query = async () => [{ id: 7, url: "chrome://extensions" }];
  const response = await invoke({ type: "RUN_IN_ACTIVE_TAB", command: "scan", payload: {} });
  assert.equal(response.ok, false);
  assert.equal(response.code, "UNSUPPORTED_PAGE");
  assert.match(response.error, /不是可填写的普通网页/);
  assert.match(response.hint, /http:\/\/|https:\/\//);
});

 test('51job access label is restricted to its observed resume path', async()=>{for(const [url,site,label] of [['https://xyz.51job.com/External/MyResume/FillInResume.aspx?SeqID=0','job51','51job'],['https://xyz.51job.com/jobs','generic','xyz.51job.com']]){chrome.tabs.query=async()=>[{id:18,url}];const result=await invoke({type:'GET_ACTIVE_TAB_ACCESS'});assert.equal(result.site,site);assert.equal(result.label,label);}});
