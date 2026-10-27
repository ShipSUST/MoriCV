import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

// 本地匿名侧栏预览，只读检查 DOM，不访问招聘页或私人 JSON。
const endpoint = process.env.RESUME_HELPER_CDP || 'http://127.0.0.1:9337';
const origin = process.env.RESUME_HELPER_FIXTURE_ORIGIN || 'http://127.0.0.1:4185';
assert.equal(new URL(endpoint).hostname, '127.0.0.1'); assert.equal(new URL(origin).hostname, '127.0.0.1');
const example = JSON.parse(await readFile(new URL('../src/examples/mori-cv-profile-example.json', import.meta.url), 'utf8'));
const target = await (await fetch(`${endpoint}/json/new?${encodeURIComponent(`${origin}/preview-example`)}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl), pending = new Map(); let id = 0;
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data), promise = pending.get(message.id); if (!promise) return;
  pending.delete(message.id); message.error ? promise.reject(new Error(message.error.message)) : promise.resolve(message.result);
});
const send = (method, params) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
try {
  let cards = [];
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await send('Runtime.evaluate', { expression: `Array.from(document.querySelectorAll('.category-card')).map(card=>({title:card.querySelector('h3')?.textContent,count:card.querySelector('.count')?.textContent,batch:card.querySelector('.batch')?.textContent,rows:card.querySelectorAll('.entry-row').length}))`, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    cards = result.result.value || []; if (cards.length) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(cards.length, 'Side panel must actually render');
  assert.equal(cards.some(card => ['competitions', 'honors'].includes(card.title)), false, 'Internal site subsets leaked into UI');
  const awards = cards.filter(card => card.title === '奖项荣誉');
  assert.equal(awards.length, 1, 'Exactly one Chinese awards group must render');
  assert.equal(awards[0].batch, `批量填入（${example.records.awards.length}）`, 'Canonical awards batch button must render');
  assert.equal(awards[0].rows, example.records.awards.length, 'Every award is visible once');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(new URL('../test-results/v8-runtime/library-ui-v1114.png', import.meta.url), Buffer.from(screenshot.data, 'base64'));
  const evidence = { verifiedAt: new Date().toISOString(), anonymous: true, cards, checks: ['Chinese awards group', 'canonical batch button', 'no internal groups', 'no duplicated records'] };
  await writeFile(new URL('../test-results/v8-runtime/library-ui-v1114.json', import.meta.url), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { socket.close(); await fetch(`${endpoint}/json/close/${target.id}`); }
