export async function runRecords(){
const checks=[];const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
const profile={entries:[],records:{programmingLanguages:[{id:'skill-a',name:'虚构甲语言',level:'熟练'},{id:'skill-t',name:'虚构工具',level:'了解'}]}};
const settings={confidenceThreshold:100,overwriteExisting:false,rejectedMatches:[]};
const command=(command,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload:{profile,settings,...payload}},null,result=>result?.error?reject(Error(result.error)):resolve(result)));
const val=id=>document.getElementById(id)?.value;
if(new URLSearchParams(location.search).get('case')==='path-source'){
 profile.records.programmingLanguages=[{id:'path-skill',name:'用户自定技术称呼',level:'熟练',fieldPaths:{name:[['虚构编程类'],['虚构甲语言']]}}];
 let result=await command('fillRecord',{collection:'programmingLanguages',recordId:'path-skill'});check('record field path can express an explicit two-level skill selection',result.filled.length===2&&val('cc_CCE1_5_1')==='A');
 result=await command('fillRecord',{collection:'programmingLanguages',recordId:'path-skill'});check('unchanged explicit record paths do not become false conflicts on repeat',!result.requiresConfirmation&&!result.filled.length&&val('cc_CCE1_5_1')==='A');
 return {adapter:'job51-record-path',checks};
}
if(new URLSearchParams(location.search).get('case')==='slot-shape'){
 document.querySelectorAll('.ci').forEach((card,index)=>{if(index)card.remove();});document.getElementById('cc_CCA1_1_1').id='cc_CCA1_1_2';
 const result=await command('fillRecord',{collection:'programmingLanguages',recordId:'skill-a'});
 check('mismatched field suffixes inside one card cannot form a synthetic cross-record mapping',!result.filled.length&&[...document.querySelectorAll('select')].every(element=>!element.value));
 return {adapter:'job51-slot-shape',checks};
}
if(new URLSearchParams(location.search).get('case')==='dictionary'){
 const parent=document.getElementById('ddl_CCE1_5_1'),child=document.getElementById('cc_CCE1_5_1');parent.focus();
 let result=await command('fillTarget',{entry:{id:'ambiguous',label:'技能名称',value:'虚构甲语言'}});check('a repeated leaf under different public parents is refused before changing either selector',!result.success&&!parent.value&&!child.value);
 result=await command('fillTarget',{entry:{id:'explicit',label:'技能名称',value:'虚构甲语言',pathValues:[['虚构编程类'],['虚构甲语言']]}});check('an explicit two-level path can disambiguate a repeated leaf',result.success&&parent.value==='1'&&child.value==='A');await command('undo');
 parent.focus();result=await command('fillTarget',{entry:{id:'unknown',value:'不存在技能'}});check('unknown leaf never walks through public parents to discover a match',!result.success&&!parent.value&&child.options.length===1);
 result=await command('fillTarget',{entry:{id:'original',value:'虚构工具'}});check('a unique public leaf still selects its exact native dictionary codes',result.success&&parent.value==='2'&&child.value==='T');
 const beforeEvidence=[result.expectation];await command('undo');parent.value='2';parent.dispatchEvent(new Event('change',{bubbles:true}));child.value='T';const reject=()=>{if(child.value==='A')child.value='';};child.addEventListener('change',reject);
 result=await command('fillTarget',{entry:{id:'reject',value:'虚构甲语言',pathValues:[['虚构编程类'],['虚构甲语言']]},forceOverwrite:true});check('failed inferred/explicit child readback restores the original nonempty pair',!result.success&&parent.value==='2'&&child.value==='T');
 const refuse=()=>{if(parent.value==='2'){parent.value='1';parent.dispatchEvent(new Event('change',{bubbles:true}));}};parent.addEventListener('change',refuse);
 result=await command('fillTarget',{entry:{id:'reject-again',value:'虚构甲语言',pathValues:[['虚构编程类'],['虚构甲语言']]},forceOverwrite:true});check('failed recovery reports failure and keeps changed native selectors available to undo',!result.success&&parent.value==='1');parent.removeEventListener('change',refuse);child.removeEventListener('change',reject);
 result=await command('undo');check('retained failed pair can restore its original native codes when website refusal ends',result.restoredCount>=1&&parent.value==='2'&&child.value==='T');
 parent.focus();await command('fillTarget',{entry:{id:'same',value:'虚构工具'},forceOverwrite:true});child.add(new Option('虚构工具','SAME_LABEL_NEW_CODE'));child.value='SAME_LABEL_NEW_CODE';result=await command('verify',{expectations:beforeEvidence});check('same visible label with a changed native code does not confirm prior skill evidence',result.confirmedCount===0);
 result=await command('undo');check('later native-code changes protect the entire skill pair from undo',parent.value==='2'&&child.value==='SAME_LABEL_NEW_CODE');
 return {adapter:'job51-dictionary-safety',checks};
}
if(new URLSearchParams(location.search).get('case')==='identities'){
 profile.records.programmingLanguages=[{id:'a-good',name:'虚构甲语言',level:'熟练'},{id:'a-basic',name:'虚构甲语言',level:'了解'}];
 let result=await command('fillCollection',{collection:'programmingLanguages'});
 check('same skill name with distinct proficiency keeps separate editor identities',result.filled.length===4&&val('cc_CCE1_5_1')==='A'&&val('cc_CCE1_5_2')==='A'&&val('cc_CCA1_1_1')==='good'&&val('cc_CCA1_1_2')==='basic');
 profile.records.programmingLanguages.reverse();result=await command('fillCollection',{collection:'programmingLanguages'});check('reordered same-name sources use their nonempty discriminators',!result.filled.length&&!result.requiresConfirmation&&val('cc_CCA1_1_1')==='good'&&val('cc_CCA1_1_2')==='basic');await command('undo');
 profile.records.programmingLanguages=[{id:'same1',name:'虚构甲语言',level:'熟练'},{id:'same2',name:'别名甲',level:'熟练',fieldOptions:{name:['虚构甲语言']}}];
 result=await command('fillCollection',{collection:'programmingLanguages'});check('semantically duplicate skill records with candidate aliases are rejected without sharing a group',!result.filled.length&&result.skipped.filter(item=>/身份重复/.test(item.reason)).length===2);
 profile.records.programmingLanguages=[{id:'too-many-'+0,name:'虚构甲语言',level:'熟练'}];document.querySelectorAll('.ci').forEach((card,index)=>{if(index)card.remove();});
 result=await command('fillRecord',{collection:'programmingLanguages',recordId:'too-many-0'});check('manual capacity path can reuse an anonymous editor after undo',result.filled.length===2);
 return {adapter:'job51-identities',checks};
}
if(new URLSearchParams(location.search).get('case')==='single-editor'){
 document.querySelectorAll('.ci').forEach((card,index)=>{if(index)card.remove();});
 const result=await command('fillRecord',{collection:'programmingLanguages',recordId:'skill-t'});
 check('an explicitly chosen second source can use the one empty editor without reserving it for unrequested records',result.filled.length===2&&val('cc_CCE1_5_1')==='T'&&val('cc_CCA1_1_1')==='basic');
 return {adapter:'job51-single-editor',checks};
}
if(new URLSearchParams(location.search).get('module')==='language'){
 profile.records={foreignLanguages:[{id:'english',language:'英语',proficiency:'熟练',certification:'错误的旧投影',score:'错误的旧投影'},{id:'japanese',language:'日语',proficiency:'良好'}],certifications:[{id:'cert6',name:'CET-6',score:'520',fieldOptions:{name:['大学英语六级'],score:['500-599分']}}]};
 if(new URLSearchParams(location.search).get('case')==='safety'){
  const cert=profile.records.certifications[0];delete cert.fieldOptions.score;
  let result=await command('fillCollection',{collection:'foreignLanguages'});check('numeric English score never becomes a dictionary band',!val('ddl_EnglishLevel_5_1')&&result.skipped.some(item=>item.entryId==='english'&&/不换算/.test(item.reason)));await command('undo');
  cert.fieldOptions.score=['500-599分'];profile.records.certifications.push({id:'ielts',name:'雅思',score:'7分'});
  result=await command('fillCollection',{collection:'foreignLanguages'});check('multiple English exams do not pick the first certification or stale projection',!val('ddl_EnglishLevel_5_1')&&result.skipped.some(item=>item.entryId==='english'&&/唯一明确/.test(item.reason)));await command('undo');profile.records.certifications.pop();
  profile.records.foreignLanguages.push({id:'german',language:'德语',proficiency:'良好'});
  result=await command('fillCollection',{collection:'foreignLanguages'});check('multiple other languages cannot compete for the one native slot',!val('ddl_OtherLanguage_5_1')&&result.skipped.filter(item=>/语种身份不唯一/.test(item.reason)).length===2);await command('undo');profile.records.foreignLanguages.pop();
  profile.entries=[{id:'other.english',category:'其他',label:'英语水平',value:'7分',pathValues:[['雅思'],['7分']],aliases:[]}];
  result=await command('fill');check('Other language notes neither write nor block the formal language record source',val('cc_EnglishLevel_5_1')==='C500'&&result.filled.filter(item=>item.field==='英语水平').length===1&&!result.skipped.some(item=>/普通外语资料项/.test(item.reason)));await command('undo');profile.entries=[];
  document.getElementById('ddl_EnglishLevel_5_1').focus();result=await command('fillTarget',{entry:{id:'score',value:'500-599分'}});check('single score-band target without exam context cannot infer even a unique parent',!result.success&&!val('ddl_EnglishLevel_5_1'));
  document.getElementById('ddl_OtherLanguage_5_1').focus();result=await command('fillTarget',{entry:{id:'level',value:'良好'}});check('single proficiency target without language context cannot infer a parent',!result.success&&!val('ddl_OtherLanguage_5_1'));
  const english=document.getElementById('ddl_EnglishLevel_5_1'),callback=english.getAttribute('onchange');english.setAttribute('onchange',callback.replace('D_EnglishLevel','D_Unknown'));
  result=await command('fillCollection',{collection:'foreignLanguages'});check('unknown dictionary callback blocks formal English mapping without touching it',!val('ddl_EnglishLevel_5_1')&&result.skipped.some(item=>item.entryId==='english'&&/公共外语字典/.test(item.reason)));
  return {adapter:'job51-language-safety',checks};
 }
 let result=await command('scan');check('formal language scan finds the unique explicit exam and language without changing pairs',result.suggestions.length===2&&[...document.querySelectorAll('select')].every(select=>!select.value));
 result=await command('fillCollection',{collection:'foreignLanguages'});check('formal language records use certificate candidates and exact language proficiency instead of stale projection',result.filled.length===2&&val('ddl_EnglishLevel_5_1')==='1'&&val('cc_EnglishLevel_5_1')==='C500'&&val('ddl_OtherLanguage_5_1')==='1'&&val('cc_OtherLanguage_5_1')==='Jgood');
 const evidence=JSON.parse(JSON.stringify(result.filled));result=await command('verify',{expectations:evidence});check('formal language native codes survive JSON evidence transport',result.confirmedCount===2);await command('undo');check('formal language undo clears both complete pairs',[...document.querySelectorAll('select')].every(select=>!select.value));
 return {adapter:'job51-languages',checks};
}
if(new URLSearchParams(location.search).get('module')==='work'){
 profile.records={internships:[{id:'work-a',company:'虚构甲公司',position:'虚构工程师',start:'2020-02-29',end:'2021-03-01',description:'虚构职责'},{id:'work-b',company:'虚构乙公司',position:'虚构测试师',description:'第二条职责'}]};
 if(new URLSearchParams(location.search).get('case')==='multiple'){
  profile.records.internships[1]={id:'work-b',company:'虚构甲公司',position:'虚构测试师',start:'2022-04-01',end:'2023-05-01',description:'第二次同企业职责'};
  let result=await command('fillCollection',{collection:'internships'});check('two existing same-company work editors keep role and full-day dates within each record',result.filled.length===10&&val('cc_CCE2_5_1')==='E'&&val('cc_CCC1_3_1')==='2020-02-29'&&val('cc_CCE2_5_2')==='Q'&&val('cc_CCC1_3_2')==='2022-04-01'&&val('cc_CCF1_6_2')==='第二次同企业职责');
  profile.records.internships.reverse();document.querySelector('#container').append(document.querySelector('.ci'));result=await command('fill',{resetTransaction:false});check('whole-page entry reuses work identity after source and DOM reorder without cross-writing',!result.filled.length&&!result.requiresConfirmation&&val('cc_CCC1_3_1')==='2020-02-29'&&val('cc_CCC1_3_2')==='2022-04-01');
  await command('undo');check('same-company work batch undo restores all existing editors',[...document.querySelectorAll('input,textarea,select')].every(element=>!element.value));
  profile.records.internships=[{id:'short-date',company:'虚构甲公司',position:'虚构工程师',start:'2020-02',description:'日期缺少日'}];
  result=await command('fillRecord',{collection:'internships',recordId:'short-date'});check('work month-only source is reported without inventing a day',!val('cc_CCC1_3_1')&&result.skipped.some(item=>item.field==='开始日期'&&/日/.test(item.reason)));
  return {adapter:'job51-work-multiple',checks};
 }
 let result=await command('scan');check('work scan plans only the one existing editor without opening My97',result.suggestions.length===5&&!val('cc_CCC1_3_1')&&(!document.querySelector('#_my97DP')||document.querySelector('#_my97DP').style.left==='-1970px'));
 result=await command('fillCollection',{collection:'internships'});check('work record fills company, position and full-day dates through the same existing editor',result.filled.length===5&&val('cc_CCA1_1_1')==='虚构甲公司'&&val('cc_CCE2_5_1')==='E'&&val('cc_CCC1_3_1')==='2020-02-29'&&val('cc_CCC2_3_1')==='2021-03-01'&&val('cc_CCF1_6_1')==='虚构职责');
 check('work capacity shortage explicitly asks for a manual editor instead of adding or overwriting',result.skipped.some(item=>item.entryId==='work-b'&&/手动添加/.test(item.reason))&&document.querySelectorAll('.ci').length===1&&document.documentElement.dataset.fixtureActions==='0');
 const evidence=JSON.parse(JSON.stringify(result.filled));result=await command('verify',{expectations:evidence});check('work JSON evidence confirms native pair and both dates',result.confirmedCount===5);
 document.getElementById('cc_CCF1_6_1').value='用户后改';await command('undo');check('work undo preserves later description edits and restores unchanged controls',val('cc_CCF1_6_1')==='用户后改'&&!val('cc_CCC1_3_1')&&!val('cc_CCC2_3_1')&&!val('cc_CCA1_1_1')&&!val('cc_CCE2_5_1'));
 return {adapter:'job51-work',checks};
}
if(new URLSearchParams(location.search).get('case')==='conflict'){
 profile.records.programmingLanguages=[profile.records.programmingLanguages[0]];
 let result=await command('fillRecord',{collection:'programmingLanguages',recordId:'skill-a'});
 document.getElementById('cc_CCA1_1_1').value='basic';
 result=await command('fillRecord',{collection:'programmingLanguages',recordId:'skill-a'});
 check('one exact skill identity with a different proficiency requires confirmation instead of allocating another record',result.requiresConfirmation&&!result.filled.length&&val('cc_CCA1_1_1')==='basic'&&!val('cc_CCE1_5_2'));
 result=await command('fillRecord',{collection:'programmingLanguages',recordId:'skill-a',settings:{...settings,recordConflictConfirmed:true}});
 check('confirmed skill change stays in its identity group',result.filled.length===1&&val('cc_CCA1_1_1')==='good'&&!val('cc_CCE1_5_2'));
 await command('undo');check('confirmed skill replacement restores the prior nonempty proficiency',val('cc_CCA1_1_1')==='basic');
 return {adapter:'job51-record-conflict',checks};
}
if(new URLSearchParams(location.search).get('case')==='duplicate-id'){
 const card=document.querySelector('.ci');card.after(card.cloneNode(true));
 const result=await command('scan');
 check('duplicate native identities cannot expose either cloned skill record as a valid target',result.suggestions.length===4&&result.suggestions.every(item=>item.entryId)&&!result.suggestions.some(item=>item.locator?.includes('CCE1_5_1')));
 document.getElementById('ddl_CCE1_5_1').focus();const target=await command('fillTarget',{entry:{id:'target',label:'技能名称',value:'虚构甲语言',pathValues:[['虚构编程类'],['虚构甲语言']]}});
 check('focused duplicate native identities refuse target writes and preserve all selectors',!target.success&&[...document.querySelectorAll('select')].every(select=>!select.value));
 return {adapter:'job51-duplicate-id',checks};
}
let result=await command('scan');
check('fifteen existing skill editors expose two separate source records without changing native selections',result.suggestions.length===4&&[...document.querySelectorAll('select')].every(select=>!select.value));
result=await command('fillCollection',{collection:'programmingLanguages'});
check('skill collection uses exact public dictionary parents and distinct existing editors',result.filled.length===4&&val('ddl_CCE1_5_1')==='1'&&val('cc_CCE1_5_1')==='A'&&val('cc_CCA1_1_1')==='good'&&val('ddl_CCE1_5_2')==='2'&&val('cc_CCE1_5_2')==='T'&&val('cc_CCA1_1_2')==='basic');
const evidence=JSON.parse(JSON.stringify(result.filled));result=await command('verify',{expectations:evidence});check('JSON-transported skill evidence confirms both native codes and proficiency fields',result.confirmedCount===4);
profile.records.programmingLanguages.reverse();result=await command('fillCollection',{collection:'programmingLanguages'});check('source reorder reuses skill leaf identity instead of display pair strings or source positions',!result.filled.length&&!result.requiresConfirmation&&val('cc_CCE1_5_1')==='A'&&val('cc_CCE1_5_2')==='T');
await command('undo');check('skill collection undo restores all four selectors from the original batch',!val('ddl_CCE1_5_1')&&!val('cc_CCE1_5_1')&&!val('cc_CCA1_1_1')&&!val('ddl_CCE1_5_2')&&!val('cc_CCA1_1_2'));
check('existing editor workflow does not invoke record buttons or form submission',document.documentElement.dataset.fixtureActions==='0');
return {adapter:'job51-records',checks};
}
