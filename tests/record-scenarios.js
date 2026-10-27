// Runs only in the local anonymous fixture, never in a recruitment tab.
import { siteProfile } from "/src/shared/schema.js";

export async function runScenarios(adapter) {
  if (location.hostname !== "127.0.0.1") throw new Error("Anonymous runner requires localhost");
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const checks = [];
  const check = (name, ok) => { assert(ok, name); checks.push(name); globalThis.__recordProgress = { checks: [...checks], phase: name }; };
  const records = Array.from({ length: 14 }, (_, index) => ({
    id: `anonymous.education.${index}`, school: index % 2 ? "示例科技大学" : "示例大学",
    college: "虚构学院", major: "示例专业", educationLevel: "用户自定学历", academicDegree: index % 2 ? "学士" : "硕士", studyType: "用户自定学习形式",
    fieldOptions: { educationLevel: index % 2 ? ["本科"] : ["硕士研究生", "硕士"], studyType: ["全日制"] },
    start: `${2000 + index}-09`, end: `${2004 + index}-06`
  }));
  const profile = siteProfile({ entries: [], records: { educations: records }, recordTemplates: { educations: { fieldAliases: { school: ["自定义学校框"] } } } });
  const settings = { overwriteExisting: false, confidenceThreshold: 78, rejectedMatches: [] };
  const rows = () => Array.from(document.querySelectorAll({
    zhiye: '#education-records > .form', feishu: '[data-kind="education"] .resumeEditForm-item',
    mokahr: '[data-nav-id="block-educationInfo"] > .apply-fields-test', generic: '[data-repeat-item="educations"]', ud: '[class^="apply-form-array-card__"]'
  }[adapter]));
  const initialCount = rows().length;
  const renameSchools = () => {
    for (const row of rows()) {
      const title = Array.from(row.querySelectorAll('.title-test, .atsx-form-item-label, .form-item label, label')).find((el) => el.firstChild?.textContent.trim() === "学校名称");
      if (title) { title.firstChild.textContent = "自定义学校框"; if (adapter === 'ud') title.closest('.ud-formily-item').dataset.formFieldI18nName = '自定义学校框'; }
    }
  };
  const observer = new MutationObserver(renameSchools); observer.observe(document.body, { childList: true, subtree: true }); renameSchools();
  const snapshots = () => rows().map((row) => Array.from(row.querySelectorAll('input, textarea, select, .sd-Input-display-value-test, .atsx-select-selection-selected-value, .atsx-date-picker-period-month-label'), (el) => el.tagName === "SELECT" ? el.value : el.value ?? el.textContent.trim()));
  const initial = JSON.stringify(snapshots());
  const timings = [];
  const combinedDegree=adapter==='ud'&&new URLSearchParams(location.search).get('ud')==='combined-degree';
  const expectedFields=combinedDegree?7:adapter==='ud'||adapter==='mokahr'?8:7;
  const run = (command, payload = {}) => new Promise((resolve, reject) => {
    const started = performance.now();
    const timer = setTimeout(() => reject(new Error(`${command} timeout`)), 114000);
    globalThis.__resumeHelperListener({ type: "RESUME_HELPER_COMMAND", command, payload: { profile, settings, ...payload } }, null, (result) => {
      clearTimeout(timer); timings.push({ command, ms: Math.round(performance.now() - started) });
      result?.error ? reject(new Error(result.error)) : resolve(result);
    });
  });
  const fillOne = (id, resetTransaction = false, extra = {}) => run("fillRecord", { collection: "educations", recordId: id, resetTransaction, ...extra });
  const readReport = (report) => {
    for (const item of report.filled) {
      const el = document.querySelector(item.locator);
      assert(el, `Missing field: ${item.field}`);
      const shown = el.closest('.ud__select')?.querySelector('.ud__select__selector__selectItem')?.textContent || el.closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle')?.textContent || el.closest('[class*=sd-Select-container]')?.querySelector('[class*=sd-Input-display-value]')?.textContent || el.querySelector?.('.atsx-select-selection-selected-value')?.textContent || el.value || el.textContent;
      assert(String(shown).trim(), `Empty field: ${item.field}`);
      assert(String(shown).trim() === String(item.expectedValue).trim(), `Readback mismatch: ${item.field}`);
    }
  };
  const first = await fillOne(records[0].id, true);
  readReport(first);
  check("single record fills every available requested field", first.skipped.length === 0 && first.filled.length >= expectedFields);
  if (adapter === 'ud') {
    check('merged study type fills the education-type dropdown with its own candidate', rows()[0].querySelector('[data-form-field-name="degree_type"] .ud__select__selector__selectItem')?.textContent === '全日制');
  }
  if (adapter === "mokahr") {
    const dateInputs = rows()[0].querySelector('.month-range-select').querySelectorAll('input:not([type=checkbox])');
    const actualDates = Array.from(dateInputs, (input) => input.value || input.closest('[class*=sd-Select-container]').querySelector('[class*=sd-Input-display-value]').textContent);
    check("Moka year and month readback matches source, including default months", JSON.stringify(actualDates) === JSON.stringify(['2000', '9', '2004', '6']));
    check("Moka blank initial group is reused", rows().length === Math.max(1, initialCount));
  }
  check("category custom alias is used by the site adapter", rows()[0].textContent.includes("自定义学校框"));
  if (adapter === 'ud') {
    check('UD range selects both exact source months, not just years', JSON.stringify(Array.from(rows()[0].querySelectorAll('.throne-biz-date-range-picker-wrapper input'), el => el.value)) === JSON.stringify(['2000-09', '2004-06']));
    check('UD dropdown commits the user candidate, not its query', rows()[0].querySelector('[data-form-field-name="degree"] .ud__select__selector__selectItem')?.textContent === (combinedDegree?'硕士研究生':'硕士'));
    if(combinedDegree)check('combined degree field fills only education level', !first.filled.some(item=>item.entryId.endsWith('.academicDegree')));
  }
  const undoFirst = await run("undo");
  check("undo restores original blank groups without removing them", undoFirst.failedCount === 0 && rows().length === initialCount && JSON.stringify(snapshots()) === initial);
  const refilledFirst = await fillOne(records[0].id, true); readReport(refilledFirst);
  const firstRow = rows()[0];
  const major = adapter === "feishu" ? firstRow.querySelector('input[id="fieldOfStudy"]')
    : adapter === "mokahr" ? Array.from(firstRow.querySelectorAll('.apply-field-test')).find((el) => el.querySelector('.title-test')?.textContent === "专业名称")?.querySelector('input')
    : adapter === "zhiye" ? firstRow.querySelectorAll('.form-item')[1]?.querySelector('input') : adapter === 'ud' ? firstRow.querySelector('[data-form-field-name="field_of_study"] input') : firstRow.querySelectorAll('input')[2];
  assert(major, "Missing major control");
  {
    major.focus();
    const child = await run("fillTarget", { entry: { id: "anonymous.child", label: "专业", value: adapter === "mokahr" ? "用户自定主值" : "示例专业（子字段）", optionValues: adapter === "mokahr" ? ["软件工程"] : [] }, forceOverwrite: true });
    check("child field only changes the selected control", child.success && rows().length === Math.max(1, initialCount));
    const undoChild = await run("undo");
    check(`child field undo${undoChild.failedCount ? ': ' + JSON.stringify({undoChild, majorValue: major.value, majorDisplay: major.closest('[class*=sd-Select-container]')?.querySelector('[class*=sd-Input-display-value]')?.textContent}) : ''}`, undoChild.failedCount === 0);
  }
  if (new URLSearchParams(location.search).has('quick')) {
    const repeated = await fillOne(records[0].id);
    check('quick repeat retains one group without writes', repeated.filled.length === 0 && !repeated.requiresConfirmation && rows().length === Math.max(1, initialCount));
    observer.disconnect(); return { adapter, checks, timings, initialCount, initial };
  }
  // Start a fresh transaction after the targeted-child check.
  await run("undo");
  // Restore the fixture to its original blank state using fixture-owned controls.
  for (const row of rows()) row.remove();
  for (let index = 0; index < records.length; index += 1) {
    const single = await fillOne(records[index].id, index === 0); readReport(single);
    assert(single.skipped.length === 0 && single.filled.length >= expectedFields, `Single record ${index} failed`);
  }
  check("14 individual records use separate candidates", rows().length === 14);
  check("14 individual records share undo when appended", (await run("undo")).failedCount === 0 && rows().length === 0);
  const batch = await run("fillCollection", { collection: "educations", resetTransaction: true });
  readReport(batch);
  check("14-record batch", rows().length === 14 && batch.skipped.length === 0 && !batch.requiresConfirmation);
  const filledSnapshot = JSON.stringify(snapshots());
  const repeat = await fillOne(records[0].id);
  check("repeat preserves 14 groups and writes nothing", rows().length === 14 && repeat.filled.length === 0 && !repeat.requiresConfirmation && JSON.stringify(snapshots()) === filledSnapshot);
  const changedProfile = structuredClone(profile); changedProfile.records.educations[0].major = "用户确认的新专业";
  changedProfile.records.educations[0].fieldOptions.major = ["软件工程"];
  const conflict = await fillOne(records[0].id, false, { profile: changedProfile, settings: { ...settings, overwriteExisting: true } });
  check("overwrite still requires record confirmation", conflict.requiresConfirmation && conflict.filled.length === 0 && JSON.stringify(snapshots()) === filledSnapshot);
  const undoBatch = await run("undo");
  check("whole batch undo removes only plugin-created groups", undoBatch.failedCount === 0 && rows().length === 0);
  const one = await fillOne(records[0].id, true);
  check("new transaction after undo", one.filled.length >= expectedFields && rows().length === 1);
  const userField = rows()[0].querySelector(adapter === 'ud' ? '[data-form-field-name="school"] input' : 'input:not([readonly]):not([type=hidden])');
  const previous = userField.value; userField.value = "用户后来修改"; userField.dispatchEvent(new Event("input", { bubbles: true }));
  const protectedUndo = await run("undo");
  check("later user edit prevents group removal", protectedUndo.failedCount > 0 && rows().length === 1 && userField.value === "用户后来修改");
  userField.value = previous; userField.dispatchEvent(new Event("input", { bubbles: true }));
  const retryUndo = await run("undo");
  check("failed undo remains retryable", retryUndo.failedCount === 0 && rows().length === 0);
  const faultProfile = structuredClone(profile);
  faultProfile.records.educations[6].educationLevel = "没有对应选项";
  faultProfile.records.educations[6].fieldOptions.educationLevel = [];
  const faultBatch = await run("fillCollection", { profile: faultProfile, collection: "educations", resetTransaction: true });
  check("unmatched option fails without stopping later records", faultBatch.skipped.length > 0 && faultBatch.filled.some((field) => field.entryId.startsWith(records[13].id)) && rows().length === 14);
  check("partial batch shares one undo transaction", (await run("undo")).failedCount === 0 && rows().length === 0);
  const confirmed = await fillOne(records[0].id, true);
  const changed = await fillOne(records[0].id, false, { profile: changedProfile, settings: { ...settings, overwriteExisting: true, recordConflictConfirmed: true } });
  check("confirmed record conflict writes the changed field", changed.filled.length > 0 && !changed.requiresConfirmation);
  await run("undo");
  observer.disconnect();
  return { adapter, checks, timings, initialCount, initial };
}
