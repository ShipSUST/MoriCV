import { siteProfile } from '/src/shared/schema.js';

// All writes below target the local, original anonymous mock. Filling always
// goes through the real content-script command listener, never fixture hooks.
export async function runZhaopin() {
  if (location.hostname !== '127.0.0.1') throw new Error('Anonymous Zhaopin fixture only');
  const fixture = globalThis.ZhaopinFixture;
  if (!fixture || !globalThis.__resumeHelperListener) throw new Error('Fixture/content listener not ready');
  const checks = [], timings = [];
  const check = (name,ok) => {
    if (!ok) throw new Error(name);
    checks.push(name); globalThis.__recordProgress = { adapter:'zhaopin',checks:[...checks],timings:[...timings] };
  };
  const settings = { overwriteExisting:false,confidenceThreshold:78,rejectedMatches:[] };
  const emptyProfile = siteProfile({ schemaVersion:8,entries:[],records:{} });
  const run = (command,payload = {}) => new Promise((resolve,reject) => {
    const started = performance.now();
    const timer = setTimeout(() => reject(new Error(`${command} timeout`)),114000);
    globalThis.__resumeHelperListener({ type:'RESUME_HELPER_COMMAND',command,payload:{ profile:emptyProfile,settings,...payload } },null,result => {
      clearTimeout(timer); timings.push({ command,ms:Math.round(performance.now() - started) });
      result?.error ? reject(new Error(result.error)) : resolve(result);
    });
  });
  const input = key => document.querySelector(`.apply-form .el-form-item[data-field-key="${CSS.escape(key)}"] input`);
  const model = key => fixture.snapshot().draft[key];
  const pair = () => [model('edu_date_start'),model('edu_date_end')];
  const target = (key,value,pathValues,extra = {}) => {
    const element = input(key); if (!element) throw new Error(`Missing fixture control ${key}`);
    element.focus();
    const dateField = element.closest('.apply-form-date');
    return run('fillTarget',{ entry:{ id:`anonymous.${key}`,label:key,value,optionValues:[],...(dateField ? {fieldType:'date'} : {}),...(pathValues ? {pathValues} : {}) },...extra });
  };
  const openBlankBirthday = () => { fixture.open('person_info'); fixture.setInitial({birth:''}); };
  const saveState = () => JSON.stringify({saved:fixture.snapshot().saved,count:fixture.snapshot().saveCount});

  fixture.reset();
  check('public anonymous topology has twelve modules and 97 fields',fixture.modules.length === 12 && fixture.modules.reduce((sum,module) => sum + module.fields.length,0) === 97);
  openBlankBirthday();
  const initialSaved = saveState();
  const leap = await target('birth','2024-02-29');
  check('Element single date derives year month day without a configured path',leap.success && model('birth') === '2024-02-29' && input('birth').value === '2024-02-29');
  check('date result is committed input value rather than an intermediate panel choice',leap.expectation.expectedValue === '2024-02-29' && fixture.snapshot().commits.some(item => item.key === 'birth' && item.source === 'calendar'));
  check('date filling never saves the local module',saveState() === initialSaved);
  check('blank Element date undo uses the control clear action',(await run('undo')).failedCount === 0 && model('birth') === '' && input('birth').value === '');

  const equalPath = [['2024','2024年'],['2','02','二月','2月'],['29','29日']];
  const equal = await target('birth','2024/02/29',equalPath);
  check('slash main date and equivalent per-level display candidates preserve one date',equal.success && model('birth') === '2024-02-29');
  check('equivalent path date can be undone',(await run('undo')).failedCount === 0 && model('birth') === '');
  const beforeConflict = fixture.snapshot().commits.length;
  const conflict = await target('birth','2024-02-29',[['2023'],['二月'],['29']]);
  check('contradictory date path fails before any committed change',!conflict.success && model('birth') === '' && fixture.snapshot().commits.length === beforeConflict);
  const monthOnly = await target('birth','2024-02',[['2024'],['二月'],['29']]);
  check('a path never invents a missing day for a day-precision website',!monthOnly.success && model('birth') === '');
  check('an impossible leap date is rejected without leaving a different day',!(await target('birth','2023-02-29')).success && model('birth') === '');

  input('birth').dataset.disabledDay = '2024-02-29';
  const disabled = await target('birth','2024-02-29');
  check('disabled day is rejected without selecting a neighboring enabled day',!disabled.success && model('birth') === '');
  delete input('birth').dataset.disabledDay;
  const neighbor = await target('birth','2024-03-01');
  check('same-number gray neighboring month cells are never selected',neighbor.success && model('birth') === '2024-03-01' && fixture.snapshot().commits.at(-1).value === '2024-03-01');
  check('neighbor-month case undo returns to blank',(await run('undo')).failedCount === 0 && model('birth') === '');
  input('birth').dataset.delay = '160';
  const past = await target('birth','1884-09-02');
  check('delayed panel navigates multiple decades into the past',past.success && model('birth') === '1884-09-02');
  check('past date undo is exact',(await run('undo')).failedCount === 0 && model('birth') === '');
  delete input('birth').dataset.delay;
  const future = await target('birth','2048-12-31');
  check('year navigation can also move forward',future.success && model('birth') === '2048-12-31');
  await run('undo');

  fixture.setInitial({birth:'2001-01-02'});
  const protectedDate = await target('birth','2002-02-03');
  check('existing date still requires an explicit target overwrite',!protectedDate.success && protectedDate.requiresConfirmation && model('birth') === '2001-01-02');
  const overwritten = await target('birth','2002-02-03',null,{forceOverwrite:true});
  check('explicit date overwrite commits only the chosen date',overwritten.success && model('birth') === '2002-02-03');
  check('nonblank date undo restores original date through the real control',(await run('undo')).failedCount === 0 && model('birth') === '2001-01-02');
  await target('birth','2002-02-03',null,{forceOverwrite:true});
  fixture.setInitial({birth:'2003-03-04'});
  check('undo preserves a later user date edit',(await run('undo')).failedCount > 0 && model('birth') === '2003-03-04');

  openBlankBirthday();
  input('birth').dataset.rewrite = '2024-03-01';
  const rewritten = await target('birth','2024-02-29');
  check('site-rewritten date is never reported as successful',!rewritten.success);
  check('site-rewritten date is recovered to its exact original blank value',model('birth') === '');
  delete input('birth').dataset.rewrite;

  const gender = await target('gender','男');
  check('controlled Element ordinary select formally commits its selected option',gender.success && model('gender') === '男');
  check('ordinary select undo clears its committed model',(await run('undo')).failedCount === 0 && model('gender') === '');
  const health = await target('healthiness_status','其他');
  const history = document.querySelector('.el-form-item[data-field-key="healthiness_history"]');
  check('conditional field is revealed by the actual controlling select commit',health.success && !history.hidden);
  check('conditional select undo restores both selection and field visibility',(await run('undo')).failedCount === 0 && model('healthiness_status') === '' && history.hidden);

  const currentInput = input('nowlocated_city'); currentInput.focus();
  const current = await run('fillTarget',{entry:{id:'anonymous.location',label:'现居住城市',value:'示例省甲示例市甲示例区甲',optionValues:['示例市甲'],pathValues:[['示例省甲'],['示例市甲'],['示例区甲']]}});
  check('region modal keeps flat candidates separate from a confirmed three-level path',current.success && model('nowlocated_city') === '示例省甲/示例市甲/示例区甲' && fixture.snapshot().commits.at(-1).source === 'region');
  check('region success occurs only after its confirmation button closes the modal',!document.querySelector('.s-region__modal'));
  check('district-level region can undo its committed selection',(await run('undo')).failedCount === 0 && model('nowlocated_city') === '');
  const hometownInput = input('FIELD1002_city'); hometownInput.focus();
  const hometown = await run('fillTarget',{entry:{id:'anonymous.hometown',label:'籍贯',value:'示例省乙示例市丙',optionValues:[],pathValues:[['示例省乙'],['示例市丙']]}});
  check('city-level region uses its two observed levels',hometown.success && model('FIELD1002_city') === '示例省乙/示例市丙');
  check('city-level region also uses exact clear undo',(await run('undo')).failedCount === 0 && model('FIELD1002_city') === '');

  // Faults are injected only into the anonymous control; writes and undo still
  // use the production command boundary and must change the committed model.
  const regionPath = [['Region-A'],['City (B)'],['Area.C']];
  const originalRegion = '示例省乙/示例市丙/示例区丁';
  const regionKey = 'nowlocated_city';
  const fault = (value,remaining = 1) => {
    input(regionKey).dataset.regionRewrite = value;
    input(regionKey).dataset.regionRewriteRemaining = String(remaining);
  };
  const clearFault = () => {
    delete input(regionKey).dataset.regionRewrite;
    delete input(regionKey).dataset.regionRewriteRemaining;
    delete input(regionKey).dataset.regionClearFails;
  };
  const regionSaved = saveState();
  fault('RegionA/City B/AreaC');
  const punctuation = await target(regionKey,'Region-A/City (B)/Area.C',regionPath);
  check('region label punctuation cannot be discarded to report a wrong commit as success',!punctuation.success);
  check('wrong region commit restores original blank input and model',model(regionKey) === '' && input(regionKey).value === '');
  clearFault();
  fixture.setInitial({[regionKey]:originalRegion});
  fault('Unexpected');
  const recovered = await target(regionKey,'Region-A/City (B)/Area.C',regionPath,{forceOverwrite:true});
  check('wrong region commit restores a nonempty original via selection',!recovered.success && model(regionKey) === originalRegion && input(regionKey).value === originalRegion);
  clearFault();
  fixture.setInitial({[regionKey]:''});
  fault('Unexpected'); input(regionKey).dataset.regionClearFails = '1';
  const failedRecovery = await target(regionKey,'Region-A/City (B)/Area.C',regionPath);
  check('failed empty-region recovery reports failure and preserves changed model',!failedRecovery.success && model(regionKey) === 'Unexpected' && /恢复未完成/.test(failedRecovery.reason));
  clearFault();
  const recoveredUndo = await run('undo');
  check('failed region commit retains undo evidence for an eventual exact clear',recoveredUndo.restoredCount > 0 && recoveredUndo.failedCount === 0 && model(regionKey) === '');
  fixture.setInitial({[regionKey]:originalRegion});
  fault('Unexpected',2);
  const twiceWrong = await target(regionKey,'Region-A/City (B)/Area.C',regionPath,{forceOverwrite:true});
  check('wrong nonempty recovery also retains failure without claiming restoration',!twiceWrong.success && model(regionKey) === 'Unexpected');
  clearFault();
  const nonemptyUndo = await run('undo');
  check('retained region undo reselects the exact original nonempty hierarchy',nonemptyUndo.restoredCount > 0 && nonemptyUndo.failedCount === 0 && model(regionKey) === originalRegion);
  fixture.setInitial({[regionKey]:''});
  fault('Unexpected'); input(regionKey).dataset.regionClearFails = '1';
  await target(regionKey,'Region-A/City (B)/Area.C',regionPath);
  clearFault(); fixture.setInitial({[regionKey]:originalRegion});
  const laterRegion = await run('undo');
  check('failed region undo protects a later user selection',laterRegion.failedCount > 0 && model(regionKey) === originalRegion);
  fixture.setInitial({[regionKey]:''});
  const punctuated = await target(regionKey,'Region-A/City (B)/Area.C',regionPath);
  check('punctuated region labels commit exactly through all levels',punctuated.success && model(regionKey) === 'Region-A/City (B)/Area.C');
  check('successful punctuated region undo restores original blank model',(await run('undo')).failedCount === 0 && model(regionKey) === '');
  check('region failure recovery and undo never save the mock module',saveState() === regionSaved);

  fixture.open('education_experience');
  fixture.setInitial({school_name:'匿名学校甲',education_degree:'硕士研究生',edu_date_start:'2020-01-01',edu_date_end:'2022-01-01'});
  const protectedPair = pair(); const pairCommitCount = fixture.snapshot().commits.length;
  const lateStart = await target('edu_date_start','2023-01-01',null,{forceOverwrite:true});
  check('single start cannot passively clear an existing paired end',!lateStart.success && JSON.stringify(pair()) === JSON.stringify(protectedPair) && fixture.snapshot().commits.length === pairCommitCount);
  const earlyEnd = await target('edu_date_end','2019-01-01',null,{forceOverwrite:true});
  check('single end cannot passively clear an existing paired start',!earlyEnd.success && JSON.stringify(pair()) === JSON.stringify(protectedPair));

  const record = {id:'anonymous.education.one',school:'匿名学校甲',start:'2023-01-01',end:'2025-01-01',fieldPaths:{start:[['2023'],['一月'],['1']],end:[['2025'],['一月'],['1']]}};
  const profile = siteProfile({schemaVersion:8,entries:[],records:{educations:[record]}});
  const originalSource = JSON.stringify(profile);
  const confirmedSettings = {...settings,overwriteExisting:true,recordConflictConfirmed:true};
  const savedPair = saveState();
  const moveLater = await run('fillRecord',{profile,collection:'educations',recordId:record.id,settings:confirmedSettings,resetTransaction:true});
  check('paired date interval moves later without intermediate passive clearing',moveLater.filled.length >= 2 && JSON.stringify(pair()) === JSON.stringify(['2023-01-01','2025-01-01']) && !fixture.snapshot().commits.slice(pairCommitCount).some(item => item.source === 'paired-clear'));
  check('record date fill never clicks Add Save Cancel or switches modules',saveState() === savedPair && fixture.snapshot().active.key === 'education_experience' && fixture.snapshot().active.index === 0 && fixture.snapshot().cancelCount === 0);
  check('paired undo restores both endpoints exactly',(await run('undo')).failedCount === 0 && JSON.stringify(pair()) === JSON.stringify(protectedPair));
  const earlier = siteProfile({schemaVersion:8,entries:[],records:{educations:[{...record,start:'2010-01-01',end:'2012-01-01',fieldPaths:{}}]}});
  const moveEarlier = await run('fillRecord',{profile:earlier,collection:'educations',recordId:record.id,settings:confirmedSettings,resetTransaction:true});
  check('paired date interval also moves earlier without clearing the original start',moveEarlier.filled.length >= 2 && JSON.stringify(pair()) === JSON.stringify(['2010-01-01','2012-01-01']));
  check('earlier paired undo restores the valid original interval',(await run('undo')).failedCount === 0 && JSON.stringify(pair()) === JSON.stringify(protectedPair));
  const invalidInterval = siteProfile({schemaVersion:8,entries:[],records:{educations:[{...record,start:'2025-01-01',end:'2023-01-01',fieldPaths:{}}]}});
  const invalid = await run('fillRecord',{profile:invalidInterval,collection:'educations',recordId:record.id,settings:confirmedSettings,resetTransaction:true});
  check('invalid requested interval is skipped atomically',invalid.skipped.length > 0 && JSON.stringify(pair()) === JSON.stringify(protectedPair));

  input('edu_date_start').dataset.reject = '1';
  const partial = await run('fillRecord',{profile,collection:'educations',recordId:record.id,settings:confirmedSettings,resetTransaction:true});
  check('second endpoint rejection rolls back the successful first endpoint',partial.skipped.length > 0 && JSON.stringify(pair()) === JSON.stringify(protectedPair));
  delete input('edu_date_start').dataset.reject;
  await run('fillRecord',{profile,collection:'educations',recordId:record.id,settings:confirmedSettings,resetTransaction:true});
  fixture.setInitial({edu_date_end:'2026-01-01'});
  const laterUserPair = pair();
  check('user changing one endpoint blocks undo for the entire pair',(await run('undo')).failedCount > 0 && JSON.stringify(pair()) === JSON.stringify(laterUserPair));

  fixture.open('work_ecperience');
  fixture.setInitial({FIELD1008:'2020-01-01',FIELD1009:'2022-01-01'});
  const internship = await target('FIELD1008','2023-01-01',null,{forceOverwrite:true});
  check('unpaired custom internship date keys do not inherit the default education clear rule',internship.success && model('FIELD1009') === '2022-01-01');
  check('unpaired internship date has ordinary exact undo',(await run('undo')).failedCount === 0 && model('FIELD1008') === '2020-01-01');
  fixture.open('MODULE100'); fixture.setInitial({FIELD1013:'2020-01-01',FIELD1014:'2022-01-01'});
  const project = await target('FIELD1013','2023-01-01',null,{forceOverwrite:true});
  check('current custom project keys are also not assumed to be a pair',project.success && model('FIELD1014') === '2022-01-01');
  await run('undo');

  fixture.open('education_experience'); fixture.setInitial({education_degree:'硕士研究生'});
  const school = input('school_name'); school.focus();
  const selected = await run('fillTarget',{entry:{id:'anonymous.school',label:'学校名称',value:'不存在的主值',optionValues:['匿名学校乙']}});
  check('asynchronous school candidate must be formally selected, not left as a query',selected.success && model('school_name') === '匿名学校乙' && school.value === '匿名学校乙');
  await run('undo');
  school.focus();
  const queryOnly = await run('fillTarget',{entry:{id:'anonymous.school',label:'学校名称',value:'没有匹配结果',optionValues:[]}});
  check('remote search text by itself never becomes a committed school',!queryOnly.success && model('school_name') === '');

  const second = {id:'anonymous.education.two',school:'匿名学校乙',start:'2013-09-02',end:'2017-06-03'};
  const twoProfile = siteProfile({schemaVersion:8,entries:[],records:{educations:[record,second]}});
  fixture.seed('education_experience',0,{school_name:'匿名学校甲',education_degree:'硕士研究生'});
  fixture.seed('education_experience',1,{school_name:'匿名学校乙',education_degree:'本科'});
  fixture.open('education_experience',0);
  const firstLocalSaved = saveState();
  const first = await run('fillRecord',{profile:twoProfile,collection:'educations',recordId:record.id,resetTransaction:true});
  check('first selected record receives only its own dates',first.filled.length >= 2 && JSON.stringify(pair()) === JSON.stringify([record.start,record.end]) && saveState() === firstLocalSaved);
  const batchSnapshot = JSON.stringify(fixture.snapshot().draft);
  const collection = await run('fillCollection',{profile:twoProfile,collection:'educations',resetTransaction:true});
  check('collection never traverses Add Save or overwrites the current record with the next record',JSON.stringify(fixture.snapshot().draft) === batchSnapshot && saveState() === firstLocalSaved && fixture.snapshot().active.index === 0 && collection.skipped.length > 0);
  fixture.open('education_experience',1);
  const secondLocalSaved = saveState();
  const secondResult = await run('fillRecord',{profile:twoProfile,collection:'educations',recordId:second.id,resetTransaction:true});
  check('a separately user-selected second record retains its independent dates',secondResult.filled.length >= 2 && JSON.stringify(pair()) === JSON.stringify([second.start,second.end]) && saveState() === secondLocalSaved && fixture.snapshot().active.index === 1);
  check('second record undo leaves all saved records intact',(await run('undo')).failedCount === 0 && model('edu_date_start') === '' && model('edu_date_end') === '' && saveState() === secondLocalSaved);
  check('runtime source profile is immutable',JSON.stringify(profile) === originalSource);
  fixture.open('education_experience',0);
  fixture.setInitial({school_name:'匿名学校甲',education_degree:'硕士研究生',edu_date_start:'',edu_date_end:''});
  const pageSaved = saveState();
  const fullPage = await run('fill',{profile,resetTransaction:true});
  check('whole-page fill uses the same independent education date paths',fullPage.filled.length >= 2 && JSON.stringify(pair()) === JSON.stringify([record.start,record.end]));
  check('whole-page filling stays in the current editor without saving',saveState() === pageSaved && fixture.snapshot().active.key === 'education_experience');
  check('whole-page dates undo atomically',(await run('undo')).failedCount === 0 && JSON.stringify(pair()) === JSON.stringify(['','']));
  fixture.setInitial({edu_date_start:'2023-01-02',edu_date_end:'2025-01-01'});
  const differentDay = await run('fillRecord',{profile,collection:'educations',recordId:record.id,settings:{...settings,overwriteExisting:true},resetTransaction:true});
  check('same month but a different day still requires record conflict confirmation',differentDay.requiresConfirmation && model('edu_date_start') === '2023-01-02');
  fixture.open('work_ecperience');
  const workRecord = {id:'anonymous.internship.path',company:'匿名公司甲',position:'匿名职位',
    start:'2020-09-02',end:'2021-06-03',fieldPaths:{start:[['2020年'],['九月'],['2日']],end:[['2021'],['六月'],['3']]}};
  const workProfile = siteProfile({schemaVersion:8,entries:[],records:{internships:[workRecord]}});
  const workSaved = saveState();
  const workFill = await run('fillRecord',{profile:workProfile,collection:'internships',recordId:workRecord.id,resetTransaction:true});
  check('internship start and end use their own date paths',workFill.filled.length >= 2 && model('FIELD1008') === workRecord.start && model('FIELD1009') === workRecord.end);
  check('internship record fill does not add or save website records',saveState() === workSaved);
  check('independent internship dates undo through their own calendar controls',(await run('undo')).failedCount === 0 && model('FIELD1008') === '' && model('FIELD1009') === '');
  const badWork = structuredClone(workProfile);badWork.records.internships[0].fieldPaths.start = [['2022']];
  const badWorkFill = await run('fillRecord',{profile:badWork,collection:'internships',recordId:workRecord.id,resetTransaction:true});
  check('an internship path conflict stops that date without changing its main value',badWorkFill.skipped.some(item => /主日期不一致/.test(item.reason)) && model('FIELD1008') === '');
  await run('undo');
  fixture.open('photo_attach');
  const fileProfile = siteProfile({schemaVersion:8,entries:[{id:'anonymous.file',category:'基本信息',label:'简历附件',aliases:['简历附件'],value:'匿名文件路径',optionValues:[]}],records:{}});
  const files = await run('fill',{profile:fileProfile,resetTransaction:true});
  check('extension never uploads local-only attachment inputs',files.filled.length === 0 && model('attach_path').length === 0 && Array.from(document.querySelectorAll('input[type=file]')).every(element => element.value === ''));
  return {adapter:'zhaopin',checks,timings,anonymous:true,scope:'current module only; no server persistence'};
}
