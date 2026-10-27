export async function runSany(){
 const checks=[],check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
 const profile={entries:[],records:{}},command=(command,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload:{profile,settings:{confidenceThreshold:60,overwriteExisting:false},...payload}},null,r=>r?.error?reject(Error(r.error)):resolve(r)));
 const input=key=>document.querySelector(`[data-key="${key}"] input`),value=key=>input(key).closest('.phoenix-select').querySelector('.phoenix-select__calcEle').textContent.trim().replace(/^请选择$/,'');
 const fault=data=>document.dispatchEvent(new CustomEvent('SANY_ANONYMOUS_FAULT',{detail:JSON.stringify(data)}));
 const dateEntry={id:'other.sany.start',category:'其他',label:'开始时间',fieldType:'date',value:'2021-03-17'};
 const testCase=new URLSearchParams(location.search).get('case');
 if(testCase==='record-path'){
  profile.records.projects=[{id:'anonymous-conflict',start:'2022-04-19',fieldPaths:{start:[['2020年'],['四月'],['19日']]}}];
  const conflict=await command('fillCollection',{collection:'projects',resetTransaction:true});check('record day path contradicting the main date refuses rather than ignoring configuration',!conflict.filled.length&&!value('start')&&!document.querySelector('.common-unmodeled-layer'));
  profile.records.projects[0].fieldPaths.start=[['2022年'],['四月'],['19日']];const matching=await command('fillCollection',{collection:'projects',resetTransaction:true});check('matching record date path preserves main-date selection',matching.filled.length===1&&value('start')==='2022-04-19');return {checks};
 }
 if(testCase==='undo-format'){
  input('start').focus();const r=await command('fillTarget',{entry:dateEntry});check('date initially commits before format changes',r.success&&value('start')==='2021-03-17');fault({kind:'format',value:'unknown'});
  const undo=await command('undo');check('undo refuses changed unknown precision instead of mutating a controlled input',undo.failedCount===1&&value('start')==='2021-03-17'&&input('start').value==='2021-03-17');return {checks};
 }
 if(['owner','twoOwners','sharedOwner','foreign'].includes(testCase)){
  if(testCase==='foreign'){const layer=document.createElement('div');layer.className='common-unmodeled-layer';layer.innerHTML='<div class="phoenix-calendar"><div class="phoenix-calendar-date-panel"><div class="phoenix-calendar-cell">17</div></div></div>';document.body.append(layer);}
  else {input('start').closest('.phoenix-select').click();fault({kind:testCase});}
  const panels=Array.from(document.querySelectorAll('.common-unmodeled-layer'));input('start').focus();const r=await command('fillTarget',{entry:dateEntry});
  check('unowned or ambiguous popups are never selected or dismissed',!r.success&&!value('start')&&panels.every(panel=>panel.isConnected));return {checks};
 }
 await command('scan');check('scan does not open or mutate dates',!value('start')&&!document.querySelector('.common-unmodeled-layer'));
 input('start').focus();const r=await command('fillTarget',{entry:{id:'other.sany.start',category:'其他',label:'开始时间',fieldType:'date',value:'2021-03-17'}});
 check('full date keeps its observed day precision',r.success&&value('start')==='2021-03-17');
 check('day evidence verifies',(await command('verify',{expectations:[r.expectation]})).confirmedCount===1);
 check('undo restores blank',(await command('undo')).failedCount===0&&!value('start'));
 input('start').focus();const reopened=await command('fillTarget',{entry:dateEntry});check('reopen follows committed branch and connected wrapper despite stale portal root',reopened.success&&value('start')==='2021-03-17');await command('undo');
 input('start').focus();const partial=await command('fillTarget',{entry:{...dateEntry,value:'2021-03'}});check('month-only source never guesses a day',!partial.success&&!value('start')&&!document.querySelector('.common-unmodeled-layer'));
 fault({kind:'format',value:'YYYY/MM/DD'});input('start').focus();const unknown=await command('fillTarget',{entry:dateEntry});check('unknown format refuses without opening calendar',!unknown.success&&!value('start')&&!document.querySelector('.common-unmodeled-layer'));fault({kind:'format',value:'YYYY-MM-DD'});
 const extra=input('start').cloneNode();input('start').after(extra);input('start').focus();const multi=await command('fillTarget',{entry:dateEntry});check('two inputs beneath one title refuse date filling',!multi.success&&!value('start')&&!document.querySelector('.common-unmodeled-layer'));extra.remove();
 const duplicate=input('start').closest('.form-item').cloneNode(true);input('start').closest('.form-item').after(duplicate);input('start').focus();const repeated=await command('fillTarget',{entry:dateEntry});check('duplicate titles in one form refuse date filling',!repeated.success&&!value('start')&&!document.querySelector('.common-unmodeled-layer'));duplicate.remove();
 const wrapper=input('start').closest('.phoenix-unmodeled-layer');wrapper.classList.remove('phoenix-unmodeled-layer');input('start').focus();const shape=await command('fillTarget',{entry:dateEntry});check('unknown wrapper structure refuses date filling',!shape.success&&!value('start')&&!document.querySelector('.common-unmodeled-layer'));wrapper.classList.add('phoenix-unmodeled-layer');
 profile.entries=[{id:'basic.birth_date',category:'基本信息',label:'出生日期',value:'2000-02-29',fieldType:'date'},{id:'basic.graduation_date',category:'基本信息',label:'毕业时间',value:'2026-06-30',fieldType:'date'},{id:'career.graduation_date',category:'求职偏好',label:'预计毕业日期',value:'2027-07-31',fieldType:'date'}];
 profile.records.educations=[{id:'record.not-source',end:'2030-12-25',start:'2001-01-01'}];
 let flat=await command('fillFlatEntries',{resetTransaction:true});check('birth and actual graduation use their fixed main values',flat.filled.length===2&&value('birth')==='2000-02-29'&&value('graduation')==='2026-06-30');
 check('both flat date writes verify',(await command('verify',{expectations:flat.filled})).confirmedCount===2);await command('undo');
 profile.entries=profile.entries.filter(entry=>entry.id==='career.graduation_date');flat=await command('fillFlatEntries',{resetTransaction:true});check('empty fixed main values do not borrow expected graduation or education records',!flat.filled.length&&!value('birth')&&!value('graduation'));
 profile.entries=[];profile.records={projects:[{id:'anonymous-project',start:'2022-04-19',end:'2023-09-23'}]};
 const record=await command('fillCollection',{collection:'projects',resetTransaction:true});check('existing record write path keeps full day precision',record.filled.length===2&&value('start')==='2022-04-19'&&value('end')==='2023-09-23');
 check('record dates verify',(await command('verify',{expectations:record.filled})).confirmedCount===2);check('record date undo restores blanks',(await command('undo')).failedCount===0&&!value('start')&&!value('end'));
 profile.records.projects=[{id:'anonymous-project-month',start:'2022-04'}];const monthRecord=await command('fillCollection',{collection:'projects',resetTransaction:true});check('direct record chooser never guesses missing day',!monthRecord.filled.length&&!value('start')&&!value('end'));
 return {checks};
}
