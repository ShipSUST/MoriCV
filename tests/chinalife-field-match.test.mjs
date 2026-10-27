import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import '../src/shared/matcher-core.js';
const source=await readFile(new URL('../src/content/fill.js',import.meta.url),'utf8');
const aliases=source.slice(source.indexOf('  const CHINALIFE_FLAT_ALIASES'),source.indexOf('  let chinalifeFingerprint'));
const matching=source.slice(source.indexOf('  function bestMatch('),source.indexOf('  function matchSkip('));
const match=vm.runInNewContext(`${aliases};${matching};bestMatch`,{
 core:globalThis.ResumeHelperCore,isChinalifeZhiyePage:()=>true,compactText:text=>String(text||'').trim()
});
const field=label=>({name:label,element:{closest:()=>({querySelector:()=>({textContent:label})})}});
test('an exact known political-status equivalence remains a 100 score at the strict threshold',()=>{
 const entry={id:'anonymous.political',label:'政治面貌',aliases:[],value:'虚构值'};
 const result=match(field('党派'),[entry],'zhiye',{confidenceThreshold:100});
 assert.equal(result?.entry?.id,entry.id);assert.equal(result.score,100);
});
test('a user-created joining-party date matches by its saved label without a fixed ID',()=>{
 const entry={id:'anonymous.new-date',label:'加入党派时间',aliases:[],value:'2018-05-17'};
 assert.equal(match(field(entry.label),[entry],'zhiye',{confidenceThreshold:100})?.entry?.id,entry.id);
});
