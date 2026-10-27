// Observed public labels / Phoenix DOM / event contracts. No personal data.
const root=document.querySelector('.form-root');let popup=null,serial=0;
const observedMonths=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
const realControls=new URLSearchParams(location.search).has('real-controls');
const deepControls=new URLSearchParams(location.search).has('deep-controls');
const dependentControls=new URLSearchParams(location.search).has('dependent-controls');
const nativeLayers=new URLSearchParams(location.search).has('native-layers');
const openingControls=new URLSearchParams(location.search).has('opening-controls');
const reopenedControls=new URLSearchParams(location.search).has('reopened-controls');
if(nativeLayers){const style=document.createElement('style');style.textContent='.anonymous-native-date .phoenix-select__clearIcon{display:none}.anonymous-native-date:hover .phoenix-select__clearIcon--show{display:block}';document.head.append(style);}
const specs={
 basic:['个人基本信息*',[['name','姓名'],['email','电子邮箱'],['birth','出生年月','day'],['region','籍贯','region'],['current','现居住地','region'],['city','期望工作城市','multiRegion'],['gender','性别','radio'],['description','自我评价及求职目标','textarea'],['ethnicity','民族','constant',['虚构民族甲','虚构民族乙']],['political','党派','choice',['群众','中共党员']],['joiningParty','加入党派时间','day']]],
 educations:['教育经历*',[['start','开始时间','day'],['end','结束时间','day'],['school','学校'],['major','专业名称'],['educationLevel','学历','choice',['本科','硕士研究生']],['academicDegree','学位','choice',['学士','硕士']],['highest','是否最高全日制学历','radio']]],
 internships:['工作/实习经历*',[['start','开始时间','day'],['end','结束时间','day'],['company','单位名称'],['position','职位名称'],['description','工作描述','textarea']]],
 projects:['参与科研项目',[['start','开始时间','month'],['end','结束时间','month'],['name','项目名称'],['role','担当角色'],['description','主要工作内容','textarea']]],
 awards:['学习/工作获奖情况',[['start','获奖时间','day'],['name','奖项名称'],['type','获奖级别','choice',['国家级','省级','院校级']],['issuer','颁奖单位'],['description','其他补充','textarea'],['role','担当角色','choice',['参与者','负责人']]]],
 papers:['专业论著',[['publishedAt','日期','day'],['name','文章名、书名'],['venue','刊物、出版社'],['role','担任角色','choice',['第一作者','共同作者']],['abstract','内容摘要','textarea']]],
 foreignLanguages:['语言能力*',[['language','外语语种','choice',['英语','日语']],['exam','语言等级','choice',['大学英语六级','大学英语四级']],['score','得分']]],
 certifications:['专业资格',[['kind','具有资格证书','choice',['职业资格','其他']],['name','证书名称'],['obtainedAt','获得时间','day']]],
 relationships:['家庭成员及重要社会关系*',[['relation','称谓','choice',['父亲','母亲']],['name','姓名'],['birthDate','出生日期','day'],['employer','工作单位'],['jobTitle','所属职务']]],
 programmingLanguages:['计算机技能',[['name','技能类别','choice',['虚构技能甲','虚构技能乙']]]],
 questionnaire:['本人承诺*',[['question','本人是否获得外国国籍','radio']]],
};
const nodes=[{id:'0',label:'根',parentId:'',hasChildren:'1'},{id:'1',label:'中国',parentId:'0',hasChildren:'1'},{id:'11',label:'江苏省',parentId:'1',hasChildren:'1'},{id:'12',label:'天津市',parentId:'1',hasChildren:'1'},{id:'111',label:'泰州市',parentId:'11',hasChildren:'1'},{id:'112',label:'南京市',parentId:'11',hasChildren:'1'},{id:'1111',label:'兴化市',parentId:'111',hasChildren:'0'},{id:'1121',label:'鼓楼区',parentId:'112',hasChildren:'0'},{id:'121',label:'南开区',parentId:'12',hasChildren:'0'}];
function ancestry(id){const a=[];for(let n=nodes.find(x=>x.id===id);n&&n.id!=='0';n=nodes.find(x=>x.id===n.parentId))a.unshift(n);return a;}
function fiber(element,props,state){element.__reactFiberAnonymous={memoizedProps:props,stateNode:state?{state}:null,return:null};}
function close(){popup?.remove();popup=null;}
function layer(){close();popup=document.createElement('div');popup.className='common-unmodeled-layer';document.body.append(popup);return popup;}
function createField(form,key,label,kind='',options=[]){
 const f=document.createElement('div');f.className='form-item form-item--phoenix';f.dataset.key=key;
 const title=document.createElement('label');title.className='form-item__text';title.textContent=label;f.append(title);form.append(f);
 if(kind==='radio'){
 const g=document.createElement('div');g.className='phoenix-radio-group';
 for(const text of label==='性别'?['男','女','匿名第三选项']:['是','否']){
 const wrapper=document.createElement('div');wrapper.className='phoenix-radio-group__radioItem';
 const b=document.createElement('div');b.className='phoenix-radio';
 b.innerHTML='<span class="phoenix-radio__wrapper"><span class="phoenix-radio__circle-wrapper"><span class="phoenix-radio__circle"></span><span class="phoenix-radio__dot"></span></span></span><span class="phoenix-radio__radio-text"></span>';
 b.querySelector('.phoenix-radio__radio-text').textContent=text;
 b.onclick=()=>{if(b.classList.contains('phoenix-radio--checked'))return;const wrong=ChinalifeFixture.wrongRadioOnce||ChinalifeFixture.wrongRadioAlways;ChinalifeFixture.wrongRadioOnce=false;const selected=wrong?g.querySelectorAll('.phoenix-radio')[2]:b;g.querySelectorAll('.phoenix-radio').forEach(x=>x.classList.toggle('phoenix-radio--checked',x===selected));};
 wrapper.append(b);g.append(wrapper);}
 f.append(g);return;} const i=document.createElement(kind==='textarea'?'textarea':'input');i.type='text';i.id='anonymous-control-'+(++serial);i.className=kind==='textarea'?'phoenix-textarea__realTextarea':'phoenix-input__input';
 if(!kind||kind==='textarea'){f.append(i);return;}
 const select=document.createElement('div');select.className='phoenix-select';i.className='phoenix-select__input';
 const calc=document.createElement('span');calc.className='phoenix-select__calcEle';
 if(deepControls){i.id='';i.placeholder='';const content=document.createElement('ul');content.className='phoenix-select__content';const wrapper=document.createElement('li');wrapper.className='phoenix-select__inputWrapper';calc.textContent='请选择';wrapper.append(calc,i);content.append(wrapper);select.append(content);}
 else select.append(calc,i);
 f.append(select);
 const clear=document.createElement('span');clear.className='phoenix-select__clearIcon';clear.textContent='×';select.append(clear);
 if(nativeLayers&&(['day','month'].includes(kind)||new URLSearchParams(location.search).has('hover-clear'))){select.classList.add('anonymous-native-date','phoenix-select--editable');clear.classList.add('phoenix-select__clearIcon--show');}
 const config={mode:kind==='month'?'month':'date',format:kind==='month'?'YYYY-MM':'YYYY-MM-DD'};
 let selected=[];const multi=kind==='multiRegion';
 const props={allLevelDisplay:!multi,isSingleSelect:!multi,value:selected};
 if(dependentControls&&key==='end'&&['day','month'].includes(kind))i.disabled=true;
 const commit=value=>{i.value=value;calc.textContent=value;if(dependentControls&&key==='start'){const end=form.querySelector('[data-key=end] input');if(end)end.disabled=!value;}};
 const commitRegions=values=>{selected=values.map(x=>({...x}));props.value=selected;
  if(new URLSearchParams(location.search).has('current-fibers')&&kind==='region'){
   // React may keep the DOM expando's old fiber while committing its alternate.
   const attached=i.__reactFiberAnonymous,owner=attached.return,oldProps={...attached.memoizedProps};
   if(owner){const oldOwner={...owner,return:null},liveOwner={...owner,return:null},oldRoot={tag:3},liveRoot={tag:3},state={current:oldRoot};
    const live={memoizedProps:{...props,value:selected},stateNode:null,return:liveOwner,alternate:attached};attached.memoizedProps=oldProps;attached.return=oldOwner;attached.alternate=live;
    oldRoot.stateNode=liveRoot.stateNode=state;oldRoot.alternate=liveRoot;liveRoot.alternate=oldRoot;oldRoot.child=liveOwner;liveRoot.child=oldOwner;oldOwner.return=oldRoot;liveOwner.return=liveRoot;oldOwner.alternate=liveOwner;liveOwner.alternate=oldOwner;oldOwner.child=attached;liveOwner.child=live;
   }
  }
  commit(selected.map(x=>x.label).join('、'));};
 f.fixture={input:i,commit,commitRegions,setAllLevelDisplay(value){props.allLevelDisplay=value;i.__reactFiberAnonymous.memoizedProps.allLevelDisplay=value;},get selected(){return selected;}};
 fiber(i,kind.includes('Region')||kind==='region'?(new URLSearchParams(location.search).has('current-fibers')?{...props}:props):kind==='choice'?{multiple:false,options}:kind==='constant'?{}:config);
 clear.onclick=e=>{e.stopPropagation();commitRegions([]);commit('');close();};
 let firstPortal=null;
 select.onclick=e=>{if(e.target===clear||i.disabled)return;if(popup?.fixtureOwner===i){if(nativeLayers&&['day','month'].includes(kind))close();return;}const l=layer();l.fixtureOwner=i;
  if(openingControls&&['day','month'].includes(kind)){l.style.opacity='0';setTimeout(()=>{l.style.opacity='1';},120);}
  // The real Phoenix UnmodeledLayer owns its portal through these React refs.
  const trigger={_component:{rootNode:openingControls?null:reopenedControls?(firstPortal||l):l}};firstPortal||=l;
  if(openingControls)setTimeout(()=>{trigger._component.rootNode=l;},60);
  const instance={containerRef:{current:select},triggerRef:{current:trigger}};
  if(new URLSearchParams(location.search).has('current-fibers')&&i.__reactFiberAnonymous.return?.return?.tag===3&&i.__reactFiberAnonymous.alternate?.return){i.__reactFiberAnonymous.return.stateNode=instance;i.__reactFiberAnonymous.alternate.return.stateNode=instance;}
  else i.__reactFiberAnonymous.return={memoizedProps:{},stateNode:instance,return:null};
  if(kind==='choice'){const content=document.createElement('div');content.className='common-unmodeled-layer__layerContent';l.append(content);content.innerHTML='<div class="phoenix-selectList"></div>';if(reopenedControls)instance.layerRef={wrapperRef:{current:content}};for(const t of options){const li=document.createElement('div');li.className='phoenix-selectList__listItem';li.textContent=t;li.onclick=()=>{commit(t);close();};content.firstChild.append(li);}return;}
  if(kind==='constant'||kind==='region'||multi){
   let content=l;if(reopenedControls){content=document.createElement('div');content.className='common-unmodeled-layer__layerContent';l.append(content);instance.layerRef={wrapperRef:{current:content}};}
   if(kind==='constant')renderConstant(content,options,commit,i.value);else renderArea(content,i,props,selected,multi,commitRegions);return;
  }
  if(reopenedControls){const content=document.createElement('div');content.className='common-unmodeled-layer__layerContent';l.append(content);instance.layerRef={wrapperRef:{current:content}};renderCalendar(content,kind,config,commit);}
  else renderCalendar(l,kind,config,commit);
 };
}
function footerButton(text,action){
 const button=document.createElement('div');button.className='phoenix-button';
 if(new URLSearchParams(location.search).has('native-buttons')){const wrapper=document.createElement('div'),content=document.createElement('div');wrapper.className='phoenix-button__wraper';content.className='phoenix-button__content';content.textContent=text;wrapper.onclick=action;wrapper.append(content);button.append(wrapper);}
 else{button.textContent=text;button.onclick=action;}return button;
}
function renderConstant(l,options,commit,before){
 const c=document.createElement('div');c.className='constant-main-layer-container';l.append(c);
 const state={selectData:before?[{code:'anonymous-'+options.indexOf(before),name:before}]:[]};fiber(c,{isMulti:!!ChinalifeFixture.multiConstant},state);
 const list=document.createElement('div');list.className='list-data-container';const chosen=document.createElement('div');chosen.className='select-data-container';c.append(list,chosen);
 const update=()=>{chosen.replaceChildren();for(const item of state.selectData){const s=document.createElement('span');s.className='select-text-label';s.textContent=item.name;chosen.append(s);}};
 for(const [index,name]of options.entries()){const row=document.createElement('div');row.className='list-item-container';const data={code:'anonymous-'+index,name};fiber(row,{data,isForbidExpand:true,disabled:false});const label=document.createElement('span');label.className='item-text-label no-hover';label.textContent=name;const icon=new URLSearchParams(location.search).has('svg-icons')?document.createElementNS('http://www.w3.org/2000/svg','svg'):document.createElement('span');icon.setAttribute('class','RadioUnchecked');if(icon.namespaceURI==='http://www.w3.org/2000/svg'){icon.setAttribute('width','14');icon.setAttribute('height','14');}icon.onclick=()=>{state.selectData=[data];update();};row.append(icon,label);list.append(row);}
 const footer=document.createElement('div');footer.className='selector-footer-button';l.append(footer);for(const text of ['取消','确定'])footer.append(footerButton(text,()=>{if(text==='确定')commit(ChinalifeFixture.wrongConstantOnce?'虚构错误值':state.selectData[0]?.name||'');ChinalifeFixture.wrongConstantOnce=false;close();}));update();
}
function renderCalendar(l,kind,config,commit){
 let year=2026,month=10,mode=kind==='month'?'month':'day';
 const render=()=>{l.replaceChildren();const c=document.createElement('div');c.className='phoenix-calendar'+(kind==='month'?' phoenix-calendar-month-calendar':'');l.append(c);
  const header=document.createElement('div');header.className='phoenix-calendar-header';c.append(header);
  const button=(cls,text,action)=>{const b=document.createElement('a');b.className=cls;b.textContent=text;b.onclick=()=>{action();render();};header.append(b);};
  button('phoenix-calendar-prev-year-btn','«',()=>{ChinalifeFixture.yearSteps=(ChinalifeFixture.yearSteps||0)+1;year--;});button('phoenix-calendar-prev-month-btn','‹',()=>{if(--month===0){month=12;year--;}});
  button('phoenix-calendar-year-select',year+'年',()=>{mode='year';});button('phoenix-calendar-month-select',month+'月',()=>{mode='month';});
  button('phoenix-calendar-next-month-btn','›',()=>{if(++month===13){month=1;year++;}});button('phoenix-calendar-next-year-btn','»',()=>{ChinalifeFixture.yearSteps=(ChinalifeFixture.yearSteps||0)+1;year++;});
  const p=document.createElement('table');p.className=mode==='year'?'phoenix-calendar-year-panel':mode==='month'?'phoenix-calendar-month-panel':'phoenix-calendar-date-panel';c.append(p);
  if(mode==='year'){const decade=Math.floor(year/10)*10;const head=document.createElement('thead');p.append(head);for(const [direction,sign]of [['prev',-1],['next',1]]){const nav=document.createElement('a');nav.className='phoenix-calendar-year-panel-'+direction+'-decade-btn';nav.textContent=direction;nav.onclick=()=>{ChinalifeFixture.yearSteps=(ChinalifeFixture.yearSteps||0)+1;year+=sign*10;render();};head.append(nav);}for(let y=decade-1;y<=decade+10;y++){const cell=document.createElement('td');cell.className='phoenix-calendar-year-panel-cell'+(y<decade?' phoenix-calendar-year-panel-last-decade-cell':y>=decade+10?' phoenix-calendar-year-panel-next-decade-cell':'');if(y===ChinalifeFixture.disabledYear)cell.classList.add('phoenix-calendar-year-panel-disabled-cell');cell.textContent=String(y);cell.onclick=()=>{if(cell.classList.contains('phoenix-calendar-year-panel-disabled-cell'))return;ChinalifeFixture.yearChoices=(ChinalifeFixture.yearChoices||0)+1;year=y;mode='month';render();};p.append(cell);}return;}
  if(mode==='month'){for(let m=1;m<=12;m++){const cell=document.createElement('td');cell.className='phoenix-calendar-month-panel-cell';cell.textContent=realControls?observedMonths[m-1]:m+'月';if(year===2030&&m===12)cell.classList.add('phoenix-calendar-disabled-cell');cell.onclick=()=>{if(cell.classList.contains('phoenix-calendar-disabled-cell'))return;month=m;if(kind==='month'){finish();}else{mode='day';render();}};p.append(cell);}return;}
  const first=new Date(Date.UTC(year,month-1,1));const start=new Date(first);start.setUTCDate(1-(first.getUTCDay()+6)%7);
  for(let j=0;j<42;j++){const date=new Date(start);date.setUTCDate(start.getUTCDate()+j);const cell=document.createElement('td');cell.className='phoenix-calendar-cell';const inner=document.createElement('div');inner.className='phoenix-calendar-date';inner.textContent=String(date.getUTCDate());cell.append(inner);if(date.getUTCMonth()!==month-1)cell.classList.add('phoenix-calendar-'+(date<first?'last':'next')+'-month-cell');if(date.toISOString().startsWith('2030-12-25'))cell.classList.add('phoenix-calendar-disabled-cell');inner.onclick=()=>{if(cell.classList.contains('phoenix-calendar-disabled-cell'))return;finish(date);};p.append(cell);}
 };
 const finish=date=>{let value=kind==='month'?`${year}-${String(month).padStart(2,'0')}`:date.toISOString().slice(0,10);
  if(ChinalifeFixture.wrongDateAlways||ChinalifeFixture.wrongDateOnce){value=kind==='month'?'2000-01':'2000-01-01';ChinalifeFixture.wrongDateOnce=false;}
  commit(value);close();
 };
 render();
}
function renderArea(l,input,props,original,multi,commit){
 const state={areaData:nodes,selectData:original.map(x=>({...x}))};const area=document.createElement('div');area.className='area-selector-container';l.append(area);const panelMulti=ChinalifeFixture.multiRegionMode??multi;fiber(area,{isMulti:panelMulti,isSingleSelect:!panelMulti},state);
 const search=document.createElement('input');search.className='phoenix-input__input';const searchWrap=document.createElement('div');searchWrap.className='area-search-input';searchWrap.append(search);area.append(searchWrap);
 const data=document.createElement('div');data.className='area-data-container';area.append(data);let parent=realControls?'1':'0';
 const breadcrumb=document.createElement('div');breadcrumb.className='area-breadcrumb-list';const home=document.createElement('span');home.className='phoenix-breadcrumb-link';home.textContent='国家';home.onclick=()=>{parent=realControls?'1':'0';search.value='';rows();};breadcrumb.append(home);area.insertBefore(breadcrumb,data);
 const chosen=document.createElement('div');chosen.className='select-data-container';area.append(chosen);
 const selected=()=>{chosen.replaceChildren();for(const value of state.selectData){const item=document.createElement('div');item.className='select-item-container';const label=document.createElement('span');label.className='select-area-text-label';label.textContent=value.label;item.append(label);chosen.append(item);}};
 const rows=()=>{data.replaceChildren();let visible=search.value?nodes.filter(n=>n.label.includes(search.value)&&n.id!=='0'):nodes.filter(n=>n.parentId===parent);if(realControls&&parent==='1'&&!search.value)visible.unshift({...nodes[1],hasChildren:'0'});if(ChinalifeFixture.wrongProvinceParent&&parent==='0')visible=[{...nodes.find(n=>n.id==='11'),parentId:'foreign'}];
  for(const n of visible){const row=document.createElement('div');row.className='area-item-container';fiber(row,{data:n,checked:state.selectData.some(x=>x.id===n.id)});const label=document.createElement('span');label.className='area-text-label';label.textContent=n.label;label.onclick=()=>{if(n.hasChildren!=='1')return;parent=n.id;search.value='';rows();};const icon=document.createElement('span');icon.className='area-icon-'+(multi?'Checkbox':'Radio')+(state.selectData.some(x=>x.id===n.id)?'Checked':'Unchecked');icon.onclick=()=>{let values=multi?[...state.selectData]:[];if(!values.some(x=>x.id===n.id))values.push({id:n.id,label:props.allLevelDisplay?ancestry(n.id).map(x=>x.label).join('/'):n.label});state.selectData=values;selected();rows();};row.append(icon,label);data.append(row);}
 };
 search.oninput=rows;
 const clear=document.createElement('span');clear.className='clear-select-data';clear.textContent='清空已选';clear.onclick=()=>{state.selectData=[];selected();rows();};area.append(clear);
 const footer=document.createElement('div');footer.className='area-footer-button';area.append(footer);
 for(const [text,fn] of [['取消',()=>close()],['确定',()=>{let values=state.selectData;if(ChinalifeFixture.wrongRegionAlways||ChinalifeFixture.wrongRegionOnce){values=[{id:'1121',label:props.allLevelDisplay?'中国/江苏省/南京市/鼓楼区':'鼓楼区'}];ChinalifeFixture.wrongRegionOnce=false;}commit(values);close();}]])footer.append(footerButton(text,fn));
 selected();rows();
}
function add(key){const section=root.querySelector(`[data-anonymous-section="${key}"]`);const wrap=document.createElement('div');wrap.className='record';const ux=document.createElement('div');ux.className='ux-standard-form';const form=document.createElement('div');form.className='form twoLineFormStyleLong formStyleLeftAndRight';form.id=section.querySelector('[id]').id;ux.append(form);wrap.append(ux);section.insertBefore(wrap,section.lastChild);const body=document.createElement('div');body.className='form-part-body';form.append(body);for(const spec of specs[key][1])createField(body,...spec);
 if(key!=='basic'&&key!=='questionnaire'){const del=document.createElement('span');del.textContent='删除';del.onclick=()=>{const p=layer();p.className+=' phoenix-popover';for(const [text,fn] of [['取消',close],['确定',()=>{wrap.remove();close();}]]){const b=document.createElement('button');b.textContent=text;b.onclick=fn;p.append(b);}};wrap.append(del);}return form;}
function reset(){close();root.replaceChildren();serial=0;ChinalifeFixture.wrongDateAlways=false;ChinalifeFixture.wrongDateOnce=false;ChinalifeFixture.wrongRegionAlways=false;ChinalifeFixture.wrongRegionOnce=false;for(const [key,[title]]of Object.entries(specs)){const s=document.createElement('section');s.dataset.anonymousSection=key;const h=document.createElement('div');h.id='anonymous-'+key;h.textContent=title;const b=document.createElement('div');b.id=h.id+'_addButton';b.textContent='添加'+title;b.onclick=()=>add(key);s.append(h,b);root.append(s);add(key);}}
globalThis.ChinalifeFixture={reset,add,close,nodes,ancestry,specs,fields(key,index=0){return Array.from(root.querySelectorAll(`[data-anonymous-section="${key}"] div.form`))[index];},field(key,name,index=0){return this.fields(key,index)?.querySelector(`[data-key="${name}"]`);},input(key,name,index=0){return this.field(key,name,index)?.querySelector('input,textarea');}};
document.addEventListener('keydown',e=>{if(!nativeLayers&&(e.key==='Escape'||e.which===27))close();});
document.addEventListener('mousedown',e=>{if(nativeLayers&&popup&&!popup.contains(e.target)&&!popup.fixtureOwner?.closest('.phoenix-select')?.contains(e.target))close();});
globalThis.chrome={runtime:{onMessage:{addListener(fn){globalThis.__resumeHelperListener=fn;}}}};reset();
