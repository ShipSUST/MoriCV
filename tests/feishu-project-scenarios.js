import { siteProfile } from '/src/shared/schema.js';

export async function runFeishuProjects() {
  if (location.hostname !== '127.0.0.1') throw new Error('Anonymous fixture only');
  const checks = [], timings = [];
  const check = (name, ok) => { if (!ok) throw new Error(name); checks.push(name); globalThis.__recordProgress = { checks: [...checks] }; };
  const projects = Array.from({ length: 14 }, (_, i) => ({ id: `anonymous.project.${i}`, name: `匿名项目${i}`, role: '匿名角色', description: `匿名描述${i}`, start: `${2000 + i}-01`, end: `${2001 + i}-02` }));
  const profile = siteProfile({ entries: [], records: { projects } });
  const settings = { overwriteExisting: false, confidenceThreshold: 78, rejectedMatches: [] };
  const rows = () => [...document.querySelectorAll('[data-kind="project"] .resumeEditForm-item')];
  const dates = r => [...r.querySelectorAll('.atsx-date-picker-period-month-label')].map(el => el.textContent.trim());
  const field = (r, name) => r.querySelector(`[id="${name}"]`);
  const snapshot = () => rows().map(r => [field(r, 'projectName').value, field(r, 'projectRole').value, field(r, 'projectDescription').value, ...dates(r)]);
  const originalOthers = [...document.querySelectorAll('[data-kind]:not([data-kind="project"]) input, [data-kind]:not([data-kind="project"]) textarea')].map(el => el.value).join('|');
  const run = (command, payload = {}) => new Promise((resolve, reject) => {
    const started = performance.now(), timer = setTimeout(() => reject(new Error(`${command} timeout`)), 114000);
    globalThis.__resumeHelperListener({ type: 'RESUME_HELPER_COMMAND', command, payload: { profile, settings, ...payload } }, null, result => {
      clearTimeout(timer); timings.push({ command, ms: Math.round(performance.now() - started) });
      result?.error ? reject(new Error(result.error)) : resolve(result);
    });
  });
  const existing = rows()[0];
  field(existing, 'projectName').value = projects[0].name;
  field(existing, 'projectRole').value = projects[0].role;
  field(existing, 'projectDescription').value = projects[0].description;
  const initial = JSON.stringify(snapshot());
  const scanned = await run('scan');
  check('scan includes configured project start and end months', scanned.suggestions.some(item => item.entryId === projects[0].id && item.label === projects[0].start) && scanned.suggestions.some(item => item.entryId === projects[0].id && item.label === projects[0].end));
  check('scan does not write dates', JSON.stringify(snapshot()) === initial);
  const repaired = await run('fillRecord', { collection: 'projects', recordId: projects[0].id });
  check('repair existing project writes exactly the two empty date halves', repaired.filled.length === 2 && rows().length === 1);
  check('both project months read back in their correct halves', dates(existing).join('|') === `${projects[0].start}|${projects[0].end}`);
  check('repeat repaired project is zero writes without duplication', (await run('fillRecord', { collection: 'projects', recordId: projects[0].id, resetTransaction: false })).filled.length === 0 && rows().length === 1);
  check('repair undo clears dates without changing existing text', (await run('undo')).failedCount === 0 && JSON.stringify(snapshot()) === initial);
  const batch = await run('fillCollection', { collection: 'projects' });
  check('14 project records fill without truncation or failed controls', rows().length === 14 && batch.skipped.every(item => item.reason === '字段已有内容') && batch.filled.length === 67);
  check('14 start and end pairs are separate and exact', rows().every((r, i) => dates(r).join('|') === `${projects[i].start}|${projects[i].end}`));
  const changed = structuredClone(profile); changed.records.projects[0].end = '2022-03';
  const conflict = await run('fillRecord', { collection: 'projects', recordId: projects[0].id, profile: changed, resetTransaction: false });
  check('existing end-date conflict requires confirmation', conflict.requiresConfirmation && conflict.filled.length === 0 && dates(rows()[0])[1] === projects[0].end);
  check('batch undo preserves existing project and removes only added groups', (await run('undo')).failedCount === 0 && JSON.stringify(snapshot()) === initial);
  const ongoing = structuredClone(profile); ongoing.records.projects = [{ ...projects[0], end: '' }];
  const ongoingResult = await run('fillRecord', { collection: 'projects', recordId: projects[0].id, profile: ongoing });
  check('missing personal end month is left blank without inference', ongoingResult.filled.length === 1 && dates(rows()[0])[0] === projects[0].start && dates(rows()[0])[1] === 'YYYY-MM');
  check('ongoing date undo restores original record', (await run('undo')).failedCount === 0 && JSON.stringify(snapshot()) === initial);
  check('other sections remain untouched', [...document.querySelectorAll('[data-kind]:not([data-kind="project"]) input, [data-kind]:not([data-kind="project"]) textarea')].map(el => el.value).join('|') === originalOthers);
  return { adapter: 'feishu-projects', checks, timings };
}
