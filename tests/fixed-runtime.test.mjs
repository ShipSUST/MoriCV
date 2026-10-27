import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { compileCategoryContract, hydrateCategoryContract } from '../src/shared/categories/runtime-contract.js';
import { FIXED_FIELDS } from '../src/shared/ordinary-fields.js';
import { renderCategoryRuntime } from '../scripts/category-runtime.mjs';
import { createTemplateEntry } from '../src/shared/categories/templates.js';

test('classic runtime admits only fixed identities and attaches code-owned metadata', () => {
  const fields = [{ id:'basic.name', category:'基本信息', label:'姓名', aliases:['姓名'], type:'text', supportsOptions:false, supportsPath:false }];
  const runtime = vm.runInNewContext(`(${hydrateCategoryContract.toString()})(${JSON.stringify(compileCategoryContract([]))}, ${JSON.stringify(fields)})`);
  assert.equal(runtime.fixedFields.length, 1);
  assert.equal(runtime.isFixedEntry({id:'basic.name',category:'基本信息'}), true);
  assert.equal(runtime.isFixedEntry({id:'basic.name',category:'其他'}), false);
  assert.equal(runtime.isFixedEntry({id:'other.name',category:'其他',label:'姓名'}), false);
  assert.equal(runtime.fixedField('basic.name').label, '姓名');
  assert.equal(runtime.fixedField('unknown'), undefined);
});

test('generated classic catalog matches the ESM catalog and contains no personal defaults', () => {
  const context = vm.createContext({});
  vm.runInContext(renderCategoryRuntime(), context);
  const runtime = context.ResumeHelperCategories;
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.fixedFields)), FIXED_FIELDS);
  assert.equal(runtime.fixedFields.length, 44);
  assert.equal(runtime.fixedFields.some(field => Object.hasOwn(field,'value')), false);
});
test('fixed template creation cannot relocate a program field into another category',()=>{
  assert.throws(()=>createTemplateEntry('basic.name','其他'),/固定字段分类/);
  assert.equal(createTemplateEntry('basic.name').category,'基本信息');
});
