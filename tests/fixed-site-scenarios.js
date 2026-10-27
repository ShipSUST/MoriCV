export async function runFixedSites(){
 const checks=[],check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
 const settings={confidenceThreshold:78,overwriteExisting:false,rejectedMatches:[]};
 const profile={entries:[{id:'skills.certificates_summary',category:'其他',label:'技能证书汇总',value:'不得自动写入的匿名证书备注'},
  {id:'experience.campus_summary',category:'其他',label:'校园工作经历',value:'不得自动写入的匿名校园备注'},
  {id:'other.self',category:'其他',label:'自我评价',value:'不得自动写入的匿名自评'}],records:{}};
 const run=(command,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload:{profile,settings,...payload}},null,result=>result?.error?reject(Error(result.error)):resolve(result)));
 const fields=()=>[...document.querySelectorAll('input,textarea')].filter(e=>!['radio','checkbox','hidden'].includes(e.type));
 const before=JSON.stringify(fields().map(e=>e.value));
 let result=await run('scan');check('dedicated site scan ignores removed summaries and same-name Other items',!result.suggestions.length);
 for(const command of ['fillFlatEntries','fill','fillStructuredSegment']){result=await run(command,{resetTransaction:true});check(command+' leaves all manual-only content out of dedicated site paths',!result.filled.length&&JSON.stringify(fields().map(e=>e.value))===before);}
 profile.entries=[{id:'basic.name',category:'基本信息',label:'用户无法覆盖的名称',aliases:['伪别名'],value:'匿名固定姓名'}];
 result=await run('scan');check('dedicated site scan uses fixed name metadata rather than imported labels',result.suggestions.some(item=>item.entryId==='basic.name'));
 result=await run('fillFlatEntries',{resetTransaction:true});check('dedicated page receives the fixed main value',result.filled.some(item=>item.entryId==='basic.name')&&fields().some(e=>e.value==='匿名固定姓名'));
 const verified=await run('verify',{expectations:JSON.parse(JSON.stringify(result.filled))});check('dedicated page fixed write retains verification',verified.confirmedCount===result.filled.length);
 check('dedicated fixed write retains undo',(await run('undo')).failedCount===0&&JSON.stringify(fields().map(e=>e.value))===before);
 return {adapter:location.pathname.split('/').at(-1),checks};
}
