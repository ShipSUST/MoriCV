import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

async function assertReadOnlyPreview(script) {
  const directory = await mkdtemp(path.join(tmpdir(), 'mori-cv-cli-preview-'));
  try {
    const profilePath = path.join(directory, 'anonymous.json');
    const personalValue = 'anonymous-source-value-must-not-be-printed';
    const sourceText = JSON.stringify({ schemaVersion: 8, entries: [
      { id: 'legacy.public', category: '基本信息', label: '旧条目', value: personalValue, aliases: [] },
      { id: 'basic.name', category: '基本信息', label: '姓名', value: personalValue, aliases: [], pathValues: [['旧路径']] },
      { id: 'career.minimum_salary', category: '求职偏好', label: '最低月薪', value: personalValue, aliases: [] },
      { id: 'career.salary_negotiable', category: '求职偏好', label: '期望薪资选项', value: 'another-anonymous-source-value', aliases: [] }
    ], records: {} }, null, 2) + '\r\n';
    await writeFile(profilePath, sourceText);
    const run = args => spawnSync(process.execPath, [path.join(projectRoot, 'scripts', script), ...args], { cwd: projectRoot, encoding: 'utf8' });
    const preview = run([profilePath]);
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /source file unchanged/);
    const report = JSON.parse(preview.stdout.slice(preview.stdout.indexOf('{')));
    assert.equal(report.toVersion, 9);
    assert.equal(report.removed.length, 2);
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.requiresReview, true);
    assert.equal((preview.stdout + preview.stderr).includes(personalValue), false);
    assert.equal((preview.stdout + preview.stderr).includes('another-anonymous-source-value'), false);
    assert.equal(await readFile(profilePath, 'utf8'), sourceText);
    assert.deepEqual(await readdir(directory), ['anonymous.json']);
    for (const target of [profilePath, path.join(directory, 'does-not-exist.json')]) {
      const refused = run([target, '--write']);
      assert.notEqual(refused.status, 0);
      assert.match(refused.stderr, /--write/);
      assert.match(refused.stderr, /设置页/);
      assert.match(refused.stderr, /备份/);
      assert.match(refused.stderr, /版本/);
      assert.doesNotMatch(refused.stderr, /ENOENT/);
      assert.equal((refused.stdout + refused.stderr).includes(personalValue), false);
      assert.equal(await readFile(profilePath, 'utf8'), sourceText);
      assert.deepEqual(await readdir(directory), ['anonymous.json']);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('v7 migration CLI previews removal and conflict metadata without writing and rejects --write before file access', async () => {
  await assertReadOnlyPreview('migrate-profile-v7.mjs');
});

test('legacy v5 migration CLI has the same read-only preview and write refusal', async () => {
  await assertReadOnlyPreview('migrate-profile-v5.mjs');
});
