import { readLinkedProfile } from "./profile-file.js";
import { previewProfileMigration, saveProfile, validateProfile } from "./storage.js";
import { buildProfileLibraryEntries } from "./profile-view.js";

// Only a successful file read may supply a new operation's personal data.
// The returned profile is the operation's snapshot, independent of later reads.
export async function readCanonicalProfileSnapshot({ readLinked = readLinkedProfile, cache = saveProfile } = {}) {
  const linked = await readLinked();
  if (!linked?.linked) throw new Error("尚未关联 JSON 主档，请在资料设置中加载并关联资料文件。");
  if (!linked.readable) {
    throw new Error(`无法读取 ${linked.name || "JSON 主档"}${linked.reason ? `：${linked.reason}` : ""}`);
  }
  let profile;
  let migrationReport;
  try {
    const parsed = JSON.parse(linked.text);
    validateProfile(parsed);
    ({ profile, report: migrationReport } = previewProfileMigration(parsed));
    validateProfile(profile);
  } catch (error) {
    throw new Error(`JSON 主档无法使用：${error.message}`);
  }
  if (cache) {
    try { await cache(profile); }
    catch (error) { throw new Error(`JSON 主档已成功读取，但 Chrome 工作副本更新失败：${error.message}`); }
  }
  return { profile, name: linked.name || "JSON 主档", revision: linked.revision || "", migrationReport, sourceText: linked.text };
}

export function resolveCanonicalEntry(profile, reference) {
  reference ||= {};
  const entries = buildProfileLibraryEntries(profile).flatMap((entry) => [entry, ...(entry.children || [])]);
  const wantedId = reference?.id;
  const wantedSource = reference?.sourceId;
  const matches = entries.filter((entry) =>
    (wantedId ? entry.id === wantedId : wantedSource && entry.sourceId === wantedSource)
    && (!reference.parentSourceId || entry.parentSourceId === reference.parentSourceId)
    && (!reference.recordCollection || entry.recordCollection === reference.recordCollection));
  if (matches.length !== 1) {
    const parent = reference?.parentSourceId && Object.values(profile.records || {}).flat()
      .find((record) => record?.id === reference.parentSourceId);
    const key = reference?.recordField || (parent && wantedId?.startsWith(`${parent.id}.`) ? wantedId.slice(parent.id.length + 1) : "");
    if (parent && Object.hasOwn(parent, key) && !String(parent[key] || "").trim()) {
      throw new Error("这条资料在 JSON 主档中没有填写内容。");
    }
    throw new Error("这条资料已从 JSON 主档删除或标识发生变化，请重新选择资料。");
  }
  return matches[0];
}

// Verification belongs to the original fill, even if the main file is missing
// or has changed. Keep its expected values and field vocabulary in the snapshot.
export function verificationProfileFromExpectations(expectations = []) {
  const entries = new Map();
  for (const expectation of expectations) {
    if (!expectation?.entryId) continue;
    const entry = entries.get(expectation.entryId) || {
      id: expectation.entryId,
      label: expectation.label || expectation.field || "原填写资料",
      value: String(expectation.expectedValue || ""),
      aliases: []
    };
    entry.aliases = [...new Set([...entry.aliases, expectation.field, expectation.label].filter(Boolean))];
    entries.set(entry.id, entry);
  }
  return { entries: [...entries.values()], records: {} };
}
