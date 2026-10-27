import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/content/fill.js', import.meta.url), 'utf8');
test('UD month undo restores an empty or existing value without consulting a fill entry', async () => {
  let clears = 0;
  const element = { value: '2024-09', isConnected: true };
  const clear = { click() { clears++; element.value = ''; } };
  element.closest = selector => selector === '.throne-biz-date-range-picker-wrapper' ? {}
    : selector === '.throne-biz-date-range-picker-input' ? { querySelector: () => clear } : null;
  const restoreSource = source.slice(source.indexOf('  async function restoreRecord('), source.indexOf('  async function clearControlledChoice('));
  const restore = vm.runInNewContext(restoreSource + '; restoreRecord', {
    isElementDayPicker: () => false, isCmbMonthPicker: () => false, isCmbHonorChoice: () => false, isMokaMonthPicker: () => false, isMokaDayPicker: () => false,
    isMokaRegionControl: () => false, isMokaDropdown: () => false,
    isSeyondRecordControl:()=>false,
    isChinalifeRegion: () => false, isChinalifeRadioGroup: () => false, isChinalifeZhiyePage: () => false, chinalifeDatePrecision: () => '',
    isZhaopinSearchChoice: () => false, isZhaopinRegion: () => false, isFeishuYearControl: () => false,
    getCurrentValue: control => control.value, isVisible: () => true, waitUntil: async predicate => predicate(),
    chooseUdMonth: async (control, original) => { control.value = original; return true; }
  });
  assert.equal(await restore({ kind: 'field', element, value: '', afterValue: '2024-09' }), true);
  assert.equal(element.value, ''); assert.equal(clears, 1);
  element.value = '2024-09';
  assert.equal(await restore({ kind: 'field', element, value: '2023-06', afterValue: '2024-09' }), true);
  assert.equal(element.value, '2023-06');
  element.value = '2025-01';
  assert.equal(await restore({ kind: 'field', element, value: '', afterValue: '2024-09' }), false);
  assert.equal(element.value, '2025-01');
});
const value = vm.runInNewContext(`${source.slice(source.indexOf('  function getCurrentValue('), source.indexOf('  // 组合框的显示层'))}; getCurrentValue`, {
  job51: null, isSeyondRecordControl:()=>false, HTMLSelectElement: class {}, compactText: text => String(text || '').trim(), isChinalifeRadioGroup: () => false, isChinalifeZhiyePage: () => false
});
test('UD select reads committed display, never query or placeholder', () => {
  const display = { textContent: '本科' };
  const input = { value: '硕士', getAttribute: () => 'combobox', closest: selector => selector === '.ud__select' ? { querySelector: () => display } : null };
  assert.equal(value(input), '本科');
  display.textContent = ''; assert.equal(value(input), '');
  input.closest = selector => selector === '.ud__select' ? { querySelector: () => null } : null;
  assert.equal(value(input), '');
});
const context = vm.runInNewContext(`${source.slice(source.indexOf('  function fieldContext('), source.indexOf('  function fieldName('))}; fieldContext`, {});
test('UD range maps two inputs to separate start/end identities', () => {
  const controls = [{}, {}];
  const field = { getAttribute: () => '起止时间' };
  for (const control of controls) control.closest = selector => selector.startsWith('.ud-formily-item') ? field : { querySelectorAll: () => controls };
  assert.equal(context(controls[0], 'generic'), '起止时间 | 开始时间');
  assert.equal(context(controls[1], 'generic'), '起止时间 | 结束时间');
});

const exactStart=source.indexOf('  function exactOption(');
const exactEnd=source.indexOf('  function chooseNativeSelect(', exactStart);
const monthStart=source.indexOf('  async function chooseUdMonth(');
const monthEnd=source.indexOf('  function cascadeLevelOptions(', monthStart);
function monthHarness({readYearOnly=false, disabled=false, duplicatePanel=false}={}) {
  let opened=false,year=2026,shown='',clicks=0;
  const failures=new WeakMap();
  const cells=Array.from({length:12},(_,index)=>({
    className: disabled&&index===8?'ud__picker-month-panel-cell-disabled':'ud__picker-month-panel-cell',
    getAttribute:()=>null,contains:()=>false,
    querySelector:()=>({textContent:String(index+1).padStart(2,'0')+'月'}),
    click:()=>{clicks++;shown=readYearOnly?String(year):year+'-'+String(index+1).padStart(2,'0')}
  }));
  const panel={
    querySelector:()=>({textContent:year+'年'}),
    querySelectorAll:selector=>selector.includes('button')?[{disabled:false,getAttribute:()=>null,click:()=>{year+=selector.includes('LeftBold')?-1:1}}]:cells
  };
  const element={focus(){},click(){opened=true},dispatchEvent(){opened=false},blur(){opened=false}};
  const choose=vm.runInNewContext(`${source.slice(exactStart,exactEnd)};${source.slice(monthStart,monthEnd)};chooseUdMonth`,{
    visibleUdLayers:()=>opened?(duplicatePanel?[panel,{}]:[panel]):[],
    waitUntil:async predicate=>predicate(),isVisible:()=>true,controlFailures:failures,
    compactText:text=>String(text||'').trim(),getCurrentValue:()=>shown,
    closeUdControl:el=>el.dispatchEvent(),
  });
  return {choose,element,failures,clicks:()=>clicks,shown:()=>shown};
}
test('UD month driver navigates year and confirms complete source month', async()=>{
  const h=monthHarness();assert.equal(await h.choose(h.element,'2000-09-05'),true);assert.equal(h.shown(),'2000-09');assert.equal(h.clicks(),1);
});
test('UD month driver refuses year-only confirmation and disabled month', async()=>{
  const h=monthHarness({readYearOnly:true});assert.equal(await h.choose(h.element,'2024-09'),false);assert.equal(h.failures.get(h.element),'写入未确认');
  const disabled=monthHarness({disabled:true});assert.equal(await disabled.choose(disabled.element,'2024-09'),false);assert.equal(disabled.clicks(),0);
});
test('UD month driver refuses ambiguous panels and invalid source month', async()=>{
  const h=monthHarness({duplicatePanel:true});assert.equal(await h.choose(h.element,'2024-09'),false);assert.equal(h.clicks(),0);
  assert.equal(await h.choose(h.element,'2024-13'),false);assert.equal(h.clicks(),0);
});
