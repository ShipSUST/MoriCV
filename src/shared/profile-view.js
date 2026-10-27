import { CATEGORY_ORDER, RECORD_COLLECTIONS, RECORD_SCHEMAS, extraRecordKeys, recordSchema, siteProfile } from "./schema.js";
import { compact } from './categories/common.js';
import { fixedField } from './ordinary-fields.js';

export { CATEGORY_ORDER };

function unique(values) {
  return [...new Set((values || []).map(compact).filter(Boolean))];
}

export { formatProfileDate } from './categories/common.js';

function child(record, key, label, aliases = [], dateField = null) {
  const value = compact(record?.[key]);
  if (!value) return null;
  return {
    id: `${record.id}.${key}`,
    sourceId: `${record.id}.${key}`,
    parentSourceId: record.id,
    label,
    value,
    aliases: unique([label, ...aliases, ...(record.fieldAliases?.[key] || [])]),
    optionValues: [...(record.fieldOptions?.[key] || [])],
    ...(dateField ? {
      fieldType: "date",
      recordCollection: dateField.collection,
      recordField: key,
      ...(record.fieldPaths?.[key]?.length ? { pathValues: structuredClone(record.fieldPaths[key]) } : {})
    } : {}),
    structuredField: true
  };
}

function recordChildren(collection, record) {
  const known = (recordSchema(collection)?.fields || [])
    .filter((item) => item.type !== "checkbox")
    .map((item) => child(record, item.key, item.label, item.aliases, item.pathConfig ? { collection } : null));
  // 模板外的字段也作为子字段显示，保证 JSON 里有的都看得见。
  const extra = extraRecordKeys(collection, record)
    .filter((key) => typeof record[key] === "string")
    .map((key) => child(record, key, key));
  return [...known, ...extra].filter(Boolean);
}

// 站点投影中的竞赛/荣誉只是 awards 的内部子集，不是独立个人资料大类。
const SITE_ONLY_COLLECTIONS = new Set(['competitions', 'honors']);

// 注册表之外的资料集合；不要把站点驱动内部视图渲染成额外大类。
export function unknownRecordCollections(profile) {
  return Object.keys(profile?.records || {})
    .filter((key) => !RECORD_COLLECTIONS.includes(key) && !SITE_ONLY_COLLECTIONS.has(key) && Array.isArray(profile.records[key]));
}

function derivedRecordPresentation(collection, record) {
  const generated = recordSchema(collection)?.presentation?.(record) || {
    label: compact(record.name || record.title) || collection,
    summary: Object.entries(record).filter(([key, value]) => key !== "id" && typeof value === "string" && value.trim()).map(([, value]) => value).join("｜"),
    aliases: []
  };
  return {
    label: compact(record.displayName) || generated.label,
    value: compact(record.summary) || generated.summary,
    aliases: unique([...(record.aliases || []), ...generated.aliases])
  };
}

function structuredEntries(profile) {
  const entries = [];
  const collections = [
    ...RECORD_SCHEMAS.map(({ key, category, recordType }) => ({ key, category, recordType })),
    ...unknownRecordCollections(profile).map((key) => ({ key, category: key, recordType: key }))
  ];
  for (const { key: collection, category, recordType } of collections) {
    for (const record of profile.records?.[collection] || []) {
      if (!record || typeof record !== "object") continue;
      const presentation = derivedRecordPresentation(collection, record);
      entries.push({
        id: `structured.${record.id}`,
        sourceId: record.id,
        category,
        label: presentation.label,
        value: presentation.value,
        aliases: presentation.aliases,
        structured: true,
        recordType,
        recordCollection: collection,
        children: recordChildren(collection, record)
      });
    }
  }
  return entries;
}

export function categoryRank(category) {
  if (category === '其他') return Number.MAX_SAFE_INTEGER;
  const index = CATEGORY_ORDER.indexOf(category);
  return index >= 0 ? index : CATEGORY_ORDER.length;
}

// 固定类与记录类先展示，兼容额外记录集合时「其他」仍保持最末。
export function categorySequence(categories = []) {
  return [...CATEGORY_ORDER.filter(category => category !== '其他'),
    ...new Set(categories.filter(category => !CATEGORY_ORDER.includes(category))), '其他'];
}

export function sortProfileEntries(entries) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => categoryRank(a.entry.category) - categoryRank(b.entry.category) || a.index - b.index)
    .map(({ entry }) => entry);
}

export function buildProfileLibraryEntries(profile) {
  const structured = structuredEntries(siteProfile(profile));
  const structuredIds = new Set(structured.map((entry) => entry.sourceId));
  const ordinary = (profile.entries || []).filter((entry) => !structuredIds.has(entry.id))
    .map(entry => fixedField(entry.id)?.type === 'date' ? {...entry,fieldType:'date'} : entry);
  return sortProfileEntries([...ordinary, ...structured]);
}

export function libraryEntrySourceId(entry) {
  return compact(entry?.sourceId) || String(entry?.id || "").replace(/^structured\./, "");
}

export function libraryEntryWasFilled(entry, filledEntryIds) {
  if (!filledEntryIds) return false;
  const sourceId = libraryEntrySourceId(entry);
  if (filledEntryIds.has(entry.id) || filledEntryIds.has(sourceId)) return true;
  return Boolean(entry?.structured && [...filledEntryIds].some((id) => String(id).startsWith(`${sourceId}.`)));
}
