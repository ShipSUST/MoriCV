// Executed by CDP in a real Chrome isolated world. UI/React fixture and the
// read-only bridge remain in MAIN; this file cannot access their JS objects.
globalThis.__recordRunner=(async()=>{
 const checks=[];const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);globalThis.__recordProgress={checks:[...checks]};};
 const command=(command,payload={})=>new Promise((resolve,reject)=>__resumeHelperListener({type:'RESUME_HELPER_COMMAND',command,payload},null,r=>r?.error?reject(Error(r.error)):resolve(r)));
 const input=document.querySelector('[data-anonymous-section=basic] [data-key=region] input');
 check('React expandos and fixture globals are absent in the isolated world',!Object.keys(input).some(key=>key.startsWith('__reactFiber'))&&typeof globalThis.ChinalifeFixture==='undefined');
 input.focus();const r=await command('fillTarget',{entry:{id:'anonymous.isolated',value:'较短复制值',pathValues:[['江苏','江苏省'],['泰州市'],['兴化市']]}});
 check('isolated production driver commits a path through the MAIN read-only bridge',r.success&&input.value==='中国/江苏省/泰州市/兴化市');
 const undo=await command('undo');check('isolated undo restores the committed empty selection',undo.failedCount===0&&!input.value);
 const clone=input.closest('.form-item').cloneNode(true);input.closest('div.form').append(clone);const missing=clone.querySelector('input');missing.focus();const skipped=await command('fillTarget',{entry:{id:'anonymous.missingReaderData',value:'江苏',pathValues:[['江苏省'],['泰州市'],['兴化市']]}});
 check('a changed component without metadata fails closed without writing',!skipped.success&&!missing.value&&!document.querySelector('.area-selector-container'));clone.remove();
 const constant=document.querySelector('[data-anonymous-section=basic] [data-key=ethnicity] input');constant.focus();
 const selected=await command('fillTarget',{entry:{id:'anonymous.constant.isolated',value:'虚构民族甲'}});
 check('isolated constant driver reads leaf and selection metadata without React access',selected.success&&constant.value==='虚构民族甲');
 check('isolated constant undo restores the original blank control',(await command('undo')).failedCount===0&&!constant.value);
 const date=document.querySelector('[data-anonymous-section=basic] [data-key=joiningParty] input');date.focus();
 const dated=await command('fillTarget',{entry:{id:'anonymous.date.isolated',value:'2018-05-17'}});
 check('isolated custom ordinary date uses the real calendar contract',dated.success&&date.value==='2018-05-17');await command('undo');
 const profile={entries:[],records:{awards:[{id:'award.isolated',name:'虚构隔离奖项',start:'2021-05-17'}],projects:[{id:'project.isolated',name:'虚构隔离项目',start:'2020-02-29',end:'2022-06-25'}]}};
 const field=(key,name)=>document.querySelector(`[data-anonymous-section=${key}] [data-key=${name}] input`);
 field('awards','name').value=profile.records.awards[0].name;field('projects','name').value=profile.records.projects[0].name;
 const settings={confidenceThreshold:100,overwriteExisting:false,rejectedMatches:[]};
 const scan=await command('scan',{profile,settings});
 check('isolated record scan resolves award and both project date labels at threshold 100',['award.isolated.start','project.isolated.start','project.isolated.end'].every(id=>scan.suggestions.some(item=>item.entryId===id)));
 await command('fillRecord',{profile,settings,collection:'awards',recordId:'award.isolated',resetTransaction:true});
 check('isolated record filling commits the award day without changing its identity',field('awards','start').value==='2021-05-17'&&field('awards','name').value==='虚构隔离奖项');
 await command('fillRecord',{profile,settings,collection:'projects',recordId:'project.isolated',resetTransaction:false});
 check('isolated record filling commits both project month values',field('projects','start').value==='2020-02'&&field('projects','end').value==='2022-06');
 await command('undo');check('isolated record date undo retains the existing names',!field('awards','start').value&&!field('projects','start').value&&field('awards','name').value==='虚构隔离奖项'&&field('projects','name').value==='虚构隔离项目');
 const own=field('awards','start');own.focus();own.click();
 await command('fillRecord',{profile,settings:{...settings,confidenceThreshold:60},collection:'awards',recordId:'award.isolated',resetTransaction:true});
 check('an isolated driver reuses its already opened portal at sensitivity 60',own.value==='2021-05-17'&&!document.querySelector('.phoenix-calendar'));await command('undo');
 const foreign=document.querySelector('[data-anonymous-section=basic] [data-key=birth] input');foreign.focus();foreign.click();
 const opened=document.querySelector('.phoenix-calendar');own.focus();const refused=await command('fillTarget',{entry:{id:'foreign.isolated.date',value:'2021-05-17'}});
 check('an isolated driver never selects or closes another field\'s calendar',!refused.success&&!own.value&&!foreign.value&&document.querySelector('.phoenix-calendar')===opened);
 return {adapter:'zhiye',template:'chinalife',checks};
})().catch(error=>({error:error.stack,checks:globalThis.__recordProgress?.checks||[]}));
