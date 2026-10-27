import { DEFAULT_PROFILE } from "../data/default-profile.js";
import { RECORD_COLLECTIONS, RECORD_SCHEMAS, SCHEMA_VERSION, normalizePathValues } from "./schema.js";
import { FIXED_FIELDS, fixedField } from './ordinary-fields.js';

export const PROFILE_KEY = "resumeHelperProfileV1";
export const SETTINGS_KEY = "resumeHelperSettingsV1";
export const SNAPSHOT_KEY = "resumeHelperSnapshotsV1";
export const PROFILE_BACKUP_KEY = "resumeHelperProfileBackupBeforeV5";
export const PROFILE_BACKUP_V6_KEY = "resumeHelperProfileBackupBeforeV6";
export const PROFILE_BACKUP_V7_KEY = "resumeHelperProfileBackupBeforeV7";
export const PROFILE_BACKUP_KEYS = [PROFILE_BACKUP_KEY, PROFILE_BACKUP_V6_KEY, PROFILE_BACKUP_V7_KEY];

// 置信度三档预设；阈值本身仍是 0–100 的连续数值，高级设置可以直接填数字。
export const CONFIDENCE_PRESETS = Object.freeze([
  { key: "conservative", label: "保守", value: 88 },
  { key: "standard", label: "标准", value: 78 },
  { key: "sensitive", label: "灵敏", value: 60 }
]);

export const DEFAULT_SETTINGS = Object.freeze({
  overwriteExisting: false,
  confidenceThreshold: 78,
  // 侧栏「否决候补」记住的组合，键为 normalize(字段名)::词条 ID。
  rejectedMatches: []
});

const MAX_REJECTED_MATCHES = 500;

export function normalizeRejectedMatches(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string" && item.includes("::")))].slice(-MAX_REJECTED_MATCHES);
}

export function normalizeConfidence(value, fallback = DEFAULT_SETTINGS.confidenceThreshold) {
  const number = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, Math.round(number)));
}

export function confidencePresetFor(value) {
  return CONFIDENCE_PRESETS.find((preset) => preset.value === Number(value))?.key || "custom";
}

export function createCustomProfileEntry(id = `custom.${crypto.randomUUID().slice(0, 8)}`) {
  return {
    id,
    category: "其他",
    label: "新资料",
    value: "",
    aliases: []
  };
}

// v5 及更早版本的集合，迁移时并入 v6 的 awards。
const LEGACY_COLLECTIONS = RECORD_SCHEMAS.flatMap(schema => schema.generic?.legacyCollections || []);

// Legacy flat-to-record metadata belongs to each category; orchestration remains here.
const STRUCTURED_ENTRY_MAP = Object.fromEntries(RECORD_SCHEMAS.flatMap(schema =>
  Object.entries(schema.legacyEntries || {}).map(([id, [selector, key]]) => [id, [schema.key, selector, key]])));

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeRecordCollections(profile, previousVersion) {
  const source = profile.records && typeof profile.records === "object" ? profile.records : {};
  profile.records = {};
  for (const key of RECORD_COLLECTIONS) {
    profile.records[key] = Array.isArray(source[key]) ? source[key] : [];
  }
  // v5 的两个旧奖项集合仅保留到 v6 合并步骤；schema v7 删除其它未知记录集合。
  if (previousVersion < 6) {
    for (const key of LEGACY_COLLECTIONS) {
      if (Array.isArray(source[key])) profile.records[key] = source[key];
    }
  }
}

function allRecordCollections(profile) {
  return Object.keys(profile.records).filter((key) => Array.isArray(profile.records[key]));
}

function uniqueRecordId(profile, preferred) {
  const used = new Set(allRecordCollections(profile).flatMap((key) => profile.records[key].map((record) => record?.id)));
  let id = preferred;
  for (let index = 2; used.has(id); index += 1) id = `${preferred}_${index}`;
  return id;
}

// v5 → v6：竞赛 + 荣誉合并为 awards；外语记录中的证书拆到 certifications。所有字段值逐字保留。
function migrateRecordsToV6(profile) {
  const records = profile.records;
  const legacyAwards = [
    ...(records.competitions || []).map((record) => ["竞赛获奖", record]),
    ...(records.honors || []).map((record) => ["荣誉称号", record])
  ];
  for (const [awardCategory, legacy] of legacyAwards) {
    const { current, ...award } = legacy || {};
    if (current) award.current = current;
    records.awards.push({ id: award.id, awardCategory, ...award });
  }
  for (const key of LEGACY_COLLECTIONS) delete records[key];

  for (const language of records.foreignLanguages) {
    if (!language || !(language.certification || language.score)) continue;
    const suffix = String(language.id || "").replace(/^foreign\./, "") || crypto.randomUUID().slice(0, 8);
    const cert = { id: uniqueRecordId(profile, `cert.${suffix}`), name: language.certification || "", certType: "外语" };
    if (language.score) cert.score = language.score;
    const aliases = language.fieldAliases || {};
    const certAliases = {};
    if (aliases.certification) certAliases.name = aliases.certification;
    if (aliases.score) certAliases.score = aliases.score;
    if (Object.keys(certAliases).length) cert.fieldAliases = certAliases;
    records.certifications.push(cert);
    delete language.certification;
    delete language.score;
    if (language.fieldAliases) {
      delete language.fieldAliases.certification;
      delete language.fieldAliases.score;
      if (!Object.keys(language.fieldAliases).length) delete language.fieldAliases;
    }
  }
}

// v6 把「技能证书」拆成技术技能 / 资格证书；个别旧条目的大类放错了，按 id 归位。
const V6_ENTRY_CATEGORY = {
  "skills.certificates_summary": "资格证书",
  "skills.summary": "技术技能",
  "profile.github": "基本信息"
};

function migrateEntryToV6(entry) {
  delete entry.sensitive;
  if (V6_ENTRY_CATEGORY[entry.id]) entry.category = V6_ENTRY_CATEGORY[entry.id];
  else if (entry.category === "技能证书") entry.category = /证书|证照|资格/.test(entry.label) ? "资格证书" : "技术技能";
  // 「亲属关系」现在是独立大类，这个是非题条目不再占用该别名。
  if (entry.id === "relation.company") entry.aliases = (entry.aliases || []).filter((alias) => alias !== "亲属关系");
}

const V7_SINGLE_CATEGORIES = new Set(["基本信息", "求职偏好"]);
const V7_SUMMARY_ENTRY_IDS = new Set([
  "awards.summary",
  "skills.certificates_summary",
  "skills.summary",
  "experience.campus_summary",
  "profile.self_evaluation"
]);

function migrateRecordsToV7(profile) {
  for (const language of profile.records.foreignLanguages || []) {
    if (!language || typeof language !== "object") continue;
    if (!language.proficiency && language.level) language.proficiency = language.level;
    delete language.level;
    if (language.fieldAliases?.level) {
      language.fieldAliases.proficiency = uniqueStrings([
        ...(language.fieldAliases.proficiency || []),
        ...language.fieldAliases.level
      ]);
      delete language.fieldAliases.level;
    }
    if (language.fieldOptions?.level) {
      language.fieldOptions.proficiency = uniqueStrings([
        ...(language.fieldOptions.proficiency || []),
        ...language.fieldOptions.level
      ]);
      delete language.fieldOptions.level;
    }
  }
}

function recordForMapping(profile, collection, selector, entry) {
  const records = profile.records[collection];
  let record = typeof selector === "number" ? records[selector] : records.find((item) => item?.id === selector);
  if (record) return record;
  const id = typeof selector === "string"
    ? selector
    : `${collection.replace(/s$/, "")}.${crypto.randomUUID().slice(0, 8)}`;
  record = { id, displayName: entry.label || "迁移记录" };
  records.push(record);
  return record;
}

function migrateRecordsToV8(profile) {
  profile.recordTemplates ||= {};
  // 用户要求直接丢弃教育旧字段，而非重命名/迁入新字段。其它集合的 current 不受影响。
  const removedEducationFields = ['entranceExamScore', 'entranceExamRank', 'current'];
  for (const bag of ['fieldAliases', 'fieldOptions']) {
    for (const key of removedEducationFields) delete profile.recordTemplates.educations?.[bag]?.[key];
  }
  // 同一学习形式字段：保留现有主值，旧教育类型作为候选；只迁移运行副本。
  const educationAliases = profile.recordTemplates.educations?.fieldAliases;
  if (educationAliases?.educationType) {
    educationAliases.studyType = uniqueStrings([...(educationAliases.studyType || []), ...educationAliases.educationType]);
    delete educationAliases.educationType;
  }
  for (const education of profile.records.educations || []) {
    for (const key of removedEducationFields) {
      delete education[key];
      for (const bag of ['fieldAliases', 'fieldOptions']) delete education[bag]?.[key];
    }
    education.unifiedExamScore ??= '';
    education.professionalCourses ??= '';
    const oldType = education.educationType;
    if (!education.studyType && oldType != null) education.studyType = oldType;
    if ((oldType && oldType !== education.studyType) || education.fieldOptions?.educationType) {
      education.fieldOptions ||= {};
      education.fieldOptions.studyType = uniqueStrings([
        ...(education.fieldOptions.studyType || []),
        ...(oldType && oldType !== education.studyType ? [oldType] : []),
        ...(education.fieldOptions.educationType || [])
      ]);
    }
    delete education.educationType;
    if (education.fieldOptions) delete education.fieldOptions.educationType;
    if (education.fieldAliases?.educationType) {
      education.fieldAliases.studyType = uniqueStrings([
        ...(education.fieldAliases.studyType || []), ...education.fieldAliases.educationType
      ]);
      delete education.fieldAliases.educationType;
    }
    if (education.degree != null) {
      if (education.educationLevel && education.degree && education.educationLevel !== education.degree) {
        throw new Error(`记录 ${education.id} 的旧学历与新学历冲突，请先处理资料文件`);
      }
      education.educationLevel ||= education.degree;
      delete education.degree;
    }
    education.academicDegree ??= "";
    for (const bag of ["fieldAliases", "fieldOptions"]) {
      if (education[bag]?.degree) {
        education[bag].educationLevel = uniqueStrings([...(education[bag].educationLevel || []), ...education[bag].degree])
          .filter((value) => bag !== "fieldAliases" || !/^学位$/.test(value));
        delete education[bag].degree;
      }
    }
  }
  for (const [collection, records] of Object.entries(profile.records)) {
    for (const record of records) {
      for (const [key, aliases] of Object.entries(record.fieldAliases || {})) {
        profile.recordTemplates[collection] ||= { fieldAliases: {} };
        profile.recordTemplates[collection].fieldAliases ||= {};
        profile.recordTemplates[collection].fieldAliases[key] = uniqueStrings([
          ...(profile.recordTemplates[collection].fieldAliases[key] || []), ...aliases
        ]);
      }
      delete record.fieldAliases;
    }
  }
}

function validateRecordPaths(record) {
  if (record.fieldPaths === undefined) return;
  if (!record.fieldPaths || typeof record.fieldPaths !== "object" || Array.isArray(record.fieldPaths)) {
    throw new Error(`记录 ${record.id} 的 fieldPaths 必须是对象。`);
  }
  for (const [key, path] of Object.entries(record.fieldPaths)) {
    if (!key.trim() || !Array.isArray(path) || path.some((level) => !Array.isArray(level) || !level.length
      || level.some((value) => typeof value !== "string" || !value.trim()))) {
      throw new Error(`记录 ${record.id} 的字段 ${key} 级联路径格式错误。`);
    }
  }
}

function normalizeRecordPaths(profile) {
  for (const records of Object.values(profile.records)) {
    for (const record of records) {
      validateRecordPaths(record);
      if (!record.fieldPaths) continue;
      const paths = Object.fromEntries(Object.entries(record.fieldPaths)
        .map(([key, path]) => [key, normalizePathValues(path)])
        .filter(([, path]) => path.length));
      if (Object.keys(paths).length) record.fieldPaths = paths;
      else delete record.fieldPaths;
    }
  }
}

const LEGACY_FIXED_IDS = { 'career.minimum_salary': 'career.expected_salary', 'career.salary_negotiable': 'career.expected_salary' };
const OTHER_SUMMARY_IDS = new Set(['skills.summary', 'skills.certificates_summary', 'awards.summary', 'experience.campus_summary']);
const OTHER_SUMMARY_LABELS = new Set(['职业规划', '技能证书汇总', '奖项荣誉汇总', '校园工作经历', '技能汇总']);

function sourceInfo(entry) {
  return { sourceId: entry.id, label: entry.label, category: entry.category };
}

function fixedAndOtherEntries(entries, report) {
  const groups = new Map(FIXED_FIELDS.map(field => [field.id, []]));
  const blocked = new Set();
  const other = [];
  const ids = new Set(FIXED_FIELDS.map(field => field.id));
  const preserve = (entry, reason, targetId, conflictingFields = []) => {
    let id = entry.id;
    if (!id || ids.has(id)) {
      const base = `other.quarantine.${id || 'entry'}`;
      id = base;
      for (let n = 2; ids.has(id); n++) id = `${base}.${n}`;
    }
    ids.add(id);
    other.push({ id, category: '其他', label: entry.label || '未命名条目', value: entry.value || '', aliases: [] });
    if (reason) report.quarantined.push({ ...sourceInfo(entry), targetId: id, reason, ...(targetId ? { fixedId: targetId } : {}) });
    const fields = ['optionValues', 'pathValues'].filter(key => entry[key]?.length);
    const supported = fields.filter(key => conflictingFields.some(field => key === 'optionValues' ? field.supportsOptions : field.supportsPath));
    if (supported.length) {
      const config = Object.fromEntries(supported.map(key => [key, entry[key]]));
      preserve({ id: `${id}.configuration`, category: '其他', label: `${entry.label || '资料'}（原选择配置）`, value: JSON.stringify(config) }, 'preserved-configuration', targetId);
    }
    const removed = fields.filter(key => !supported.includes(key));
    if (removed.length) report.removed.push({ ...sourceInfo(entry), reason: 'unsupported-configuration', fields: removed, ...(targetId ? { targetId } : {}) });
    return id;
  };
  for (const entry of entries) {
    if (report.fromVersion >= 9 && entry.category === '其他' && !fixedField(entry.id)) { preserve(entry); continue; }
    if (entry.id === 'profile.github') {
      report.removed.push({ ...sourceInfo(entry), reason: 'removed-github' });
      continue;
    }
    const byId = fixedField(entry.id) || fixedField(LEGACY_FIXED_IDS[entry.id]);
    const byLabel = report.fromVersion < 9 && V7_SINGLE_CATEGORIES.has(entry.category)
      ? FIXED_FIELDS.find(field => field.label === entry.label) : null;
    if (byId && byLabel && byId.id !== byLabel.id) {
      blocked.add(byId.id); blocked.add(byLabel.id);
      report.conflicts.push({ ...sourceInfo(entry), targetIds: [byId.id, byLabel.id], reason: 'id-label-disagreement' });
      preserve(entry, 'id-label-disagreement', undefined, [byId, byLabel]);
      continue;
    }
    const field = byId || byLabel;
    if (field && ((!byId && byLabel) || (report.fromVersion < 9 && entry.category !== field.category))) {
      report.moves.push({ ...sourceInfo(entry), targetId: field.id, targetCategory: field.category });
    }
    if (field) { groups.get(field.id).push(entry); continue; }
    if (OTHER_SUMMARY_IDS.has(entry.id) || OTHER_SUMMARY_LABELS.has(entry.label)) {
      const id = preserve(entry);
      report.moves.push({ ...sourceInfo(entry), targetId: id, targetCategory: '其他' });
      continue;
    }
    report.removed.push({ ...sourceInfo(entry), reason: 'unretained-field' });
  }
  const fixed = FIXED_FIELDS.map(field => {
    const sources = groups.get(field.id);
    const values = uniqueStrings(sources.map(entry => entry.value));
    const paths = field.supportsPath ? [...new Set(sources.filter(entry => entry.pathValues?.length).map(entry => JSON.stringify(entry.pathValues)))] : [];
    const conflict = values.length > 1 || paths.length > 1 || blocked.has(field.id);
    if (conflict) {
      if (!blocked.has(field.id)) report.conflicts.push({ targetId: field.id, label: field.label, sources: sources.map(sourceInfo), reason: values.length > 1 ? 'different-main-values' : 'different-paths' });
      for (const source of sources) preserve(source, 'conflicting-fixed-source', field.id, [field]);
    }
    if (!conflict) for (const source of sources) {
      const unsupported = {
        ...(!field.supportsOptions && source.optionValues?.length ? { optionValues: source.optionValues } : {}),
        ...(!field.supportsPath && source.pathValues?.length ? { pathValues: source.pathValues } : {})
      };
      if (Object.keys(unsupported).length) report.removed.push({ ...sourceInfo(source), targetId: field.id, reason: 'unsupported-configuration', fields: Object.keys(unsupported) });
    }
    const usable = conflict ? [] : sources;
    return {
      ...structuredClone(field), value: conflict ? '' : (sources.find(entry => entry.value.trim())?.value || ''),
      ...(field.supportsOptions ? { optionValues: uniqueStrings(usable.flatMap(entry => entry.optionValues || [])) } : {}),
      ...(field.supportsPath && usable.find(entry => entry.pathValues?.length)
        ? { pathValues: usable.find(entry => entry.pathValues?.length).pathValues } : {})
    };
  });
  return [...fixed, ...other];
}

export function previewProfileMigration(input) {
  const report = { fromVersion: Number(input?.schemaVersion) || 1, toVersion: SCHEMA_VERSION, moves: [], removed: [], conflicts: [], quarantined: [], requiresReview: false };
  const profile = migrateProfileWithReport(input, report);
  report.requiresReview = ['moves', 'removed', 'conflicts', 'quarantined'].some(key => report[key].length > 0);
  return { profile, report };
}

export function migrateProfile(input) { return previewProfileMigration(input).profile; }

function migrateProfileWithReport(input, report) {
  if (!input || !Array.isArray(input.entries)) return migrateProfileWithReport(structuredClone(DEFAULT_PROFILE), report);
  const profile = structuredClone(input);
  const previousVersion = Number(profile.schemaVersion) || 1;
  const legacyMasterPeriod = profile.entries.find((entry) => entry?.id === "education.master.period");
  profile.entries = profile.entries.filter((entry) => entry?.id !== 'education.master.period');
  normalizeRecordCollections(profile, previousVersion);
  if (previousVersion < 3 && Array.isArray(profile.records.educations)) {
    for (const education of profile.records.educations) {
      if (education?.educationType === "硕士" || education?.educationType === "本科") {
        education.educationType = "普通高等教育";
      }
    }
  }
  if (legacyMasterPeriod?.value) {
    const [start = "", end = ""] = String(legacyMasterPeriod.value).split(/\s*(?:至|—|–|-{2,})\s*/);
    let master = profile.records.educations.find((education) =>
      education?.id === "education.master" || /硕士/.test(String(education?.degree || ""))
    );
    if (!master) {
      master = { id: "education.master", displayName: legacyMasterPeriod.label || "硕士教育经历" };
      profile.records.educations.push(master);
    }
    if (!master.start && start) master.start = start.trim();
    if (!master.end && end) master.end = end.trim();
  }

  const recordsById = new Map();
  for (const key of allRecordCollections(profile)) {
    for (const record of profile.records[key]) {
      if (record?.id) recordsById.set(record.id, record);
    }
  }

  const portableEntries = [];
  for (const entry of profile.entries) {
    // These historical education fields were explicitly removed in v1.11.3;
    // do not revive them as schema9 manual notes.
    if (['education.master.entrance_exam_score', 'education.master.entrance_exam_rank'].includes(entry?.id)) continue;
    const {
      siteAliases: _siteAliases,
      batchAutofill: _batchAutofill,
      autofill: _autofill,
      ...portableEntry
    } = entry || {};
    if (portableEntry.id === "internship.period") {
      const record = recordForMapping(profile, "internships", 0, portableEntry);
      const [start = "", end = ""] = String(portableEntry.value || "").split(/\s*(?:至|—|–|-{2,})\s*/);
      if (!record.start && start) record.start = start.trim();
      if (!record.end && end) record.end = end.trim();
      continue;
    }
    const mapped = STRUCTURED_ENTRY_MAP[portableEntry.id];
    if (mapped) {
      const [collection, selector, field] = mapped;
      const record = recordForMapping(profile, collection, selector, portableEntry);
      if (!record[field] && portableEntry.value) record[field] = portableEntry.value;
      record.fieldAliases ||= {};
      record.fieldAliases[field] = uniqueStrings([
        ...(record.fieldAliases[field] || []),
        portableEntry.label,
        ...(portableEntry.aliases || [])
      ]);
      continue;
    }
    const record = recordsById.get(portableEntry.id);
    if (record) {
      if (!record.displayName && portableEntry.label) record.displayName = portableEntry.label;
      if (!record.summary && portableEntry.value) record.summary = portableEntry.value;
      record.aliases = uniqueStrings([...(record.aliases || []), ...(portableEntry.aliases || [])]);
      continue;
    }
    portableEntry.category = String(portableEntry.category || fixedField(portableEntry.id)?.category || "").trim();
    if (previousVersion < 6) {
      const savedCategory = portableEntry.category;
      migrateEntryToV6(portableEntry);
      if (V7_SINGLE_CATEGORIES.has(savedCategory)) portableEntry.category = savedCategory;
    }
    // Supply historic summary identity before the schema9 ordinary migration.
    if (previousVersion < 9 && !V7_SINGLE_CATEGORIES.has(portableEntry.category) && V7_SUMMARY_ENTRY_IDS.has(portableEntry.id)) portableEntry.category = "求职偏好";
    // Unretained ordinary fields are listed in the deletion preview below.
    portableEntry.label = String(portableEntry.label || "未命名条目");
    portableEntry.value = String(portableEntry.value || "");
    portableEntry.aliases = uniqueStrings(portableEntry.aliases);
    portableEntry.optionValues = uniqueStrings(portableEntry.optionValues);
    portableEntry.pathValues = normalizePathValues(portableEntry.pathValues || []);
    if (!portableEntry.pathValues.length) delete portableEntry.pathValues;
    portableEntries.push(portableEntry);
  }
  profile.entries = fixedAndOtherEntries(portableEntries, report);
  migrateRecordsToV6(profile);
  migrateRecordsToV7(profile);
  migrateRecordsToV8(profile);
  normalizeRecordPaths(profile);
  profile.schemaVersion = SCHEMA_VERSION;
  return profile;
}

export async function ensureSeededProfile() {
  const stored = await chrome.storage.local.get([PROFILE_KEY, SETTINGS_KEY]);
  const updates = {};
  if (!stored[PROFILE_KEY]) updates[PROFILE_KEY] = migrateProfile(DEFAULT_PROFILE);
  else {
    const migrated = migrateProfile(stored[PROFILE_KEY]);
    if (JSON.stringify(migrated) !== JSON.stringify(stored[PROFILE_KEY])) updates[PROFILE_KEY] = migrated;
  }
  if (!stored[SETTINGS_KEY]) updates[SETTINGS_KEY] = { ...DEFAULT_SETTINGS };
  if (Object.keys(updates).length) await chrome.storage.local.set(updates);
}

export async function getProfile() {
  await ensureSeededProfile();
  const stored = await chrome.storage.local.get(PROFILE_KEY);
  return stored[PROFILE_KEY];
}

export async function saveProfile(profile) {
  const migrated = migrateProfile(profile);
  validateProfile(migrated);
  await chrome.storage.local.set({ [PROFILE_KEY]: migrated });
}

export async function resetProfile() {
  await chrome.storage.local.set({ [PROFILE_KEY]: structuredClone(DEFAULT_PROFILE) });
  return getProfile();
}

export async function getSettings() {
  // 设置独立初始化，不借读取设置迁移或发布个人资料缓存。
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  if (!stored[SETTINGS_KEY]) await chrome.storage.local.set({ [SETTINGS_KEY]: { ...DEFAULT_SETTINGS } });
  const merged = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
  return { ...merged, confidenceThreshold: normalizeConfidence(merged.confidenceThreshold), rejectedMatches: normalizeRejectedMatches(merged.rejectedMatches) };
}

export async function saveSettings(settings) {
  const normalized = {
    overwriteExisting: Boolean(settings.overwriteExisting),
    confidenceThreshold: normalizeConfidence(settings.confidenceThreshold),
    rejectedMatches: normalizeRejectedMatches(settings.rejectedMatches)
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}

export async function getSnapshots() {
  const stored = await chrome.storage.session.get(SNAPSHOT_KEY);
  return stored[SNAPSHOT_KEY] || {};
}

export async function saveSnapshot(tabId, snapshot) {
  const snapshots = await getSnapshots();
  snapshots[String(tabId)] = snapshot;
  await chrome.storage.session.set({ [SNAPSHOT_KEY]: snapshots });
}

export async function getSnapshot(tabId) {
  const snapshots = await getSnapshots();
  return snapshots[String(tabId)] || null;
}

export function validateProfile(profile) {
  const versions = Array.from({ length: SCHEMA_VERSION }, (_, index) => index + 1);
  if (!profile || !versions.includes(profile.schemaVersion) || !Array.isArray(profile.entries)) {
    throw new Error(`资料文件格式错误：需要 schemaVersion=${versions.join("/")} 和 entries 数组。`);
  }
  const ids = new Set();
  for (const entry of profile.entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id.trim()) throw new Error("每个资料条目都必须有 id。");
    if (ids.has(entry.id)) throw new Error(`资料条目 id 重复：${entry.id}`);
    ids.add(entry.id);
    const fixed = profile.schemaVersion >= 9 && fixedField(entry.id);
    if ((!fixed && typeof entry.label !== "string") || typeof entry.value !== "string") {
      throw new Error(`资料条目 ${entry.id} 的 label 和 value 必须是字符串。`);
    }
    if (profile.schemaVersion < 9 && !Array.isArray(entry.aliases)) throw new Error(`资料条目 ${entry.id} 缺少 aliases 数组。`);
    if (profile.schemaVersion >= 9 && !fixed && entry.category !== '其他') throw new Error(`自定义普通资料只能属于其他：${entry.id}`);
    if (profile.schemaVersion >= 7 && profile.schemaVersion < 9 && !V7_SINGLE_CATEGORIES.has(entry.category)) {
      throw new Error(`schemaVersion≥7 的普通词条只能属于基本信息或求职偏好：${entry.id}`);
    }
    if (entry.pathValues !== undefined && !Array.isArray(entry.pathValues)) {
      throw new Error(`资料条目 ${entry.id} 的 pathValues 必须是数组。`);
    }
    if (entry.optionValues !== undefined && (!Array.isArray(entry.optionValues)
      || entry.optionValues.some(value => typeof value !== 'string'))) {
      throw new Error(`资料条目 ${entry.id} 的 optionValues 必须是字符串数组。`);
    }
    if (entry.pathValues?.some((level) => profile.schemaVersion >= 8
      ? !Array.isArray(level) || !level.length || level.some((value) => typeof value !== "string" || !value.trim())
      : typeof level !== "string" && (!Array.isArray(level) || level.some((value) => typeof value !== "string")))) {
      throw new Error(`资料条目 ${entry.id} 的级联路径格式错误。`);
    }
  }
  if (profile.recordTemplates !== undefined) {
    if (!profile.recordTemplates || typeof profile.recordTemplates !== "object" || Array.isArray(profile.recordTemplates)) throw new Error("recordTemplates 必须是对象。");
    for (const [collection, template] of Object.entries(profile.recordTemplates)) {
      if (!RECORD_COLLECTIONS.includes(collection) || !template || typeof template !== "object") throw new Error(`类别模板错误：${collection}`);
      for (const aliases of Object.values(template.fieldAliases || {})) {
        if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== "string")) throw new Error(`类别 ${collection} 的字段别名必须是字符串数组。`);
      }
    }
  }
  if (profile.schemaVersion >= 2) {
    if (!profile.records || typeof profile.records !== "object") throw new Error("schemaVersion≥2 需要 records 对象。");
    const recordIds = new Set();
    // 旧版本文件缺少的集合由迁移补齐；当前版本必须包含注册表内的全部集合。
    const required = profile.schemaVersion >= SCHEMA_VERSION ? RECORD_COLLECTIONS : [];
    if (profile.schemaVersion >= 7) {
      const unknown = Object.keys(profile.records).filter((key) => !RECORD_COLLECTIONS.includes(key));
      if (unknown.length) throw new Error(`schemaVersion≥7 不允许未知记录集合：${unknown.join("、")}`);
    }
    for (const key of new Set([...required, ...Object.keys(profile.records)])) {
      if (!Array.isArray(profile.records[key])) throw new Error(`records.${key} 必须是数组。`);
      for (const record of profile.records[key]) {
        if (!record || typeof record.id !== "string" || !record.id.trim()) throw new Error(`records.${key} 中每条记录都必须有 id。`);
        if (recordIds.has(record.id)) throw new Error(`结构化经历 id 重复：${record.id}`);
        recordIds.add(record.id);
        validateRecordPaths(record);
      }
    }
  }
  return true;
}
