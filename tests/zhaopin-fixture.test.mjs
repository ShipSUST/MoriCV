import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { toPortableProfile } from '../src/shared/ordinary-fields.js';

const html = await readFile(new URL('./zhaopin-fixture.html', import.meta.url), 'utf8');
const configStart = html.indexOf('  const f =');
const configEnd = html.indexOf('  const MONTH_LABELS =');
const modules = vm.runInNewContext(`${html.slice(configStart,configEnd)}; JSON.parse(JSON.stringify(MODULES));`);
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('anonymous Zhaopin topology retains twelve observed modules and 97 public fields', () => {
  assert.equal(modules.length,12);
  assert.equal(modules.reduce((count,module) => count + module.fields.length,0),97);
  assert.deepEqual(Array.from(modules,module => module.fields.length),[22,4,15,13,6,12,1,10,4,5,3,2]);
  assert.equal(new Set(modules.flatMap(module => module.fields.map(field => field.key))).size,97);
  assert.equal(modules.find(module => module.key === 'education_experience').loop,5);
  assert.equal(modules.find(module => module.key === 'MODULE101').loop,2);
});

test('fixture preserves evidence gaps instead of inventing required flags or unknown source keys', () => {
  const all = modules.flatMap(module => module.fields);
  assert.equal(all.filter(field => field.required === true).length,6);
  assert.equal(all.filter(field => field.required === false).length,1);
  assert.equal(all.filter(field => !Object.hasOwn(field,'required')).length,90);
  assert.deepEqual(Array.from(all.filter(field => field.syntheticKey),field => field.key),['anonymous_referee_name','anonymous_referee_relation']);
});

test('calendar fixture script compiles and keeps real component classes without artificial repeat aliases', () => {
  assert.doesNotThrow(() => new vm.Script(script));
  for (const marker of ['apply-module__body','form-content--title-box','form-content--title','apply-module__form','apply-form-date','el-date-editor--date','el-year-table','el-month-table','el-date-table','prev-month','next-month']) assert.ok(html.includes(marker),marker);
  assert.equal(html.includes('data-repeat-item'),false);
  assert.equal(html.includes('data-resume-repeat'),false);
  assert.equal(html.includes("document.createElement('h2')"),false);
});

test('fixture reproduces only confirmed default date-pair clearing, including passive opposite clears', () => {
  const pairStart = html.indexOf('  const DATE_PAIRS =');
  const pairEnd = html.indexOf('  const REGION_TREE =');
  const commitStart = html.indexOf('  function commit(');
  const commitEnd = html.indexOf('  function requestOpen(',commitStart);
  const state = { active:{ key:'education_experience',index:0 }, draft:{edu_date_start:'2020-01-01',edu_date_end:'2022-01-01',unrelated:'保持'}, commits:[],dirty:false };
  const commit = vm.runInNewContext(`${html.slice(pairStart,pairEnd)}; ${html.slice(commitStart,commitEnd)}; commit;`,{
    state, displayValue() {}, renderConditions() {}, parseDate:value => /^\d{4}-\d{2}-\d{2}$/.test(value)
  });
  commit('edu_date_start','2023-01-01');
  assert.equal(state.draft.edu_date_end,'');
  assert.equal(state.draft.unrelated,'保持');
  assert.equal(state.commits.at(-1).source,'paired-clear');
  state.draft = { FIELD1008:'2020-01-01',FIELD1009:'2022-01-01',FIELD1013:'2020-01-01',FIELD1014:'2022-01-01' };
  commit('FIELD1008','2023-01-01'); commit('FIELD1013','2023-01-01');
  assert.equal(state.draft.FIELD1009,'2022-01-01');
  assert.equal(state.draft.FIELD1014,'2022-01-01');
});

test('fixture is offline and separates current draft from explicit local module save', () => {
  assert.equal(/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(script),false);
  assert.equal(/https?:\/\//.test(html),false);
  assert.ok(script.includes('state.draft = structuredClone(state.saved[key][index]'));
  assert.ok(script.includes('state.saved[key][index] = structuredClone(state.draft); state.saveCount++'));
  assert.ok(script.includes('当前模块有未保存内容'));
});

test('anonymous preview file stub exercises the production IndexedDB File and revision path',async () => {
  const server = await readFile(new URL('../scripts/serve-fixture.mjs',import.meta.url),'utf8');
  const start = server.indexOf('function previewStub('), end = server.indexOf('\nconst mimeTypes',start);
  const source = {schemaVersion:8,entries:[],records:{}};
  const stub = vm.runInNewContext(`${server.slice(start,end)}; previewStub(false,${JSON.stringify(source)});`,{DEFAULT_PROFILE:source});
  const context = vm.createContext({File,TextEncoder,URLSearchParams,toPortableProfile,location:{search:''},queueMicrotask,crypto:webcrypto});
  vm.runInContext(stub.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  const production = (await readFile(new URL('../src/shared/profile-file.js',import.meta.url),'utf8')).replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
  vm.runInContext(`${production}; globalThis.fixtureReadLinkedProfile = readLinkedProfile; globalThis.fixtureSaveProfile = saveToLinkedProfile;`,context);
  const linked = await context.fixtureReadLinkedProfile();
  assert.equal(linked.linked,true); assert.equal(linked.readable,true); assert.equal(linked.name,'anonymous-profile.json');
  assert.deepEqual(JSON.parse(linked.text),source); assert.match(linked.revision,/^1:\d+:[a-f0-9]{64}$/);
  const changed = {...source,entries:[{id:'anonymous.test',category:'其他',label:'匿名测试',value:'匿名值'}]};
  const saved = await context.fixtureSaveProfile(changed,linked.revision);
  assert.equal(saved.synced,true);
  const reread = await context.fixtureReadLinkedProfile();
  assert.deepEqual(JSON.parse(reread.text),changed); assert.notEqual(reread.revision,linked.revision);
  assert.equal((await context.fixtureSaveProfile(source,linked.revision)).conflict,true);
});

test('anonymous preview can explicitly model unlinked and unreadable sources',async () => {
  const server = await readFile(new URL('../scripts/serve-fixture.mjs',import.meta.url),'utf8');
  const start = server.indexOf('function previewStub('), end = server.indexOf('\nconst mimeTypes',start);
  const source = {schemaVersion:8,entries:[],records:{}};
  const stub = vm.runInNewContext(`${server.slice(start,end)}; previewStub(false,${JSON.stringify(source)});`,{DEFAULT_PROFILE:source});
  const production = (await readFile(new URL('../src/shared/profile-file.js',import.meta.url),'utf8')).replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
  for (const mode of ['unlinked','denied','read-error']) {
    const context = vm.createContext({File,TextEncoder,URLSearchParams,toPortableProfile,location:{search:`?source=${mode}`},queueMicrotask,crypto:webcrypto});
    vm.runInContext(stub.match(/<script>([\s\S]*?)<\/script>/)[1],context);
    vm.runInContext(`${production}; globalThis.fixtureRead = readLinkedProfile;`,context);
    const result = await context.fixtureRead();
    assert.equal(result.linked,mode !== 'unlinked',mode); assert.equal(result.readable,false,mode);
  }
});
