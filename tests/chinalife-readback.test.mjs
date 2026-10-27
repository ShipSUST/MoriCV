import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/content/chinalife-readback.js',import.meta.url),'utf8');
function install(host='chinalife.zhiye.com',pathname='/form',legacyInstalled=false){
 const listeners=[],sent=[],layers=[];
 const labels=['获奖时间','获奖项','获奖级别','获奖描述'];
 const form={id:'anonymous-awards',querySelectorAll:()=>labels.map(textContent=>({textContent,closest:()=>({querySelectorAll:()=>[{}]})}))};
 const heading={id:form.id,textContent:'获奖情况',matches:()=>false};
 class Element{isConnected=true;matches(selector){return selector==='.phoenix-select__input';}contains(element){return this.child===element;}closest(selector){return selector==='.ux-standard-form > div.form[id]'?form:{};}dispatchEvent(event){sent.push(JSON.parse(event.detail));}}
 const context={Element,location:{hostname:host,pathname},document:{documentElement:{dataset:{}},querySelector:()=>({}),querySelectorAll:selector=>host==='seyond.zhiye.com'&&selector==='div[id]'?[heading]:host==='seyond.zhiye.com'&&selector==='.ux-standard-form > div.form[id]'?[form]:layers,addEventListener(_type,fn){listeners.push(fn);},removeEventListener(_type,fn){const index=listeners.indexOf(fn);if(index>=0)listeners.splice(index,1);}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}}};
 if(legacyInstalled){
  context.__moriChinalifeReadbackInstalled=/^version[23456]$/.test(legacyInstalled)?Number(legacyInstalled.slice(-1)):true;
  const previous=event=>{const request=JSON.parse(event.detail);event.target.dispatchEvent(new context.CustomEvent('MORI_CV_CHINALIFE_READ_RESULT',{detail:JSON.stringify({id:request.id,value:null})}));};
  if(['version2','version3','version4','version5','version6'].includes(legacyInstalled))context.__moriChinalifeReadbackListener=previous;
  listeners.push(previous);
 }
 vm.runInNewContext(source,context);
 return {get listener(){return listeners.at(-1);},sent,layers,Element,reinstall(){vm.runInNewContext(source,context);},dispatch(event){for(const listener of [...listeners])listener(event);},get listenerCount(){return listeners.length;}};
}

test('popup ownership exposes only the observed own portal DOM position without calling React methods',()=>{
 const h=install(),input=new h.Element(),container=new h.Element(),popup=new h.Element();
 container.child=input;popup.matches=selector=>selector==='.common-unmodeled-layer';
 h.layers.push(new h.Element(),popup);
 const instance=Object.freeze({containerRef:Object.freeze({current:container}),triggerRef:Object.freeze({current:Object.freeze({_component:Object.freeze({rootNode:popup}),getPopupDomNode(){throw Error('no component calls');}})})});
 input.__reactFiberAnonymous=Object.freeze({memoizedProps:Object.freeze({privateValue:'must not export'}),stateNode:instance});
 h.listener({target:input,detail:JSON.stringify({id:'own-popup',kind:'popup'})});
 assert.deepEqual(h.sent.at(-1),{id:'own-popup',value:{index:1}});
 assert.equal(input.__reactFiberAnonymous.stateNode,instance);
});

test('popup ownership refuses foreign, disconnected, missing and ambiguous portal references',()=>{
 const h=install(),input=new h.Element(),container=new h.Element(),popup=new h.Element(),other=new h.Element();
 popup.matches=other.matches=selector=>selector==='.common-unmodeled-layer';h.layers.push(popup,other);
 const ref=(root,parent=null)=>({stateNode:{containerRef:{current:container},triggerRef:{current:{_component:{rootNode:root}}}},return:parent});
 const read=()=>{h.listener({target:input,detail:JSON.stringify({id:'unknown',kind:'popup'})});return h.sent.at(-1).value;};
 input.__reactFiberAnonymous=ref(popup);assert.equal(read(),null);
 container.child=input;popup.isConnected=false;assert.equal(read(),null);
 popup.isConnected=true;input.__reactFiberAnonymous=ref(new h.Element());assert.equal(read(),null);
 input.__reactFiberAnonymous=ref(popup,ref(other));assert.equal(read(),null);
 input.__reactFiberAnonymous=ref(popup,ref(popup));assert.deepEqual(read(),{index:0});
});

test('reopened Seyond portal ownership uses its live content ref and refuses conflicting connected roots',()=>{
 const h=install('seyond.zhiye.com'),input=new h.Element(),container=new h.Element(),old=new h.Element(),current=new h.Element(),content=new h.Element();
 container.child=input;old.isConnected=false;old.matches=current.matches=selector=>selector==='.common-unmodeled-layer';
 content.matches=selector=>selector==='.common-unmodeled-layer__layerContent';content.closest=()=>current;h.layers.push(current,old);
 input.__reactFiberAnonymous={memoizedProps:{options:[],multiple:false},stateNode:{containerRef:{current:container},triggerRef:{current:{_component:{rootNode:old}}},layerRef:{wrapperRef:{current:content}}}};
 const read=()=>{h.listener({target:input,detail:JSON.stringify({id:'reopened',kind:'popup'})});return h.sent.at(-1).value;};
 assert.deepEqual(read(),{index:0,scalar:true});
 input.__reactFiberAnonymous.memoizedProps.multiple=true;assert.deepEqual(read(),{index:0,scalar:false});
 old.isConnected=true;assert.equal(read(),null);
 old.isConnected=false;content.isConnected=false;assert.equal(read(),null);
 content.isConnected=true;container.child=null;assert.equal(read(),null);
});

test('China Life does not gain a new ownership fallback from the Seyond repair',()=>{
 const h=install(),input=new h.Element(),container=new h.Element(),content=new h.Element(),popup=new h.Element();
 container.child=input;content.matches=()=>true;content.closest=()=>popup;h.layers.push(popup);
 input.__reactFiberAnonymous={stateNode:{containerRef:{current:container},layerRef:{wrapperRef:{current:content}}}};
 h.listener({target:input,detail:JSON.stringify({id:'other-tenant',kind:'popup'})});assert.equal(h.sent.at(-1).value,null);
});

for(const version of ['version2','version3','version4','version5','version6'])test(`upgrading the retained ${version} reader replaces its owned listener and enables portal reads once`,()=>{
 const h=install('chinalife.zhiye.com','/form',version),input=new h.Element(),container=new h.Element(),popup=new h.Element();
 container.child=input;popup.matches=selector=>selector==='.common-unmodeled-layer';h.layers.push(popup);
 input.__reactFiberAnonymous={stateNode:{containerRef:{current:container},triggerRef:{current:{_component:{rootNode:popup}}}}};
 h.reinstall();h.reinstall();h.dispatch({target:input,detail:JSON.stringify({id:'version2-upgrade',kind:'popup'})});
 assert.equal(h.listenerCount,1);assert.deepEqual(h.sent,[{id:'version2-upgrade',value:{index:0}}]);
});
test('readback reader never attaches to other hosts or paths',()=>{
 for(const [host,path]of [['other.zhiye.com','/form'],['chinalife.zhiye.com.attacker.invalid','/form'],['chinalife.zhiye.com','/jobs'],['127.0.0.1','/form']])assert.equal(install(host,path).listener,undefined);
 assert.equal(typeof install().listener,'function');
});
test('read-only bridge returns only requested selection metadata and its correlation ID',()=>{
 const h=install(),input=new h.Element();
 const props=Object.freeze({allLevelDisplay:true,value:Object.freeze([Object.freeze({id:'anonymous-area',label:'虚构地点',unrelatedPrivateValue:'must not be exported'})])});
 input.__reactFiberAnonymous=Object.freeze({memoizedProps:props});
 h.listener({target:input,detail:JSON.stringify({id:'request-a',kind:'selection'})});
 assert.deepEqual(h.sent,[{id:'request-a',value:[{id:'anonymous-area',label:'虚构地点'}]}]);
 assert.equal(input.__reactFiberAnonymous.memoizedProps,props);
 h.listener({target:input,detail:JSON.stringify({id:'request-b',kind:'arbitrary-property'})});
 assert.deepEqual(h.sent.at(-1),{id:'request-b',value:null});
 const count=h.sent.length;h.listener({target:input,detail:'invalid JSON'});h.listener({target:input,detail:{id:'bad',kind:'selection'}});assert.equal(h.sent.length,count);
});

test('oversized original selections are refused rather than silently truncated',()=>{
 const h=install(),input=new h.Element();
 input.__reactFiberAnonymous={memoizedProps:{allLevelDisplay:true,value:Array.from({length:101},(_,i)=>({id:String(i),label:'虚构地点'}))}};
 h.listener({target:input,detail:JSON.stringify({id:'too-many',kind:'selection'})});
 assert.equal(h.sent.at(-1).value,null);
});

test('constant metadata exposes only single-mode selections and leaf identity without calling handlers',()=>{
 const h=install(),element=new h.Element();
 element.matches=selector=>selector==='.constant-main-layer-container';
 const row=Object.freeze({code:'anonymous-code',name:'虚构选项',privateExtra:'must-not-be-exported'});
 element.__reactFiberAnonymous=Object.freeze({memoizedProps:Object.freeze({isMulti:false,onChange(){throw Error('must not call');}}),stateNode:{state:{selectData:Object.freeze([row])}}});
 h.listener({target:element,detail:JSON.stringify({id:'constant',kind:'constant'})});
 assert.deepEqual(h.sent.at(-1),{id:'constant',value:{multi:false,selections:[{id:'anonymous-code',label:'虚构选项'}]}});
 element.matches=selector=>selector==='.list-data-container .list-item-container';
 element.__reactFiberAnonymous={memoizedProps:{data:row,isForbidExpand:true,disabled:false}};
 h.listener({target:element,detail:JSON.stringify({id:'leaf',kind:'constantRow'})});
 assert.deepEqual(h.sent.at(-1),{id:'leaf',value:{id:'anonymous-code',label:'虚构选项',leaf:true,disabled:false}});
 element.__reactFiberAnonymous={memoizedProps:{data:row}};
 h.listener({target:element,detail:JSON.stringify({id:'unknown',kind:'constantRow'})});
 assert.equal(h.sent.at(-1).value,null);
});

test('a retained legacy bridge upgrades constant metadata once and responds after the legacy null result',()=>{
 const h=install('chinalife.zhiye.com','/form',true),element=new h.Element();
 element.matches=selector=>selector==='.constant-main-layer-container';
 element.__reactFiberAnonymous={memoizedProps:{isMulti:false},stateNode:{state:{selectData:[{code:'anonymous-code',name:'虚构选项'}]}}};
 const request={target:element,detail:JSON.stringify({id:'upgrade',kind:'constant'})};
 h.dispatch(request);
 assert.deepEqual(h.sent,[{id:'upgrade',value:null},{id:'upgrade',value:{multi:false,selections:[{id:'anonymous-code',label:'虚构选项'}]}}]);
 h.reinstall();h.reinstall();h.sent.length=0;h.dispatch(request);
 assert.equal(h.listenerCount,2);
 assert.deepEqual(h.sent,[{id:'upgrade',value:null},{id:'upgrade',value:{multi:false,selections:[{id:'anonymous-code',label:'虚构选项'}]}}]);
});
