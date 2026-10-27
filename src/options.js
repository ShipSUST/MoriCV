import {
  saveProfile, validateProfile,
  getSettings, saveSettings, migrateProfile, previewProfileMigration, createCustomProfileEntry,
  CONFIDENCE_PRESETS, confidencePresetFor, normalizeConfidence
} from "./shared/storage.js";
import { categorySequence as orderCategories, categoryRank, unknownRecordCollections } from "./shared/profile-view.js";
import { RECORD_SCHEMAS, extraRecordKeys, recordSchema, recordSchemaForCategory, emptyRecord, parsePathText, formatPathText } from "./shared/schema.js";
import { DEFAULT_PROFILE } from "./data/default-profile.js";
import { fixedField, toPortableProfile } from "./shared/ordinary-fields.js";
import { readCanonicalProfileSnapshot } from "./shared/canonical-profile.js";
import {
  linkedProfileName, saveToLinkedProfile, chooseProfileToSave, chooseProfileToOpen,
  getProfileHandle, rememberProfileHandle, forgetProfileHandle
} from "./shared/profile-file.js";

const elements = {
  editor: document.querySelector("#entry-editor"),
  search: document.querySelector("#options-search"),
  count: document.querySelector("#options-count"),
  confidence: document.querySelector("#confidence"),
  confidencePresets: document.querySelector("#confidence-presets"),
  overwrite: document.querySelector("#settings-overwrite"),
  save: document.querySelector("#save-button"),
  reset: document.querySelector("#reset-profile"),
  importButton: document.querySelector("#import-button"),
  exportButton: document.querySelector("#export-button"),
  importFile: document.querySelector("#import-file"),
  fileStatus: document.querySelector("#file-status"),
  toast: document.querySelector("#toast")
};

let profile = migrateProfile(DEFAULT_PROFILE);
let settings;
let toastTimer;
let linkedRevision = "";
let migrationReport = null;
let migrationSourceText = "";
let migrationSourceName = "";
// 新增仅由所属记录组或「其他」按钮触发，不能切换固定字段结构。
let draft = null;
let datalistSeq = 0;

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function field(label, control, full = false) {
  const wrapper = document.createElement("label");
  wrapper.className = `edit-field${full ? " full" : ""}`;
  wrapper.append(document.createTextNode(label), control);
  return wrapper;
}

function inputFor(value, onInput, multiline = false) {
  const input = document.createElement(multiline ? "textarea" : "input");
  input.value = value ?? "";
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

function splitList(value) {
  return String(value || "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
}

function matchesQuery(values, query) {
  if (!query) return true;
  return values.flat().join(" ").toLowerCase().includes(query);
}

function categorySequence() {
  return orderCategories([
    ...profile.entries.map((entry) => entry.category),
    ...RECORD_SCHEMAS.map((item) => item.category),
    ...unknownRecordCollections(profile)
  ]);
}

// ── 记录里的可编辑列表（后备别名 / 下拉选项）────────────────────────────────
// 只在有内容时写入 JSON，避免给每条记录塞空的 fieldAliases / fieldOptions。

function readRecordList(record, bag, key) {
  return record[bag]?.[key] || [];
}

function writeRecordList(record, bag, key, value) {
  const list = splitList(value);
  if (list.length) {
    record[bag] = { ...(record[bag] || {}), [key]: list };
    return;
  }
  if (!record[bag]) return;
  delete record[bag][key];
  if (!Object.keys(record[bag]).length) delete record[bag];
}

function recordListControl(record, bag, key, label) {
  const input = inputFor(readRecordList(record, bag, key).join("，"), (value) => writeRecordList(record, bag, key, value), true);
  return field(label, input, true);
}

function writeRecordPath(record, key, value) {
  const path = parsePathText(value);
  if (path.length) {
    record.fieldPaths = { ...(record.fieldPaths || {}), [key]: path };
    return;
  }
  if (!record.fieldPaths) return;
  delete record.fieldPaths[key];
  if (!Object.keys(record.fieldPaths).length) delete record.fieldPaths;
}

function recordPathControl(record, key) {
  const input = inputFor(formatPathText(record.fieldPaths?.[key]), (value) => writeRecordPath(record, key, value), true);
  input.placeholder = "每行一级，例如年、月、日；同级只填写同一日期的候选表达";
  return field("级联路径（仅本条日期；每行一级，同级候选用逗号分隔）", input, true);
}

// 枚举型子字段的候选值：注册表内置 + 记录自带，供输入框提示。
function enumCandidates(record, item) {
  return [...new Set([...(record.fieldOptions?.[item.key] || []), ...(item.enumOptions || [])])];
}

function subfieldValueControl(collection, record, item) {
  if (item.type === "checkbox") {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(record[item.key]);
    input.addEventListener("change", () => { record[item.key] = input.checked; });
    return input;
  }
  const multiline = item.type === "textarea";
  const input = inputFor(record[item.key], (value) => { record[item.key] = value; }, multiline);
  const candidates = enumCandidates(record, item);
  if (candidates.length && !multiline) {
    const listId = `options-list-${(datalistSeq += 1)}`;
    const list = document.createElement("datalist");
    list.id = listId;
    for (const candidate of candidates) {
      const option = document.createElement("option");
      option.value = candidate;
      list.append(option);
    }
    input.setAttribute("list", listId);
    input.placeholder = candidates.join(" / ");
    // 此时 input 还没挂进文档，after() 会静默失效；用片段把两者一起交出去。
    const fragment = document.createDocumentFragment();
    fragment.append(input, list);
    return fragment;
  } else if (item.type === "date") {
    input.placeholder = "2021-04 或 2021-04-01";
  }
  return input;
}

function subfieldRow(collection, record, item) {
  const row = document.createElement("div");
  row.className = "subfield-row";
  const head = document.createElement("div");
  head.className = "subfield-main";
  const label = document.createElement("span");
  label.className = "subfield-label";
  label.textContent = item.label;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "subfield-toggle";
  toggle.textContent = item.pathConfig ? "别名/选项/路径" : "别名/选项";
  const detail = document.createElement("div");
  detail.className = "subfield-detail";
  detail.hidden = true;
  profile.recordTemplates ||= {};
  const template = profile.recordTemplates[collection] ||= { fieldAliases: {} };
  const aliasControl = recordListControl(template, "fieldAliases", item.key, "字段别名（同类所有记录同步）");
  const aliasInput = aliasControl.querySelector("textarea");
  aliasInput.dataset.templateCollection = collection;
  aliasInput.dataset.templateField = item.key;
  aliasInput.addEventListener("input", () => {
    for (const input of document.querySelectorAll("[data-template-collection]")) {
      if (input !== aliasInput && input.dataset.templateCollection === collection && input.dataset.templateField === item.key) input.value = aliasInput.value;
    }
  });
  detail.append(aliasControl);
  detail.append(recordListControl(record, "fieldOptions", item.key, "下拉候选项（只用于本条主值，按顺序尝试）"));
  if (item.pathConfig) detail.append(recordPathControl(record, item.key));
  const hint = detail.querySelector(".edit-field");
  if (hint && item.aliases?.length) {
    const small = document.createElement("small");
    small.textContent = `内置别名：${item.aliases.join("，")}`;
    hint.append(small);
  }
  toggle.addEventListener("click", () => { detail.hidden = !detail.hidden; });
  head.append(label, subfieldValueControl(collection, record, item), toggle);
  row.append(head, detail);
  return row;
}

function subfieldTable(collection, record) {
  const schema = recordSchema(collection);
  const table = document.createElement("div");
  table.className = "subfield-table";
  for (const item of schema?.fields || []) table.append(subfieldRow(collection, record, item));
  // 模板之外的属性也显示出来，保证 JSON 里有的都看得见、改得动。
  for (const key of extraRecordKeys(collection, record)) {
    table.append(subfieldRow(collection, record, {
      key,
      label: `${key}（模板外）`,
      type: typeof record[key] === "boolean" ? "checkbox" : typeof record[key] === "string" && record[key].length > 60 ? "textarea" : "text"
    }));
  }
  return table;
}

function recordMetaGrid(record, title) {
  const grid = document.createElement("div");
  grid.className = "edit-grid";
  const displayName = inputFor(record.displayName, (value) => {
    record.displayName = value;
    title.textContent = value || "新记录";
  });
  grid.append(
    field("侧栏显示名称（可选）", displayName),
    field("整段摘要（可选；留空自动生成）", inputFor(record.summary, (value) => { record.summary = value; }, true), true),
    field("整条记录的别名（可选）", inputFor((record.aliases || []).join("，"), (value) => { record.aliases = splitList(value); }, true), true)
  );
  return grid;
}

// ── 普通条目卡片 ─────────────────────────────────────────────────────────

function renderEntryCard(entry) {
  const definition = fixedField(entry.id);
  const card = document.createElement("article");
  card.className = "edit-card";
  card.dataset.entryId = entry.id;
  const header = document.createElement("div");
  header.className = "edit-card-header";
  const title = document.createElement("h3");
  title.textContent = entry.label || "未命名条目";
  header.append(title);
  if (!definition) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-entry";
    remove.textContent = "删除";
    remove.addEventListener("click", () => {
      if (!confirm(`确定删除“${entry.label}”吗？保存全部修改后才会生效。`)) return;
      profile.entries = profile.entries.filter((item) => item !== entry);
      renderEditor();
    });
    header.append(remove);
  }

  const grid = document.createElement("div");
  grid.className = "edit-grid";
  if (!definition) {
    const labelInput = inputFor(entry.label, (value) => {
      entry.label = value;
      title.textContent = value || "未命名条目";
    });
    grid.append(field("侧栏显示名称", labelInput));
  }
  const valueInput = inputFor(entry.value, value => { entry.value = value; }, !definition || definition.type === 'textarea');
  if (definition?.type === 'date') valueInput.placeholder = 'YYYY-MM 或 YYYY-MM-DD；按资料实际精度填写';
  if (definition?.type === 'year') valueInput.placeholder = 'YYYY';
  grid.append(field("填写值", valueInput, true));
  if (definition?.supportsOptions) grid.append(field("下拉选项候选（逗号或换行分隔）", inputFor((entry.optionValues || []).join("，"), (value) => { entry.optionValues = splitList(value); }, true), true));
  if (definition?.supportsPath) grid.append(field("级联路径（每行一级，同级候选用逗号分隔）", inputFor(formatPathText(entry.pathValues), (value) => {
      const path = parsePathText(value);
      if (path.length) entry.pathValues = path;
      else delete entry.pathValues;
    }, true), true));
  card.append(header, grid);
  return card;
}

// ── 结构化记录卡片 ───────────────────────────────────────────────────────

function recordTitle(record, collection) {
  const values = recordSchema(collection)?.fields.map((item) => item.key) || [];
  const first = values.map((key) => record[key]).find((value) => typeof value === "string" && value.trim());
  return record.displayName || first || collection;
}

function moveRecord(records, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= records.length) return;
  [records[index], records[target]] = [records[target], records[index]];
  renderEditor();
}

function renderRecordCard(collection, record, index, records) {
  const card = document.createElement("article");
  card.className = "edit-card record-card";
  card.dataset.recordId = record.id;
  const header = document.createElement("div");
  header.className = "edit-card-header";
  const title = document.createElement("h3");
  title.textContent = recordTitle(record, collection);
  const actions = document.createElement("div");
  actions.className = "record-actions";
  for (const [text, direction] of [["上移", -1], ["下移", 1]]) {
    const move = document.createElement("button");
    move.type = "button";
    move.className = "small-action";
    move.textContent = text;
    move.disabled = direction < 0 ? index === 0 : index === records.length - 1;
    move.addEventListener("click", () => moveRecord(records, index, direction));
    actions.append(move);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete-entry";
  remove.textContent = "删除";
  remove.addEventListener("click", () => {
    if (!confirm(`确定删除“${recordTitle(record, collection)}”吗？保存全部修改后才会生效。`)) return;
    records.splice(index, 1);
    renderEditor();
  });
  actions.append(remove);
  header.append(title, actions);
  card.append(header, recordMetaGrid(record, title), subfieldTable(collection, record));
  return card;
}

// ── 通过所属组新增记录或其他资料 ───────────────────────────────────────

function startDraft(category) {
  const schema = recordSchemaForCategory(category);
  if (!schema && category !== '其他') return;
  draft = schema
    ? { category, collection: schema.key, record: emptyRecord(schema.key) }
    : { category, entry: { ...createCustomProfileEntry(), category } };

  elements.search.value = "";
  renderEditor();
  scrollToDraft();
}

function scrollToDraft() {
  requestAnimationFrame(() => {
    elements.editor.querySelector(".draft-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function commitDraft() {
  if (!draft) return;
  const anchor = draft.record ? draft.record.id : draft.entry.id;
  if (draft.record) profile.records[draft.collection].unshift(draft.record);
  else profile.entries.unshift(draft.entry);
  draft = null;
  renderEditor();
  requestAnimationFrame(() => {
    const card = elements.editor.querySelector(`[data-record-id="${CSS.escape(anchor)}"], [data-entry-id="${CSS.escape(anchor)}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.querySelector("input, textarea")?.focus({ preventScroll: true });
  });
}

function renderDraftCard() {
  const card = document.createElement("article");
  card.className = "edit-card draft-card";
  const header = document.createElement("div");
  header.className = "edit-card-header";
  const title = document.createElement("h3");
  title.textContent = "新资料";
  const actions = document.createElement("div");
  actions.className = "record-actions";
  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "button primary compact";
  confirmButton.textContent = "确认添加";
  confirmButton.addEventListener("click", commitDraft);
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "small-action";
  cancelButton.textContent = "取消";
  cancelButton.addEventListener("click", () => { draft = null; renderEditor(); });
  actions.append(confirmButton, cancelButton);
  header.append(title, actions);

  const grid = document.createElement("div");
  grid.className = "edit-grid";
  if (draft.record) {
    const schema = recordSchema(draft.collection);
    const note = document.createElement("p");
    note.className = "subfield-note";
    note.textContent = `「${schema.category}」可以有多条记录，下面是它的专用子字段表。`;
    card.append(header, grid, note, recordMetaGrid(draft.record, title), subfieldTable(draft.collection, draft.record));
    return card;
  }
  const labelInput = inputFor(draft.entry.label, (value) => {
    draft.entry.label = value;
    title.textContent = value || "新资料";
  });
  grid.append(
    field("侧栏显示名称", labelInput),
    field("填写值", inputFor(draft.entry.value, (value) => { draft.entry.value = value; }, true), true)
  );
  card.append(header, grid);
  return card;
}

// ── 渲染 ─────────────────────────────────────────────────────────────────

function categorySection(category) {
  const section = document.createElement("section");
  section.className = "settings-category";
  const heading = document.createElement("div");
  heading.className = "settings-category-heading";
  const title = document.createElement("h2");
  title.textContent = category;
  heading.append(title);
  if (category === '其他') {
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'button secondary compact'; add.textContent = '新增其他';
    add.addEventListener('click', () => startDraft('其他'));
    heading.append(add);
  }
  const body = document.createElement("div");
  body.className = "settings-category-body";
  section.append(heading, body);
  return { section, body };
}

function renderRecordGroup(collection, category, query) {
  const records = profile.records[collection] || [];
  const schema = recordSchema(collection);
  const title = schema?.title || collection;
  const visible = records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => matchesQuery([title, Object.values(record).filter((value) => typeof value === "string")], query));
  if (query && !visible.length) return null;

  const wrapper = document.createElement("section");
  wrapper.className = "record-group";
  const heading = document.createElement("div");
  heading.className = "record-group-heading";
  const headingTitle = document.createElement("h3");
  headingTitle.textContent = `${title}（${records.length}）`;
  const add = document.createElement("button");
  add.type = "button";
  add.className = "button secondary compact";
  add.textContent = `新增${title}`;
  add.addEventListener("click", () => startDraft(category));
  heading.append(headingTitle, add);
  const list = document.createElement("div");
  list.className = "record-list";
  for (const { record, index } of visible) list.append(renderRecordCard(collection, record, index, records));
  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "record-empty";
    empty.textContent = `暂无${title}，需要时可新增。`;
    list.append(empty);
  }
  wrapper.append(heading, list);
  return wrapper;
}

function renderEditor() {
  const query = elements.search.value.trim().toLowerCase();
  const ordinary = profile.entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => categoryRank(a.entry.category) - categoryRank(b.entry.category) || a.index - b.index)
    .map(({ entry }) => entry);
  const collections = [
    ...RECORD_SCHEMAS.map((item) => ({ collection: item.key, category: item.category })),
    ...unknownRecordCollections(profile).map((key) => ({ collection: key, category: key }))
  ];
  const totalRecords = collections.reduce((sum, item) => sum + (profile.records[item.collection]?.length || 0), 0);
  let visibleCount = 0;
  elements.editor.replaceChildren();

  for (const category of categorySequence()) {
    const { section, body } = categorySection(category);
    for (const entry of ordinary) {
      if (entry.category !== category) continue;
      if (!query && draft?.entry === entry) continue;
      if (!matchesQuery([entry.label, entry.value, entry.category, entry.aliases], query)) continue;
      body.append(renderEntryCard(entry));
      visibleCount += 1;
    }
    for (const { collection } of collections.filter((item) => item.category === category)) {
      const recordGroup = renderRecordGroup(collection, category, query);
      if (!recordGroup) continue;
      body.append(recordGroup);
      visibleCount += (profile.records[collection] || [])
        .filter((record) => matchesQuery([collection, Object.values(record).filter((value) => typeof value === "string")], query)).length;
    }
    // 新增卡片跟着所属大类走（有筛选时也保留，否则一点「新增」就看不见了）。
    if (draft?.category === category) body.prepend(renderDraftCard());
    if (!query && !body.childElementCount) {
      const empty = document.createElement("p");
      empty.className = "subfield-note";
      empty.textContent = "尚未添加资料。";
      body.append(empty);
    }
    if (body.childElementCount) elements.editor.append(section);
  }
  elements.count.textContent = `${visibleCount}/${ordinary.length + totalRecords}`;
}

function settingsFromForm() {
  // 保留侧栏写入的否决记录等其它设置，只覆盖本页可编辑的两项。
  return {
    ...settings,
    confidenceThreshold: normalizeConfidence(elements.confidence.value, settings?.confidenceThreshold),
    overwriteExisting: elements.overwrite.checked
  };
}

function renderConfidencePresets() {
  const active = confidencePresetFor(elements.confidence.value);
  elements.confidencePresets.replaceChildren(...[...CONFIDENCE_PRESETS, { key: "custom", label: "自定义" }].map((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `preset-button${preset.key === active ? " active" : ""}`;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(preset.key === active));
    button.textContent = preset.value === undefined ? preset.label : `${preset.label} ${preset.value}`;
    if (preset.value === undefined) {
      button.disabled = active !== "custom";
      button.title = "在「高级」里输入任意分数";
    } else {
      button.addEventListener("click", () => {
        elements.confidence.value = preset.value;
        renderConfidencePresets();
      });
    }
    return button;
  }));
}

async function refreshFileStatus(message = "", state = "") {
  const name = await linkedProfileName();
  elements.fileStatus.textContent = message || (name ? `已关联：${name}` : "尚未关联 JSON；当前内容为未保存草稿，请另存资料文件建立关联。");
  elements.fileStatus.classList.toggle("linked", Boolean(name) && state !== "stale");
  elements.fileStatus.classList.toggle("stale", state === "stale");
}

async function loadCanonicalProfile() {
  try {
    const canonical = await readCanonicalProfileSnapshot();
    profile = canonical.profile;
    linkedRevision = canonical.revision;
    retainMigrationSource(canonical);
    await refreshFileStatus(`已从 JSON 主档刷新：${canonical.name}`);
    return true;
  } catch (error) {
    linkedRevision = "";
    await refreshFileStatus(`${error.message} 当前编辑内容仅为未保存草稿；复制和填写暂停，请加载或另存 JSON。`, "stale");
    return false;
  }
}

function retainMigrationSource(snapshot) {
  migrationReport = snapshot.migrationReport || null;
  migrationSourceText = snapshot.sourceText || '';
  migrationSourceName = snapshot.name || 'mori-cv-profile.json';
}

async function approveMigration() {
  if (!migrationReport || !(migrationReport.requiresReview || migrationReport.fromVersion < migrationReport.toVersion)) return true;
  if (!migrationSourceText) throw new Error('缺少原始资料备份，不能保存迁移；请重新加载 JSON。');
  const lines = [`资料格式将从 v${migrationReport.fromVersion} 升级到 v${migrationReport.toVersion}。固定字段的名称和别名改由程序维护，个人值仍保存在 JSON。`];
  for (const [key, title] of [['moves','移动'],['removed','删除'],['conflicts','冲突（主值留空）'],['quarantined','保留到其他']]) {
    const rows = migrationReport[key] || [];
    if (rows.length) lines.push(`${title}：${rows.map(row => {
      const label = row.label || row.sourceId || row.targetId;
      const fields = (row.fields || []).map(field => ({ optionValues: '候选', pathValues: '路径' })[field] || field);
      return fields.length ? `${label}（移除${fields.join('、')}）` : label;
    }).join('、')}`);
  }
  lines.push('可取消并查看编辑页中的迁移结果。继续后会先下载原始 JSON 备份，再保存当前草稿。确定继续吗？');
  if (!confirm(lines.join('\n\n'))) return false;
  const base = migrationSourceName.replace(/\.json$/i, '').replace(/[<>:"/\\|?*]/g, '_');
  await downloadContents(migrationSourceText, `${base}.before-schema9.${Date.now()}.json`);
  return true;
}

function clearMigrationSource() {
  migrationReport = null; migrationSourceText = ''; migrationSourceName = '';
}

async function saveAll() {
  const candidate = structuredClone(profile);
  candidate.updatedAt = new Date().toISOString().slice(0, 10);
  validateProfile(candidate);
  const linkedName = await linkedProfileName();
  if (!linkedName) throw new Error("尚未关联 JSON，修改仍是未保存草稿；请使用“另存资料文件”建立关联。");
  if (!linkedRevision) throw new Error("JSON 主档未成功加载，不能覆盖；请重新加载或另存资料文件。草稿已保留。");
  const current = await readCanonicalProfileSnapshot({ cache: null });
  if (current.revision !== linkedRevision) throw new Error("关联 JSON 已在外部发生变化，请先重新加载资料文件；当前草稿尚未保存。");
  if (!await approveMigration()) return;
  const sync = await saveToLinkedProfile(candidate, current.revision);
  if (!sync.synced) throw new Error(sync.reason || "JSON 主档写入失败，草稿已保留");
  profile = candidate;
  linkedRevision = sync.revision || "";
  clearMigrationSource();
  try {
    await Promise.all([saveProfile(profile), saveSettings(settingsFromForm())]);
  } catch (error) {
    await refreshFileStatus(`JSON 主档已保存：${sync.name}；运行缓存或设置更新失败，请重新加载。`, "stale");
    throw new Error(`JSON 主档已写入，但运行缓存或设置更新失败：${error.message}`);
  }
  await refreshFileStatus(`已同步 JSON 主档：${sync.name}`);
  // Rebind controls to the saved candidate, rather than the pre-save draft object.
  renderEditor();
  showToast("修改已保存并同步到 JSON");
}

async function downloadProfile(profileToExport, filename = "mori-cv-profile.json") {
  return downloadContents(`${JSON.stringify(toPortableProfile(profileToExport), null, 2)}\n`, filename);
}

async function downloadContents(contents, filename) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportProfile() {
  const candidate = structuredClone(profile);
  candidate.updatedAt = new Date().toISOString().slice(0, 10);
  validateProfile(candidate);
  if (!await approveMigration()) return;
  const sync = await chooseProfileToSave(candidate);
  if (sync && !sync.synced) throw new Error(sync.reason || "JSON 写入失败，缓存未更新");
  if (sync) {
    profile = candidate;
    linkedRevision = sync.revision || "";
    clearMigrationSource();
    try {
      await saveProfile(profile);
    } catch (error) {
      await refreshFileStatus(`JSON 已另存并关联：${sync.name}；运行缓存更新失败，请重新加载。`, "stale");
      throw new Error(`JSON 已另存并关联，但运行缓存更新失败：${error.message}`);
    }
    await refreshFileStatus(`已关联并保存：${sync.name}`);
    showToast(`资料已保存为 ${sync.name}`);
    return;
  }
  await downloadProfile(candidate);
  await refreshFileStatus("草稿已下载；下载稿尚未关联，不会发布为运行资料。请加载并关联该 JSON。", "stale");
  showToast("草稿已下载；尚未关联为 JSON 主档");
}

async function importProfile(file, handle = null) {
  const sourceText = await file.text();
  const parsed = JSON.parse(sourceText);
  validateProfile(parsed);
  const imported = migrateProfile(parsed);
  validateProfile(imported);
  if (!confirm(`将加载 ${parsed.entries.length} 条普通资料及结构化经历，并替换当前编辑草稿，确定继续吗？`)) return;
  if (handle) {
    const previousHandle = await getProfileHandle();
    try {
      await rememberProfileHandle(handle);
      const canonical = await readCanonicalProfileSnapshot({ cache: null });
      await saveProfile(canonical.profile);
      profile = canonical.profile;
      linkedRevision = canonical.revision;
      retainMigrationSource(canonical);
    } catch (error) {
      if (previousHandle) await rememberProfileHandle(previousHandle);
      else await forgetProfileHandle();
      throw error;
    }
  } else {
    await forgetProfileHandle();
    if (await getProfileHandle()) throw new Error("未能解除原 JSON 关联，导入未生效；请另存资料文件。");
    profile = imported;
    linkedRevision = "";
    retainMigrationSource({ migrationReport:previewProfileMigration(parsed).report, sourceText, name:file.name });
  }
  draft = null;
  renderEditor();
  await refreshFileStatus(handle ? `已加载并关联：${file.name}` : `已加载 ${file.name} 为未保存草稿；请另存并关联 JSON 后再复制或填写。`, handle ? "" : "stale");
  showToast(handle ? "JSON 主档加载成功" : "已加载编辑草稿，尚未关联 JSON");
}

async function chooseAndImportProfile() {
  const selected = await chooseProfileToOpen();
  if (!selected) {
    elements.importFile.click();
    return;
  }
  await importProfile(selected.file, selected.handle);
}

async function init() {
  settings = await getSettings();
  await loadCanonicalProfile();
  elements.confidence.value = settings.confidenceThreshold;
  renderConfidencePresets();
  elements.confidence.addEventListener("input", renderConfidencePresets);
  elements.overwrite.checked = settings.overwriteExisting;
  renderEditor();

  elements.search.addEventListener("input", renderEditor);
  elements.save.addEventListener("click", () => saveAll().catch((error) => alert(`保存失败：${error.message}`)));
  elements.exportButton.addEventListener("click", () => exportProfile().catch((error) => alert(`另存失败：${error.message}`)));
  elements.importButton.addEventListener("click", () => chooseAndImportProfile().catch((error) => {
    if (error?.name !== "AbortError") alert(`加载失败，原资料未被覆盖：${error.message}`);
  }));
  elements.importFile.addEventListener("change", async () => {
    const [file] = elements.importFile.files;
    if (!file) return;
    try {
      await importProfile(file);
    } catch (error) {
      alert(`导入失败，原资料未被覆盖：${error.message}`);
    } finally {
      elements.importFile.value = "";
    }
  });
  elements.reset.addEventListener("click", async () => {
    if (!confirm("确定将编辑草稿清空为默认空白模板吗？保存前，JSON 主档和已发布的运行资料不会改变。")) return;
    profile = migrateProfile(DEFAULT_PROFILE);
    draft = null;
    renderEditor();
    await refreshFileStatus("编辑草稿已清空，尚未保存；JSON 主档和已发布的运行资料未改动。", "stale");
    showToast("已清空编辑草稿，尚未保存");
  });
}

init().catch((error) => alert(`设置页初始化失败：${error.message}`));
