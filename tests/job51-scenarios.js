import {DEFAULT_PROFILE} from '/src/data/default-profile.js';

export async function runJob51(){
const checks=[];
const check=(name,ok)=>{if(!ok)throw Error(name);
checks.push(name);
globalThis.__recordProgress={checks:[...checks]};
};

const profile=structuredClone(DEFAULT_PROFILE);
profile.entries=[{id:'basic.name',label:'姓名',category:'基本信息',value:'虚构甲',aliases:[]},{id:'contact.email',label:'邮箱',category:'基本信息',value:'fiction@example.invalid',aliases:[]},{id:'contact.phone',label:'手机',category:'基本信息',value:'00000000000',aliases:[]},{id:'other.intent',label:'期望工作地点',category:'其他',value:'虚构市',aliases:[]}];

const settings={confidenceThreshold:100,overwriteExisting:false,rejectedMatches:[]};
const command=(command,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload:{profile:profile,settings,...payload}},null,result=>result?.error?reject(Error(result.error)):resolve(result)));

const input=id=>document.getElementById(id);
const val=id=>input(id).value;
if(new URLSearchParams(location.search).get('case')==='shape'){
 const container=document.getElementById('container'),wrapper=document.createElement('div');container.replaceWith(wrapper);wrapper.append(container);
 let result=await command('fill');check('one observed form root remains supported through an intervening wrapper',result.filled.length===3&&val('cc_Cname_1_1')==='虚构甲');await command('undo');
 input('sPhoneNumber').focus();result=await command('fillTarget',{entry:profile.entries[2]});check('country code focus cannot retarget the mobile phone field',!result.success&&!val('cc_MobilePhone_1_1'));
 const duplicate=document.createElement('div');duplicate.id='container';document.getElementById('form1').append(duplicate);result=await command('fill');check('duplicate form roots refuse all specialized writes',!result.filled.length&&!val('cc_Cname_1_1'));
 return {adapter:'job51-shape',checks};
}

if(new URLSearchParams(location.search).get('module')==='self'){
 profile.entries=[{id:'profile.self_evaluation',label:'自我评价',category:'基本信息',value:'虚构自评',aliases:[]}];
const area=input('cc_SelfAssessment_6_1');
let result=await command('fill');
check('self evaluation uses its fixed identity and accepts the personal main value',result.filled.length===1&&area.value==='虚构自评');
const expectations=result.filled;
await command('undo');
check('self evaluation undo restores blank',!area.value);
profile.entries[0].value='长'.repeat(4001);
result=await command('fill');
check('overlong self evaluation is refused explicitly without truncation',result.filled.length===0&&result.skipped.some(x=>x.reason.includes('4000'))&&!area.value);
area.value='虚构自评';
document.querySelector('h1').textContent='基本信息';
document.querySelector('.leftli2').title='基本信息';
result=await command('verify',{expectations});
check('historical self evidence cannot confirm another module',result.confirmedCount===0);
return {adapter:'job51',checks};
}
if(new URLSearchParams(location.search).get('case')==='safety'){
 const name=input('cc_Cname_1_1');
name.focus();
let result=await command('fillTarget',{entry:profile.entries[0]});
const expected=[result.expectation];
const dt=name.closest('dl').querySelector('dt');
dt.textContent='未知含义';
result=await command('undo');
check('same-module contract changes block ordinary-field undo',result.failedCount===1&&name.value==='虚构甲');
dt.textContent='姓名';
await command('undo');
check('restoring the observed field contract permits its original undo',!name.value);
name.focus();
result=await command('fillTarget',{entry:profile.entries[0]});
document.querySelector('h1').textContent='自我评价';
document.querySelector('.leftli2').title='自我评价';
let verification=await command('verify',{expectations:expected});
check('same-ID controls in another module cannot confirm prior evidence',verification.confirmedCount===0);
result=await command('undo');
check('same-ID controls in another module cannot receive prior undo',result.failedCount===1&&name.value==='虚构甲');
document.querySelector('h1').textContent='基本信息';
document.querySelector('.leftli2').title='基本信息';
await command('undo');
const dl=name.closest('dl');
dl.setAttribute('dlcolname','CCA');
result=await command('fill');
check('custom codes with a familiar label never borrow ordinary mapping',!name.value);
return {adapter:'job51',checks};
}
if(new URLSearchParams(location.search).get('case')==='pair'){
profile.entries=[{id:'location.current',label:'现居住城市',category:'基本信息',value:'虚构甲市',pathValues:[['虚构甲省'],['虚构甲市']],aliases:[]}];
const selects=[...document.querySelectorAll('[dlcolname="City"] select')];
const values=()=>selects.map(x=>x.value).join('|');
let result=await command('scan');
check('dependent choice scan is one field and never rebuilds options',result.suggestions.length===1&&selects[1].options.length===1);
result=await command('fill');
check('dependent native choices fill both levels after rebuilding child options',result.filled.length===1&&values()==='0|1');
const expected=result.filled;
let verification=await command('verify',{expectations:expected});
check('dependent choice readback includes both levels',verification.confirmedCount===1&&expected[0].expectedValue==='虚构甲省 / 虚构甲市');
await command('undo');
check('dependent choice undo restores empty parents and children',values()==='|');
selects[0].value='1';
selects[0].dispatchEvent(new Event('change',{bubbles:true}));
selects[1].value='1';
selects[1].focus();
result=await command('fillTarget',{entry:profile.entries[0]});
check('different populated pair requires explicit overwrite',result.requiresConfirmation&&values()==='1|1');
result=await command('fillTarget',{entry:profile.entries[0],forceOverwrite:true});
check('confirmed pair fill accepts the complete explicit path',result.success&&values()==='0|1');
await command('undo');
check('undo restores the original nonempty dependent pair',values()==='1|1');
const reject=()=>{if(selects[0].value==='0')selects[1].value='';
};
selects[1].addEventListener('change',reject);
result=await command('fillTarget',{entry:profile.entries[0],forceOverwrite:true});
check('refused child restores both original levels without a false success',!result.success&&values()==='1|1');
selects[1].removeEventListener('change',reject);

const refuseRestore=()=>{if(selects[0].value==='1'){selects[0].value='0';
selects[0].dispatchEvent(new Event('change',{bubbles:true}));
}};
selects[0].addEventListener('change',refuseRestore);
selects[1].addEventListener('change',reject);
result=await command('fillTarget',{entry:profile.entries[0],forceOverwrite:true});
check('incomplete recovery reports failure and retains changed composite evidence',!result.success&&values()!=='1|1');
selects[0].removeEventListener('change',refuseRestore);
selects[1].removeEventListener('change',reject);
result=await command('undo');
check('a later undo can restore a failed composite after website refusal clears',result.restoredCount===1&&result.failedCount===0&&values()==='1|1');
profile.entries[0].pathValues=[];
result=await command('fillTarget',{entry:profile.entries[0],forceOverwrite:true});
check('missing parent path is never inferred from a leaf name',!result.success&&values()==='1|1');
profile.entries=[{id:'other.english',label:'英语水平',category:'其他',value:'520',pathValues:[],aliases:[]}];
const english=[...document.querySelectorAll('[dlcolname="EnglishLevel"] select')];
result=await command('fill');
check('numeric English score does not invent an exam and score band',result.filled.length===0&&english.every(x=>!x.value));
profile.entries[0].pathValues=[['虚构等级考试'],['明确成绩段']];
result=await command('fill');
check('Other with an exam path remains excluded from automatic language filling',result.filled.length===0&&english.every(x=>!x.value));
english[0].focus();result=await command('fillTarget',{entry:profile.entries[0]});
check('an explicitly selected composite can still use a manual Other exam path',result.success&&english.map(x=>x.value).join('|')==='0|1');
await command('undo');
return {adapter:'job51',checks};
}
if(new URLSearchParams(location.search).get('case')==='birth'){
 profile.entries=[{id:'basic.birth_date',label:'出生日期',category:'基本信息',value:'2000-02-29',fieldType:'date',aliases:[]}];
const selects=[...document.querySelectorAll('[dlcolname="Birthday"] select')];
const hidden=input('cc_Birthday_3_1');
const values=()=>selects.map(x=>x.value).join('|');

let result=await command('scan');
check('birth scan exposes one logical field without editing year or month',result.suggestions.length===1&&values()==='|');
result=await command('fill');
check('birthday fills displayed year and month through native options',result.filled.length===1&&values()==='b|y'&&hidden.value==='');
check('birthday evidence names only the actually selected precision',result.filled[0].expectedValue==='2000-02'&&result.filled[0].precisionNote?.includes('年月'));
let verification=await command('verify',{expectations:result.filled});
check('birthday verification reads both visible selectors',verification.confirmedCount===1);
await command('undo');
check('birthday undo restores both empty selectors',values()==='|');
selects[1].focus();
result=await command('fillTarget',{entry:profile.entries[0]});
check('focusing month still fills one entire date target',result.success&&values()==='b|y');
selects[1].value='x';
result=await command('undo');
check('changing only month protects the complete composite from undo',result.failedCount===1&&values()==='b|x');
selects.forEach(x=>x.value='');
profile.entries[0].pathValues=[['1999'],['02']];
result=await command('fill');
check('fixed birthday ignores unsupported imported path metadata and uses its own main value',result.filled.length===1&&values()==='b|y');
await command('undo');selects[1].focus();result=await command('fillTarget',{entry:profile.entries[0]});
check('explicit manual date configuration still rejects a conflicting date path',!result.success&&values()==='|');
profile.entries[0].pathValues=[];
profile.entries[0].value='2001-02-01';
result=await command('fill');
check('missing year option cannot leave a partial birthday',result.filled.length===0&&values()==='|'&&hidden.value==='');
return {adapter:'job51',checks};
}
let result=await command('scan');
check('scan recognizes only scoped basic fields without writing',result.site==='job51'&&result.skipped.some(item=>item.entryId==='manual.intent')&&result.suggestions.length===3&&result.suggestions.some(x=>x.field==='姓名')&&!val('cc_Cname_1_1'));

result=await command('fill');
check('whole-page command fills known name email phone only',result.filled.length===3&&val('cc_Cname_1_1')==='虚构甲'&&val('cc_Email_1_1')==='fiction@example.invalid'&&val('cc_MobilePhone_1_1')==='00000000000'&&!val('sPhoneNumber')&&!val('cc_TargetCity_1_1')&&!val('cc_CCA_1_1'));

let verification=await command('verify',{expectations:result.filled,documentToken:result.documentToken});
check('verify sees the actual accepted basic values',verification.confirmedCount===3);

await command('undo');
check('undo restores initial empty basic fields',!val('cc_Cname_1_1')&&!val('cc_Email_1_1')&&!val('cc_MobilePhone_1_1'));

input('cc_Cname_1_1').value='用户原值';
input('cc_Cname_1_1').focus();
result=await command('fillTarget',{entry:profile.entries[0]});
check('selected-field overwrite still requires confirmation',result.requiresConfirmation&&val('cc_Cname_1_1')==='用户原值');
result=await command('fillTarget',{entry:profile.entries[0],forceOverwrite:true});
check('confirmed selected-field uses the same scoped target',result.success&&val('cc_Cname_1_1')==='虚构甲');
input('cc_Cname_1_1').value='用户后改';
result=await command('undo');
check('undo protects a subsequent user edit',result.failedCount===1&&val('cc_Cname_1_1')==='用户后改');

input('cc_Cname_1_1').value='';
document.querySelector('h1').textContent='未知模块';
document.querySelector('.leftli2').title='未知模块';
result=await command('fill');
check('unknown modules never borrow ordinary personal mapping',result.filled.length===0&&!val('cc_Cname_1_1'));
return {adapter:'job51',checks};
}
