// Anonymous reproduction of the public 3PEAK Moka headings and controls.
import { siteProfile } from '/src/shared/schema.js';

export async function runThreePeak() {
  if (location.hostname !== '127.0.0.1') throw new Error('Anonymous fixture only');
  const checks = [], timings = [];
  const check = (name, ok) => { if (!ok) throw new Error(name); checks.push(name); globalThis.__recordProgress = { checks: [...checks] }; };
  const papers = [0, 1].map(i => ({ id: `anonymous.paper.${i}`, name: `虚构论文${i}`, venue: i ? '' : '匿名示例刊物', publishedAt: `${2023 + i}-09-05`, authorOrder: '用户指定作者表达', fieldOptions: { authorOrder: [i ? '第二作者' : '第一作者'] } }));
  const awards = Array.from({ length: 14 }, (_, i) => ({ id: `anonymous.award.${i}`, name: `虚构奖项${i}`, awardCategory: i % 2 ? '荣誉称号' : '竞赛获奖', start: `${2001 + i}-06-20` }));
  const profile = siteProfile({ entries: [], records: { papers, awards } });
  const settings = { overwriteExisting: false, confidenceThreshold: 78, rejectedMatches: [] };
  const rows = id => Array.from(document.querySelector(`[data-nav-id="${id}"]`).children).filter(e => e.matches('.apply-fields-test'));
  const state = id => rows(id).map(r => Array.from(r.querySelectorAll('input,textarea'), e => e.value));
  const paperId = 'block-82482', awardId = 'block-99952';
  const initial = JSON.stringify([state(paperId), state(awardId)]);
  const run = (command, payload = {}) => new Promise((resolve, reject) => {
    const started = performance.now(), timer = setTimeout(() => reject(new Error(`${command} timeout`)), 114000);
    globalThis.__resumeHelperListener({ type: 'RESUME_HELPER_COMMAND', command, payload: { profile, settings, ...payload } }, null, result => {
      clearTimeout(timer); timings.push({ command, ms: Math.round(performance.now() - started) });
      result?.error ? reject(new Error(result.error)) : resolve(result);
    });
  });
  const single = await run('fillRecord', { collection: 'papers', recordId: papers[0].id });
  check('renamed journal section accepts one paper', single.filled.length === 5 && rows(paperId).length === 1);
  check('publication year and month both read back', state(paperId)[0][0] === '2023' && state(paperId)[0][1] === '9');
  check('author uses only this records candidate', state(paperId)[0][2] === '第一作者');
  check('venue and article title map to the right fields', state(paperId)[0][3] === papers[0].venue && state(paperId)[0][4] === papers[0].name);
  check('repeat paper does not duplicate or confuse day with month precision', (await run('fillRecord', { collection: 'papers', recordId: papers[0].id, resetTransaction: false })).filled.length === 0 && rows(paperId).length === 1);
  check('single paper undo restores both date parts', (await run('undo')).failedCount === 0 && JSON.stringify([state(paperId), state(awardId)]) === initial);
  const batch = await run('fillCollection', { collection: 'papers' });
  check('paper batch adds exactly two groups', rows(paperId).length === 2 && batch.filled.length === 9);
  check('missing personal venue remains empty', state(paperId)[1][3] === '' && state(paperId)[1][2] === '第二作者');
  const changed = structuredClone(profile); changed.records.papers[0].publishedAt = '2022-04-01';
  const conflict = await run('fillRecord', { collection: 'papers', recordId: papers[0].id, resetTransaction: false, profile: changed });
  check('split publication date conflict requires confirmation', conflict.requiresConfirmation && conflict.filled.length === 0 && state(paperId)[0][0] === '2023');
  check('paper batch undo removes only added groups', (await run('undo')).failedCount === 0 && rows(paperId).length === 1 && JSON.stringify(state(paperId)) === JSON.stringify(JSON.parse(initial)[0]));
  const awardsResult = await run('fillCollection', { collection: 'awards' });
  check('renamed single awards section receives all 14 awards', rows(awardId).length === 14 && awardsResult.filled.length === 42);
  check('all award dates and names read back', state(awardId).every((v, i) => v[0] === String(2001 + i) && v[1] === '6' && v[2] === awards[i].name));
  check('award repeat does not add a duplicate group', (await run('fillRecord', { collection: 'awards', recordId: awards[0].id, resetTransaction: false })).filled.length === 0 && rows(awardId).length === 14);
  check('patent section is never treated as a paper or an award', document.querySelector('[data-nav-id="block-128259"] input').value === '' && rows('block-128259').length === 1);
  check('whole awards batch undo restores original blank group', (await run('undo')).failedCount === 0 && JSON.stringify([state(paperId), state(awardId)]) === initial);
  return { adapter: 'mokahr-3peak', checks, timings };
}
