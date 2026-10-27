/* The observed xyz.51job.com template; never calls website save callbacks. */
(function installJob51() {
  'use strict';
  if (globalThis.ResumeHelperJob51) return;
  globalThis.ResumeHelperJob51 = { create(helpers) {
    const resumePath = '/External/MyResume/FillInResume.aspx';
    const labels = { basic: '基本信息', education: '教育经历', skills: 'IT技能', work: '实习/工作经验', self: '自我评价' };
    const normalizeLabel = text => String(text || '').replace(/[\s：:*＊]/g, '');
    const normalizeValue=text=>String(text??'').trim().replace(/\s+/g,' ').toLowerCase();
    const education = [
      ['Degree','最高学历','select','educationLevel',0],['GradDate','毕业时间','my97','end',0,'3'],['School','毕业学校','combo','school',0],['OtherSchool','其他学校','supplement','school',0],['Major','专业','combo','major',0],['OtherMajor','其他专业','supplement','major',0],['Score','学习成绩排名','select','rank',0],['Course','主修课程','textarea','professionalCourses',0],
      ['CCA1','其他学历','select','educationLevel',1],['CCC1','毕业时间2','my97','end',1,'3'],['CCA2','毕业学校2','combo','school',1],['CCA3','其他学校2','supplement','school',1],['CCA4','专业2','combo','major',1],['CCA5','其他专业2','supplement','major',1],['CCA14','学习成绩排名2','select','rank',1],['CCF1','主修课程2','textarea','professionalCourses',1]
    ];
    const repeated = {
      skills:[['CCE1','技能','dependentPair','name','11','5','D_ITSKILLSLIST'],['CCA1','掌握程度','select','level','4','1']],
      work:[['CCC1','开始日期','my97','start','3','3'],['CCC2','结束日期','my97','end','3','3'],['CCA1','公司名称','text','company',null,'1'],['CCE2','职位','dependentPair','position','11','5','D_FUNTYPE'],['CCF1','工作描述','textarea','description',null,'6']]
    };
    const slotOwners=new WeakMap();
    function root() {
      const forms = document.querySelectorAll('form#form1'), containers = document.querySelectorAll('#container');
      return forms.length === 1 && containers.length === 1 && forms[0].contains(containers[0]) ? containers[0] : null;
    }
    const basics = {
      Cname: { labels: ['姓名', '中文姓名'], type: 'text', aliases: ['姓名', '中文姓名'] },
      Gender: { labels: ['性别'], type: 'select', aliases: ['性别'] },
      Party: { labels: ['政治面貌'], type: 'select', aliases: ['政治面貌'] },
      Birthday: { labels: ['出生日期', '出生年月'], type: 'monthPair', aliases: ['出生年月', '出生日期', '生日'], style: '23' },
      City: { labels: ['目前居住地'], type: 'dependentPair', aliases: ['目前居住地', '现居住地', '现居住城市', '现居城市', '当前居住地', '居住地'], style: '11', parent: 'ddl_City_1_1', child: 'cc_City_1_1' },
      EnglishLevel: { labels: ['英语水平'], type: 'dependentPair', aliases: ['英语水平', '英语等级'], style: '11', parent: 'ddl_EnglishLevel_5_1', child: 'cc_EnglishLevel_5_1' },
      OtherLanguage: { labels: ['其他外语'], type: 'dependentPair', aliases: ['其他外语'], style: '11', parent: 'ddl_OtherLanguage_5_1', child: 'cc_OtherLanguage_5_1' },
      Email: { labels: ['电子邮件', '电子邮箱', 'E-mail', '邮箱'], type: 'text', aliases: ['电子邮箱', '电子邮件', '邮箱'] },
      MobilePhone: { labels: ['手机号码', '手机', '移动电话'], type: 'text', aliases: ['手机号码', '手机号', '手机', '联系电话'] }
    };
    function ownsPage() {
      return location.pathname === resumePath && (location.hostname === 'xyz.51job.com'
        || (location.hostname === '127.0.0.1' && document.documentElement.dataset.job51Anonymous === 'resume-v1'));
    }
    function moduleName() {
      if (!ownsPage()) return '';
      const container = root();
      const title = container?.querySelector(':scope > h1');
      const active = document.querySelectorAll('li.leftli2[title]');
      if (!title || active.length !== 1 || normalizeLabel(title.textContent) !== normalizeLabel(active[0].title)) return '';
      return Object.keys(labels).find(key => normalizeLabel(labels[key]) === normalizeLabel(title.textContent)) || '';
    }
    function fields() {
      const key = moduleName();
      if (!key) return [];
      if(key==='education'&&root().querySelectorAll(':scope > .ci').length!==1)return [];
      const rows = Array.from(root().querySelectorAll(':scope > .ci > dl[dlcolname][editstyle]'));
      const fields = [];
      for (const dl of rows) {
        const col = dl.getAttribute('dlcolname');
        const card=dl.parentElement,repeat=repeated[key]?.find(item=>item[0]===col);
        if ((repeat?Array.from(card.querySelectorAll(':scope > dl[dlcolname]')):rows).filter(row => row.getAttribute('dlcolname') === col).length !== 1) continue;
        const label = normalizeLabel(dl.querySelector(':scope > dt')?.textContent);
        const edu = key === 'education' && education.find(item => item[0] === col);
        const suffix=repeat&&Array.from(dl.querySelectorAll(':scope > dd [id]')).map(element=>new RegExp('^cc_'+col+'_'+repeat[5]+'_(\\d+)$').exec(element.id)).find(Boolean)?.[1];
        if(repeat&&repeated[key].some(definition=>Array.from(card.querySelectorAll(':scope > dl[dlcolname="'+definition[0]+'"] > dd [id]')).some(control=>{const match=new RegExp('^cc_'+definition[0]+'_'+definition[5]+'_(\\d+)$').exec(control.id);return match&&match[1]!==suffix;})))continue;
        const spec = repeat&&suffix ? {labels:[repeat[1]],type:repeat[2],recordKey:repeat[3],slot:suffix,aliases:[repeat[1]],style:repeat[4],id:'cc_'+col+'_'+repeat[5]+'_'+suffix,parent:'ddl_'+col+'_'+repeat[5]+'_'+suffix,child:'cc_'+col+'_'+repeat[5]+'_'+suffix,dict:repeat[6]} : edu ? { labels:[edu[1]], type:edu[2], recordKey:edu[3], slot:edu[4], aliases:[edu[1]], style:edu[5] } : key === 'basic' ? basics[col] : key === 'self' && col === 'SelfAssessment'
          ? { labels: ['自我评价'], type: 'textarea', id: 'cc_SelfAssessment_6_1', aliases: ['自我评价', 'self evaluation'], style: '6' } : null;
        if (!spec || !spec.labels.some(text => normalizeLabel(text) === label)
          || (spec.style && (!edu || spec.type==='my97') && dl.getAttribute('editstyle') !== spec.style)) continue;
        const controls = Array.from(dl.querySelectorAll(':scope > dd input,:scope > dd textarea,:scope > dd select'))
          .filter(element => !element.disabled && helpers.isVisible(element));
        const metadata = { module: key, col, aliases: spec.aliases, kind: spec.type, slot:spec.slot, recordKey:spec.recordKey,card,dict:spec.dict };
        if(repeat&&(!suffix||Array.from(dl.querySelectorAll(':scope > dd [id]')).some(element=>document.querySelectorAll('#'+CSS.escape(element.id)).length!==1)))continue;
        if(spec.type==='combo'){
          const select=dl.querySelector(':scope > dd > select'),wrapper=select?.nextElementSibling;
          const queries=wrapper?.matches('.custom-combobox')?wrapper.querySelectorAll(':scope > input.custom-combobox-input'):[];
          const query=queries.length===1&&queries[0];
          if(!(select instanceof HTMLSelectElement)||select.disabled||helpers.isVisible(select)||dl.querySelectorAll(':scope > dd > select').length!==1||select.id!=='cc_'+col+'_1_1'||!query||!helpers.isVisible(query)||query.disabled)continue;
          fields.push({element:query,type:'select',context:spec.aliases.join(' | '),name:spec.labels[0],job51:{...metadata,select,controls:[query,select]}});continue;
        }
        if(spec.type==='supplement')continue;
        if (['monthPair', 'dependentPair'].includes(spec.type)) {
          const selects = controls.filter(element => element instanceof HTMLSelectElement);
          if (selects.length !== 2 || controls.length !== 2) continue;
          if (spec.type === 'monthPair' && !dl.querySelector('input[type=hidden]#cc_Birthday_3_1')) continue;
          if (spec.type === 'dependentPair' && (selects[0].id !== spec.parent || selects[1].id !== spec.child)) continue;
          fields.push({ element: selects[0], type: spec.type === 'monthPair' ? 'month' : 'select', context: spec.aliases.join(' | '), name: spec.labels[0], job51: { ...metadata, controls: selects } });
          continue;
        }
        const element = spec.id ? controls.find(control => control.id === spec.id)
          : col === 'MobilePhone' ? controls.find(control => /^cc_MobilePhone_\d+_\d+$/.test(control.id))
          : controls.length === 1 ? controls[0] : null;
        if(edu&&element?.id!=='cc_'+col+'_'+(spec.type==='textarea'?'6':spec.type==='my97'?'3':'1')+'_1')continue;
        const supported = spec.type === 'text' ? element instanceof HTMLInputElement && element.type === 'text'
          : spec.type === 'my97' ? element instanceof HTMLInputElement && element.type==='text'&&element.readOnly&&element.id===(repeat?spec.id:'cc_'+col+'_3_1')&&/\bsetday\s*\(/.test(element.getAttribute('onfocus')||'')
          : spec.type === 'select' ? element instanceof HTMLSelectElement : element instanceof HTMLTextAreaElement;
        if (!supported) continue;
        fields.push({ element, type: spec.type, context: spec.aliases.join(' | '), name: spec.labels[0], job51: metadata });
      }
      return fields;
    }
    function notes() {
      if (!ownsPage()) return [];
      const currentModule = moduleName();
      if (!currentModule) return [{field:'51job',entryId:'',reason:'未识别当前 51job 模块或表单指纹，请手动处理'}];
      if (currentModule !== 'basic') return [];
      const target = root()?.querySelector(':scope > .ci > dl[dlcolname="TargetCity"][editstyle="11"]');
      return normalizeLabel(target?.querySelector(':scope > dt')?.textContent) === '期望工作地点'
        ? [{field:'期望工作地点',entryId:'manual.intent',label:'手动选择',score:100,reason:'岗位和工作城市因企业而异，请手动填写'}] : [];
    }
    function info(element) { return fields().find(field => field.element === element) || null; }
    function identity(element) { const field = info(element); return field ? [field.job51.module,field.job51.col,field.job51.kind,field.job51.slot??'',element.closest('dl')?.getAttribute('editstyle')].join(":") : null; }
    function value(element) {
      const field = info(element);
      if (!field?.job51.controls) return undefined;
      if(field.job51.kind==='combo'){
        const select=field.job51.select,label=select.value?select.selectedOptions[0]?.textContent.trim()||'':'';
        if(element.value.trim()!==label)return element.value.trim()||label?`未确认选择：${element.value.trim()} / ${label}`:'';
        const supplement=otherOption(field)?supplementFor(field):null;return supplement?.value.trim()||label;
      }
      const selected = field.job51.controls.map(control => control.value ? control.selectedOptions[0]?.textContent.trim() || '' : '');
      if (selected.every(text => !text)) return '';
      if (field.job51.kind === 'monthPair') return selected[0] + '-' + selected[1];
      return selected.join(' / ');
    }
    function snapshot(element) { const field=info(element);if(field?.job51.kind==='my97')return {kind:'my97',value:element.value};if(field?.job51.kind==='combo')return {kind:'combo',query:element.value,value:field.job51.select.value,label:field.job51.select.selectedOptions[0]?.textContent.trim()||'',supplement:supplementFor(field)?.value??null};return field?.job51.controls?.map(control => ({value:control.value,label:control.value ? control.selectedOptions[0]?.textContent.trim() || '' : ''})) || null; }
    async function restore(element, values) {
      const field = info(element);
      if(field?.job51.kind==='my97'&&values?.kind==='my97')return await selectDate(field,values.value)&&element.value===values.value;
      if(field?.job51.kind==='combo'&&values?.kind==='combo'){
        if(values.value){if(!await selectCombo(field,[values.label],values.value))return false;}
        else {element.focus();element.value='';element.dispatchEvent(new Event('input',{bubbles:true}));element.blur();helpers.dispatchEditEvents(element);await helpers.wait(80);}
        if(values.supplement!==null){const supplement=supplementFor(field);if(!supplement)return false;supplement.value=values.supplement;helpers.dispatchEditEvents(supplement);await helpers.wait(30);}
        // Restore an unfinished search as a draft after committing the old native
        // selection. Change/blur would validate it and erase the user's draft.
        if(element.value!==values.query){element.focus();element.value=values.query;element.dispatchEvent(new Event('input',{bubbles:true}));await helpers.wait(80);}
        return JSON.stringify(snapshot(element))===JSON.stringify(values);
      }
      if (!values || field?.job51.controls?.length !== values.length) return false;
      for (let index = 0; index < values.length; index++) {
        const control = field.job51.controls[index];
        if (!Array.from(control.options).some(option => option.value === values[index].value && (!values[index].value || option.textContent.trim() === values[index].label) && !option.disabled)) return false;
        control.value = values[index].value;
        helpers.dispatchEditEvents(control);
        await helpers.wait(30);
      }
      return JSON.stringify(snapshot(element)) === JSON.stringify(values);
    }
    async function write(element, entry) {
      const field = info(element);
      if(field?.job51.kind==='my97'){
        const policy=helpers.dateSelectionPolicy(entry,'day');if(policy.reason){helpers.controlFailures.set(element,policy.reason);return false;}
        const before=snapshot(element);let accepted=false;try{accepted=await selectDate(field,policy.parts.date);}catch(_){}
        if(accepted)return true;
        let restored=false;try{restored=await restore(element,before);}catch(_){}
        helpers.controlFailures.set(element,restored?'My97 日期未确认，已恢复原日期':'My97 日期未确认且原日期恢复失败，请检查并撤销');return false;
      }
      if(field?.job51.kind==='combo'){
        const before=snapshot(element);let accepted=false;
        try{
          accepted=await selectCombo(field,[entry.value,...(entry.optionValues||[])]);
          if(accepted&&otherOption(field)&&element.value.trim()!==String(entry.value).trim()){
            const supplement=supplementFor(field);if(!supplement)accepted=false;
            else {supplement.value=String(entry.value);helpers.dispatchEditEvents(supplement);await helpers.wait(40);accepted=supplement.value===String(entry.value)&&Boolean(info(element))&&otherOption(field);}
          }
        }catch(_){accepted=false;}
        if(accepted)return true;
        let restored=false;try{restored=await restore(element,before);}catch(_){}
        helpers.controlFailures.set(element,restored?'学校/专业没有确认实际选中，已恢复原状态':'学校/专业选择未确认，原状态恢复失败，请检查并撤销');return false;
      }
      if (!field?.job51.controls) return null;
      const { kind, controls } = field.job51;
      let candidates;
      let parts;
      let resolvedTarget;
      if (kind === 'monthPair') {
        const policy = helpers.dateSelectionPolicy(entry, 'month');
        if (policy.reason) { helpers.controlFailures.set(element, policy.reason); return false; }
        parts = policy.parts;
        candidates = policy.candidates;
      } else {
        resolvedTarget=dependentTarget(field,entry);candidates=resolvedTarget?.path;
        if (!candidates) {
          helpers.controlFailures.set(element, '此 51job 联动选项需要明确的两级候选路径或公开字典中唯一精确选项；不会推断上级分类、考试或分数段，请手动选择');
          return false;
        }
      }
      const choose = (control, alternatives) => alternatives.map(text => helpers.exactOption(Array.from(control.options).filter(option=>!option.hidden), text)).find(Boolean);
      const first = choose(controls[0], candidates[0]);
      // Birth-month choices are independent; preflight both to avoid partial dates.
      if (!first || (kind === 'monthPair' && !choose(controls[1], candidates[1]))) {
        helpers.controlFailures.set(element, '51job 选项不存在或不唯一，请手动选择'); return false;
      }
      const before = snapshot(element);
      const contract=identity(element);
      let accepted = false;
      try {
        controls[0].value = first.value;
        helpers.dispatchEditEvents(controls[0]);
        await helpers.wait(50);
        const second = choose(controls[1], candidates[1]);
        if (second) {
          controls[1].value = second.value;
          helpers.dispatchEditEvents(controls[1]);
          await helpers.wait(50);
          accepted = identity(element)===contract&&[first, second].every((option,index) => controls[index].value === option.value && controls[index].selectedOptions[0]?.textContent.trim() === option.textContent.trim()&&(!resolvedTarget?.codes||option.value===resolvedTarget.codes[index]));
        }
      } catch (_) { accepted = false; }
      if (accepted) {
        if (kind === 'monthPair') helpers.datePrecisionNotes.set(element, '网站仅支持年月，已填写年月；隐藏提交值由网站后续保存生成，未填写日');
        return true;
      }
      let restored = false;
      try { restored = await restore(element, before); } catch (_) {}
      helpers.controlFailures.set(element, restored ? '51job 联动选择未确认，已恢复原选择' : '51job 联动选择未确认，恢复失败，请检查并撤销');
      return false;
    }
    function locator(element) {
      const field = info(element);
      if (!field) return null;
      const title = labels[field.job51.module];
      return 'body:has(li.leftli2[title="' + CSS.escape(title) + '"]) form#form1 #container > .ci > dl[dlcolname="' + CSS.escape(field.job51.col) + '"] > dd '
        + (field.job51.kind==='combo'?'.custom-combobox > input.custom-combobox-input':element.id ? '#' + CSS.escape(element.id) : element.tagName.toLowerCase() + ':first-of-type');
    }
    function readOwner(element,kind){
      const id=crypto.randomUUID();let result=null;
      const listener=event=>{try{const response=JSON.parse(event.detail);if(response.id===id)result=response.value;}catch(_){}};
      element.addEventListener('MORI_CV_JOB51_READ_RESULT',listener);element.dispatchEvent(new CustomEvent('MORI_CV_JOB51_READ',{bubbles:true,detail:JSON.stringify({id,kind})}));element.removeEventListener('MORI_CV_JOB51_READ_RESULT',listener);return result;
    }
    function dependentTarget(field,entry){
      const path=entry.pathValues;
      if(Array.isArray(path)&&path.length===2&&path.every(level=>Array.isArray(level)&&level.some(text=>String(text).trim())))return {path};
      // A score/proficiency label alone never identifies a language or exam.
      if(!['skills','work'].includes(field.job51.module))return null;
      const dictionary=readOwner(field.element,'dictionary');if(!dictionary||dictionary.parentId!==field.element.id||dictionary.childId!==field.job51.controls[1].id||!Array.isArray(dictionary.rows))return null;
      for(const candidate of [entry.value,...(entry.optionValues||[])]){
        if(!String(candidate??'').trim())continue;
        const matches=dictionary.rows.flatMap(parent=>Array.isArray(parent.children)?parent.children.filter(child=>child.value&&normalizeValue(child.label)===normalizeValue(candidate)).map(child=>({parent,child})):[]);
        if(matches.length>1)return null;
        if(matches.length===1)return {path:[[matches[0].parent.label],[matches[0].child.label]],codes:[matches[0].parent.value,matches[0].child.value]};
      }
      return null;
    }
    function matches(element,entry){
      const field=info(element);if(field?.job51.kind!=='dependentPair')return null;
      const target=dependentTarget(field,entry);if(!target)return false;
      return field.job51.controls.every((control,index)=>control.value&&target.path[index].some(candidate=>normalizeValue(candidate)===normalizeValue(control.selectedOptions[0]?.textContent))&&(!target.codes||control.value===target.codes[index]));
    }
    function recordValue(element){const field=info(element);return field?.job51.kind==='dependentPair'?field.job51.controls[1].value?field.job51.controls[1].selectedOptions[0]?.textContent.trim()||'':'':value(element)??(element instanceof HTMLSelectElement?element.value?element.selectedOptions[0]?.textContent.trim()||'':'':element.value);}
    function otherOption(field){
      const select=field.job51.select,dict=String(select?.dataset.dict||'').toLowerCase(),key=field.job51.recordKey;
      return Boolean(select&&!dict.includes('cmcc')&&(key==='school'&&dict.includes('school')&&select.value==='S_99000'||key==='major'&&dict.includes('major')&&select.value==='FF01'));
    }
    function conflict(element,entry){
      const field=info(element);
      if(field?.job51.kind==='dependentPair')return value(element)&&!matches(element,entry)?{field:field.name,currentValue:value(element),expectedValue:String(entry.value)}:null;
      if(field?.job51.kind!=='combo')return null;
      const select=field.job51.select,option=[entry.value,...(entry.optionValues||[])].map(text=>helpers.exactOption(Array.from(select.options),text)).find(Boolean);
      const dict=String(select.dataset.dict||'').toLowerCase(),key=field.job51.recordKey;
      const other=option&&!dict.includes('cmcc')&&(key==='school'&&dict.includes('school')&&option.value==='S_99000'||key==='major'&&dict.includes('major')&&option.value==='FF01');
      if(!other||String(entry.value).trim()===option.textContent.trim())return null;
      const supplement=supplementFor(field);return supplement?.value.trim()&&normalizeValue(supplement.value)!==normalizeValue(entry.value)?{field:field.name+'补充',currentValue:supplement.value,expectedValue:String(entry.value)}:null;
    }
    function supplementFor(field){
      const spec=education.find(item=>item[2]==='supplement'&&item[3]===field.job51.recordKey&&item[4]===field.job51.slot);if(!spec||!root())return null;
      const rows=Array.from(root().querySelectorAll(':scope > .ci > dl[dlcolname][editstyle]')).filter(dl=>dl.getAttribute('dlcolname')===spec[0]);
      if(rows.length!==1||normalizeLabel(rows[0].querySelector(':scope > dt')?.textContent)!==normalizeLabel(spec[1]))return null;
      const inputs=rows[0].querySelectorAll(':scope > dd input');const element=inputs.length===1&&inputs[0];
      return element instanceof HTMLInputElement&&element.type==='text'&&element.id==='cc_'+spec[0]+'_1_1'&&!element.disabled&&!element.readOnly&&helpers.isVisible(element)?element:null;
    }
    async function selectCombo(field,candidates,requiredCode){
      const element=field.element,select=field.job51.select;
      const option=candidates.map(text=>helpers.exactOption(Array.from(select.options).filter(option=>!option.hidden),text)).find(Boolean);
      if(!option||!option.value||requiredCode&&option.value!==requiredCode)return false;
      element.focus();element.value=option.textContent.trim();element.dispatchEvent(new Event('input',{bubbles:true}));
      let menu=null;
      for(let attempt=0;attempt<20;attempt++){await helpers.wait(30);if(!info(element))return false;const owner=readOwner(element,'menu');menu=owner?.id&&document.getElementById(owner.id);if(menu&&helpers.isVisible(menu))break;}
      if(!menu||!helpers.isVisible(menu)||menu.tagName!=='UL'||document.querySelectorAll('#'+CSS.escape(menu.id)).length!==1)return false;
      const items=Array.from(menu.querySelectorAll(':scope > li.ui-menu-item')).filter(item=>!item.matches('.ui-state-disabled')&&item.getAttribute('data-value')===option.textContent.trim());
      if(items.length!==1||readOwner(element,'menu')?.id!==menu.id)return false;
      const item=items[0].querySelector('.ui-menu-item-wrapper')||items[0];
      for(const type of ['mousedown','mouseup','click'])item.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window}));
      await helpers.wait(80);element.blur();await helpers.wait(40);
      return Boolean(info(element)&&select.value===option.value&&select.selectedOptions[0]?.textContent.trim()===option.textContent.trim()&&element.value.trim()===option.textContent.trim());
    }
    async function selectDate(field,target){
      const element=field.element;
      const innerVisible=node=>{if(!node?.isConnected||!node.getClientRects().length)return false;const style=node.ownerDocument.defaultView.getComputedStyle(node);return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0;};
      const open=node=>Boolean(node&&helpers.isVisible(node)&&node.style.left!=='-1970px'&&node.style.top!=='-1970px');
      const existing=document.getElementById('_my97DP');
      if(open(existing)&&readOwner(element,'calendar')?.id!==existing.id)return false;
      element.focus();element.click();
      let popup,doc;
      const state=()=>{
        if(info(element)?.job51.kind!=='my97')return null;
        const owner=readOwner(element,'calendar');if(!owner||owner.ownerId!==element.id||owner.format!=='yyyy-MM-dd')return null;
        const current=document.getElementById(owner.id);if(!open(current)||document.querySelectorAll('#'+CSS.escape(owner.id)).length!==1)return null;
        const frames=current.querySelectorAll(':scope > iframe');if(frames.length!==1||!/\/My97DatePicker\.htm(?:[?#]|$)/.test(frames[0].src))return null;
        try{const inner=frames[0].contentDocument;return inner?.querySelector('.WdateDiv')?{popup:current,doc:inner}:null;}catch(_){return null;}
      };
      for(let attempt=0;attempt<40;attempt++){const current=state();if(current){({popup,doc}=current);break;}await helpers.wait(30);if(attempt%5===4&&!open(document.getElementById('_my97DP'))&&info(element)){element.blur();element.focus();element.click();}}
      if(!doc)return false;
      if(!target){const clear=doc.getElementById('dpClearInput');if(!clear||clear.disabled||!innerVisible(clear)||!state())return false;clear.click();await helpers.wait(80);return !element.value&&!open(popup)&&Boolean(info(element));}
      const parts=helpers.controlDateParts(target);if(!parts?.date)return false;
      const change=async(selector,value)=>{
        const current=state();if(!current)return false;
        const menu=current.doc.querySelector(selector),input=menu?.parentElement.querySelector('input');if(!input||input.disabled)return false;
        input.focus();input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();await helpers.wait(80);return Boolean(state());
      };
      if(!await change('#dpTitle .YMenu',parts.year)||!await change('#dpTitle .MMenu',parts.month))return false;
      const current=state();if(!current)return false;
      const cells=Array.from(current.doc.querySelectorAll('.WdayTable td[onclick]')).filter(cell=>{
        const match=/^\s*day_Click\((\d+),(\d+),(\d+)\);?\s*$/.exec(cell.getAttribute('onclick')||'');
        return match&&Number(match[1])===parts.year&&Number(match[2])===parts.month&&Number(match[3])===parts.day&&!cell.classList.contains('WinvalidDay')&&!cell.classList.contains('WotherDay');
      });
      if(cells.length!==1||!state())return false;
      cells[0].click();await helpers.wait(100);
      return Boolean(info(element)&&element.value===parts.date&&!open(popup));
    }
    function educationPlan(profile) {
      const records = profile.records?.educations || [];
      const available = fields().filter(field => field.job51.module === 'education' && field.job51.kind !== 'supplement');
      const slots = [0,1].map(slot => ({ slot, fields:available.filter(field => field.job51.slot === slot) }));
      const claims = new Map();
      const plans = [];
      const highest = records.filter(record => String(record.highest).trim() === '是');
      for (const data of records) {
        const matches = slots.filter(slot => {
          const school = slot.fields.find(field => field.job51.recordKey === 'school');
          const actual = school ? (value(school.element) ?? school.element.value) : '';
          const degree = slot.fields.find(field => field.job51.recordKey === 'educationLevel');
          const actualDegree = degree?.element.selectedOptions?.[0]?.textContent.trim();
          return actual && [data.school,...(data.fieldOptions?.school||[])].some(text=>normalizeValue(text)===normalizeValue(actual))
            && (!actualDegree || !degree.element.value || [data.educationLevel,...(data.fieldOptions?.educationLevel||[])].some(text=>normalizeValue(text)===normalizeValue(actualDegree)));
        });
        let target = matches.length === 1 ? matches[0] : null;
        if(target&&highest.length===1&&target.slot!==(data.id===highest[0].id?0:1))return records.map(data=>({data,fields:[],reason:'已有教育记录身份与资料中的唯一最高学历标记冲突；请手动确认固定两段教育位置'}));
        if (!matches.length) {
          if (highest.length === 1 && data.id === highest[0].id) target = slots[0];
          else if (highest.length === 1 && records.length === 2) target = slots[1];
        }
        let reason = !target ? '无法唯一确认教育记录身份或最高学历；请手动确认固定两段教育位置' : '';
        if (target && claims.has(target.slot)) { reason='多条教育记录对应同一位置，身份不唯一；请手动处理'; const prior=plans.find(plan=>plan.data.id===claims.get(target.slot));if(prior)prior.reason=reason; }
        if (target) claims.set(target.slot,data.id);
        plans.push({data, fields:target?.fields||[], reason});
      }
      return plans;
    }
    function recordPlan(profile,selectedId){
      const module=moduleName(),collection=module==='skills'?'programmingLanguages':module==='work'?'internships':null;
      if(!collection)return [];
      const sources=profile.records?.[collection]||[],available=fields().filter(field=>field.job51.module===module),cards=Array.from(root()?.querySelectorAll(':scope > .ci')||[]);
      const owner=card=>sources.some(source=>source.id===slotOwners.get(card))?slotOwners.get(card):null;
      const slots=cards.map(card=>({card,fields:available.filter(field=>field.job51.card===card)}));
      const entry=(data,key)=>({value:data[key],optionValues:data.fieldOptions?.[key]||[],pathValues:data.fieldPaths?.[key]||[]});
      const equal=(field,data)=>{const target=entry(data,field.job51.recordKey),composite=matches(field.element,target);return composite??[target.value,...target.optionValues].some(text=>String(text??'').trim()&&normalizeValue(text)===normalizeValue(recordValue(field.element)));};
      const identityKey=module==='skills'?'name':'company',discriminators=module==='skills'?['level']:['position','start'];
      const canonical=(data,key)=>{const field=available.find(field=>field.job51.recordKey===key),target=entry(data,key);if(field?.job51.kind==='dependentPair'){const pair=dependentTarget(field,target);if(pair)return pair.path.map(level=>normalizeValue(level[0])).join(' / ');}if(field?.element instanceof HTMLSelectElement){const option=[target.value,...target.optionValues].map(text=>helpers.exactOption(Array.from(field.element.options).filter(option=>!option.hidden),text)).find(Boolean);if(option)return normalizeValue(option.textContent);}return normalizeValue(data[key]);};
      const discriminates=(slot,data)=>discriminators.every(key=>{const field=slot.fields.find(field=>field.job51.recordKey===key);return !field||!String(data[key]||'').trim()||!String(recordValue(field.element)||'').trim()||equal(field,data);});
      const claims=new Map(),plans=[];
      for(const data of selectedId?sources.filter(source=>source.id===selectedId):sources){
        const sameSources=sources.filter(source=>[identityKey,...discriminators].every(key=>canonical(source,key)===canonical(data,key)));
        const identities=slots.filter(slot=>{const identity=slot.fields.find(field=>field.job51.recordKey===identityKey);return identity&&String(data[identityKey]||'').trim()&&equal(identity,data)&&(!owner(slot.card)||owner(slot.card)===data.id);});
        const sameIdentitySources=sources.filter(source=>canonical(source,identityKey)===canonical(data,identityKey));
        const ambiguous=identities.some(slot=>!owner(slot.card)&&sources.filter(source=>equal(slot.fields.find(field=>field.job51.recordKey===identityKey),source)&&discriminates(slot,source)).length>1);
        const candidates=identities.length===1&&sameIdentitySources.length===1?identities:identities.filter(slot=>discriminates(slot,data));
        let target=candidates.length===1?candidates[0]:null,reason='';
        if(!String(data[identityKey]||'').trim()||sameSources.length!==1)reason='记录身份重复或缺少身份资料，无法唯一定位，请手动处理';
        else if(ambiguous)reason='已有记录缺少足够的区分资料，不能在多条同身份资料之间选择，请手动处理';
        else if(candidates.length>1)reason='多个已有编辑器具有相同身份，无法唯一定位，请手动处理';
        else if(!target){
          target=slots.find(slot=>slot.fields.length===repeated[module].length&&!claims.has(slot.card)&&(!owner(slot.card)||owner(slot.card)===data.id)&&slot.fields.every(field=>!String(value(field.element)??recordValue(field.element)??'').trim()));
          if(!target)reason='未找到唯一匹配或空的现有记录编辑器，请手动添加或打开记录';
        }
        if(target&&claims.has(target.card)){reason='多条资料争用同一记录编辑器，请手动处理';const prior=plans.find(plan=>plan.data.id===claims.get(target.card));if(prior)prior.reason=reason;}
        if(target)claims.set(target.card,data.id);
        plans.push({data,fields:target?.fields||[],card:target?.card,reason});
      }
      return plans;
    }
    function claim(plan){if(plan?.card&&plan.data.id)slotOwners.set(plan.card,plan.data.id);}
    function languagePlan(profile){
      if(moduleName()!=='basic')return [];
      const sources=profile.records?.foreignLanguages||[],certificates=profile.records?.certifications||[];
      const isEnglish=source=>[source.language,...(source.fieldOptions?.language||[])].some(text=>/^(英语|英文|english)$/i.test(String(text||'').trim()));
      const available=fields(),groups=[sources.filter(isEnglish),sources.filter(source=>!isEnglish(source))];
      return sources.map(data=>{
        const english=isEnglish(data),col=english?'EnglishLevel':'OtherLanguage',field=available.find(item=>item.job51.col===col),group=groups[english?0:1];
        let reason='',entry=null,certificateId=null;
        if(!field)reason='未找到已确认的 51job 外语编辑器，请手动处理';
        else if(group.length!==1)reason='多条外语资料对应同一编辑器，语种身份不唯一，请手动选择';
        else if((profile.entries||[]).some(source=>globalThis.ResumeHelperCategories?.isFixedEntry(source)&&String(source.value||'').trim()&&[source.label,...(source.aliases||[])].some(alias=>field.job51.aliases.some(label=>normalizeLabel(alias)===normalizeLabel(label)))))reason='普通外语资料项与正式记录占用同一字段，请先明确使用哪一份资料';
        else {
          const dictionary=readOwner(field.element,'dictionary');
          if(!dictionary||dictionary.parentId!==field.element.id||dictionary.childId!==field.job51.controls[1].id||!Array.isArray(dictionary.rows))reason='未确认公共外语字典，不能推断考试、语种或分数段，请手动选择';
          else {
            let parentCandidates,childCandidates;
            if(english){
              const tests=certificates.filter(source=>[source.name,...(source.fieldOptions?.name||[])].some(text=>dictionary.rows.some(row=>normalizeValue(row.label)===normalizeValue(text))||/英语|英文|english|CET|TEM|IELTS|TOEFL|BEC|雅思|托福/i.test(String(text||''))));
              if(tests.length!==1)reason='缺少唯一明确的英语考试记录，不能按证书数组顺序选择';
              else {const cert=tests[0];if(!String(cert.name||'').trim()||!String(cert.score||'').trim())reason='英语考试缺少名称或分数主值，请手动补全资料';certificateId=cert.id;parentCandidates=[cert.name,...(cert.fieldOptions?.name||[])];childCandidates=[cert.score,...(cert.fieldOptions?.score||[])];}
            }else {if(!String(data.language||'').trim()||!String(data.proficiency||'').trim())reason='外语缺少语种或程度主值，请手动补全资料';parentCandidates=[data.language,...(data.fieldOptions?.language||[])];childCandidates=[data.proficiency,...(data.fieldOptions?.proficiency||[])];}
            if(!reason){
              const unique=(items,candidates)=>{for(const candidate of candidates||[]){if(!String(candidate??'').trim())continue;const matches=items.filter(item=>normalizeValue(item.label)===normalizeValue(candidate));if(matches.length>1)return null;if(matches.length===1)return matches[0];}return null;};
              const parent=unique(dictionary.rows,parentCandidates),child=parent&&unique(parent.children.filter(item=>item.value),childCandidates);
              if(!parent||!child)reason='没有唯一精确的考试/语种及分数段/程度候选，不换算数值或猜分类';
              else entry={id:data.id,label:field.name,value:String(english?certificates.find(cert=>cert.id===certificateId).score:data.proficiency),pathValues:[[parent.label],[child.label]],optionValues:[]};
            }
          }
        }
        return {data,field,entry,certificateId,reason};
      });
    }
    return { ownsPage, moduleName, fields, notes, info, identity, locator, value, snapshot, restore, write, educationPlan, recordPlan, recordValue, matches, claim, languagePlan, conflict };
  } };
})();
