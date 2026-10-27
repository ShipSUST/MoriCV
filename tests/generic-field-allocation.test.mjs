import '../src/shared/category-runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import '../src/shared/matcher-core.js';
const source=await readFile(new URL('../src/content/fill.js',import.meta.url),'utf8');
const start=source.indexOf('  function genericRecordFieldMap(');
const end=source.indexOf('  // 单个重复大类',start);
const schema={fields:[{key:'educationLevel',aliases:['学历']},{key:'academicDegree',aliases:['学位']}]};
const lookupStart=source.indexOf('  function genericRecordField(');
const lookupEnd=source.indexOf('  function genericStructuredValue(',lookupStart);
const context={
  isChinalifeZhiyePage:()=>false,
  isSeyondRecordControl:()=>false,
  isNjzqZhiyePage:()=>false,
  mappedLabels:(_data,mapping)=>mapping.aliases,
  FIELD_SELECTOR:'input',core:globalThis.ResumeHelperCore,
  isSupportedFieldElement:()=>true,isVisible:()=>true,isCmbResumePage:()=>false,
  fieldContext:el=>el.label,fieldName:(_el,label)=>label
};
const rawAllocate=vm.runInNewContext(`${source.slice(lookupStart,lookupEnd)};${source.slice(start,end)};genericRecordFieldMap`,context);
const allocate=(elements,...args)=>{
  for(const element of elements){element.getAttribute=()=>null;element.tagName='INPUT';}
  return rawAllocate({querySelectorAll:()=>elements},...args);
};
test('a merged degree control belongs only to level, including a blank level',()=>{
  const combined={label:'学历/学位'};
  for(const data of [{educationLevel:'硕士研究生',academicDegree:'硕士'},{educationLevel:'',academicDegree:'硕士'}]){
    const fields=allocate([combined],data,schema,'generic',78);
    assert.equal(fields.get('educationLevel').element,combined);
    assert.equal(fields.has('academicDegree'),false);
  }
});
test('separate level and degree controls keep separate ownership',()=>{
  const level={label:'学历'},degree={label:'学位'};
  const fields=allocate([level,degree],{},schema,'generic',78);
  assert.equal(fields.get('educationLevel').element,level);
  assert.equal(fields.get('academicDegree').element,degree);
});

test('exact study-type alias reserves its control before a partial degree match',()=>{
  const type={label:'学历类型'},combined={label:'学历/学位'};
  const mergedSchema={fields:[...schema.fields,{key:'studyType',aliases:['学习形式','学历类型']}]};
  const fields=allocate([type,combined],{},mergedSchema,'generic',78);
  assert.equal(fields.get('studyType').element,type);
  assert.equal(fields.get('educationLevel').element,combined);
  assert.equal(fields.has('academicDegree'),false);
});

const repeatSchemas=vm.runInNewContext(`${source.slice(source.indexOf('  const GENERIC_REPEAT_SCHEMAS ='),source.indexOf('  const DEFAULT_GENERIC_REPEAT_ADD ='))};GENERIC_REPEAT_SCHEMAS`,{ResumeHelperCategories:globalThis.ResumeHelperCategories});
const awardSchema=repeatSchemas.find(item=>item.key==='awards');
test('competition heading maps awards but never works or patents',()=>{
  for(const heading of ['竞赛','竞赛经历','奖项荣誉'])assert.equal(awardSchema.heading.test(heading),true);
  for(const heading of ['作品','专利获取情况','项目经历'])assert.equal(awardSchema.heading.test(heading),false);
});
test('competition name and bare description allocate distinct award fields',()=>{
  const name={label:'竞赛名称'},description={label:'描述'};
  const fields=allocate([name,description],{},awardSchema,'generic',78);
  assert.equal(fields.get('name').element,name);
  assert.equal(fields.get('description').element,description);
  assert.equal(fields.size,2);
});
