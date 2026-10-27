import { educationsCategory } from './categories/educations.js';
import { internshipsCategory } from './categories/internships.js';
import { projectsCategory } from './categories/projects.js';
import { papersCategory } from './categories/papers.js';
import { awardsCategory } from './categories/awards.js';
import { programmingLanguagesCategory } from './categories/programmingLanguages.js';
import { foreignLanguagesCategory } from './categories/foreignLanguages.js';
import { certificationsCategory } from './categories/certifications.js';
import { relationshipsCategory } from './categories/relationships.js';
import { basicCategory } from './categories/basic.js';
import { careerCategory } from './categories/career.js';
import { otherCategory } from './categories/other.js';

// 兼容注册接口；各大类定义来自 categories/，站点投影仍独立。
export const SCHEMA_VERSION = 9;

export const CATEGORY_SCHEMA = [
  basicCategory, careerCategory,
  educationsCategory,
  internshipsCategory,
  projectsCategory,
  papersCategory,
  awardsCategory,
  programmingLanguagesCategory,
  foreignLanguagesCategory,
  certificationsCategory,
  relationshipsCategory,
  otherCategory
];

export const RECORD_SCHEMAS = CATEGORY_SCHEMA.filter((item) => item.kind === "record");
export const RECORD_COLLECTIONS = RECORD_SCHEMAS.map((item) => item.key);
export const CATEGORY_ORDER = CATEGORY_SCHEMA.map((item) => item.category);

export function recordSchema(collection) {
  return RECORD_SCHEMAS.find((item) => item.key === collection) || null;
}

export function recordSchemaForCategory(category) {
  return RECORD_SCHEMAS.find((item) => item.category === category) || null;
}

export function isRecordCategory(category) {
  return Boolean(recordSchemaForCategory(category));
}

// 已知子字段之外的记录属性（系统字段除外）。设置页原样显示这些属性，保证 JSON 里有的都看得见。
const RECORD_META_KEYS = new Set(["id", "displayName", "summary", "aliases", "fieldAliases", "fieldOptions", "fieldPaths"]);

export function extraRecordKeys(collection, record) {
  const known = new Set((recordSchema(collection)?.fields || []).map((item) => item.key));
  return Object.keys(record || {}).filter((key) => !known.has(key) && !RECORD_META_KEYS.has(key));
}

export function emptyRecord(collection, id) {
  const schema = recordSchema(collection);
  const record = { id: id || `${schema.prefix}.${crypto.randomUUID().slice(0, 8)}` };
  for (const item of schema.fields) record[item.key] = item.type === "checkbox" ? false : "";
  return record;
}

export function normalizePathValues(values = []) {
  return values.map((level) => [...new Set((Array.isArray(level) ? level : [level])
    .map((value) => String(value).trim()).filter(Boolean))]).filter((level) => level.length);
}

export function parsePathText(text) {
  return normalizePathValues(String(text || "").split(/\r?\n/).map((line) => line.split(/[,，]/)));
}

export function formatPathText(values) {
  return normalizePathValues(values || []).map((level) => level.join("，")).join("\n");
}

export function recordFieldAliases(profile, collection, key) {
  return [...new Set([...(recordSchema(collection)?.fields.find((field) => field.key === key)?.aliases || []),
    ...(profile.recordTemplates?.[collection]?.fieldAliases?.[key] || [])])];
}

const LANGUAGE_CERTIFICATE_HINTS = [
  { language: /英语|英文|english/i, certificate: /英语|英文|CET|TEM|IELTS|TOEFL|BEC|雅思|托福/i },
  { language: /日语|日文|japanese/i, certificate: /日语|日文|JLPT|JTEST/i },
  { language: /德语|德文|german/i, certificate: /德语|德文|TestDaF|DSH/i },
  { language: /法语|法文|french/i, certificate: /法语|法文|DELF|DALF/i },
  { language: /韩语|韩文|korean/i, certificate: /韩语|韩文|TOPIK/i },
  { language: /汉语|中文|chinese/i, certificate: /汉语|中文|HSK/i }
];

function certificateMatchesLanguage(certificate, language) {
  const languageText = `${language?.language || ""} ${(language?.aliases || []).join(" ")}`;
  const certificateText = `${certificate?.certType || ""} ${certificate?.name || ""} ${certificate?.issuer || ""} ${certificate?.note || ""}`;
  const normalizedLanguage = languageText.toLowerCase().replace(/\s+/g, "");
  const normalizedCertificate = certificateText.toLowerCase().replace(/\s+/g, "");
  if (!normalizedLanguage || !normalizedCertificate) return false;
  if (normalizedCertificate.includes(normalizedLanguage) || normalizedLanguage.includes(normalizedCertificate)) return true;
  return LANGUAGE_CERTIFICATE_HINTS.some((hint) => hint.language.test(languageText) && hint.certificate.test(certificateText));
}

function matchingLanguageCertificate(language, certificates, languages) {
  // Only uniquely attributable certificates participate; keep source order among
  // multiple certificates for the same language. Never infer from array length.
  return certificates.find((certificate) => certificateMatchesLanguage(certificate, language)
    && languages.filter((candidate) => certificateMatchesLanguage(certificate, candidate)).length === 1) || null;
}

// fill.js 的站点适配仍按招聘网站自身的区块来分（竞赛 / 荣誉分开、外语与证书合并）。
// 这里把 v7 数据投影成站点视图，不改动原始资料；外语证书按文本匹配，绝不再按数组索引配对。
export function siteRecordViews(records = {}) {
  const awards = records.awards || [];
  const isHonor = (award) => /荣誉/.test(String(award.awardCategory || ""));
  const languageCerts = records.certifications || [];
  const languages = records.foreignLanguages || [];
  const foreignLanguages = languages.map((language) => {
    const cert = matchingLanguageCertificate(language, languageCerts, languages);
    return { ...language, certification: cert?.name || "", score: cert?.score || "" };
  });
  return {
    competitions: awards.filter((award) => !isHonor(award)),
    honors: awards.filter(isHonor),
    foreignLanguages
  };
}

export function siteProfile(profile) {
  if (!profile?.records) return profile;
  const records = Object.fromEntries(Object.entries(profile.records).map(([collection, rows]) => [collection,
    rows.map((row) => ({ ...row, ...(row.fieldPaths ? { fieldPaths: structuredClone(row.fieldPaths) } : {}), fieldAliases: Object.fromEntries((recordSchema(collection)?.fields || [])
      .map((field) => [field.key, [...new Set([field.label, ...recordFieldAliases(profile, collection, field.key), ...(row.fieldAliases?.[field.key] || [])])]])) }))]));
  return { ...profile, records: { ...records, ...siteRecordViews(records) } };
}
