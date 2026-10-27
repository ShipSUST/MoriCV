export async function runSany(){
 const checks=[],check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
 // Match sidepanel dispatch: the production siteProfile projection adds
 // default record aliases even when the portable JSON contains none.
 const profile=structuredClone(globalThis.__sanySiteProfile);
 const command=(command,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload:{profile,settings:{confidenceThreshold:60,overwriteExisting:false},...payload}},null,r=>r?.error?reject(Error(r.error)):resolve(r)));
 const testCase=new URLSearchParams(location.search).get('case');
 const form=index=>document.querySelectorAll('[data-anonymous-section="awards"] div.form[id]')[index];
 const input=(key,index=0)=>form(index)?.querySelector('[data-key="'+key+'"] input');
 const value=(key,index=0)=>{const node=input(key,index);return node?.closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle')?.textContent.replace(/^请选择$/,'')||node?.value||'';};
 if(testCase==='ambiguous'){
  profile.records={};profile.entries=[{id:'basic.name',category:'基本信息',value:'匿名本人'}];
  const heading=document.querySelector('[data-anonymous-section="awards"] > div[id]');heading.after(heading.cloneNode(true));
  const extra=document.createElement('label');extra.textContent='姓名';const target=document.createElement('input');extra.append(target);form(0).append(extra);
  const filled=await command('fillFlatEntries',{resetTransaction:true});
  check('ambiguous award headings never expose a record to ordinary applicant filling',!filled.filled.length&&!target.value);
  return {checks};
 }
 if(testCase==='malformed'){
  profile.records={};profile.entries=[{id:'basic.ethnicity',category:'基本信息',value:'虚构民族甲'}];
  const item=document.querySelector('[data-anonymous-section="basic"] [data-key="ethnicity"]');item.after(item.cloneNode(true));
  const filled=await command('fillFlatEntries',{resetTransaction:true});
  check('duplicate scalar labels refuse before typing into either search input',!filled.filled.length&&Array.from(document.querySelectorAll('[data-key="ethnicity"] input')).every(node=>!node.value));
  return {checks};
 }
 if(['switch','pending','unknown','multi','delayed'].includes(testCase)){
  profile.records={};profile.entries=[{id:'basic.ethnicity',category:'基本信息',value:'虚构民族甲'},{id:'location.household',category:'基本信息',value:'匿名省/示例市/虚构区',pathValues:[['匿名省'],['示例市'],['虚构区']]}];
  const ethnicity=document.querySelector('[data-anonymous-section="basic"] [data-key="ethnicity"] .phoenix-select');
  if(['switch','pending'].includes(testCase))ethnicity.click();
  if(testCase==='pending')document.querySelectorAll('.list-item-container .RadioUnchecked')[1].dispatchEvent(new MouseEvent('click',{bubbles:true}));
  let unknown;
  if(testCase==='unknown'){unknown=document.createElement('div');unknown.className='common-unmodeled-layer';unknown.textContent='用户未完成的未知控件';document.body.append(unknown);}
  if(testCase==='multi'){document.dispatchEvent(new CustomEvent('SANY_CONTROLS_FIXTURE_FAULT',{detail:JSON.stringify({multiRegion:true})}));profile.entries=profile.entries.filter(row=>row.id==='location.household');}
  const filled=await command('fillFlatEntries',{resetTransaction:true});
  if(['switch','delayed'].includes(testCase))check('owned scalar controls finish on their first batch with '+testCase+' menus (filled='+filled.filled.length+')',filled.filled.length===2&&!document.querySelector('.common-unmodeled-layer'));
  if(testCase==='pending')check('another control pending selection is not canceled or replaced',!filled.filled.length&&document.querySelector('.constant-main-layer-container .select-data-container')?.textContent.includes('虚构民族乙'));
  if(testCase==='unknown')check('unknown user popup remains untouched',!filled.filled.length&&unknown.isConnected);
  if(testCase==='multi')check('a multi-value region is never treated as a scalar',!filled.filled.length&&!document.querySelector('[data-key="region"] .phoenix-select__calcEle').textContent.replace(/^请选择$/,''));
  return {checks};
 }
 if(testCase==='month')profile.records.awards[0].start='2021-04';
 if(testCase==='existing'){
  input('name').value='用户保留的奖项';
  const filled=await command('fillCollection',{collection:'awards',resetTransaction:true});
  check('a pre-existing foreign record is preserved while an empty slot is used',value('name')==='用户保留的奖项'&&!value('start')&&value('name',1)==='匿名奖项甲'&&filled.filled.length===3);
  check('undo restores only the new record and preserves user content',(await command('undo')).failedCount===0&&value('name')==='用户保留的奖项'&&!value('name',1));
  return {checks};
 }
 if(['competition','radio','no-empty-slot'].includes(testCase)){
  if(testCase!=='radio')input('competition').value='用户保留的竞赛';
  if(testCase!=='competition')form(testCase==='no-empty-slot'?1:0).querySelector('.phoenix-radio').click();
  const filled=await command('fillCollection',{collection:'awards',resetTransaction:true});
  check('unmapped competition text and radio selections are occupied record data',!value('name')&&!value('start')
    && (testCase==='no-empty-slot'?!filled.filled.length:filled.filled.length===3&&value('name',1)==='匿名奖项甲'));
  if(testCase!=='radio')check('existing competition text is preserved',value('competition')==='用户保留的竞赛');
  check('undo only restores the selected empty slot',(await command('undo')).failedCount===0&&!value('name',1));
  return {checks};
 }
 if(testCase==='single'){
  const filled=await command('fillRecord',{collection:'awards',recordId:'anonymous-award',resetTransaction:true});
  check('single-record entry uses the same award mapping',filled.filled.length===3&&value('name')==='匿名奖项甲'&&!value('name',1));
  check('single-record transaction verifies',(await command('verify',{expectations:filled.filled})).confirmedCount===3);
  check('single-record undo restores its own slot',(await command('undo')).failedCount===0&&!value('name'));
  return {checks};
 }
 if(testCase==='whole'){
  profile.entries=[{id:'basic.ethnicity',category:'基本信息',value:'虚构民族甲'},{id:'location.household',category:'基本信息',value:'匿名省/示例市/虚构区',pathValues:[['匿名省'],['示例市'],['虚构区']]}];
  profile.records.awards[0].fieldOptions={awardCategory:['竞赛'],type:['省市级']};
  profile.records.awards.push({id:'anonymous-award-2',name:'匿名奖项乙',start:'2022-08-09',type:'国家级',grade:'二等奖',awardCategory:'竞赛获奖',fieldOptions:{awardCategory:['竞赛']}});
  const preview=await command('scan');check('whole-page preview includes two scalar controls and both isolated award records (suggestions='+preview.suggestions.length+', structured='+preview.structured+')',preview.suggestions.length===12&&!input('name').value&&!input('name',1).value);
  const filled=await command('fill',{resetTransaction:true});
  check('whole-page fill commits the two controls and ten award fields',filled.filled.length===12);
  check('repeated awards use each record own name, day, level and explicit candidates',value('name')==='匿名奖项甲'&&value('name',1)==='匿名奖项乙'&&value('start')==='2021-04-10'&&value('start',1)==='2022-08-09'&&value('type')==='省市级'&&value('type',1)==='国家级'&&value('awardCategory')==='竞赛');
  check('competition names are not invented from award names',!value('competition')&&!value('competition',1));
  check('whole-page transaction verifies all twelve writes',(await command('verify',{expectations:filled.filled})).confirmedCount===12);
  check('whole-page undo restores both records and all controls',(await command('undo')).failedCount===0&&!value('name')&&!value('name',1)&&!value('type'));
  return {checks};
 }
 if(['ethnicity','region'].includes(testCase)){
  if(new URLSearchParams(location.search).has('minimal')){
   document.querySelector('[data-anonymous-section="awards"]').remove();
   document.querySelector('[data-anonymous-section="basic"] [data-key="'+(testCase==='ethnicity'?'region':'ethnicity')+'"]').remove();
  }
  profile.records={};profile.entries=[testCase==='ethnicity'?{id:'basic.ethnicity',category:'基本信息',value:'虚构民族甲'}:{id:'location.household',category:'基本信息',value:'匿名省/示例市/虚构区',pathValues:[['匿名省'],['示例市'],['虚构区']]}];
  const result=await command('fillFlatEntries',{resetTransaction:true});
  const text=document.querySelector('[data-anonymous-section="basic"] [data-key="'+testCase+'"] .phoenix-select__calcEle').textContent;
  check('Sany '+testCase+' commits the configured value (filled='+result.filled.length+', display='+text+')',result.filled.length===1&&(testCase==='ethnicity'?text==='虚构民族甲':text.endsWith('虚构区')));
  return {checks};
 }
 if(testCase==='minimal'){
  document.querySelector('[data-anonymous-section="basic"]').remove();
  Array.from(document.querySelectorAll('[data-anonymous-section="awards"] div.form[id]')).slice(1).forEach(form=>form.remove());
 }
 if(testCase==='hidden-name')input('name').closest('.form-item').style.display='none';
 const result=await command('fillCollection',{collection:'awards',resetTransaction:true});
 if(testCase==='hidden-name'){
  check('an unavailable exact Sany field never falls back to a generic competition alias',!value('name')&&!value('competition')&&result.filled.length===2);
  check('independent award date and grade still verify',(await command('verify',{expectations:result.filled})).confirmedCount===2);
  check('undo restores only the supported fields',(await command('undo')).failedCount===0&&!value('start')&&!value('grade'));
  return {checks};
 }
 check('observed Sany award editor receives its explicit award name (filled='+result.filled.length+')',document.querySelector('[data-anonymous-section="awards"] [data-key="name"] input').value==='匿名奖项甲');
 if(testCase==='month'){
  check('month-only award date stays empty with a day-precision reason',!value('start')&&result.skipped.some(row=>row.reason?.includes('只提供年月')));
  check('month precision does not prevent independent award name and grade',value('grade')==='一等奖'&&result.filled.length===2);
  return {checks};
 }
 check('an exact day and grade use the same award source',value('start')==='2021-04-10'&&value('grade')==='一等奖');
 check('unconfigured category and level alternatives stay empty',!value('awardCategory')&&!value('type')&&!value('competition'));
 check('award evidence verifies the three supported writes',(await command('verify',{expectations:result.filled})).confirmedCount===3);
 if(testCase==='edited'){
  input('grade').value='用户手动修改的等级';await command('undo');
  check('undo preserves a user-edited award field while restoring other writes',value('grade')==='用户手动修改的等级'&&!value('name')&&!value('start'));
  return {checks};
 }
 check('award undo restores its own record',(await command('undo')).failedCount===0&&!value('name')&&!value('start')&&!value('grade'));
 return {checks};
}
