import { siteProfile } from '/src/shared/schema.js';

export async function runCompetitions() {
  if (location.hostname !== '127.0.0.1') throw new Error('Anonymous fixture only');
  const checks = [], timings = [];
  const check = (name, ok) => { if (!ok) throw new Error(name); checks.push(name); globalThis.__recordProgress = { checks: [...checks] }; };
  const awards = Array.from({ length: 14 }, (_, i) => ({ id: `anonymous.award.${i}`, name: i ? `用户匿名奖项${i}` : '匿名竞赛0', description: `匿名奖项描述${i}`, fieldOptions: { name: i ? [`匿名竞赛${i}`, '其他'] : ['其他'] } }));
  const profile = siteProfile({ entries: [], records: { awards } });
  const settings = { overwriteExisting: false, confidenceThreshold: 78, rejectedMatches: [] };
  const rows = () => [...document.querySelector('#rows').children];
  const state = () => rows().map(r => [r.querySelector('.ud__select__selector__selectItem').textContent, r.querySelector('textarea').value]);
  const initial = JSON.stringify(state());
  const decoy = document.querySelector('.apply-form-array-card__decoy');
  const decoyState = () => [...decoy.querySelectorAll('input,textarea')].map(el => el.value).join('|');
  const originalDecoy = decoyState();
  const run = (command, payload = {}) => new Promise((resolve, reject) => {
    const started = performance.now(), timer = setTimeout(() => reject(new Error(`${command} timeout`)), 114000);
    globalThis.__resumeHelperListener({ type: 'RESUME_HELPER_COMMAND', command, payload: { profile, settings, ...payload } }, null, result => {
      clearTimeout(timer); timings.push({ command, ms: Math.round(performance.now() - started) });
      result?.error ? reject(new Error(result.error)) : resolve(result);
    });
  });
  const single = await run('fillRecord', { collection: 'awards', recordId: awards[0].id });
  check('single award maps competition name and bare description', single.filled.length === 2 && state()[0][1] === awards[0].description);
  check('primary exact name precedes user alternative', state()[0][0] === awards[0].name);
  check('repeat single does not add or rewrite', (await run('fillRecord', { collection: 'awards', recordId: awards[0].id, resetTransaction: false })).filled.length === 0 && rows().length === 5);
  check('single undo restores original five blank groups', (await run('undo')).failedCount === 0 && JSON.stringify(state()) === initial);
  const batch = await run('fillCollection', { collection: 'awards' });
  check('14 awards reuse blank groups and add only nine', batch.filled.length === 28 && rows().length === 14);
  check('per-record ordered candidates remain independent', state().every((v, i) => v[0] === `匿名竞赛${i}` && v[1] === awards[i].description));
  check('repeat candidate-selected record has no duplicate', (await run('fillRecord', { collection: 'awards', recordId: awards[1].id, resetTransaction: false })).filled.length === 0 && rows().length === 14);
  const changed = structuredClone(profile); changed.records.awards[0].description = '用户新描述';
  const conflict = await run('fillRecord', { collection: 'awards', recordId: awards[0].id, profile: changed, resetTransaction: false });
  check('description conflict requires explicit confirmation', conflict.requiresConfirmation && conflict.filled.length === 0 && state()[0][1] === awards[0].description);
  check('other module remains untouched', decoyState() === originalDecoy);
  check('whole batch undo restores original groups and select display', (await run('undo')).failedCount === 0 && JSON.stringify(state()) === initial);
  const missing = siteProfile({ entries: [], records: { awards: [{ id: 'anonymous.missing', name: '不在菜单的匿名名称', description: '名称失败后仍填描述' }, awards[1]] } });
  const partial = await run('fillCollection', { collection: 'awards', profile: missing });
  check('unknown name reports failure without choosing Other or hidden stale option', partial.skipped.length > 0 && state()[0][0] === '');
  check('name failure still fills description and continues next record', state()[0][1] === '名称失败后仍填描述' && state()[1][0] === '匿名竞赛1');
  check('search query is never counted as a committed competition name', state()[0][0] === '' && !partial.filled.some(item => item.value === '不在菜单的匿名名称'));
  check('partial batch undo restores blank groups', (await run('undo')).failedCount === 0 && JSON.stringify(state()) === initial);
  await run('fillCollection', { collection: 'awards' });
  rows()[13].querySelector('textarea').value = '用户后来修改';
  const protectedUndo = await run('undo');
  check('undo preserves user later change and its added group', protectedUndo.failedCount > 0 && state().some(v => v[1] === '用户后来修改') && decoyState() === originalDecoy);
  return { adapter: 'ud-competitions', checks, timings };
}
