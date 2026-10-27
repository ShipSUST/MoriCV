import { DEFAULT_PROFILE } from '/src/data/default-profile.js';
import { emptyRecord, siteProfile } from '/src/shared/schema.js';
import { buildProfileLibraryEntries } from '/src/shared/profile-view.js';

export async function runCategoryModules() {
  if (location.hostname !== '127.0.0.1') throw new Error('Anonymous localhost only');
  const checks=[];
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
  const wait=async predicate=>{const deadline=Date.now()+10000;while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('Timed out waiting for anonymous UI');};
  const frame=document.createElement('iframe');frame.src='/options-preview?empty=1';document.body.append(frame);
  await wait(()=>frame.contentDocument?.querySelectorAll('.settings-category').length===12);
  const w=frame.contentWindow,doc=frame.contentDocument;w.confirm=()=>true;w.alert=message=>{throw Error(message);};
  const file=()=>w.eval('JSON.parse(anonymousContent)');
  const save=async()=>{doc.querySelector('#toast').textContent='';doc.querySelector('#save-button').click();await wait(()=>doc.querySelector('#toast').textContent==='修改已保存并同步到 JSON');};
  const section=category=>[...doc.querySelectorAll('.settings-category')].find(s=>s.querySelector('h2').textContent===category);
  const setInput=(input,value)=>{input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));};
  const commit=()=>[...doc.querySelectorAll('.draft-card button')].find(button=>button.textContent==='确认添加').click();
  const addRecord=category=>section(category).querySelector('.record-group-heading button').click();
  const setRecord=(key,value)=>setInput(doc.querySelector(`.draft-card [data-template-field="${key}"]`).closest('.subfield-row').querySelector('.subfield-main input,.subfield-main textarea'),value);
  check('blank settings projects36 basic and8 career fields from an empty personal JSON',section('基本信息').querySelectorAll('[data-entry-id]').length===36&&section('求职偏好').querySelectorAll('[data-entry-id]').length===8&&file().entries.length===0);
  check('fixed categories have no global add, rename, category, alias or delete controls',!doc.querySelector('#add-entry')&&![...section('基本信息').querySelectorAll('label')].some(label=>/显示名称|分类|字段别名/.test(label.firstChild?.textContent||''))&&!section('基本信息').querySelector('select,.delete-entry'));
  const card=id=>doc.querySelector(`[data-entry-id="${id}"]`);
  check('text, choice and region fields expose1,2,3 allowed inputs',card('basic.name').querySelectorAll('input,textarea').length===1&&card('basic.marital_status').querySelectorAll('input,textarea').length===2&&card('location.household').querySelectorAll('input,textarea').length===3);
  check('Other is the last settings group with its own Add button',[...doc.querySelectorAll('.settings-category')].at(-1)===section('其他')&&section('其他').querySelector('button').textContent==='新增其他');
  if(new URLSearchParams(location.search).has('new-entry')){
    for(const [school,level] of [['虚构大学甲','博士'],['虚构大学乙','硕士']]){
      addRecord('教育经历');check('record Add opens its unchanged dedicated editor without category switching',!!doc.querySelector('.draft-card [data-template-field="school"]')&&!doc.querySelector('.draft-card select'));
      setRecord('school',school);setRecord('educationLevel',level);setRecord('start','2030-09-01');setRecord('end','2033-06-30');commit();
    }
    check('two unsaved records do not alter the linked JSON',file().records.educations.length===0);await save();
    const saved=file();check('record Add preserves independent IDs, main values and dates',saved.records.educations.length===2&&new Set(saved.records.educations.map(r=>r.id)).size===2&&saved.records.educations[0].school==='虚构大学乙'&&saved.records.educations[1].school==='虚构大学甲'&&saved.records.educations.every(r=>r.start==='2030-09-01'));
    frame.remove();return{adapter:'category-modules',checks};
  }
  setInput(card('basic.name').querySelector('input'),'匿名固定姓名');
  const locationInputs=card('location.household').querySelectorAll('input,textarea');setInput(locationInputs[0],'匿名户口主值');setInput(locationInputs[1],'匿名户口候选');setInput(locationInputs[2],'匿名省，省候选\n匿名市\n匿名区');
  section('其他').querySelector('button').click();
  check('Other draft has exactly name/value inputs with no matching configuration',doc.querySelectorAll('.draft-card input,.draft-card textarea').length===2&&!doc.querySelector('.draft-card select'));
  setInput(doc.querySelector('.draft-card input'),'匿名自定义备注');setInput(doc.querySelector('.draft-card textarea'),'匿名备注主值');commit();
  check('fixed and Other edits remain detached until explicit save',file().entries.length===0);await save();
  const saved=file(),other=saved.entries.find(entry=>entry.category==='其他');
  check('saved JSON has44 ID/value fixed rows and one name/value Other row',saved.entries.length===45&&saved.entries.filter(e=>e.category!=='其他').every(e=>!('label'in e)&&!('aliases'in e))&&other.label==='匿名自定义备注'&&other.value==='匿名备注主值');
  check('only region configuration round-trips through JSON',JSON.stringify(saved.entries.find(e=>e.id==='location.household').pathValues)===JSON.stringify([['匿名省','省候选'],['匿名市'],['匿名区']])&&!('pathValues'in saved.entries.find(e=>e.id==='basic.name')));
  const panel=document.createElement('iframe'),html=await(await fetch('/preview')).text();panel.srcdoc=html.replace(/let anonymousContent = [^\n]+/,`let anonymousContent = ${JSON.stringify(JSON.stringify(saved))};`);document.body.append(panel);
  await wait(()=>panel.contentDocument?.querySelectorAll('.entry-row').length===45);
  const otherCard=[...panel.contentDocument.querySelectorAll('.category-card')].at(-1),pw=panel.contentWindow,copied=[];
  Object.defineProperty(pw.navigator,'clipboard',{configurable:true,value:{writeText:async value=>copied.push(value)}});
  check('Other remains the last sidebar group with manual fill/copy and no batch',otherCard.querySelector('h3').textContent==='其他'&&otherCard.querySelectorAll('.entry-row button').length===2&&!otherCard.querySelector('.batch'));
  const changed=structuredClone(saved);changed.entries.find(e=>e.id===other.id).value='来自最新JSON的备注';pw.eval(`anonymousContent=${JSON.stringify(JSON.stringify(changed))}`);
  [...otherCard.querySelectorAll('.entry-row button')].find(b=>b.textContent==='复制已有').click();await wait(()=>copied.length===1);
  check('Other copy resolves its stable ID from the fresh linked JSON',copied[0]==='来自最新JSON的备注');
  addRecord('亲属关系');setRecord('phone','000000');setRecord('name','虚构成员甲');commit();await save();const editedRelative=file().records.relationships[0];
  check('relative fields still save through the existing record editor',editedRelative.phone==='000000'&&editedRelative.name==='虚构成员甲');
  frame.remove();panel.remove();
  const profile=structuredClone(DEFAULT_PROFILE);
  profile.records.relationships=[editedRelative,{...emptyRecord('relationships','anonymous.relative.1'),name:'虚构成员乙',phone:'000001'}];
  const records=profile.records.relationships, settings={confidenceThreshold:78,overwriteExisting:false,rejectedMatches:[]};
  const run=(command,payload={})=>new Promise((resolve,reject)=>globalThis.__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload:{profile:siteProfile(profile),settings,...payload}},null,response=>response.error?reject(new Error(response.error)):resolve(response)));
  const values=()=>[...document.querySelectorAll('#rows input')].map(input=>input.value).join(',');
  {
    check('relative phone field creates blank editor structure',emptyRecord('relationships','anonymous.blank').phone==='');
    check('relative phone field reaches sidebar summary and child',buildProfileLibraryEntries(profile)[0].children.some(child=>child.value==='000000') && buildProfileLibraryEntries(profile)[0].value.includes('000000'));
    document.querySelector('#add').click();
    const child=buildProfileLibraryEntries(profile)[0].children.find(item=>item.id.endsWith('.phone'));
    const target=document.querySelectorAll('#rows input')[1]; target.focus(); target.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));
    const single=await run('fillTarget',{entry:child});
    check('single child field fills through real content targeting',single.success && values()===',000000');
    await run('undo'); check('single field undo restores original blank',values()===',');
    const one=await run('fillRecord',{collection:'relationships',recordId:records[0].id,resetTransaction:true});
    check('whole record includes the module field',one.filled.length===2 && values()==='虚构成员甲,000000');
    await run('undo'); check('whole record undo restores both fields',values()===',');
    const batch=await run('fillCollection',{collection:'relationships',resetTransaction:true});
    check('category batch keeps two records and field values separate',batch.filled.length===4 && values()==='虚构成员甲,000000,虚构成员乙,000001');
    await run('undo'); check('category undo removes only added group and restores original',document.querySelectorAll('#rows > div').length===1 && values()===',');
    const all=await run('fill',{resetTransaction:true});
    check('whole page includes category metadata without duplicate fields',all.filled.length===4 && values()==='虚构成员甲,000000,虚构成员乙,000001');
    const first=document.querySelectorAll('#rows input')[1]; first.value='000099'; first.dispatchEvent(new Event('input',{bubbles:true}));
    await run('undo'); check('undo protects a later user phone edit',first.value==='000099');
  }
  return {adapter:'category-modules',checks};
}
