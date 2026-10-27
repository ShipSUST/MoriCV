import test from "node:test";
import assert from "node:assert/strict";
import { fileRevision, writeProfileHandle } from "../src/shared/profile-file.js";

const file = (text) => ({ lastModified: 42, size: text.length, text: async () => text });
const handle = (text, permission = "granted") => ({
  name: "anonymous.json",
  queryPermission: async () => permission,
  requestPermission: async () => permission,
  getFile: async () => file(text)
});

test("file revision detects content changes even with identical timestamp and size", async () => {
  assert.notEqual(await fileRevision(file("abc")), await fileRevision(file("abd")));
  assert.equal(await fileRevision(file("abc")), await fileRevision(file("abc")));
});

test("external content change blocks writable creation", async () => {
  const target = handle("abd");
  target.createWritable = () => { throw new Error("must not write"); };
  const result = await writeProfileHandle(target, {}, await fileRevision(file("abc")));
  assert.equal(result.conflict, true);
  assert.equal(result.synced, false);
});

test("permission loss never starts a write", async () => {
  const target = handle("abc", "denied");
  target.createWritable = () => { throw new Error("must not write"); };
  assert.equal((await writeProfileHandle(target, {})).synced, false);
});

test("failed JSON write rejects instead of reporting synchronized", async () => {
  const target = handle("abc");
  target.createWritable = async () => ({ write: async () => { throw new Error("disk failure"); }, close: async () => {} });
  await assert.rejects(writeProfileHandle(target, {}), /disk failure/);
});

test("successful write closes before reading back its revision", async () => {
  let text = "abc";
  let closed = false;
  const target = handle(text);
  target.getFile = async () => file(text);
  target.createWritable = async () => ({ write: async (value) => { text = value; }, close: async () => { closed = true; } });
  const result = await writeProfileHandle(target, { schemaVersion: 7 });
  assert.equal(closed, true);
  assert.equal(result.synced, true);
  assert.equal(result.revision, await fileRevision(file(text)));
});

test('successful linked write serializes fixed values without runtime vocabulary', async () => {
  const { migrateProfile } = await import('../src/shared/storage.js');
  const runtime = migrateProfile({ schemaVersion: 8, entries: [{ id: 'basic.name', category: '基本信息', label: '姓名', value: '虚构姓名', aliases: [] }], records: {} });
  let writtenText = '';
  const target = handle('original');
  target.getFile = async () => file(writtenText || 'original');
  target.createWritable = async () => ({ write: async text => { writtenText = text; }, close: async () => {} });
  assert.equal((await writeProfileHandle(target, runtime)).synced, true);
  const row = JSON.parse(writtenText).entries.find(entry => entry.id === 'basic.name');
  assert.deepEqual(row, { id: 'basic.name', value: '虚构姓名' });
  assert.equal(runtime.entries[0].label, '姓名');
});
