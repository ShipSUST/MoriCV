// MAIN world: minimal public component ownership only. No model values or writes.
(function installJob51Readback(){
  'use strict';
  const requestType='MORI_CV_JOB51_READ',responseType='MORI_CV_JOB51_READ_RESULT';
  const version=2;if(globalThis.__moriJob51ReadbackInstalled===version)return;
  function allowed(){
    if(location.pathname!=='/External/MyResume/FillInResume.aspx'||!(location.hostname==='xyz.51job.com'||location.hostname==='127.0.0.1'&&document.documentElement.dataset.job51Anonymous==='resume-v1'))return false;
    const forms=document.querySelectorAll('form#form1'),roots=document.querySelectorAll('#container'),active=document.querySelectorAll('li.leftli2[title]');
    return forms.length===1&&roots.length===1&&forms[0].contains(roots[0])&&active.length===1&&['基本信息','教育经历','IT技能','实习/工作经验'].includes(active[0].title)&&roots[0].querySelector(':scope > h1')?.textContent.trim()===active[0].title;
  }
  function read(element,kind){
    if(!allowed()||!(element instanceof HTMLElement)||!element.isConnected)return null;
    const dl=element.closest('#container > .ci > dl[dlcolname][editstyle]');if(!dl)return null;
    const module=document.querySelector('li.leftli2[title]').title;
    if(kind==='dictionary'&&element instanceof HTMLSelectElement&&dl.getAttribute('editstyle')==='11'){
      const definitions={基本信息:{City:['目前居住地','D_JOBAREA','1'],EnglishLevel:['英语水平','D_EnglishLevel','5'],OtherLanguage:['其他外语','D_SecondLanguage','5']},IT技能:{CCE1:['技能','D_ITSKILLSLIST','5']},'实习/工作经验':{CCE2:['职位','D_FUNTYPE','5']}};
      const col=dl.getAttribute('dlcolname'),def=definitions[module]?.[col],suffix=new RegExp('^ddl_'+col+'_'+(def?.[2]||'')+'_(\\d+)$').exec(element.id)?.[1];
      if(!def||!suffix||def[0]!==dl.querySelector(':scope > dt')?.textContent.replace(/[\s：:*＊]/g,''))return null;
      const selects=dl.querySelectorAll(':scope > dd select'),child=selects[1],childId='cc_'+col+'_'+def[2]+'_'+suffix;
      if(selects.length!==2||selects[0]!==element||child.id!==childId||document.querySelectorAll('#'+CSS.escape(element.id)).length!==1||document.querySelectorAll('#'+CSS.escape(childId)).length!==1)return null;
      const callback=/^\s*DDL_OnChange1\(\s*(['"])([^'"]+)\1\s*,\s*this\.options\[this\.selectedIndex\]\.value\s*,\s*(['"])([^'"]+)\3\s*\)\s*;?\s*$/.exec(element.getAttribute('onchange')||'');
      if(!callback||callback[2]!==def[1]||callback[4]!==childId)return null;
      const tables=Array.isArray(globalThis.ArrDictTable)?globalThis.ArrDictTable.filter(table=>table?.TableName===def[1]):[];
      if(tables.length!==1||!Array.isArray(tables[0].Rows)||tables[0].Rows.length>1000)return null;
      const rows=[];let total=0;
      for(const option of element.options){if(!option.value||option.disabled||option.hidden)continue;const index=Number(option.value),row=tables[0].Rows[index];if(!Number.isInteger(index)||String(index)!==option.value||!row||typeof row.RowName!=='string'||typeof row.Value!=='string'||row.RowName.trim()!==option.textContent.trim()||row.Value.length>200000)return null;
        const children=row.Value.split('|').map(value=>{const parts=value.split(',');return {label:parts[0].trim(),value:parts.length>1?parts[1]:parts[0]};});total+=children.length;if(total>15000)return null;
        rows.push({value:option.value,label:option.textContent.trim(),children});
      }
      return {dictionary:def[1],parentId:element.id,childId,rows};
    }
    if(!(element instanceof HTMLInputElement))return null;
    const columns=module==='教育经历'?{School:'毕业学校',Major:'专业',CCA2:'毕业学校2',CCA4:'专业2',GradDate:'毕业时间',CCC1:'毕业时间2'}:module==='实习/工作经验'?{CCC1:'开始日期',CCC2:'结束日期'}:{};
    const col=dl.getAttribute('dlcolname');if(columns[col]!==dl.querySelector(':scope > dt')?.textContent.replace(/[\s：:*＊]/g,''))return null;
    if(kind==='menu'&&element.matches('.custom-combobox > input.custom-combobox-input')){
      const wrapper=element.parentElement,select=wrapper.previousElementSibling;
      if(!(select instanceof HTMLSelectElement)||!/^cc_(School|Major|CCA2|CCA4)_1_1$/.test(select.id))return null;
      const widget=globalThis.jQuery?.(element).data('ui-autocomplete'),menu=widget?.menu?.element?.[0];
      return widget?.element?.[0]===element&&menu instanceof HTMLUListElement&&menu.isConnected&&menu.id?{id:menu.id}:null;
    }
    if(kind==='calendar'&&element.readOnly&&new RegExp(module==='教育经历'?'^cc_(GradDate|CCC1)_3_1$':'^cc_(CCC1|CCC2)_3_\\d+$').test(element.id)){
      const dp=globalThis.$dp,popup=document.getElementById('_my97DP');
      const frame=popup?.querySelector(':scope > iframe');
      return document.querySelectorAll('#_my97DP').length===1&&dp?.el===element&&dp?.win?.document===document&&dp?.dd===popup&&frame instanceof HTMLIFrameElement
        && /\/My97DatePicker\.htm(?:[?#]|$)/.test(frame.src)&&dp.dateFmt==='yyyy-MM-dd'&&!dp.eCont&&(!dp.elProp||dp.elProp==='value')?{id:popup.id,ownerId:element.id,format:dp.dateFmt}:null;
    }
    return null;
  }
  if(!allowed())return;
  if(typeof globalThis.__moriJob51ReadbackListener==='function')document.removeEventListener(requestType,globalThis.__moriJob51ReadbackListener,true);
  const listener=event=>{try{if(typeof event.detail!=='string'||event.detail.length>200)return;const request=JSON.parse(event.detail);if(typeof request.id!=='string'||request.id.length>80)return;const value=read(event.target,request.kind);event.target.dispatchEvent(new CustomEvent(responseType,{detail:JSON.stringify({id:request.id,value})}));}catch(_){/* Unknown components fail closed. */}};
  document.addEventListener(requestType,listener,true);globalThis.__moriJob51ReadbackListener=listener;
  globalThis.__moriJob51ReadbackInstalled=version;
})();
