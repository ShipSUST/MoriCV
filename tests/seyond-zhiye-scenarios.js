import {DEFAULT_PROFILE} from '/src/data/default-profile.js';
export async function runSeyond(){
 if(location.hostname!=='127.0.0.1')throw Error('Anonymous localhost only');
 const checks=[];const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
 const profile=structuredClone(DEFAULT_PROFILE);profile.records.papers=[{id:'paper.anonymous.a',name:'虚构论文甲'}];
 const settings={confidenceThreshold:60,overwriteExisting:false,rejectedMatches:[]};
 const command=(command,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload:{profile,settings,...payload}},null,r=>r?.error?reject(Error(r.error)):resolve(r)));
 const input=(collection,key,index=0)=>Array.from(document.querySelectorAll(`[data-anonymous-section="${collection}"] div.form`))[index]?.querySelector(`[data-key="${key}"] input, [data-key="${key}"] textarea`);
 const read=(collection,key,index=0)=>{const element=input(collection,key,index);return element?.closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle')?.textContent.replace(/^请选择$/,'')??element?.value;};
 const fault=data=>document.dispatchEvent(new CustomEvent('SEYOND_ANONYMOUS_FAULT',{detail:JSON.stringify(data)}));
 if(new URLSearchParams(location.search).get('case')==='popup-switch'){
  profile.records.papers=[];
  profile.records.awards=[{id:'award.switch.a',name:'虚构省级奖项',type:'省级',fieldOptions:{type:['省区级']},start:'2024-04-17'},
   {id:'award.switch.b',name:'虚构国家奖项',type:'国家级',start:'2023-05-18'}];
  input('awards','type',1).click();
  check('a different award level is expanded before the batch',Boolean(document.querySelector('.phoenix-selectList')));
  const filled=[];
  for(const [index,record] of profile.records.awards.entries()){
   const result=await command('fillRecord',{collection:'awards',recordId:record.id,resetTransaction:index===0});filled.push(...result.filled);
  }
  check('first sidebar-style batch fills both award dates and explicit level candidates without manual popup dismissal',
   filled.length===6&&read('awards','start')==='2024-04-17'&&read('awards','type')==='省区级'
   &&read('awards','start',1)==='2023-05-18'&&read('awards','type',1)==='国家级');
  const verification=await command('verify',{expectations:JSON.parse(JSON.stringify(filled))});
  check('all six first-batch fields verify',verification.confirmedCount===6);
  const undo=await command('undo');check('switching a preopened award menu retains batch undo',undo.failedCount===0&&['name','type','start'].every(key=>!read('awards',key)&&!read('awards',key,1)));
  profile.records.awards[0].fieldOptions={};
  const missing=await command('fillCollection',{collection:'awards',resetTransaction:true});
  check('a missing explicit province candidate leaves only its level blank and continues other dates and records',
   missing.filled.length===5&&!read('awards','type')&&read('awards','start')==='2024-04-17'
   &&read('awards','type',1)==='国家级'&&read('awards','start',1)==='2023-05-18'&&!document.querySelector('.common-unmodeled-layer'));
  await command('undo');
  const foreign=document.createElement('div');foreign.className='common-unmodeled-layer';foreign.innerHTML='<div class="phoenix-selectList"><div class="phoenix-selectList__listItem">省区级</div></div>';document.body.append(foreign);
  const guarded=await command('fillCollection',{collection:'awards',resetTransaction:true});
  check('an unowned popup remains untouched instead of being selected or dismissed',foreign.isConnected&&!read('awards','type')&&!read('awards','start')&&!read('awards','type',1)&&!read('awards','start',1)&&guarded.filled.length===2);foreign.remove();
  await command('undo');input('awards','type',1).click();fault({kind:'multipleLevel'});
  const multiple=document.querySelector('.common-unmodeled-layer');
  await command('fillRecord',{collection:'awards',recordId:'award.switch.a',resetTransaction:true});
  check('a multi-value menu is not dismissed while filling another award',multiple.isConnected&&document.querySelector('.common-unmodeled-layer')===multiple&&!read('awards','type')&&!read('awards','start'));
  return {adapter:'zhiye',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='safety'){
  const noPaper=async()=>{try{return await command('fillRecord',{collection:'papers',recordId:'paper.anonymous.a',resetTransaction:true});}catch(error){return {filled:[],error:error.message};}};
  const heading=document.querySelector('[data-anonymous-section="papers"] > div[id]'),duplicate=heading.cloneNode(true);heading.after(duplicate);
  let result=await noPaper();check('duplicate paper headings refuse automatic record mapping',!result.filled.length&&!read('papers','name'));
  profile.entries=[{id:'ordinary.bad',category:'基本信息',label:'名称',aliases:['获奖项','年度/期次'],value:'不应串入的个人值'}];result=await command('fill',{resetTransaction:true});check('ambiguous paper and empty award editors remain isolated from ordinary entries',!result.filled.length&&!read('papers','name')&&!read('papers','yearIssue')&&!read('awards','name'));duplicate.remove();
  heading.textContent='未知标题';result=await command('fill',{resetTransaction:true});check('an unknown title keeps the observed record fingerprint isolated from ordinary data',!result.filled.length&&!read('papers','name')&&!read('papers','yearIssue'));heading.textContent='论文/专著';
  const label=document.querySelector('[data-anonymous-section="papers"] [data-key="venue"] label');label.textContent='未知字段';result=await noPaper();check('changed paper fingerprint fails closed',!result.filled.length&&!read('papers','name'));label.textContent='所属期刊';
  const duplicateInput=input('papers','name').cloneNode(true);input('papers','name').after(duplicateInput);result=await noPaper();check('two editable controls under one paper label are refused as ambiguous',!result.filled.length&&!read('papers','name'));duplicateInput.remove();
  const originalPath=location.pathname+location.search;history.replaceState(null,'','/jobs');result=await noPaper();check('unobserved path does not reuse the Seyond record mapping',!result.filled.length&&!read('papers','name'));history.replaceState(null,'',originalPath);
  input('papers','name').value='虚构论文甲';const form=document.querySelector('[data-anonymous-section="papers"] div.form'),clone=form.parentElement.cloneNode(true);form.parentElement.after(clone);result=await noPaper();check('duplicate populated paper identities require manual resolution',!result.filled.length&&Array.from(document.querySelectorAll('[data-anonymous-section="papers"] [data-key="name"] input')).every(input=>input.value==='虚构论文甲'));
  return {adapter:'zhiye',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='scan'){
  profile.records.awards=[{id:'award.anonymous.a',name:'虚构奖项甲'},{id:'award.anonymous.b',name:'虚构奖项乙'}];profile.records.papers=[];
  const result=await command('scan');
  const suggested=result.suggestions.filter(row=>row.entryId.startsWith('award.'));
  check('scan previews both observed award editors without cross-record locators',suggested.length===2&&new Set(suggested.map(row=>row.locator)).size===2&&!read('awards','name')&&!read('awards','name',1));
  return {adapter:'zhiye',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='date'){
  profile.records.papers=[{id:'paper.anonymous.a',publishedAt:'2024-02-29'}];
  let result=await command('fillRecord',{collection:'papers',recordId:'paper.anonymous.a',resetTransaction:true});
  check('paper full publication date commits through its Phoenix calendar',result.filled.length===1&&read('papers','publishedAt')==='2024-02-29');
  let verification=await command('verify',{expectations:JSON.parse(JSON.stringify(result.filled))});check('full date verifies after JSON evidence transport',verification.confirmedCount===1);
  await command('undo');check('date undo clears committed display and query',!read('papers','publishedAt')&&!input('papers','publishedAt').value);
  profile.records.papers[0].publishedAt='2024-02';result=await command('fillRecord',{collection:'papers',recordId:'paper.anonymous.a',resetTransaction:true});check('missing source day is refused without inventing the first day',!result.filled.length&&!read('papers','publishedAt')&&result.skipped.some(x=>/日|精度/.test(x.reason)));
  const date=input('papers','publishedAt');date.focus();date.click();result=await command('fillTarget',{entry:{id:'date.before',value:'2022-12-31',fieldType:'date'}});check('selected date is filled through its owned calendar',result.success&&read('papers','publishedAt')==='2022-12-31');
  date.focus();result=await command('fillTarget',{entry:{id:'date.after',value:'2024-02-29',fieldType:'date'}});check('nonempty date requires explicit confirmation',result.requiresConfirmation&&read('papers','publishedAt')==='2022-12-31');
  result=await command('fillTarget',{entry:{id:'date.after',value:'2024-02-29',fieldType:'date'},forceOverwrite:true});check('confirmed overwrite commits the full target date',result.success&&read('papers','publishedAt')==='2024-02-29');
  let undo=await command('undo');check('date undo restores the exact nonempty original',undo.failedCount===0&&read('papers','publishedAt')==='2022-12-31');
  fault({kind:'wrongDateOnce'});date.focus();result=await command('fillTarget',{entry:{id:'date.rejected',value:'2024-02-29',fieldType:'date'},forceOverwrite:true});check('a wrong website date commit is rejected and nonempty original recovered',!result.success&&read('papers','publishedAt')==='2022-12-31');
  date.focus();result=await command('fillTarget',{entry:{id:'date.later',value:'2024-02-29',fieldType:'date'},forceOverwrite:true});fault({kind:'laterDate'});undo=await command('undo');check('undo preserves a later user date edit',undo.failedCount===1&&read('papers','publishedAt')==='2025-03-12');
  fault({kind:'dateMetadata',format:'unknown'});date.focus();result=await command('fillTarget',{entry:{id:'date.unknown',value:'2024-02-29',fieldType:'date'},forceOverwrite:true});check('unknown date metadata fails closed rather than typing into a search query',!result.success&&read('papers','publishedAt')==='2025-03-12');
  return {adapter:'zhiye',checks};
 }
 const result=await command('fillRecord',{collection:'papers',recordId:'paper.anonymous.a',resetTransaction:true});
 check('paper mother record fills its observed name field: '+JSON.stringify({filled:result.filled.length,skipped:result.skipped}),result.filled.length===1&&document.querySelector('[data-anonymous-section="papers"] [data-key="name"] input').value==='虚构论文甲');
 if(new URLSearchParams(location.search).has('minimal'))return {adapter:'zhiye',checks};
 await command('undo');
 const paper={id:'paper.anonymous.a',name:'虚构论文甲',venue:'匿名研究学报',authorOrder:'第一作者',publishedAt:'2024-02-29'};
 const awards=[{id:'award.anonymous.a',name:'虚构奖项甲',type:'省级',fieldOptions:{type:['省区级']},description:'虚构说明甲',start:'2024-04-17'},{id:'award.anonymous.b',name:'虚构奖项乙',type:'国家级',description:'虚构说明乙',start:'2023-05-18'}];
 profile.records.papers=[paper];profile.records.awards=awards;
 let r=await command('scan',{settings:{...settings,confidenceThreshold:100}});
 check('full scan previews twelve fields in three distinct existing records',r.suggestions.length===12&&new Set(r.suggestions.map(x=>x.locator)).size===12&&!read('papers','name')&&!read('awards','name'));
 r=await command('fillRecord',{collection:'papers',recordId:paper.id,resetTransaction:true,settings:{...settings,confidenceThreshold:100}});
 check('paper maps name venue author order and full date at strict confidence',r.filled.length===4&&read('papers','name')===paper.name&&read('papers','venue')===paper.venue&&read('papers','authorOrder')==='第一作者'&&read('papers','publishedAt')==='2024-02-29');
 check('year issue remains blank with an explicit manual reason',!read('papers','yearIssue')&&r.skipped.some(x=>x.field==='年度/期次'&&/不.*推断|不会.*推断/.test(x.reason)));
 let v=await command('verify',{expectations:JSON.parse(JSON.stringify(r.filled))});check('serialized paper evidence confirms actual committed controls',v.confirmedCount===4);
 let u=await command('undo');check('paper undo restores all four originally blank fields',u.failedCount===0&&['name','venue','authorOrder','publishedAt'].every(key=>!read('papers',key)));
 input('papers','name').value=paper.name;input('papers','venue').value='原手填刊物';r=await command('fillRecord',{collection:'papers',recordId:paper.id,resetTransaction:true,settings:{...settings,overwriteExisting:true}});check('record overwrite still requires confirmation for a different existing venue',r.requiresConfirmation&&read('papers','venue')==='原手填刊物');
 r=await command('fillRecord',{collection:'papers',recordId:paper.id,settings:{...settings,overwriteExisting:true,recordConflictConfirmed:true}});check('confirmed record fills only its paper editor',read('papers','venue')===paper.venue&&!read('awards','name'));u=await command('undo');check('record undo restores the original nonempty paper text',u.failedCount===0&&read('papers','venue')==='原手填刊物'&&read('papers','name')===paper.name);input('papers','name').value='';input('papers','venue').value='';
 r=await command('fillCollection',{collection:'awards',resetTransaction:true});
 check('award collection fills two existing editors with their own date name level and description',r.filled.length===8&&read('awards','name')==='虚构奖项甲'&&read('awards','start')==='2024-04-17'&&read('awards','type')==='省区级'&&read('awards','description')==='虚构说明甲'&&read('awards','name',1)==='虚构奖项乙'&&read('awards','start',1)==='2023-05-18'&&read('awards','type',1)==='国家级'&&read('awards','description',1)==='虚构说明乙');
 v=await command('verify',{expectations:r.filled});check('both award records verify through committed displays',v.confirmedCount===8);
 const swapped=structuredClone(profile);swapped.records.awards.reverse();r=await command('fillCollection',{collection:'awards',profile:swapped,resetTransaction:false});check('source reorder and repeat reuse existing award identities',r.filled.length===0&&document.querySelectorAll('[data-anonymous-section="awards"] div.form').length===2&&read('awards','name')==='虚构奖项甲');
 u=await command('undo');check('award batch undo restores dates levels and text without deleting editors',u.failedCount===0&&['start','name','type','description'].every(key=>!read('awards',key)&&!read('awards',key,1)));
 r=await command('fillRecord',{collection:'awards',recordId:awards[1].id,resetTransaction:true});check('choosing the second source directly uses one editor only',r.filled.length===4&&[read('awards','name'),read('awards','name',1)].filter(Boolean).join()==='虚构奖项乙');await command('undo');
 input('papers','venue').focus();input('papers','venue').click();r=await command('fillTarget',{entry:{id:'paper.single.venue',value:'虚构单字段刊物'}});check('selected paper subfield changes only its own input',r.success&&read('papers','venue')==='虚构单字段刊物'&&!read('papers','name'));await command('undo');
 profile.entries=[{id:'ordinary.name',category:'基本信息',label:'名称',value:'不应串入的本人名称',aliases:[]},{id:'ordinary.issue',category:'基本信息',label:'年度/期次',value:'不应猜填的期次',aliases:[]}];
 r=await command('fill',{resetTransaction:true});check('whole page fills twelve structured fields and isolates ordinary personal entries',r.filled.length===12&&read('papers','name')===paper.name&&read('awards','name')===awards[0].name&&!read('papers','yearIssue'));
 input('awards','description').value='后来手工编辑';u=await command('undo');check('undo preserves a later user edit and restores the remaining eleven fields',u.failedCount===1&&read('awards','description')==='后来手工编辑'&&!read('papers','name')&&!read('awards','name'));input('awards','description').value='';
 const unsupported=structuredClone(profile);unsupported.records.awards=[{id:'unsupported.level',name:'级别不匹配奖项',type:'省级'}];r=await command('fillRecord',{profile:unsupported,collection:'awards',recordId:'unsupported.level',resetTransaction:true});check('a province level without an explicit equivalent candidate stays unselected',r.filled.length===1&&!read('awards','type')&&r.skipped.some(x=>x.field==='获奖级别'));await command('undo');
 const overflow=structuredClone(profile);overflow.records.awards.push({id:'award.anonymous.c',name:'虚构奖项丙'});r=await command('fillCollection',{profile:overflow,collection:'awards',resetTransaction:true});check('insufficient editors are reported without clicking Add',document.querySelectorAll('[data-anonymous-section="awards"] div.form').length===2&&r.skipped.some(x=>/仅填写当前可编辑记录/.test(x.reason)));await command('undo');
 return {adapter:'zhiye',checks};
}
