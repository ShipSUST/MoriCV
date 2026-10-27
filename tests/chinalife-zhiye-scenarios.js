import {DEFAULT_PROFILE} from '/src/data/default-profile.js';
export async function runChinalife(){
 const checks=[];const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
 const command=(command,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload},null,r=>r?.error?reject(Error(r.error)):resolve(r)));
 const f=ChinalifeFixture;const settings={confidenceThreshold:78,overwriteExisting:false,rejectedMatches:[]};
 const profile=structuredClone(DEFAULT_PROFILE);profile.records.educations=[{id:'edu.anonymous.a',school:'虚构学院甲',major:'虚构专业',educationLevel:'本科',academicDegree:'学士',start:'2019-09-05',end:'2023-06-20'}];
 const red=new URLSearchParams(location.search).get('red');
 if(red==='opened-calendar'){
  const input=f.input('awards','start');input.focus();input.click();
  const r=await command('fillTarget',{entry:{id:'anonymous.opened.award',value:'2021-05-17'}});
  check('an already opened own calendar fills at the real click-to-sidebar seam',r.success&&input.value==='2021-05-17'&&!document.querySelector('.phoenix-calendar'));
  const undo=await command('undo');check('a preopened calendar fill still supports undo',undo.failedCount===0&&!input.value);
  return {adapter:'zhiye',template:'chinalife',checks};
 }
 if(red==='calendar-cleanup'){
  const input=f.input('awards','start');input.focus();f.disabledYear=2021;
  const failed=await command('fillTarget',{entry:{id:'anonymous.disabled.award',value:'2021-05-17'}});
  check('a failed calendar closes its own popup even when Escape is unsupported',!failed.success&&!input.value&&!document.querySelector('.phoenix-calendar'));
  f.disabledYear=null;const dates=structuredClone(DEFAULT_PROFILE);dates.records.projects=[{id:'project.after.failure',name:'虚构后续项目',start:'2020-02',end:'2022-06'}];f.input('projects','name').value=dates.records.projects[0].name;
  await command('fillRecord',{profile:dates,settings:{...settings,confidenceThreshold:60},collection:'projects',recordId:'project.after.failure',resetTransaction:true});
  check('a previous failed award calendar does not block the following project dates',f.input('projects','start').value==='2020-02'&&f.input('projects','end').value==='2022-06');
  return {adapter:'zhiye',template:'chinalife',checks};
 }
 if(red==='calendar-isolation'){
  const input=f.input('awards','start'),foreign=f.input('basic','birth');foreign.focus();foreign.click();
  const original=document.querySelector('.phoenix-calendar');input.focus();
  const r=await command('fillTarget',{entry:{id:'anonymous.foreign.popup',value:'2021-05-17'}});
  check('another date field\'s open calendar is not selected or closed',!r.success&&!input.value&&!foreign.value&&document.querySelector('.phoenix-calendar')===original);
  f.close();input.focus();input.click();const layer=document.querySelector('.common-unmodeled-layer');
  const extra=document.createElement('div');extra.className='common-unmodeled-layer';extra.textContent='虚构其他控件浮层';document.body.append(extra);
  const blocked=await command('fillTarget',{entry:{id:'anonymous.ambiguous.popup',value:'2021-05-17'}});
  check('multiple visible layers remain untouched',!blocked.success&&!input.value&&layer.isConnected&&extra.isConnected);extra.remove();f.close();
  input.click();input.__reactFiberAnonymous.return=null;
  const unknown=await command('fillTarget',{entry:{id:'anonymous.unknown.popup',value:'2021-05-17'}});
  check('a preopened popup with unproven ownership fails closed',!unknown.success&&!input.value&&Boolean(document.querySelector('.phoenix-calendar')));f.close();
  const region=f.input('basic','region');region.focus();region.click();
  const chosen=await command('fillTarget',{entry:{id:'anonymous.opened.region',value:'江苏',pathValues:[['江苏省'],['泰州市'],['兴化市']]}});
  check('a proven preopened region still uses its path and confirm control',chosen.success&&region.value==='中国/江苏省/泰州市/兴化市');await command('undo');
  const constant=f.input('basic','ethnicity');constant.focus();constant.click();
  const option=await command('fillTarget',{entry:{id:'anonymous.opened.constant',value:'虚构民族甲'}});
  check('a proven preopened constant selector still confirms its own choice',option.success&&constant.value==='虚构民族甲');await command('undo');
  return {adapter:'zhiye',template:'chinalife',checks};
 }
 if(red==='dependent-date'){
  const dates=structuredClone(DEFAULT_PROFILE);dates.records.projects=[{id:'project.dependent.anonymous',name:'虚构联动项目',start:'2020-02-29',end:'2022-06-25'}];f.input('projects','name').value=dates.records.projects[0].name;
  check('the end date is initially disabled by the website',f.input('projects','end').disabled);
  await command('fillRecord',{profile:dates,settings:{...settings,confidenceThreshold:95},collection:'projects',recordId:'project.dependent.anonymous',resetTransaction:true});
  check('the same record operation finds its end after the start control unlocks it',f.input('projects','start').value==='2020-02'&&f.input('projects','end').value==='2022-06');
  await command('undo');check('dependent date undo clears dates and retains the original record',!f.input('projects','start').value&&!f.input('projects','end').value&&f.input('projects','name').value==='虚构联动项目');
  return {adapter:'zhiye',template:'chinalife',checks};
 }
 if(red==='record-date-entrances'){
  const dates=structuredClone(DEFAULT_PROFILE);dates.records.awards=[{id:'award.entrance.a',name:'虚构奖项甲',start:'2021-05-17'},{id:'award.entrance.b',name:'虚构奖项乙',start:'2022-07-19'}];dates.records.projects=[{id:'project.entrance.a',name:'虚构项目甲',start:'2020-02-29',end:'2022-06-25'},{id:'project.entrance.b',name:'虚构项目乙',start:'2019-03-16',end:'2023-08-17'}];
  const strict={...settings,confidenceThreshold:100};
  f.input('awards','start').focus();const single=await command('fillTarget',{entry:{id:'award.entrance.a.start',value:dates.records.awards[0].start}});
  check('the date subfield entry still fills its selected day control',single.success&&f.input('awards','start').value==='2021-05-17');await command('undo');
  f.add('awards');f.add('projects');for(const key of ['awards','projects'])for(let index=0;index<2;index++)f.input(key,'name',index).value=dates.records[key][index].name;
  await command('fillCollection',{profile:dates,settings:strict,collection:'awards',resetTransaction:true});
  check('collection filling keeps two award dates with their own existing records',f.input('awards','start',0).value==='2021-05-17'&&f.input('awards','start',1).value==='2022-07-19');await command('undo');
  await command('fill',{profile:dates,settings:strict,resetTransaction:true});
  check('whole-page filling resolves both existing awards at threshold 100',f.input('awards','start',0).value==='2021-05-17'&&f.input('awards','start',1).value==='2022-07-19');
  check('whole-page filling unlocks and matches each project date pair independently',f.input('projects','start',0).value==='2020-02'&&f.input('projects','end',0).value==='2022-06'&&f.input('projects','start',1).value==='2019-03'&&f.input('projects','end',1).value==='2023-08');
  const repeat=await command('fill',{profile:dates,settings:strict,resetTransaction:false});check('repeated whole-page filling adds no records or writes',repeat.filled.length===0&&document.querySelectorAll('[data-anonymous-section=awards] div.form').length===2&&document.querySelectorAll('[data-anonymous-section=projects] div.form').length===2);
  await command('undo');check('batch date undo leaves all original record names in place',['awards','projects'].every(key=>[0,1].every(index=>!f.input(key,'start',index).value&&f.input(key,'name',index).value===dates.records[key][index].name)));
  await command('fillCollection',{profile:dates,settings:strict,collection:'awards',resetTransaction:true});f.field('awards','start',0).fixture.commit('2030-01-08');await command('undo');
  check('a later user edit to a record date remains protected',f.input('awards','start',0).value==='2030-01-08'&&!f.input('awards','start',1).value);
  return {adapter:'zhiye',template:'chinalife',checks};
 }
 if(red==='record-date-match'){
  const dates=structuredClone(DEFAULT_PROFILE);dates.records.awards=[{id:'award.deep.anonymous',name:'虚构奖项甲',start:'2021-05-17'}];dates.records.projects=[{id:'project.deep.anonymous',name:'虚构项目甲',start:'2020-02-29',end:'2022-06-25'}];
  f.input('awards','name').value=dates.records.awards[0].name;f.input('projects','name').value=dates.records.projects[0].name;
  const strict={...settings,confidenceThreshold:new URLSearchParams(location.search).has('strict')?100:95};const scan=await command('scan',{profile:dates,settings:strict});
  check('an occupied award date under a deep Phoenix wrapper is matched from its exact label at threshold 95',scan.suggestions.some(item=>item.entryId==='award.deep.anonymous.start'));
  check('both project month fields are matched without borrowing a neighbouring record',scan.suggestions.some(item=>item.entryId==='project.deep.anonymous.start')&&scan.suggestions.some(item=>item.entryId==='project.deep.anonymous.end'));
  await command('fillRecord',{profile:dates,settings:strict,collection:'awards',recordId:'award.deep.anonymous',resetTransaction:true});
  check('an existing award receives its full date without adding a duplicate',f.input('awards','start').value==='2021-05-17'&&document.querySelectorAll('[data-anonymous-section=awards] div.form').length===1);
  await command('fillRecord',{profile:dates,settings:strict,collection:'projects',recordId:'project.deep.anonymous',resetTransaction:false});
  check('an existing project receives year-month precision for both dates',f.input('projects','start').value==='2020-02'&&f.input('projects','end').value==='2022-06'&&document.querySelectorAll('[data-anonymous-section=projects] div.form').length===1);
  await command('undo');check('date undo preserves the existing record identities',!f.input('awards','start').value&&!f.input('projects','start').value&&f.input('awards','name').value==='虚构奖项甲'&&f.input('projects','name').value==='虚构项目甲');
  return {adapter:'zhiye',template:'chinalife',checks};
 }
 if(!red||red==='structure'){const scan=await command('scan',{profile,settings});check('required title marker and tenant headings locate education',scan.plannedRecords.educations===1&&scan.suggestions.some(s=>s.entryId==='edu.anonymous.a.school'));}
 if(!red||red==='date'){const input=f.input('educations','start');input.focus();const r=await command('fillTarget',{entry:{id:'anonymous.date',value:'2020/02/29',fieldType:'date'}});check('actual day control receives the full leap date',r.success&&input.value==='2020-02-29');await command('undo');}
 if(!red||red==='region'){const input=f.input('basic','region');input.focus();const r=await command('fillTarget',{entry:{id:'anonymous.region',value:'江苏',pathValues:[['江苏','江苏省'],['泰州市'],['兴化市']]}});check('region uses JSON levels and commits the owned dialog',r.success&&input.value==='中国/江苏省/泰州市/兴化市');await command('undo');}
 if(red==='constant'){const input=f.input('basic','ethnicity');input.focus();const r=await command('fillTarget',{entry:{id:'anonymous.ethnicity',value:'虚构民族甲'}});check('a constant selector chooses its icon and confirms before returning success',r.success&&input.value==='虚构民族甲');await command('undo');}
 if(red==='year'){const input=f.input('basic','birth');input.focus();f.yearSteps=0;f.yearChoices=0;const r=await command('fillTarget',{entry:{id:'anonymous.oldDate',value:'1960-01-01'}});check('a distant date uses the year grid and decade navigation before month and day',r.success&&input.value==='1960-01-01'&&f.yearChoices===1&&f.yearSteps<=10);await command('undo');}
 if(red==='disabled-year'){const input=f.input('basic','birth');input.focus();f.yearSteps=0;f.disabledYear=1960;const r=await command('fillTarget',{entry:{id:'anonymous.disabledYear',value:'1960-01-01'}});check('a disabled year stops within its decade without bouncing between decades',!r.success&&!input.value&&f.yearSteps<=10&&!document.querySelector('.phoenix-calendar'));f.disabledYear=null;}
 if(red==='unproven-root'){const input=f.input('basic','region');input.focus();f.wrongProvinceParent=true;const r=await command('fillTarget',{entry:{id:'anonymous.wrongParent',value:'江苏',pathValues:[['江苏省'],['泰州市'],['兴化市']]}});check('a model ancestor is never skipped without a visible direct-child relationship',!r.success&&!input.value&&!document.querySelector('.area-selector-container'));f.wrongProvinceParent=false;}
 if(red)return {adapter:'zhiye',template:'chinalife',checks};
 const value=(key,name,index=0)=>f.input(key,name,index)?.value;
 const count=key=>document.querySelectorAll(`[data-anonymous-section="${key}"] div.form`).length;
 const clone=()=>structuredClone(profile);
 const target=async(key,name,entry,force=false)=>{f.input(key,name).focus();return command('fillTarget',{entry,forceOverwrite:force});};
 const path=[['江苏省'],['泰州市'],['兴化市']];
 f.reset();const dates=clone();dates.records.educations[0].start='2020/02/29';dates.records.educations.push({id:'edu.anonymous.b',school:'虚构学院乙',major:'虚构专业乙',educationLevel:'硕士',academicDegree:'硕士',fieldOptions:{educationLevel:['硕士研究生']},start:'2024-09-01',end:'2027-06-15'});
 const filled=await command('fillCollection',{profile:dates,settings,collection:'educations',resetTransaction:true});
 check('two education records get separate full dates and fields',count('educations')===2&&value('educations','school')==='虚构学院甲'&&value('educations','school',1)==='虚构学院乙'&&value('educations','start')==='2020-02-29'&&value('educations','end',1)==='2027-06-15');
 check('a declared JSON equivalent selects the exact degree option',value('educations','educationLevel',1)==='硕士研究生'&&filled.filled.some(x=>x.entryId==='edu.anonymous.b.educationLevel'));
 const repeat=await command('fillCollection',{profile:dates,settings,collection:'educations'});check('repeated collection fill reuses its two records',count('educations')===2&&repeat.filled.length===0&&!repeat.requiresConfirmation);
 const undo=await command('undo');check('undo clears initial slots and removes only added records',undo.failedCount===0&&count('educations')===1&&!value('educations','school'));
 f.reset();f.input('educations','school').value='原先的虚构学院';f.field('educations','start').fixture.commit('2010-09-01');
 await command('fillRecord',{profile,settings,collection:'educations',recordId:'edu.anonymous.a',resetTransaction:true});check('an occupied unrelated record is preserved while a new one is added',count('educations')===2&&value('educations','school')==='原先的虚构学院'&&value('educations','school',1)==='虚构学院甲');
 f.input('educations','school',1).value='用户后来修改的虚构名称';await command('undo');check('later user edits protect the entire added record',count('educations')===2&&value('educations','school',1)==='用户后来修改的虚构名称');
 f.reset();const all=clone();all.entries=[{id:'basic.name',label:'姓名',aliases:[],value:'匿名测试者',category:'基本信息'},{id:'contact.email',label:'邮箱',aliases:[],value:'sample@example.invalid',category:'基本信息'},{id:'basic.gender',label:'性别',aliases:[],value:'男',category:'基本信息'},{id:'profile.self_evaluation',label:'自我评价',aliases:[],value:'虚构评价',category:'基本信息'}];
 all.records.internships=[{id:'intern.anonymous',company:'虚构单位',position:'虚构职位',description:'虚构工作内容',start:'2024-06-01',end:'2024-08-25'}];
 all.records.projects=[{id:'project.anonymous',name:'虚构科研项目',role:'虚构项目角色',description:'虚构项目内容',start:'2020/02/29',end:'2022-06-25'}];
 all.records.awards=[{id:'award.anonymous',name:'虚构奖项',type:'校级',fieldOptions:{type:['院校级']},issuer:'虚构颁奖单位',description:'虚构补充',start:'2021-05-16'}];
 all.records.papers=[{id:'paper.anonymous',name:'虚构论著',venue:'虚构出版社',publishedAt:'2022-07-18',authorOrder:'1',description:'虚构个人贡献'}];
 all.records.foreignLanguages=[{id:'foreign.anonymous',language:'英语',proficiency:'熟练',certification:'大学英语六级',score:0}];
 all.records.certifications=[{id:'cert.anonymous',name:'虚构资格证书',obtainedAt:'2023-01-05'}];
 all.records.relationships=[{id:'relative.anonymous.a',relation:'父亲',name:'匿名亲属甲',birthDate:'1970-04-26',employer:'虚构单位甲',jobTitle:'虚构职务甲'},{id:'relative.anonymous.b',relation:'母亲',name:'匿名亲属乙',birthDate:'1971-05-20',employer:'虚构单位乙',jobTitle:'虚构职务乙'}];
 all.records.programmingLanguages=[{id:'skill.anonymous',name:'虚构技能甲',level:'熟练'}];
 const entire=await command('fill',{profile:all,settings,resetTransaction:true});
 check('whole-page uses fixed identities and their current JSON main values',value('basic','name')==='匿名测试者'&&value('basic','email')==='sample@example.invalid'&&value('basic','description')==='虚构评价');
 check('ordinary radio groups are filled only from matching JSON items',f.field('basic','gender').querySelector('.phoenix-radio--checked').textContent==='男'&&!f.field('questionnaire','question').querySelector('.phoenix-radio--checked'));
 check('work and project field names map to their own collections',value('internships','company')==='虚构单位'&&value('internships','description')==='虚构工作内容'&&value('projects','description')==='虚构项目内容');
 check('project month mode truncates the day and reports its precision',value('projects','start')==='2020-02'&&value('projects','end')==='2022-06'&&entire.filled.some(x=>x.entryId==='project.anonymous.start'&&x.precisionNote?.includes('年月')));
 check('award and publication dates keep day precision',value('awards','start')==='2021-05-16'&&value('papers','publishedAt')==='2022-07-18'&&value('papers','venue')==='虚构出版社');
 check('author role and abstract are not invented from other meanings',!value('papers','role')&&!value('papers','abstract')&&entire.skipped.some(x=>x.field==='担任角色'));
 check('existing language exam and zero score are used without proficiency conversion',value('foreignLanguages','language')==='英语'&&value('foreignLanguages','exam')==='大学英语六级'&&value('foreignLanguages','score')==='0');
 check('certificate dates and family rows map without cross-filling',value('certifications','obtainedAt')==='2023-01-05'&&count('relationships')===2&&value('relationships','name')==='匿名亲属甲'&&value('relationships','name',1)==='匿名亲属乙'&&value('relationships','birthDate',1)==='1971-05-20');
 check('technical skills only select the provided exact option',value('programmingLanguages','name')==='虚构技能甲');
 await command('undo');check('whole-page undo preserves original row counts and clears committed controls',count('relationships')===1&&!value('certifications','obtainedAt')&&!value('basic','name')&&!value('awards','type'));
 f.reset();const alias=structuredClone(all);alias.records.papers[0].fieldAliases={authorOrder:['担任角色'],description:['内容摘要']};alias.records.papers[0].fieldOptions={authorOrder:['第一作者']};
 await command('fillCollection',{profile:alias,settings,collection:'papers',resetTransaction:true});check('explicit JSON aliases and equivalents enable otherwise ambiguous fields',value('papers','role')==='第一作者'&&value('papers','abstract')==='虚构个人贡献');await command('undo');
 f.reset();let r=await target('educations','start',{id:'date.missing',value:'2020-02',fieldType:'date'});check('a required day is never invented',!r.success&&!value('educations','start')&&r.reason.includes('日'));
 r=await target('educations','start',{id:'date.invalid',value:'2021-02-29',fieldType:'date'});check('an invalid leap day is rejected',!r.success&&!value('educations','start'));
 r=await target('educations','start',{id:'date.conflict',value:'2020-02-29',fieldType:'date',pathValues:[['2020'],['3']]});check('date path conflicts stop before opening the calendar',!r.success&&!document.querySelector('.phoenix-calendar'));
 r=await target('educations','start',{id:'date.disabled',value:'2030-12-25',fieldType:'date'});check('disabled days are refused and their popup is closed',!r.success&&!value('educations','start')&&!document.querySelector('.phoenix-calendar'));
 r=await target('educations','start',{id:'date.adjacent',value:'2020-02-01',fieldType:'date'});check('a day is selected from the current month rather than its neighbours',r.success&&value('educations','start')==='2020-02-01');await command('undo');
 f.field('educations','start').fixture.commit('2020-02-20');f.wrongDateOnce=true;r=await target('educations','start',{id:'date.wrong',value:'2019-05-16',fieldType:'date'},true);check('wrong date readback restores the original full date',!r.success&&value('educations','start')==='2020-02-20');await command('undo');
 f.wrongDateAlways=true;r=await target('educations','start',{id:'date.failedRecovery',value:'2019-05-16',fieldType:'date'},true);check('failed date recovery is retained instead of reported successful',!r.success&&value('educations','start')==='2000-01-01');f.wrongDateAlways=false;await command('undo');check('undo can retry the failed full-date recovery',value('educations','start')==='2020-02-20');
 f.reset();r=await target('basic','region',{id:'region.path',value:'简短复制值',pathValues:path});check('region completion depends on its path rather than copy text',r.success&&value('basic','region')==='中国/江苏省/泰州市/兴化市');
 f.field('basic','region').fixture.commitRegions([{id:'121',label:'中国/天津市/南开区'}]);await command('undo');check('a region changed later by the user is protected',value('basic','region')==='中国/天津市/南开区');
 f.reset();r=await target('basic','region',{id:'region.missing',value:'江苏省'});check('hierarchical regions require a path rather than a guessed copy-value split',!r.success&&!value('basic','region')&&!document.querySelector('.area-selector-container'));
 r=await target('basic','region',{id:'region.noOption',value:'江苏',pathValues:[['江苏省'],['虚构不存在的城市']]});check('an unavailable path cancels the draft without leaving a search query',!r.success&&!value('basic','region')&&!document.querySelector('.area-selector-container'));
 const city=f.field('basic','city');city.fixture.commitRegions([{id:'121',label:'南开区'},{id:'1121',label:'鼓楼区'}]);
 r=await target('basic','city',{id:'city.protected',value:'江苏',pathValues:path});check('existing multiple cities are protected without overwrite confirmation',!r.success&&city.fixture.selected.length===2);
 r=await target('basic','city',{id:'city.replace',value:'江苏',pathValues:path},true);check('one JSON path selects one city without treating aliases as extra cities',r.success&&city.fixture.selected.length===1&&city.fixture.selected[0].id==='1111');await command('undo');check('multi-city undo restores the entire original selection set',city.fixture.selected.length===2&&city.fixture.selected.some(x=>x.id==='121')&&city.fixture.selected.some(x=>x.id==='1121'));
 f.reset();f.field('basic','region').fixture.commitRegions([{id:'121',label:'中国/天津市/南开区'}]);f.wrongRegionOnce=true;r=await target('basic','region',{id:'region.wrong',value:'江苏',pathValues:path},true);check('wrong committed region restores the original selected ID',!r.success&&f.field('basic','region').fixture.selected[0]?.id==='121');await command('undo');
 f.reset();f.wrongRegionAlways=true;r=await target('basic','region',{id:'region.failedRecovery',value:'江苏',pathValues:path});check('region recovery failure is retained for undo',!r.success&&f.field('basic','region').fixture.selected[0]?.id==='1121');f.wrongRegionAlways=false;await command('undo');check('region undo can restore an originally empty selection',f.field('basic','region').fixture.selected.length===0);
 f.reset();const foreign=document.createElement('div');foreign.className='common-unmodeled-layer';foreign.innerHTML='<div class="phoenix-calendar">Unrelated calendar</div>';document.body.append(foreign);r=await target('educations','start',{id:'date.foreign',value:'2020-02-29',fieldType:'date'});check('other visible layers are left untouched',!r.success&&foreign.isConnected&&!value('educations','start'));foreign.remove();
 f.reset();const insufficient=structuredClone(all);delete insufficient.records.foreignLanguages[0].certification;delete insufficient.records.foreignLanguages[0].score;await command('fillCollection',{profile:insufficient,settings,collection:'foreignLanguages',resetTransaction:true});check('missing exam data is not replaced by general proficiency',!value('foreignLanguages','exam')&&!value('foreignLanguages','score'));await command('undo');
 f.reset();const degree=clone();degree.records.educations[0].educationLevel='不存在的学历';const missing=await command('fillCollection',{profile:degree,settings,collection:'educations',resetTransaction:true});check('a missing dropdown candidate does not stop other fields',!value('educations','educationLevel')&&value('educations','school')==='虚构学院甲'&&missing.skipped.some(x=>x.entryId==='edu.anonymous.a.educationLevel'));await command('undo');
 f.reset();let group=f.field('basic','gender').querySelector('.phoenix-radio-group');
 group.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
 r=await command('fillTarget',{entry:{id:'radio.empty',value:'男'}});
 check('actual Phoenix radios without ARIA or native inputs support single-field filling',r.success&&group.querySelector('.phoenix-radio--checked')?.textContent==='男');
 const emptyUndo=await command('undo');check('an uncleareable empty radio is reported honestly without blocking filling',emptyUndo.failedCount===1&&group.querySelector('.phoenix-radio--checked')?.textContent==='男');
 group.querySelectorAll('.phoenix-radio')[1].click();group.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
 r=await command('fillTarget',{entry:{id:'radio.replace',value:'男'},forceOverwrite:true});await command('undo');
 check('a nonempty Phoenix radio restores its original choice',r.success&&group.querySelector('.phoenix-radio--checked')?.textContent==='女');
 group.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await command('fillTarget',{entry:{id:'radio.later',value:'男'},forceOverwrite:true});group.querySelectorAll('.phoenix-radio')[1].click();const laterUndo=await command('undo');
 check('user-modified radio selections are protected',laterUndo.failedCount===1&&group.querySelector('.phoenix-radio--checked')?.textContent==='女');
 f.reset();const radioProfile=clone();radioProfile.records.educations[0].highest='是';radioProfile.records.educations[0].fieldAliases={highest:['是否最高全日制学历']};
 await command('fillCollection',{profile:radioProfile,settings,collection:'educations',resetTransaction:true});
 check('record radios require an explicit semantic alias and use the shared driver',f.field('educations','highest').querySelector('.phoenix-radio--checked')?.textContent==='是');
 f.reset();f.field('educations','highest').querySelector('.phoenix-radio').click();await command('fillRecord',{profile,settings,collection:'educations',recordId:'edu.anonymous.a',resetTransaction:true});
 check('an occupied radio-only row is preserved and a new row is added',count('educations')===2&&!value('educations','school')&&value('educations','school',1)==='虚构学院甲');await command('undo');
 f.reset();r=await target('basic','region',{id:'region.ordered',value:'短值',pathValues:[['江苏省','天津市'],['泰州市'],['兴化市']]});
 check('same-level region candidates are tried in order rather than merged',r.success&&f.field('basic','region').fixture.selected[0]?.id==='1111');await command('undo');
 f.reset();const incomplete=clone();incomplete.entries=[{id:'basic.name',label:'姓名',value:'匿名本人',aliases:[],category:'基本信息'},{id:'basic.birth_date',label:'出生日期',value:'2000-01-03',aliases:[],category:'基本信息'}];incomplete.records.relationships=[{id:'relative.empty',relation:'父亲',name:'',birthDate:''}];
 const isolatedScan=await command('scan',{profile:incomplete,settings});
 check('scan never offers applicant values to blank family records or empty collections',isolatedScan.suggestions.filter(x=>['basic.name','basic.birth_date'].includes(x.entryId)).every(x=>!document.querySelector(x.locator)?.closest('[data-anonymous-section=relationships]'))&&isolatedScan.suggestions.filter(x=>x.entryId==='basic.name').length===1);
 f.reset();group=f.field('basic','gender').querySelector('.phoenix-radio-group');group.querySelectorAll('.phoenix-radio')[1].click();group.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));f.wrongRadioOnce=true;
 r=await command('fillTarget',{entry:{id:'radio.wrong',value:'男'},forceOverwrite:true});
 check('wrong radio readback restores its original nonempty choice',!r.success&&group.querySelector('.phoenix-radio--checked')?.textContent==='女');
 f.wrongRadioAlways=true;r=await command('fillTarget',{entry:{id:'radio.recovery',value:'男'},forceOverwrite:true});
 check('failed radio recovery is not called successful',!r.success&&group.querySelector('.phoenix-radio--checked')?.textContent==='匿名第三选项');
 f.wrongRadioAlways=false;await command('undo');check('failed radio recovery keeps a retryable choice transaction',group.querySelector('.phoenix-radio--checked')?.textContent==='女');
 f.reset();const explicitQuestion=clone();explicitQuestion.entries=[{id:'other.question',label:'本人是否获得外国国籍',aliases:[],value:'否',category:'其他'}];
 await command('fill',{profile:explicitQuestion,settings,resetTransaction:true});
 check('a manual Other questionnaire answer is excluded from automatic filling',!f.field('questionnaire','question').querySelector('.phoenix-radio--checked'));
 f.field('questionnaire','question').querySelector('.phoenix-radio-group').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
 await command('fillTarget',{entry:explicitQuestion.entries[0]});
 check('the explicit Other questionnaire answer remains available for targeted filling',f.field('questionnaire','question').querySelector('.phoenix-radio--checked')?.textContent==='否');
 f.reset();const personal=clone();personal.entries=[{id:'basic.ethnicity',label:'民族',value:'别称',aliases:[],optionValues:['虚构民族甲'],category:'基本信息'},{id:'basic.political_status',label:'政治面貌',value:'中共党员',aliases:[],category:'基本信息'},{id:'basic.party_join_date',label:'加入党派时间',value:'2018-05-17',aliases:[],category:'基本信息'}];
 let page=await command('fill',{profile:personal,settings:{...settings,confidenceThreshold:100},resetTransaction:true});
 check('fixed ordinary fields and explicit personal candidates work at threshold 100',value('basic','ethnicity')==='虚构民族甲'&&value('basic','political')==='中共党员'&&value('basic','joiningParty')==='2018-05-17');
 check('fixed ordinary dates use the calendar from the main value without a region path',page.filled.some(x=>x.entryId==='basic.party_join_date'));
 await command('undo');check('ordinary date and constant selector undo restores their blank values',!value('basic','ethnicity')&&!value('basic','joiningParty'));
 f.field('basic','ethnicity').fixture.commit('虚构民族乙');r=await target('basic','ethnicity',{id:'constant.replace',value:'虚构民族甲'},true);await command('undo');
 check('a constant selector restores its previous nonempty value',r.success&&value('basic','ethnicity')==='虚构民族乙');
 f.wrongConstantOnce=true;r=await target('basic','ethnicity',{id:'constant.wrong',value:'虚构民族甲'},true);
 check('wrong constant confirmation restores the original committed value',!r.success&&value('basic','ethnicity')==='虚构民族乙');
 f.multiConstant=true;r=await target('basic','ethnicity',{id:'constant.multi',value:'虚构民族甲'},true);f.multiConstant=false;
 check('unobserved multi-constant mode stops without changing the old value',!r.success&&value('basic','ethnicity')==='虚构民族乙'&&!document.querySelector('.constant-main-layer-container'));
 r=await target('basic','ethnicity',{id:'constant.later',value:'虚构民族甲'},true);f.field('basic','ethnicity').fixture.commit('用户后来修改的虚构值');await command('undo');
 check('user edits to the constant selector are protected',r.success&&value('basic','ethnicity')==='用户后来修改的虚构值');
 return {adapter:'zhiye',template:'chinalife',checks};
}
