export async function runSany(){
 const checks=[],check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
 const profile=structuredClone(globalThis.__sanySiteProfile),mode=new URLSearchParams(location.search).get('case');
 const command=(command,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload:{profile,settings:{confidenceThreshold:60,overwriteExisting:false},...payload}},null,r=>r?.error?reject(Error(r.error)):resolve(r)));
 const name=()=>document.querySelector('[data-key="name"] input'),description=()=>document.querySelector('[data-key="description"] textarea');
 const selected=()=>Array.from(document.querySelectorAll('.phoenix-radio--checked .phoenix-radio__radio-text')).map(n=>n.textContent.trim()).join('/');
 const dropdown=key=>document.querySelector('[data-key="'+key+'"] .phoenix-select__calcEle').textContent.trim();
 if(mode==='minimal')profile.records.papers[0].description='';
 if(['full','whole','mismatch'].includes(mode)){
  Object.assign(profile.records.papers[0],{authorOrder:'共同第一作者',type:'匿名期刊类型'});
  if(mode!=='mismatch')profile.records.papers[0].fieldOptions={authorOrder:['一作/共一'],type:['SCI/SSCI/EI/CSSCI/核心期刊论文']};
 }
 if(['patent','no','unset','ambiguous','double-input'].includes(mode)){
  if(mode==='patent')document.querySelectorAll('[data-key="kind"] .phoenix-radio')[1].click();
  if(mode==='no')document.querySelectorAll('[data-key="hasPapers"] .phoenix-radio')[1].click();
  if(mode==='unset')document.querySelectorAll('.phoenix-radio--checked').forEach(n=>n.classList.remove('phoenix-radio--checked'));
  if(mode==='ambiguous'){const heading=document.querySelector('[data-anonymous-section="papers"] > div[id]');heading.after(heading.cloneNode(true));}
  if(mode==='double-input')name().after(name().cloneNode());
  const scan=await command('scan'),fill=await command('fillCollection',{collection:'papers',resetTransaction:true});
  check('unsupported or ambiguous paper editors produce no automatic paper writes',!scan.suggestions.length&&!fill.filled.length&&!name().value&&!description().value);
  profile.entries=[{id:'basic.name',category:'基本信息',value:'匿名本人'}];
  const label=document.createElement('label'),target=document.createElement('input');label.textContent='姓名';label.append(target);document.querySelector('div.form[id]').append(label);
  await command('fillFlatEntries',{resetTransaction:true});
  check('the paper or patent namespace is excluded from ordinary applicant filling',!target.value);
  return{checks};
 }
 if(mode==='foreign'){
  name().value='用户保留的另一论文';const fill=await command('fillCollection',{collection:'papers',resetTransaction:true});
  check('another existing paper is never reused or overwritten',!fill.filled.length&&name().value==='用户保留的另一论文'&&!description().value&&document.querySelectorAll('div.form[id]').length===1);return{checks};
 }
 if(mode==='existing'){
  name().value='匿名论文甲';const fill=await command('fillCollection',{collection:'papers',resetTransaction:true});
  check('matching existing identity accepts only its empty fields',fill.filled.length===1&&description().value==='匿名论文贡献说明');
  check('undo preserves the pre-existing name',(await command('undo')).failedCount===0&&name().value==='匿名论文甲'&&!description().value);return{checks};
 }
 if(mode==='capacity')profile.records.papers.push({...profile.records.papers[0],id:'anonymous-paper-2',name:'匿名论文乙'});
 const expected=mode==='minimal'?1:['full','whole'].includes(mode)?4:2;
 const scan=await command('scan');
 check('paper editor is scanned without modifying it (suggestions='+scan.suggestions.length+')',scan.suggestions.length===(mode==='mismatch'?4:expected)&&!name().value&&!description().value);
 const fill=await command(mode==='whole'?'fill':mode==='single'?'fillRecord':'fillCollection',{collection:'papers',recordId:mode==='single'?'anonymous-paper':undefined,resetTransaction:true});
 check('paper name fills its exact existing editor (filled='+fill.filled.length+')',name().value==='匿名论文甲'&&fill.filled.length===expected);
 if(mode!=='minimal')check('paper description uses its own JSON main value',description().value==='匿名论文贡献说明');
 if(['full','whole'].includes(mode))check('author and journal groups use explicit profile candidates',dropdown('authorOrder')==='一作/共一'&&dropdown('type')==='SCI/SSCI/EI/CSSCI/核心期刊论文');
 if(mode==='mismatch')check('unknown dropdown values are not guessed and leave no menu',dropdown('authorOrder')==='请选择'&&dropdown('type')==='请选择'&&!document.querySelector('.common-unmodeled-layer'));
 if(mode==='capacity')check('only existing editor capacity is used',document.querySelectorAll('div.form[id]').length===1&&fill.skipped.length>0);
 check('paper transaction verifies',(await command('verify',{expectations:fill.filled})).confirmedCount===expected);
 if(mode==='edited'){
  description().value='用户后来修改的简介';await command('undo');
  check('undo preserves later user edits',!name().value&&description().value==='用户后来修改的简介');return{checks};
 }
 check('undo restores the existing editor',(await command('undo')).failedCount===0&&!name().value&&!description().value);
 check('eligibility radios are preserved by fill and undo',selected()==='是/论文');
 return{checks};
}
