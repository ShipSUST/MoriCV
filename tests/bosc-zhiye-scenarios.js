export async function runBosc(){
 const checks=[],check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
 const profile={entries:[{id:'basic.ethnicity',category:'基本信息',label:'民族',value:'虚构民族甲',aliases:[]},
  {id:'location.native_place',category:'基本信息',label:'籍贯',aliases:['籍贯（具体到市/区）'],value:'匿名籍贯主值',pathValues:[['匿名省'],['示例市'],['虚构区']]}],records:{}};
 const command=(command,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload:{profile,settings:{confidenceThreshold:60,overwriteExisting:false},...payload}},null,r=>r?.error?reject(Error(r.error)):resolve(r)));
 const input=key=>document.querySelector(`[data-key="${key}"] input`),display=key=>input(key).closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle')?.textContent?.trim()||'';
 if(new URLSearchParams(location.search).get('case')==='manual-other'){
  const form=input('phone').closest('div.form'),item=document.createElement('div');item.className='form-item';
  item.innerHTML='<div class="form-item__title"><label>任意补充说明</label></div><div class="form-item__control"><textarea></textarea></div>';form.append(item);
  const target=item.querySelector('textarea'),entry={id:'other.manual',category:'其他',label:'个人备注',value:'仅在明确目标填写的匿名说明'};
  profile.entries=[entry];let r=await command('fillFlatEntries',{resetTransaction:true});check('Other stays out of BOSC automatic filling',!r.filled.length&&!target.value);
  target.focus();r=await command('fillTarget',{entry});check('Other can fill an explicitly selected unique plain unknown BOSC field',r.success&&target.value===entry.value);
  check('manual Other BOSC evidence verifies',(await command('verify',{expectations:[r.expectation]})).confirmedCount===1);
  check('manual Other BOSC undo restores blank',(await command('undo')).failedCount===0&&!target.value);
  target.value='用户已有备注';target.focus();r=await command('fillTarget',{entry});check('manual Other BOSC overwrite requires confirmation',r.requiresConfirmation&&target.value==='用户已有备注');
  r=await command('fillTarget',{entry,forceOverwrite:true});check('confirmed manual Other BOSC overwrite commits',r.success&&target.value===entry.value);
  target.value='用户后改备注';await command('undo');check('manual Other BOSC undo protects later edits',target.value==='用户后改备注');
  target.value='';const copy=item.cloneNode(true);form.append(copy);target.focus();r=await command('fillTarget',{entry});check('ambiguous unknown plain BOSC fields stay protected',!r.success&&!target.value);copy.remove();
  return {adapter:'zhiye',template:'bosc',checks};
 }
 if(['staged-constant-switch','staged-region-switch'].includes(new URLSearchParams(location.search).get('case'))){
  const region=new URLSearchParams(location.search).get('case')==='staged-region-switch',opened=region?'region':'ethnicity';
  input(opened).closest('.phoenix-select').click();const panel=document.querySelector(region?'.area-selector-container':'.constant-main-layer-container');
  panel.querySelector(region?'[class*=area-icon-Radio]':'.RadioUnchecked').dispatchEvent(new MouseEvent('click',{bubbles:true}));const pending=panel.querySelector('.select-data-container').textContent;
  check('the existing panel has an unconfirmed choice before the next command',Boolean(pending)&&!display(opened));input('health').focus();
  const result=await command('fillTarget',{entry:{id:'health.staged',value:'虚构健康候选甲'}});
  check('an unconfirmed '+opened+' choice is preserved when another field is requested',!result.success&&panel.isConnected&&panel.querySelector('.select-data-container').textContent===pending&&!display('health')&&!display(opened));
  return {adapter:'zhiye',template:'bosc',checks};
 }
 if(['constant-switch','region-switch'].includes(new URLSearchParams(location.search).get('case'))){
  const opened=new URLSearchParams(location.search).get('case')==='region-switch'?'region':'ethnicity';
  input(opened).closest('.phoenix-select').click();input('health').focus();
  const r=await command('fillTarget',{entry:{id:'health.switch',value:'虚构健康候选甲'}});
  check('an owned empty single '+opened+' panel does not block the next independently selected field',r.success&&display('health')==='虚构健康候选甲'&&!display(opened));
  const v=await command('verify',{expectations:JSON.parse(JSON.stringify([r.expectation]))});check('a switch from the constant panel commits a verifiable target value',v.confirmedCount===1);
  const undo=await command('undo');check('undo after switching preserves both originally blank values',undo.failedCount===0&&!display('health')&&!display('ethnicity'));
  document.dispatchEvent(new CustomEvent('BOSC_ANONYMOUS_FAULT',{detail:JSON.stringify({kind:opened==='region'?'multiRegion':'multiConstant',value:true})}));
  input(opened).closest('.phoenix-select').click();input('health').focus();const protectedTarget=await command('fillTarget',{entry:{id:'health.protected',value:'虚构健康候选甲'}});
  check('a changed multi-value '+opened+' panel is not silently closed to fill another control',!protectedTarget.success&&!display('health')&&Boolean(document.querySelector('.common-unmodeled-layer')));
  if(opened==='region'){input('region').focus();const protectedRegion=await command('fillTarget',{entry:profile.entries[1]});check('a region changed to multi-value mode is not filled by the single-region driver',!protectedRegion.success&&!display('region')&&Boolean(document.querySelector('.area-selector-container')));}
  return {adapter:'zhiye',template:'bosc',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='safety'){
  const ethnicity=input('ethnicity'),item=ethnicity.closest('.form-item'),copy=item.cloneNode(true);item.after(copy);
  let r=await command('fillFlatEntries',{resetTransaction:true});check('duplicate identity labels invalidate the basic fingerprint rather than picking the first field',!r.filled.length&&!ethnicity.value&&!input('region').value);copy.remove();
  const extra=ethnicity.cloneNode(true);ethnicity.after(extra);r=await command('fillFlatEntries',{resetTransaction:true});check('two inputs beneath a recognized label are not automatically filled',!r.filled.length&&!ethnicity.value);extra.remove();
  const heading=document.querySelector('[data-anonymous-section=basic] > div[id]'),original=heading.textContent;heading.textContent='未知个人标题';r=await command('fillFlatEntries',{resetTransaction:true});check('an unknown basic title does not authorize a broad Phoenix fallback',!r.filled.length&&!ethnicity.value);heading.textContent=original;
  const duplicate=heading.cloneNode(true);heading.after(duplicate);r=await command('fillFlatEntries',{resetTransaction:true});check('duplicate basic headings fail closed',!r.filled.length&&!ethnicity.value);duplicate.remove();
  const health=input('health'),healthCopy=health.closest('.form-item').cloneNode(true);health.closest('.form-item').after(healthCopy);
  const originalEntries=profile.entries;profile.entries=[{id:'basic.health_status',label:'健康状况',category:'基本信息',value:'虚构健康候选甲'}];r=await command('fillFlatEntries',{resetTransaction:true});check('duplicate non-fingerprint labels are also refused as ambiguous',!r.filled.length&&!display('health'));healthCopy.remove();profile.entries=originalEntries;
  const phone=input('phone'),phoneCopy=phone.closest('.form-item').cloneNode(true);phone.closest('.form-item').after(phoneCopy);
  profile.entries=[{id:'contact.phone',label:'手机号码',category:'基本信息',value:'匿名联系电话'}];r=await command('fillFlatEntries',{resetTransaction:true});
  check('duplicate native text labels cannot fill the first matching phone input',!r.filled.length&&!phone.value&&!phoneCopy.querySelector('input').value);phoneCopy.remove();
  const phoneExtra=phone.cloneNode(true);phone.after(phoneExtra);r=await command('scan');
  check('scan refuses a native text label containing two editable inputs',!r.suggestions.some(match=>match.entryId==='contact.phone')&&!phone.value&&!phoneExtra.value);
  phone.focus();r=await command('fillTarget',{entry:profile.entries[0]});
  check('selected-field filling also refuses ambiguous native text controls',!r.success&&!phone.value&&!phoneExtra.value);phoneExtra.remove();profile.entries=originalEntries;
  const foreign=document.createElement('div');foreign.className='common-unmodeled-layer';foreign.innerHTML='<div class="phoenix-selectList"><div class="phoenix-selectList__listItem">虚构民族甲</div></div>';document.body.append(foreign);
  r=await command('fillFlatEntries',{resetTransaction:true});check('an unowned popup is not selected or dismissed',!r.filled.length&&foreign.isConnected&&!ethnicity.value&&!display('ethnicity'));foreign.remove();
  document.dispatchEvent(new CustomEvent('BOSC_ANONYMOUS_FAULT',{detail:JSON.stringify({kind:'multiConstant',value:true})}));
  profile.entries=profile.entries.slice(0,1);r=await command('fillFlatEntries',{resetTransaction:true});check('a changed multi-select constant refuses scalar filling',!r.filled.length&&!display('ethnicity')&&!ethnicity.value);
  document.dispatchEvent(new CustomEvent('BOSC_ANONYMOUS_FAULT',{detail:JSON.stringify({kind:'multiConstant',value:false})}));
  const familyHeading=document.querySelector('[data-anonymous-section=relationships] > div[id]');familyHeading.textContent='未知家庭标题';
  profile.entries=[{id:'basic.name',category:'基本信息',label:'姓名',value:'不应写入的本人姓名'},{id:'basic.political_status',category:'基本信息',label:'政治面貌',value:'群众'}];r=await command('fillFlatEntries',{resetTransaction:true});
  check('unknown non-basic forms stay isolated from applicant entries',!r.filled.length&&!document.querySelector('[data-anonymous-section=relationships] [data-key=name] input').value&&input('name').value==='网页已有姓名');
  return {adapter:'zhiye',template:'bosc',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='basic-extra'){
  profile.entries=[{id:'basic.health_status',label:'健康状况',value:'虚构健康主值',optionValues:['虚构健康候选乙','虚构健康候选甲']},{id:'basic.birth_date',label:'出生日期',value:'2000-02-29'},
   {id:'basic.party_join_date',label:'加入党派时间',value:'2020-05-17'},{id:'basic.graduation_date',label:'毕业时间',value:'2026-06-30'}].map(e=>({...e,category:'基本信息'}));
  profile.records.educations=[{id:'edu.lower',school:'低层次虚构学院',highest:'否',educationLevel:'本科',academicDegree:'学士',studyType:'全日制'},
   {id:'edu.highest',school:'最高虚构学院',highest:'是',educationLevel:'硕士研究生',academicDegree:'硕士',studyType:'全日制',fieldOptions:{studyType:['统招全日制']}}];
  const result=await command('fillFlatEntries',{resetTransaction:true,settings:{confidenceThreshold:100,overwriteExisting:false}});
  check('strict basic mapping fills four fixed main values without deriving the three highest fields',result.filled.length===4&&display('birth')==='2000-02-29'&&display('joining')==='2020-05-17'&&display('graduation')==='2026-06-30'&&display('health')==='虚构健康候选乙'&&!display('highestLevel')&&!display('highestDegree')&&!display('highestStudy'));
  const v=await command('verify',{expectations:JSON.parse(JSON.stringify(result.filled))});check('all four committed basic values verify',v.confirmedCount===4);
  const undo=await command('undo');check('basic extended undo restores the original blank choices',undo.failedCount===0&&['birth','joining','graduation','health','highestLevel','highestDegree','highestStudy'].every(key=>!display(key)));
  profile.records.educations[0].highest='是';const ambiguous=await command('fillFlatEntries',{resetTransaction:true});check('contradictory highest flags cannot choose the first education by array order',ambiguous.filled.length===4&&!display('highestLevel')&&!display('highestDegree')&&!display('highestStudy'));
  await command('undo');input('health').focus();const first=await command('fillTarget',{entry:{id:'health.before',value:'虚构健康候选乙'}});check('selected-field filling reaches the owned basic menu',first.success&&display('health')==='虚构健康候选乙');
  input('health').focus();const needs=await command('fillTarget',{entry:{id:'health.after',value:'虚构健康候选甲'}});check('existing basic values still require overwrite confirmation',needs.requiresConfirmation&&display('health')==='虚构健康候选乙');
  const changed=await command('fillTarget',{entry:{id:'health.after',value:'虚构健康候选甲'},forceOverwrite:true});check('confirmed basic overwrite commits the new exact value',changed.success&&display('health')==='虚构健康候选甲');
  const restored=await command('undo');check('basic undo restores the exact original nonempty choice',restored.failedCount===0&&display('health')==='虚构健康候选乙');
  profile.records={};profile.entries=[{id:'basic.highest_education_level',label:'全日制最高学历',value:'大学本科'},{id:'basic.highest_academic_degree',label:'全日制最高学位',value:'学士'},{id:'basic.highest_study_type',label:'最高学历学习形式',value:'统招全日制'}].map(entry=>({...entry,category:'基本信息'}));
  const direct=await command('fillFlatEntries',{resetTransaction:true,settings:{confidenceThreshold:100,overwriteExisting:false}});
  check('explicit ordinary highest fields remain direct user sources without deriving an education',direct.filled.length===3&&display('highestLevel')==='大学本科'&&display('highestDegree')==='学士'&&display('highestStudy')==='统招全日制');
  const directUndo=await command('undo');check('explicit ordinary highest fields undo without changing existing health',directUndo.failedCount===0&&!display('highestLevel')&&!display('highestDegree')&&!display('highestStudy')&&display('health')==='虚构健康候选乙');
  profile.records.educations=[{id:'conflicting.highest',highest:'是',studyType:'全日制',educationLevel:'硕士研究生'}];profile.entries=profile.entries.slice(0,1);
  const conflict=await command('fillFlatEntries',{resetTransaction:true,settings:{confidenceThreshold:100,overwriteExisting:false}});
  check('record-derived highest values cannot override or block the explicit fixed main value',conflict.filled.length===1&&display('highestLevel')==='大学本科');
  return {adapter:'zhiye',template:'bosc',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='language-cert'){
  profile.entries=[{id:'ordinary.cert',category:'基本信息',label:'证书名称',value:'不可借用的普通证书值'}];
  profile.records.foreignLanguages=[{id:'lang.bosc.a',language:'英语',proficiency:'良好',certification:'不可借用的旧投影证书',score:'999'}];
  profile.records.certifications=[{id:'cert.bosc.a',name:'虚构资格证书',certType:'职业资格',issuer:'虚构颁发机构',obtainedAt:'2022-11-25',score:'88'}];
  const read=(section,key)=>{const e=document.querySelector(`[data-anonymous-section="${section}"] [data-key="${key}"] input`);return e.closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle')?.textContent?.trim()||e.value;};
  const r=await command('fill',{resetTransaction:true});check('language and certificate collections fill only their six attributable fields',r.filled.length===6&&read('foreignLanguages','language')==='英语'&&read('foreignLanguages','proficiency')==='良好'&&read('certifications','name')==='虚构资格证书'&&read('certifications','certType')==='职业资格'&&read('certifications','issuer')==='虚构颁发机构'&&read('certifications','obtainedAt')==='2022-11-25');
  check('language certificate details do not borrow from a projected or unrelated certificate',['certName','issuer','obtainedAt','score'].every(key=>!read('foreignLanguages',key)));
  const v=await command('verify',{expectations:JSON.parse(JSON.stringify(r.filled))});check('six language and certificate fields verify',v.confirmedCount===6);
  const undo=await command('undo');check('language and certificate undo restores both collections',undo.failedCount===0&&!read('foreignLanguages','language')&&!read('certifications','obtainedAt'));
  return {adapter:'zhiye',template:'bosc',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='internship'){
  profile.entries=[];profile.records.internships=[{id:'intern.bosc.a',company:'虚构实习单位',department:'虚构部门',position:'虚构岗位',description:'虚构实习内容',location:'虚构区',fieldPaths:{location:[['匿名省'],['示例市'],['虚构区']]},start:'2023-07-01',end:'2023-09-15'}];
  const read=(section,key)=>{const e=document.querySelector(`[data-anonymous-section="${section}"] [data-key="${key}"] input,[data-anonymous-section="${section}"] [data-key="${key}"] textarea`);return e.closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle')?.textContent?.trim()||e.value;};
  const r=await command('fillRecord',{collection:'internships',recordId:'intern.bosc.a',resetTransaction:true,settings:{confidenceThreshold:100,overwriteExisting:false}});
  check('internship fills its seven observed fields, with month dates and an explicit leaf-display region path',r.filled.length===7&&read('internships','company')==='虚构实习单位'&&read('internships','department')==='虚构部门'&&read('internships','position')==='虚构岗位'&&read('internships','description')==='虚构实习内容'&&read('internships','location')==='虚构区'&&read('internships','start')==='2023-07'&&read('internships','end')==='2023-09');
  check('separate employment editors are not populated from an internship',!read('work','company')&&!read('work','start')&&!read('work','description'));
  const v=await command('verify',{expectations:JSON.parse(JSON.stringify(r.filled))});check('seven internship fields verify',v.confirmedCount===7);
  const undo=await command('undo');check('internship undo clears its own location and dates',undo.failedCount===0&&!read('internships','location')&&!read('internships','start')&&!read('internships','company'));
  return {adapter:'zhiye',template:'bosc',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='papers'){
  profile.entries=[];profile.records.papers=[{id:'paper.bosc.a',name:'虚构论文甲',venue:'虚构期刊甲',authorOrder:'第一作者',publishedAt:'2024-02-29',description:'虚构个人贡献'}];
  const read=key=>{const e=document.querySelector(`[data-anonymous-section=papers] [data-key="${key}"] input,[data-anonymous-section=papers] [data-key="${key}"] textarea`);return e.closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle')?.textContent?.trim()||e.value;};
  const r=await command('fillRecord',{collection:'papers',recordId:'paper.bosc.a',resetTransaction:true,settings:{confidenceThreshold:100,overwriteExisting:false}});
  check('paper mapping fills its title venue author contribution and leap-day publication without inventing an abstract',r.filled.length===5&&read('name')==='虚构论文甲'&&read('venue')==='虚构期刊甲'&&read('authorOrder')==='第一作者'&&read('description')==='虚构个人贡献'&&read('publishedAt')==='2024-02-29'&&!read('abstract'));
  const v=await command('verify',{expectations:JSON.parse(JSON.stringify(r.filled))});check('five paper fields verify',v.confirmedCount===5);
  const undo=await command('undo');check('paper undo restores all five originally blank fields',undo.failedCount===0&&['name','venue','authorOrder','description','publishedAt'].every(key=>!read(key)));
  profile.records.papers[0].publishedAt='2024-02';const partial=await command('fillRecord',{collection:'papers',recordId:'paper.bosc.a',resetTransaction:true});check('a month-only source cannot invent a publication day',partial.filled.length===4&&!read('publishedAt')&&partial.skipped.some(x=>/日期.*日|日期到日|资料只提供年月/.test(x.reason)));
  return {adapter:'zhiye',template:'bosc',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='family'){
  profile.entries=[{id:'basic.name',label:'姓名',value:'不应借用的本人姓名',category:'基本信息'},{id:'basic.political_status',label:'政治面貌',value:'群众',category:'基本信息'}];
  profile.records.relationships=[{id:'relative.bosc.a',relation:'父亲',name:'虚构亲属甲',birthDate:'1968-02-03',politicalStatus:'中共党员',employer:'虚构单位甲',jobTitle:'虚构职务甲'}];
  const read=key=>{const e=document.querySelector(`[data-anonymous-section=relationships] [data-key="${key}"] input`);return e.closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle')?.textContent?.trim()||e.value;};
  await command('scan');check('family scan does not populate applicant data into relative fields',!read('name')&&!read('politicalStatus'));
  const r=await command('fill',{resetTransaction:true});check('whole-page family mapping uses the relative source including political status and birth day',r.filled.filter(x=>x.entryId.startsWith('relative.bosc.a.')).length===6&&read('relation')==='父亲'&&read('name')==='虚构亲属甲'&&read('politicalStatus')==='中共党员'&&read('birthDate')==='1968-02-03'&&read('employer')==='虚构单位甲'&&read('jobTitle')==='虚构职务甲'&&!read('department')&&input('name').value==='网页已有姓名');
  const v=await command('verify',{expectations:JSON.parse(JSON.stringify(r.filled))});check('six family fields verify through committed values',v.confirmedCount===6);
  const undo=await command('undo');check('family undo preserves the original applicant name',undo.failedCount===0&&!read('name')&&!read('politicalStatus')&&input('name').value==='网页已有姓名');
  return {adapter:'zhiye',template:'bosc',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='education'){
  profile.entries=[];profile.records.educations=[
   {id:'edu.bosc.b',school:'虚构学院乙',college:'虚构院系乙',major:'虚构专业乙',educationLevel:'本科',academicDegree:'学士',studyType:'全日制',fieldOptions:{educationLevel:['大学本科'],studyType:['统招全日制']},start:'2019-09',end:'2023-06'},
   {id:'edu.bosc.a',school:'虚构学院甲',college:'虚构院系甲',major:'虚构专业甲',educationLevel:'硕士研究生',academicDegree:'硕士',studyType:'全日制',fieldOptions:{studyType:['统招全日制']},start:'2023-09-01',end:'2026-06-30'}];
  const field=(key,index)=>Array.from(document.querySelectorAll('[data-anonymous-section=educations] div.form'))[index].querySelector(`[data-key="${key}"] input`);
  const value=(key,index)=>field(key,index).closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle')?.textContent?.trim()||field(key,index).value;
  for(const [index,record]of [...profile.records.educations].reverse().entries()){field('school',index).value=record.school;field('major',index).value=record.major;}
  const filled=[];for(const [index,record]of profile.records.educations.entries()){const r=await command('fillRecord',{collection:'educations',recordId:record.id,resetTransaction:index===0,settings:{confidenceThreshold:100,overwriteExisting:false}});filled.push(...r.filled);}
  check('strict-confidence education mapping keeps existing identities while filling month dates and explicit study-type candidates',filled.length===12&&value('college',0)==='虚构院系甲'&&value('college',1)==='虚构院系乙'&&value('studyType',0)==='统招全日制'&&value('educationLevel',1)==='大学本科'&&value('start',0)==='2023-09'&&value('end',0)==='2026-06'&&value('start',1)==='2019-09'&&value('end',1)==='2023-06');
  check('unknown school, major and maximum-score fields stay blank',!value('schoolKind',0)&&!value('majorKind',0)&&!value('totalScore',0));
  const v=await command('verify',{expectations:JSON.parse(JSON.stringify(filled))});check('education verification accepts only committed month values',v.confirmedCount===12);
  const undo=await command('undo');check('education undo retains preexisting school and major identity text',undo.failedCount===0&&!value('start',0)&&!value('studyType',1)&&value('school',0)==='虚构学院甲'&&value('school',1)==='虚构学院乙');
  return {adapter:'zhiye',template:'bosc',checks};
 }
 if(new URLSearchParams(location.search).get('case')==='awards'){
  profile.entries=[];profile.records.awards=[{id:'award.bosc.a',name:'虚构省级奖项',type:'省级',fieldOptions:{type:['省区级']},issuer:'虚构授奖单位甲',start:'2024-04-17'},
   {id:'award.bosc.b',name:'虚构国家奖项',type:'国家级',issuer:'虚构授奖单位乙',start:'2023-05-18'}];
  const value=(key,index)=>{const e=Array.from(document.querySelectorAll('[data-anonymous-section=awards] div.form'))[index].querySelector(`[data-key="${key}"] input`);return e.closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle')?.textContent?.trim()||e.value;};
  const filled=[];for(const [index,record]of profile.records.awards.entries()){const part=await command('fillRecord',{collection:'awards',recordId:record.id,resetTransaction:index===0});filled.push(...part.filled);}
  check('sidebar-style award batch fills both existing editors including issuer, explicit level candidate and full date',filled.length===8&&value('name',0)==='虚构省级奖项'&&value('type',0)==='省区级'&&value('issuer',0)==='虚构授奖单位甲'&&value('start',0)==='2024-04-17'&&value('name',1)==='虚构国家奖项'&&value('type',1)==='国家级'&&value('start',1)==='2023-05-18');
  const verified=await command('verify',{expectations:JSON.parse(JSON.stringify(filled))});check('award evidence verifies eight committed fields',verified.confirmedCount===8);
  const undo=await command('undo');check('award batch undo restores all choices without removing editors',undo.failedCount===0&&['name','type','issuer','start'].every(key=>!value(key,0)&&!value(key,1))&&document.querySelectorAll('[data-anonymous-section=awards] div.form').length===2);
  profile.records.awards[0].fieldOptions={};const missing=await command('fillCollection',{collection:'awards',resetTransaction:true});
  check('a missing province equivalent leaves only that level blank and does not block later dates or awards',missing.filled.length===7&&!value('type',0)&&value('start',0)==='2024-04-17'&&value('type',1)==='国家级'&&value('start',1)==='2023-05-18'&&!Array.from(document.querySelectorAll('.common-unmodeled-layer')).some(e=>getComputedStyle(e).display!=='none'&&e.getClientRects().length));
  profile.records.awards.reverse();const repeat=await command('fillCollection',{collection:'awards',resetTransaction:false});check('source reorder and repeat preserve each award identity',repeat.filled.length===0&&value('name',0)==='虚构省级奖项'&&value('name',1)==='虚构国家奖项');
  await command('undo');profile.records.awards.push({id:'award.bosc.c',name:'虚构溢出奖项'});const overflow=await command('fillCollection',{collection:'awards',resetTransaction:true});check('insufficient award editors are reported without clicking Add or deleting records',document.querySelectorAll('[data-anonymous-section=awards] div.form').length===2&&overflow.skipped.some(x=>/仅填写当前可编辑记录/.test(x.reason)));
  return {adapter:'zhiye',template:'bosc',checks};
 }
 await command('scan');check('scan does not type into constant or region search boxes',!input('ethnicity').value&&!input('region').value);
 const result=await command('fill',{resetTransaction:true});
 check('one-click commits ethnicity and the explicit region path, instead of leaving only search queries',result.filled.length===2&&display('ethnicity')==='虚构民族甲'&&display('region')==='全国/匿名省/示例市/虚构区'&&input('name').value==='网页已有姓名');
 const verified=await command('verify',{expectations:JSON.parse(JSON.stringify(result.filled))});check('serialized evidence verifies both committed Phoenix choices',verified.confirmedCount===2);
 const undo=await command('undo');check('undo restores both blank choices and preserves existing text',undo.failedCount===0&&!display('ethnicity')&&!display('region')&&input('name').value==='网页已有姓名');
 return {adapter:'zhiye',template:'bosc',checks};
}
