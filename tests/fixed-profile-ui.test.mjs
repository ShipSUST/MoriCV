import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as storage from '../src/shared/storage.js';
import * as schema from '../src/shared/schema.js';
import { DEFAULT_PROFILE } from '../src/data/default-profile.js';
import { fixedField, toPortableProfile } from '../src/shared/ordinary-fields.js';
import { categorySequence, categoryRank, unknownRecordCollections } from '../src/shared/profile-view.js';

class Element {
  constructor(tag='div') { this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.dataset={};this.value='';this.className='';this.textContent='';this.classList={add(){},remove(){},toggle(){}}; }
  append(...nodes){this.children.push(...nodes);}
  prepend(...nodes){this.children.unshift(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
  setAttribute(key,value){this[key]=value;}
  querySelector(selector){return descendants(this).slice(1).find(n=>selector.startsWith('.')?n.className?.split(' ').includes(selector.slice(1)):n.tagName===selector.toUpperCase())||null;}
  get childElementCount(){return this.children.length;}
  async trigger(type){for(const fn of this.listeners[type]||[])await fn({target:this});}
}
const descendants=node=>[node,...(node.children||[]).flatMap(descendants)];
function harness(overrides={}) {
 const nodes=new Map(),calls=[];
 const context=vm.createContext({ ...storage,...schema,DEFAULT_PROFILE,fixedField,toPortableProfile,
  orderCategories:categorySequence,categoryRank,unknownRecordCollections,structuredClone,
  document:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);},querySelectorAll:()=>[],createElement:t=>new Element(t),createTextNode:text=>({textContent:text}),createDocumentFragment:()=>new Element()},
  setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},CSS:{escape:String},confirm:()=>true,alert(){},Blob,
  URL:{createObjectURL:()=> 'blob:anonymous',revokeObjectURL(){}},
  linkedProfileName:async()=> 'anonymous.json', readCanonicalProfileSnapshot:async()=>({profile:storage.migrateProfile(DEFAULT_PROFILE),name:'anonymous.json',revision:'a'}),
  saveToLinkedProfile:async()=>{calls.push('file');return {synced:true,name:'anonymous.json',revision:'b'};},
  saveProfile:async()=>calls.push('cache'),saveSettings:async()=>calls.push('settings'),
  getProfileHandle:async()=>null,rememberProfileHandle:async()=>{},forgetProfileHandle:async()=>{},...overrides });
 const source=readFile(new URL('../src/options.js',import.meta.url),'utf8');
 return source.then(code=>{vm.runInContext(code.replace(/^import[\s\S]*?;\s*/gm,'').replace(/init\(\)\.catch\([\s\S]*$/,'')+`
 globalThis.api={renderEntryCard,renderEditor,startDraft,commitDraft,saveAll,loadCanonicalProfile,
  setProfile(p){profile=p;linkedRevision='a';settings={};},state(){return {profile,draft};}};
 `,context);return {api:context.api,nodes,calls,context};});
}
test('fixed cards expose only their permitted personal inputs, Other exposes name and value',async()=>{
 const h=await harness(),profile=storage.migrateProfile(DEFAULT_PROFILE);h.api.setProfile(profile);
 for(const [id,count]of [['basic.name',1],['basic.marital_status',2],['location.household',3]]){
  const card=h.api.renderEntryCard(profile.entries.find(e=>e.id===id));
  assert.equal(descendants(card).filter(n=>['INPUT','TEXTAREA','SELECT'].includes(n.tagName)).length,count,id);
  assert.equal(descendants(card).some(n=>n.className==='delete-entry'),false);
 }
 const other={id:'other.note',category:'其他',label:'匿名备注',value:'匿名内容'};
 const card=h.api.renderEntryCard(other);
 assert.equal(descendants(card).filter(n=>['INPUT','TEXTAREA','SELECT'].includes(n.tagName)).length,2);
 assert.equal(descendants(card).some(n=>n.textContent==='侧栏显示名称'),true);
 assert.equal(descendants(card).some(n=>n.className==='delete-entry'),true);
});
test('migration cancellation writes nothing; acceptance downloads original before publishing the JSON',async()=>{
 for(const approved of [false,true]){
  const old={...structuredClone(DEFAULT_PROFILE),schemaVersion:8,entries:[{id:'profile.github',category:'求职偏好',label:'GitHub',value:'https://example.invalid',aliases:[]}]};
  const snapshot={profile:storage.migrateProfile(old),name:'anonymous.json',revision:'a',sourceText:JSON.stringify(old),migrationReport:storage.previewProfileMigration(old).report};
  let h;h=await harness({confirm:()=>approved,readCanonicalProfileSnapshot:async()=>snapshot});
  vm.runInContext(`const create=document.createElement;document.createElement=(tag)=>{const element=create(tag);element.click=()=>globalThis.recordDownload();return element;};`,h.context);
  h.context.recordDownload=()=>h.calls.push('backup');
  await h.api.loadCanonicalProfile();await h.api.saveAll();
  assert.deepEqual(h.calls,approved?['backup','file','cache','settings']:[]);
 }
});

test('migration approval distinguishes discarded fixed configuration from deleted legacy entries and backs up original text',async()=>{
 const old={...structuredClone(DEFAULT_PROFILE),schemaVersion:8,entries:[
  {id:'basic.name',category:'基本信息',label:'姓名',value:'匿名姓名',optionValues:['旧候选'],pathValues:[['旧路径']]},
  {id:'legacy.note',category:'其他',label:'旧备注',value:'待删除内容'}
 ]};
 const sourceText=JSON.stringify(old),snapshot={profile:storage.migrateProfile(old),name:'anonymous.json',revision:'a',sourceText,migrationReport:storage.previewProfileMigration(old).report};
 let message='',backup;
 const h=await harness({confirm:text=>{message=text;return true;},readCanonicalProfileSnapshot:async()=>snapshot,URL:{createObjectURL:blob=>{backup=blob;return 'blob:anonymous';},revokeObjectURL(){}}});
 vm.runInContext(`const create=document.createElement;document.createElement=tag=>{const element=create(tag);element.click=()=>globalThis.recordDownload();return element;};`,h.context);
 h.context.recordDownload=()=>h.calls.push('backup');
 await h.api.loadCanonicalProfile();await h.api.saveAll();
 assert.match(message,/旧备注/);
 assert.match(message,/姓名（移除候选、路径）/);
 assert.equal(await backup.text(),sourceText);
 assert.deepEqual(h.calls,['backup','file','cache','settings']);
});
test('only Other and record groups can create drafts, Other remains the last group',async()=>{
 const h=await harness();h.api.setProfile(storage.migrateProfile(DEFAULT_PROFILE));
 h.api.startDraft('基本信息');assert.equal(h.api.state().draft,null);
 h.api.startDraft('其他');assert.equal(h.api.state().draft.entry.category,'其他');
 h.api.commitDraft();assert.equal(h.api.state().profile.entries.filter(e=>e.category==='其他').length,1);
 h.api.startDraft('项目经历');assert.equal(h.api.state().draft.collection,'projects');
 h.api.renderEditor();
 const groups=h.nodes.get('#entry-editor').children;
 assert.equal(groups.at(-1).children[0].children[0].textContent,'其他');
});
