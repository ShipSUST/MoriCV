export async function runFixedConsumers(){
 const checks=[],check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
 const settings={confidenceThreshold:60,overwriteExisting:false,rejectedMatches:[]};
 const command=(command,profile,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload:{profile,settings,...payload}},null,result=>result?.error?reject(Error(result.error)):resolve(result)));
 const value=id=>document.getElementById(id).value;
 const roleCase=new URLSearchParams(location.search).get('role');
 if(roleCase){
  const [source,label,main,allowed]=({pinyin:['basic.name_pinyin','亲属姓名拼音','Ni Ming Ben Ren'],phone:['contact.phone','亲属手机号','13900000001'],'emergency-phone':['contact.phone','紧急联系人电话','13900000001'],'emergency-phone-alias':['contact.phone','紧急联系电话','13900000001'],'emergency-phone-own-alias':['contact.emergency_phone','紧急联系电话','13900000002',true],'emergency-name-to-phone':['contact.emergency_name','紧急联系人电话','匿名紧急联系人'],'emergency-phone-to-name':['contact.emergency_phone','紧急联系人','13900000002']})[roleCase]||[];
  if(!source)throw Error('Unknown anonymous role case');
  document.querySelectorAll('body > label').forEach(node=>node.style.display='none');
  const target=document.createElement('label');target.textContent=label;const input=document.createElement('input');target.append(input);document.body.append(target);
  const isolatedProfile={entries:[{id:source,category:'基本信息',value:main}],records:{}};
  const preview=await command('scan',isolatedProfile);
  const filled=await command('fillFlatEntries',isolatedProfile,{resetTransaction:true});
  if(allowed){
   check('dedicated '+source+' still scans and fills '+label,preview.suggestions.length===1&&filled.filled.length===1&&input.value===main);
   check('dedicated emergency alias retains verification',(await command('verify',isolatedProfile,{expectations:filled.filled})).confirmedCount===1);
   check('dedicated emergency alias retains undo',(await command('undo',isolatedProfile)).failedCount===0&&!input.value);
   const full=await command('fill',isolatedProfile,{resetTransaction:true});
   check('whole-page fill retains the dedicated emergency alias',full.filled.length===1&&input.value===main);
   check('whole-page emergency alias retains undo',(await command('undo',isolatedProfile)).failedCount===0&&!input.value);
   return {adapter:'generic',checks};
  }
  check(source+' is never borrowed for '+label+' (suggestions='+preview.suggestions.length+', filled='+filled.filled.length+', value='+input.value+')',!preview.suggestions.length&&!filled.filled.length&&!input.value);
  const full=await command('fill',isolatedProfile,{resetTransaction:true});
  check('whole-page fill also preserves the distinct '+label+' role',!full.filled.length&&!input.value);
  return {adapter:'generic',checks};
 }
 const other={id:'other.self',category:'其他',label:'自我评价',value:'只能手动使用的匿名说明',aliases:['姓名','出生地']};
 const profile={entries:[other],records:{educations:[{id:'anonymous.edu',highest:'是',studyType:'全日制',educationLevel:'硕士研究生',end:'2030-06-30'}]}};
 const scan=await command('scan',profile);check('Other and record projections produce zero ordinary scan suggestions',scan.suggestions.length===0);
 for(const name of ['fillFlatEntries','fill']){const result=await command(name,profile,{resetTransaction:true});check(name+' cannot autofill Other or derive ordinary fields from records',!result.filled.length&&['self','graduation','highest'].every(id=>!value(id)));}
 const self=await command('fillStructuredSegment',profile,{segment:'self-evaluation',resetTransaction:true});check('self-evaluation segment cannot use an Other item with the same name',!self.filled.length&&!value('self'));
 profile.entries=[['basic.name','基本信息','姓名','匿名姓名'],['location.birth_place','基本信息','出生地','匿名出生地'],['location.native_place','基本信息','籍贯','匿名籍贯'],['basic.graduation_date','基本信息','毕业时间','2024-06-20'],['career.graduation_date','求职偏好','预计毕业日期','2027-06-30'],['career.graduation_year','求职偏好','毕业年份','2028']].map(([id,category,label,value])=>({id,category,label,value,aliases:[]}));
 document.getElementById('name').closest('label').style.display='none';
 const applicantOnly={entries:[{id:'basic.name',category:'基本信息',value:'匿名本人'}],records:{}};
 check('hidden applicant name never suggests a relative or emergency contact',(await command('scan',applicantOnly)).suggestions.length===0);
 for(const name of ['fillFlatEntries','fill']){
  const isolatedRelative=await command(name,applicantOnly,{resetTransaction:true});
  check(name+' never sends the lone applicant value to a relative or emergency contact',!value('relative-name')&&!value('emergency-name')&&!isolatedRelative.filled.length);
 }
 document.getElementById('name').closest('label').style.display='';
 const safetyScan=await command('scan',profile);check('applicant name is never suggested for a relative name',!safetyScan.suggestions.some(row=>row.field?.includes('亲属')));
 const filled=await command('fillFlatEntries',profile,{resetTransaction:true});
 check('fixed main values fill the six separate fields once',filled.filled.length===6&&value('name')==='匿名姓名'&&value('birth')==='匿名出生地'&&value('native')==='匿名籍贯'&&value('graduation')==='2024-06-20'&&value('expected')==='2027-06-30'&&value('year')==='2028'&&!value('highest'));
 check('applicant name never autofills the visible relative name',!value('relative-name'));
 const verified=await command('verify',profile,{expectations:JSON.parse(JSON.stringify(filled.filled))});check('fixed values retain verifiable transaction evidence',verified.confirmedCount===6);
 check('fixed main values undo without touching other inputs',(await command('undo',profile)).failedCount===0&&!value('name')&&!value('expected'));
 const contactProfile={entries:[{id:'contact.home_address',category:'基本信息',value:'匿名家庭地址'},{id:'location.home',category:'基本信息',value:'匿名家庭所在地'},{id:'contact.emergency_name',category:'基本信息',value:'匿名紧急联系人'},{id:'contact.emergency_phone',category:'基本信息',value:'13900000000'}],records:{}};
 const contacts=await command('fillFlatEntries',contactProfile,{resetTransaction:true});
 check('legitimate family address/location and emergency contacts keep their own fixed values',contacts.filled.length===4&&value('home-address')==='匿名家庭地址'&&value('home-location')==='匿名家庭所在地'&&value('emergency-name')==='匿名紧急联系人'&&value('emergency-phone')==='13900000000'&&!value('relative-name'));
 check('family address/location and emergency contacts retain undo',(await command('undo',contactProfile)).failedCount===0&&!value('home-address')&&!value('home-location')&&!value('emergency-name')&&!value('emergency-phone'));
 document.getElementById('relative-name').focus();
 const explicitName=await command('fillTarget',profile,{entry:profile.entries.find(entry=>entry.id==='basic.name')});
 check('explicit applicant-name target remains user controlled',explicitName.success&&value('relative-name')==='匿名姓名');
 check('explicit relative target retains verification',(await command('verify',profile,{expectations:[explicitName.expectation]})).confirmedCount===1);
 check('explicit relative target retains undo',(await command('undo',profile)).failedCount===0&&!value('relative-name'));
 document.getElementById('note').focus();const targeted=await command('fillTarget',profile,{entry:other});check('Other fills the explicitly focused arbitrary plain textarea',targeted.success&&value('note')===other.value&&!value('self'));
 check('manual Other retains historical verification',(await command('verify',profile,{expectations:[targeted.expectation]})).confirmedCount===1);
 check('manual Other can undo its target',(await command('undo',profile)).failedCount===0&&!value('note'));
 document.getElementById('graduation').closest('label').before(document.getElementById('expected').closest('label'));
 for(const [id,category,main,field,others]of [
  ['basic.graduation_date','基本信息','2024-06-20','graduation',['expected','year']],
  ['career.graduation_date','求职偏好','2027-06-30','expected',['graduation','year']],
  ['career.graduation_year','求职偏好','2028','year',['graduation','expected']]
 ]){
  profile.entries=[{id,category,value:main}];profile.records={};
  const isolated=await command('fillFlatEntries',profile,{resetTransaction:true});
  check('a lone '+id+' never substitutes for either other graduation meaning',isolated.filled.length===1&&value(field)===main&&others.every(id=>!value(id)));
  await command('undo',profile);
 }
 return {adapter:'generic',checks};
}
