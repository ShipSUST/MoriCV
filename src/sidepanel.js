import {
  getSettings, saveSettings, saveSnapshot, getSnapshot
} from "./shared/storage.js";
import { DEFAULT_PROFILE } from "./data/default-profile.js";
import { buildProfileLibraryEntries, libraryEntryWasFilled, categorySequence } from "./shared/profile-view.js";
import { siteProfile } from "./shared/schema.js";
import { readCanonicalProfileSnapshot, resolveCanonicalEntry, verificationProfileFromExpectations } from "./shared/canonical-profile.js";

const elements = {
  list: document.querySelector("#profile-list"),
  search: document.querySelector("#search"),
  count: document.querySelector("#entry-count"),
  result: document.querySelector("#result"),
  badge: document.querySelector("#site-badge"),
  fill: document.querySelector("#fill-page"),
  scan: document.querySelector("#scan-page"),
  verify: document.querySelector("#verify-page"),
  undo: document.querySelector("#undo-fill"),
  target: document.querySelector("#target-status"),
  profileStatus: document.querySelector("#profile-status"),
  accessPanel: document.querySelector("#access-panel"),
  accessTitle: document.querySelector("#access-title"),
  accessDescription: document.querySelector("#access-description"),
  grantSite: document.querySelector("#grant-site"),
  overwriteExisting: document.querySelector("#overwrite-existing"),
  options: document.querySelector("#open-options"),
  toast: document.querySelector("#toast")
};

let profile;
let settings;
let toastTimer;
let currentAccess = null;
const collapsed = new Set();
const expandedRecords = new Set();
let filledEntryIds = new Set();
let lastFillExpectationKeys = new Set();
let markerTabId = null;
let canonicalAvailable = false;
let busy = false;
let canonicalRefreshPromise = null;

function showCanonicalFailure(error) {
  canonicalAvailable = false;
  elements.profileStatus.hidden = false;
  const text = document.createElement("span");
  text.textContent = `${error.message} 当前展示的 Chrome 缓存可能过期，仅供查看，已停止复制、扫描和填写。`;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "tiny-button";
  retry.textContent = "重新读取 JSON";
  retry.addEventListener("click", async () => {
    retry.disabled = true;
    try {
      await refreshProfileFromCanonical();
      showToast("已从 JSON 主档刷新资料");
    } catch (_) {
      // refreshProfileFromCanonical has already displayed the failure.
    }
  });
  elements.profileStatus.replaceChildren(text, retry);
  updateActionAvailability();
}

async function refreshProfileFromCanonical() {
  const previous = canonicalRefreshPromise;
  // Serialize publication, but every caller reads the file for its own operation.
  // Reusing a pending read would miss external edits made before a new click.
  const refresh = (async () => {
    if (previous) await previous.catch(() => {});
    try {
      const snapshot = await readCanonicalProfileSnapshot();
      profile = snapshot.profile;
      canonicalAvailable = true;
      elements.profileStatus.hidden = true;
      renderProfile();
      return snapshot.profile;
    } catch (error) {
      showCanonicalFailure(error);
      throw error;
    }
  })();
  canonicalRefreshPromise = refresh;
  try { return await refresh; }
  finally { if (canonicalRefreshPromise === refresh) canonicalRefreshPromise = null; }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

async function copyText(value, message = "已复制") {
  await navigator.clipboard.writeText(value);
  showToast(message);
}

async function copyEntry(reference) {
  setBusy(true);
  try {
    const snapshot = await refreshProfileFromCanonical();
    const entry = resolveCanonicalEntry(snapshot, reference);
    if (!String(entry.value || "").trim()) throw new Error("这条资料在 JSON 主档中没有填写内容。");
    await copyText(entry.value, `已复制“${entry.label}”`);
  } catch (error) {
    elements.result.textContent = error.message;
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function copyCategory(category) {
  setBusy(true);
  try {
    const snapshot = await refreshProfileFromCanonical();
    const entries = buildProfileLibraryEntries(snapshot).filter((entry) =>
      entry.category === category && matchesSearch(entry, elements.search.value.trim()) && String(entry.value || "").trim());
    if (!entries.length) throw new Error(`“${category}”在 JSON 主档中没有可复制的资料。`);
    await copyText(entries.map((entry) => `${entry.label}：${entry.value}`).join("\n"), `已复制“${category}”`);
  } catch (error) {
    elements.result.textContent = error.message;
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

function renderTargetStatus(target) {
  const text = elements.target.querySelector("span:last-child");
  elements.target.classList.toggle("ready", Boolean(target?.ready));
  text.textContent = target?.ready
    ? `已选中：${target.field || "当前输入框"}${target.currentValue ? "（已有内容）" : "（空白）"}`
    : "等待你点击网页中的输入框";
}

function matchesSearch(entry, query) {
  if (!query) return true;
  const childText = (entry.children || []).flatMap((child) => [child.label, child.value, ...(child.aliases || [])]);
  const haystack = [entry.label, entry.value, entry.category, ...(entry.aliases || []), ...childText].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function collectionRecords(collection, snapshot = profile) {
  return (snapshot?.records?.[collection] || []).filter(Boolean);
}

function renderEntryRow(entry, className = "entry-row") {
  const row = document.createElement("article");
  row.className = className;
  const filledSource = libraryEntryWasFilled(entry, filledEntryIds);
  row.classList.toggle("filled-source", filledSource);
  const content = document.createElement("div");
  const label = document.createElement("div");
  label.className = "entry-label";
  label.append(document.createTextNode(entry.label));
  if (filledSource) {
    const marker = document.createElement("span");
    marker.className = "filled-marker";
    marker.textContent = "✓";
    marker.title = "这条资料已用于当前页面";
    label.append(marker);
  }
  const value = document.createElement("div");
  value.className = "entry-value";
  const hasValue = String(entry.value || "").trim() !== "";
  value.classList.toggle("empty", !hasValue);
  value.textContent = hasValue ? entry.value : "尚未填写";
  content.append(label, value);

  const buttons = document.createElement("div");
  buttons.className = "entry-buttons";
  const fill = document.createElement("button");
  fill.type = "button";
  fill.className = "entry-button fill";
  fill.textContent = "填入";
  fill.dataset.profileAction = "true";
  fill.dataset.hasValue = hasValue ? "true" : "false";
  fill.addEventListener("click", () => fillEntry(entry, fill));
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "entry-button";
  copy.textContent = "复制已有";
  copy.dataset.profileAction = "true";
  copy.dataset.hasValue = hasValue ? "true" : "false";
  copy.addEventListener("click", () => copyEntry(entry));
  fill.disabled = busy || !canonicalAvailable || !hasValue;
  copy.disabled = busy || !canonicalAvailable || !hasValue;
  if (!hasValue) {
    fill.title = "请先在资料设置中填写内容";
    copy.title = "请先在资料设置中填写内容";
  }
  buttons.append(fill, copy);

  row.append(content, buttons);

  if (entry.structured && entry.children?.length) {
    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "record-expand";
    expand.textContent = expandedRecords.has(entry.sourceId) ? "收起分字段" : `展开分字段（${entry.children.length}）`;
    expand.addEventListener("click", () => {
      if (expandedRecords.has(entry.sourceId)) expandedRecords.delete(entry.sourceId);
      else expandedRecords.add(entry.sourceId);
      renderProfile();
    });
    row.append(expand);
    if (expandedRecords.has(entry.sourceId)) {
      const childList = document.createElement("div");
      childList.className = "record-child-list";
      for (const child of entry.children) childList.append(renderEntryRow(child, "entry-row child-row"));
      row.append(childList);
    }
  }
  return row;
}

function renderProfile() {
  const query = elements.search.value.trim();
  const allEntries = buildProfileLibraryEntries(profile);
  const visible = allEntries.filter((entry) => matchesSearch(entry, query));
  elements.count.textContent = `${visible.length}/${allEntries.length}`;
  elements.list.replaceChildren();

  if (query && !visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = allEntries.length
      ? "没有找到匹配资料"
      : "个人资料库为空。请点击右上角设置，填写资料或加载 JSON 资料文件。";
    elements.list.append(empty);
    updateActionAvailability();
    return;
  }

  const groups = new Map(query ? [] : categorySequence(allEntries.map(entry => entry.category)).map(category => [category, []]));
  for (const entry of visible) {
    if (!groups.has(entry.category)) groups.set(entry.category, []);
    groups.get(entry.category).push(entry);
  }

  for (const [category, entries] of groups) {
    const copyableEntries = entries.filter((entry) => String(entry.value || "").trim());
    const card = document.createElement("section");
    card.className = "category-card";
    const header = document.createElement("div");
    header.className = "category-header";
    const meta = document.createElement("div");
    meta.className = "category-meta";
    const title = document.createElement("h3");
    title.textContent = category;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = entries.length;
    meta.append(title, count);
    if (category === '其他') {
      const note = document.createElement('small');
      note.textContent = '仅复制或指定目标填入';
      meta.append(note);
    }

    const actions = document.createElement("div");
    actions.className = "category-actions";
    const collection = entries.find((entry) => entry.structured && entry.recordCollection)?.recordCollection;
    const batchCount = collection ? collectionRecords(collection).length : 0;
    if (collection && batchCount) {
      const batch = document.createElement("button");
      batch.type = "button";
      batch.className = "tiny-button batch";
      batch.dataset.profileAction = "true";
      batch.textContent = `批量填入（${batchCount}）`;
      batch.title = `把“${category}”下全部 ${batchCount} 条记录填入网页中的对应记录组`;
      batch.addEventListener("click", () => fillCollectionEntries({ category, recordCollection: collection }, batch));
      actions.append(batch);
    }
    const copyAll = document.createElement("button");
    copyAll.type = "button";
    copyAll.className = "tiny-button";
    copyAll.dataset.profileAction = "true";
    copyAll.dataset.hasValue = copyableEntries.length ? "true" : "false";
    copyAll.textContent = "复制本组";
    copyAll.disabled = !copyableEntries.length;
    copyAll.addEventListener("click", () => copyCategory(category));
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "category-toggle";
    toggle.setAttribute("aria-label", `展开或收起${category}`);
    toggle.textContent = collapsed.has(category) ? "▸" : "▾";
    actions.append(copyAll, toggle);
    header.append(meta, actions);

    const list = document.createElement("div");
    list.className = "entry-list";
    list.hidden = collapsed.has(category);
    toggle.addEventListener("click", () => {
      if (collapsed.has(category)) collapsed.delete(category);
      else collapsed.add(category);
      renderProfile();
    });

    for (const entry of entries) list.append(renderEntryRow(entry));
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "尚未添加资料，可在设置中填写。";
      list.append(empty);
    }
    card.append(header, list);
    elements.list.append(card);
  }
  updateActionAvailability();
}

function updateActionAvailability() {
  elements.fill.disabled = busy || !canonicalAvailable;
  elements.scan.disabled = busy || !canonicalAvailable;
  elements.verify.disabled = busy;
  elements.undo.disabled = busy;
  for (const button of document.querySelectorAll('[data-profile-action="true"]')) {
    const unavailableEntry = button.dataset.hasValue === "false";
    button.disabled = busy || !canonicalAvailable || unavailableEntry;
  }
}

function setBusy(value) {
  busy = value;
  updateActionAvailability();
}

function setBadge(site, tone = "neutral") {
  const labels = { mokahr: "MokaHR", zhiye: "Zhiye", feishu: "飞书招聘", cmbchina: "招商银行招聘", job51: "51job", generic: "通用网页" };
  elements.badge.textContent = labels[site] || site || "待扫描";
  elements.badge.className = `badge ${tone}`;
}

async function refreshAccessStatus() {
  const response = await chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_ACCESS" });
  if (!response?.ok) throw new Error(response?.error || "无法检查当前网页权限。");
  currentAccess = response;

  if (response.defaultAccess) {
    elements.accessPanel.hidden = false;
    elements.accessPanel.classList.add("granted");
    elements.accessTitle.textContent = `${response.label} 已默认授权`;
    elements.accessDescription.textContent = "普通网页可直接扫描和填写，无需逐站点击授权。";
    elements.grantSite.hidden = true;
    return response;
  }

  if (!response.originPattern) {
    elements.accessPanel.hidden = false;
    if (!response.invokedForCurrentTab) {
      elements.accessPanel.classList.remove("granted");
      elements.accessTitle.textContent = "当前页面不可访问";
      elements.accessDescription.textContent = "请切换到普通 http:// 或 https:// 招聘网页。Chrome 内部页面不支持填写。";
      elements.grantSite.hidden = true;
    }
    return response;
  }

  elements.accessPanel.hidden = false;
  elements.accessTitle.textContent = response.persistent
    ? `${response.label} 已获得长期授权`
    : `${response.label} 当前为临时访问`;
  elements.accessDescription.textContent = response.persistent
    ? "重新打开或切换该网站页面后仍可使用。"
    : "现在可以使用；建议授权该招聘网站，避免侧栏或页面切换后失效。";
  elements.accessPanel.classList.toggle("granted", response.persistent);
  elements.grantSite.hidden = response.persistent;
  elements.grantSite.disabled = false;
  elements.grantSite.textContent = `授权 ${response.label}`;
  return response;
}

async function grantCurrentSite() {
  if (!currentAccess?.originPattern) {
    elements.result.textContent = "请先在目标招聘网页中点击工具栏上的扩展图标。";
    return;
  }
  elements.grantSite.disabled = true;
  try {
    const granted = await chrome.permissions.request({ origins: [currentAccess.originPattern] });
    if (!granted) {
      elements.result.textContent = `你暂未授权 ${currentAccess.label}；复制功能仍可使用。`;
      setBadge("需要授权", "warn");
      return;
    }
    await refreshAccessStatus();
    const prepared = await runCommand("prepareTargeting");
    renderTargetStatus(prepared.result);
    setBadge(prepared.result.site, "good");
    elements.result.textContent = `${currentAccess.label} 已授权，可以扫描或填写当前页面。`;
    showToast(`${currentAccess.label} 授权成功`);
  } catch (error) {
    elements.result.textContent = `授权失败：${error.message}`;
    setBadge("授权失败", "warn");
  } finally {
    elements.grantSite.disabled = false;
  }
}

// 跳过原因按组展示；顺序即优先级，第一个命中的分组胜出。
const REASON_GROUPS = [
  { key: "existing", title: "框里已有内容", match: (reason) => reason === "字段已有内容" || reason === "选项组已有选择", overwrite: true },
  { key: "used", title: "资料已用于更靠前的框", match: (reason) => reason === "同一资料已用于更靠前的字段" },
  { key: "manual", title: "控件处理未完成", match: (reason) => /未确认写入|请手动处理|未打开控件|未找到选项|写入未确认/.test(reason) && !/岗位和工作城市/.test(reason) },
  { key: "none", title: "完全没找到候选", match: (reason) => reason === "没有找到候选" },
  { key: "low", title: "置信度不足", match: (reason) => reason === "置信度不足" },
  { key: "create", title: "未能创建对应记录", match: (reason) => reason === "未能创建对应记录" || reason === "点击填写时将自动创建记录" },
  { key: "intent", title: "需要你手动决定", match: () => true }
];

function groupSkipped(skipped) {
  const buckets = new Map(REASON_GROUPS.map((group) => [group.key, []]));
  for (const item of skipped) {
    const group = REASON_GROUPS.find((candidate) => candidate.match(item.reason || ""));
    buckets.get(group.key).push(item);
  }
  return REASON_GROUPS
    .filter((group) => buckets.get(group.key).length)
    .map((group) => ({ ...group, items: buckets.get(group.key) }));
}

function resultLine(item, showReason) {
  const score = Number(item.score) ? `（${item.score}）` : "";
  const reason = showReason && item.reason ? ` · ${item.reason}` : "";
  const precision = item.precisionNote ? ` · ${item.precisionNote}` : "";
  return `${item.field || "字段"} ← ${item.label || "（空）"}${score}${reason}${precision}`;
}

function renderReasonGroup(group) {
  const details = document.createElement("details");
  details.className = "reason-group";
  const summary = document.createElement("summary");
  summary.textContent = `${group.title} ${group.items.length}`;
  details.append(summary);
  const list = document.createElement("ul");
  list.className = "result-list";
  for (const item of group.items.slice(0, 40)) list.append(Object.assign(document.createElement("li"), { textContent: resultLine(item, group.key !== "filled") }));
  details.append(list);
  if (group.overwrite) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tiny-button";
    button.textContent = "允许覆盖并重填";
    button.addEventListener("click", async () => {
      button.disabled = true;
      if (!settings.overwriteExisting) await updateSetting("overwriteExisting", true);
      elements.overwriteExisting.checked = true;
      await fillPage();
    });
    details.append(button);
  }
  return details;
}

// 否决过的组合会一直被跳过，所以必须给一个收回的地方。
function renderRejectionNotice() {
  const count = (settings.rejectedMatches || []).length;
  if (!count) return null;
  const row = document.createElement("div");
  row.className = "alternate-row";
  const text = document.createElement("span");
  text.textContent = `已记住 ${count} 条「框 ⟷ 词条」否决，不再参与匹配。`;
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "tiny-button";
  clear.textContent = "全部恢复";
  clear.addEventListener("click", async () => {
    clear.disabled = true;
    await updateSetting("rejectedMatches", []);
    showToast("已恢复全部被否决的匹配");
    renderProfile();
    row.remove();
  });
  row.append(text, clear);
  return row;
}

async function rejectMatches(keys) {
  const wanted = [...new Set([...(settings.rejectedMatches || []), ...keys.filter(Boolean)])];
  await updateSetting("rejectedMatches", wanted);
}

async function rejectAlternate(key, button) {
  button.disabled = true;
  await rejectMatches([key]);
  showToast("已否决这一条，正在重新填写…");
  await fillPage();
}

async function rejectAllAlternates(items, button) {
  const keys = items.flatMap((item) => [
    ...(item.alternates || []).map((alternate) => alternate.rejectionKey),
    item.rejectionKey
  ]);
  if (!keys.length) return;
  button.disabled = true;
  await rejectMatches(keys);
  showToast("已否决所有候补，正在重新填写…");
  await fillPage();
}

function renderAlternatesPanel(items) {
  const details = document.createElement("details");
  details.className = "reason-group alternates";
  const summary = document.createElement("summary");
  summary.textContent = `⚠ ${items.length} 个框有候补`;
  details.append(summary);

  for (const item of items) {
    const block = document.createElement("div");
    block.className = "alternate-item";
    const head = document.createElement("div");
    head.className = "alternate-row";
    const current = document.createElement("span");
    current.textContent = `已用：${item.field} ← ${item.label}（${item.score}）`;
    const dropWinner = document.createElement("button");
    dropWinner.type = "button";
    dropWinner.className = "tiny-button";
    dropWinner.textContent = "改用候补";
    dropWinner.title = "否决当前这一条，改用它下面的候补重填";
    dropWinner.addEventListener("click", () => rejectAlternate(item.rejectionKey, dropWinner));
    head.append(current, dropWinner);
    block.append(head);

    for (const alternate of item.alternates || []) {
      const row = document.createElement("div");
      row.className = "alternate-row";
      const text = document.createElement("span");
      text.textContent = `候补：${alternate.label}（${alternate.score}${alternate.alias ? ` · 命中「${alternate.alias}」` : ""}）`;
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "tiny-button";
      reject.textContent = "否决";
      reject.addEventListener("click", () => rejectAlternate(alternate.rejectionKey, reject));
      row.append(text, reject);
      block.append(row);
    }
    details.append(block);
  }

  const all = document.createElement("button");
  all.type = "button";
  all.className = "tiny-button";
  all.textContent = "一键否决所有候补";
  all.addEventListener("click", () => rejectAllAlternates(items, all));
  details.append(all);
  return details;
}

function renderFillResult(result, mode) {
  if (result?.error) throw new Error(result.error);
  setBadge(result.site, result.filled?.length ? "good" : "neutral");
  elements.result.replaceChildren();

  const title = document.createElement("p");
  title.className = "result-summary";
  title.textContent = mode === "scan"
    ? `扫描 ${result.scannedCount} 个字段，找到 ${result.suggestions.length} 处可填内容。`
    : `已填写 ${result.filled.length} 项；跳过或待手动处理 ${result.skipped.length} 项。`;
  elements.result.append(title);

  const competing = (result.filled || []).filter((item) => item.alternates?.length);
  if (competing.length) elements.result.append(renderAlternatesPanel(competing));

  const source = mode === "scan" ? result.suggestions : result.filled;
  if (source.length) {
    elements.result.append(renderReasonGroup({ key: "filled", title: mode === "scan" ? "可填" : "已填", items: source }));
  }
  if (mode !== "scan") {
    for (const group of groupSkipped(result.skipped || [])) elements.result.append(renderReasonGroup(group));
  }
  const rejectionNotice = renderRejectionNotice();
  if (rejectionNotice) elements.result.append(rejectionNotice);
}

function renderVerifyResult(result) {
  const durable = result.reloaded;
  setBadge(coreSiteFromHost(), result.missingCount ? "warn" : "good");
  const title = document.createElement("p");
  title.className = "result-summary";
  title.textContent = durable
    ? `刷新/跳转后仍存在 ${result.confirmedCount} 项，缺失 ${result.missingCount} 项。`
    : `当前页面仍存在 ${result.confirmedCount} 项；尚不能证明服务器已保存。`;
  const details = document.createElement("ul");
  details.className = "result-list";
  for (const item of result.results.filter((entry) => !entry.confirmed).slice(0, 10)) {
    const li = document.createElement("li");
    li.textContent = `${item.field || item.label}：${item.reason}`;
    details.append(li);
  }
  elements.result.replaceChildren(title);
  if (details.childElementCount) elements.result.append(details);
}

function coreSiteFromHost() {
  if (elements.badge.textContent === "51job") return "job51";
  if (elements.badge.textContent === "MokaHR") return "mokahr";
  if (elements.badge.textContent === "Zhiye") return "zhiye";
  if (elements.badge.textContent === "飞书招聘") return "feishu";
  return "generic";
}

async function runCommand(command, payload = {}) {
  // 页面脚本按招聘网站的区块划分读取记录，这里投影成站点视图；原始资料不变。
  if (payload.profile) payload = { ...payload, profile: siteProfile(payload.profile) };
  const response = await chrome.runtime.sendMessage({ type: "RUN_IN_ACTIVE_TAB", command, payload });
  if (!response?.ok) {
    const error = new Error(`${response?.error || "无法访问当前网页"} ${response?.hint || ""}`.trim());
    error.code = response?.code;
    throw error;
  }
  return response;
}

async function saveFillExpectation(tabId, result, expectations) {
  const existing = await getSnapshot(tabId);
  const sameDocument = existing?.documentToken === result.documentToken;
  const combined = sameDocument ? [...existing.expectations] : [];
  for (const expectation of expectations) {
    const index = combined.findIndex((item) => {
      if (item.locator && expectation.locator) return item.locator === expectation.locator;
      return !item.locator && !expectation.locator
        && item.entryId === expectation.entryId
        && item.field === expectation.field
        && item.kind === expectation.kind;
    });
    if (index >= 0) combined[index] = expectation;
    else combined.push(expectation);
  }
  await saveSnapshot(tabId, {
    createdAt: new Date().toISOString(),
    url: result.url,
    documentToken: result.documentToken,
    expectations: combined
  });
}

function sourceIds(expectations) {
  return new Set((expectations || []).map((item) => item?.entryId).filter(Boolean));
}

function expectationKey(expectation) {
  if (expectation?.locator) return `locator:${expectation.locator}`;
  return `source:${expectation?.entryId || ""}:${expectation?.field || ""}:${expectation?.kind || ""}`;
}

function markFilledSources(tabId, expectations) {
  if (markerTabId !== tabId) filledEntryIds = new Set();
  const ids = sourceIds(expectations);
  for (const id of ids) filledEntryIds.add(id);
  lastFillExpectationKeys = new Set((expectations || []).map(expectationKey));
  markerTabId = tabId;
  renderProfile();
}

async function syncFilledMarkersForActiveTab(render = true) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  markerTabId = tab?.id || null;
  const snapshot = tab?.id ? await getSnapshot(tab.id) : null;
  filledEntryIds = sourceIds(snapshot?.expectations);
  lastFillExpectationKeys = new Set();
  if (render) renderProfile();
}

async function removeLastFillMarkers() {
  if (!lastFillExpectationKeys.size) return;
  if (markerTabId) {
    const snapshot = await getSnapshot(markerTabId);
    if (snapshot) {
      const expectations = (snapshot.expectations || []).filter((item) => !lastFillExpectationKeys.has(expectationKey(item)));
      await saveSnapshot(markerTabId, {
        ...snapshot,
        expectations
      });
      filledEntryIds = sourceIds(expectations);
    }
  }
  lastFillExpectationKeys = new Set();
  renderProfile();
}

async function fillRecordWithConfirmation(payload) {
  let response = await runCommand("fillRecord", payload);
  const result = response.result;
  if (!result.requiresConfirmation) return response;
  const conflicts = result.conflicts || [];
  const preview = conflicts.map((item) => `${item.field}：${item.currentValue} → ${item.expectedValue}`).join("\n");
  if (!confirm(`这一组有 ${conflicts.length} 项冲突，尚未写入：\n\n${preview}\n\n是否覆盖以上内容并填入这一整组？`)) {
    result.skipped.push(...conflicts.map((item) => ({ ...item, label: item.expectedValue, reason: "用户取消覆盖这一组" })));
    return response;
  }
  response = await runCommand("fillRecord", {
    ...payload,
    settings: { ...payload.settings, overwriteExisting: true, recordConflictConfirmed: true },
    resetTransaction: false
  });
  return response;
}

async function fillEntry(reference, button) {
  setBusy(true);
  try {
    const operationProfile = await refreshProfileFromCanonical();
    const entry = resolveCanonicalEntry(operationProfile, reference);
    if (!String(entry.value || "").trim()) throw new Error("这条资料在 JSON 主档中没有填写内容。");
    if (entry.structured && entry.recordCollection && entry.sourceId) {
      if (settings.overwriteExisting && !confirm("覆盖模式已开启。确定要允许插件改写这一组中已有的非空内容吗？")) return;
      const response = await fillRecordWithConfirmation({
        profile: operationProfile,
        settings,
        collection: entry.recordCollection,
        recordId: entry.sourceId,
        resetTransaction: true
      });
      const result = response.result;
      renderFillResult(result, "fill");
      if (result.filled.length) {
        await saveFillExpectation(response.tabId, result, result.filled);
        markFilledSources(response.tabId, result.filled);
      }
      showToast(result.filled.length ? `已填写“${entry.label}”这一组` : `“${entry.label}”没有填入任何内容`);
      return;
    }
    let response = await runCommand("fillTarget", { entry, forceOverwrite: false });
    if (response.result.requiresConfirmation) {
      const preview = String(response.result.currentValue || "").slice(0, 80);
      if (!confirm(`“${response.result.field}”已有内容：\n${preview}\n\n确定用“${entry.label}”覆盖吗？`)) return;
      response = await runCommand("fillTarget", { entry, forceOverwrite: true });
    }
    if (!response.result.success) throw new Error(response.result.reason || "没有完成定点填入");
    await saveFillExpectation(response.tabId, response.result, [response.result.expectation]);
    markFilledSources(response.tabId, [response.result.expectation]);
    renderTargetStatus({ ready: true, field: response.result.field, currentValue: entry.value });
    const precisionNote = response.result.precisionNote || response.result.expectation?.precisionNote;
    const message = `已填入“${entry.label}”${precisionNote ? ` · ${precisionNote}` : ""}`;
    if (precisionNote) elements.result.textContent = message;
    showToast(message);
  } catch (error) {
    elements.result.textContent = error.message;
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function scanPage() {
  setBusy(true);
  try {
    const operationProfile = await refreshProfileFromCanonical();
    const response = await runCommand("scan", { profile: operationProfile, settings });
    renderFillResult(response.result, "scan");
  } catch (error) {
    elements.result.textContent = error.message;
    setBadge(error.code === "PAGE_ACCESS_REQUIRED" ? "需要授权" : canonicalAvailable ? "扫描失败" : "资料不可用", "warn");
  } finally {
    setBusy(false);
  }
}

async function fillPage() {
  if (settings.overwriteExisting && !confirm("覆盖模式已开启。确定要允许插件改写当前网页中已有的非空内容吗？")) return;
  setBusy(true);
  try {
    const operationProfile = await refreshProfileFromCanonical();
    const scanResponse = await runCommand("scan", { profile: operationProfile, settings });
    let response;
    if (Object.values(operationProfile.records || {}).some((records) => records.length)) {
      const combined = { ...scanResponse.result, suggestions: [], filled: [], skipped: [] };
      elements.result.textContent = "正在填写基本信息和求职偏好…";
      const flat = await runCommand("fillFlatEntries", { profile: operationProfile, settings, resetTransaction: true });
      for (const key of ["suggestions", "filled", "skipped"]) combined[key].push(...(flat.result[key] || []));
      const records = Object.entries(operationProfile.records).flatMap(([collection, rows]) => rows.map((record) => ({ collection, record })));
      for (let index = 0; index < records.length; index += 1) {
        const { collection, record } = records[index];
        elements.result.textContent = `正在处理 ${index + 1}/${records.length}`;
        try {
          const part = await fillRecordWithConfirmation({ profile: operationProfile, settings, collection, recordId: record.id, resetTransaction: false });
          for (const key of ["suggestions", "filled", "skipped"]) combined[key].push(...(part.result[key] || []));
        } catch (error) {
          combined.skipped.push({ field: collection, entryId: record.id, label: record.displayName || record.id, reason: error.message || "记录填写失败" });
        }
      }
      response = { ...scanResponse, result: combined };
    } else {
      response = await runCommand("fillFlatEntries", { profile: operationProfile, settings, resetTransaction: true });
    }
    renderFillResult(response.result, "fill");
    if (response.result.filled.length) {
      await saveFillExpectation(response.tabId, response.result, response.result.filled);
      markFilledSources(response.tabId, response.result.filled);
      showToast(`已填写 ${response.result.filled.length} 项，请在网页中保存`);
    }
  } catch (error) {
    elements.result.textContent = error.message;
    setBadge(error.code === "PAGE_ACCESS_REQUIRED" ? "需要授权" : "填写失败", "warn");
  } finally {
    setBusy(false);
  }
}

// 把一个大类的全部记录逐组填入；不设上限，进度始终显示为「正在处理 i/n」。
async function fillCollectionEntries(entry, button) {
  const collection = entry.recordCollection;
  if (settings.overwriteExisting && !confirm("覆盖模式已开启。确定要允许插件改写当前网页中已有的非空内容吗？")) return;
  setBusy(true);
  try {
    const operationProfile = await refreshProfileFromCanonical();
    const records = collectionRecords(collection, operationProfile);
    const total = records.length;
    if (!total) throw new Error(`“${entry.category}”下在 JSON 主档中已经没有记录。`);
    const combined = {
      site: "", hostname: "", url: "", documentToken: "", scannedCount: 0,
      suggestions: [], filled: [], skipped: [], structured: true, collection,
      plannedRecords: { [collection]: total }
    };
    let tabId = null;
    for (let index = 0; index < records.length; index += 1) {
      elements.result.textContent = `正在处理 ${index + 1}/${total}`;
      try {
      const response = await fillRecordWithConfirmation({
        profile: operationProfile,
        settings,
        collection,
        recordId: records[index].id,
        resetTransaction: index === 0
      });
      tabId = response.tabId;
      const part = response.result;
      for (const key of ["suggestions", "filled", "skipped"]) combined[key].push(...(part[key] || []));
      for (const key of ["site", "hostname", "url", "documentToken"]) combined[key] ||= part[key] || "";
      combined.scannedCount = Math.max(combined.scannedCount, part.scannedCount || 0);
      } catch (error) {
        combined.skipped.push({ entryId: records[index].id, label: `${entry.category} 第 ${index + 1} 条`, reason: error.message || "记录填写失败" });
        // A failed record must not prevent later records from being attempted.
      }
    }
    renderFillResult(combined, "fill");
    if (combined.filled.length && tabId) {
      await saveFillExpectation(tabId, combined, combined.filled);
      markFilledSources(tabId, combined.filled);
    }
    showToast(combined.filled.length
      ? `已处理 ${total}/${total} 组，共填入 ${combined.filled.length} 个字段`
      : `“${entry.category}”没有填入任何内容，请看下方原因分组`);
  } catch (error) {
    elements.result.textContent = error.message;
    setBadge(error.code === "PAGE_ACCESS_REQUIRED" ? "需要授权" : "批量填入失败", "warn");
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function undoFill() {
  if (!confirm("确定撤销当前页面最近一次由插件完成的填写吗？")) return;
  setBusy(true);
  try {
    const response = await runCommand("undo");
    const { restoredCount, failedCount, reason } = response.result;
    if (restoredCount && !failedCount) await removeLastFillMarkers();
    elements.result.textContent = reason || `已撤销 ${restoredCount} 项${failedCount ? `，另有 ${failedCount} 项未能恢复` : ""}。`;
    showToast(reason || `已撤销 ${restoredCount} 项`);
  } catch (error) {
    elements.result.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

async function verifyPage() {
  setBusy(true);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("无法确定当前标签页。");
    const snapshot = await getSnapshot(tab.id);
    if (!snapshot) throw new Error("当前标签页没有填写记录，请先执行一次批量填写。");
    const response = await runCommand("verify", {
      profile: verificationProfileFromExpectations(snapshot.expectations),
      settings,
      expectations: snapshot.expectations,
      documentToken: snapshot.documentToken
    });
    markerTabId = tab.id;
    filledEntryIds = sourceIds(response.result.results.filter((item) => item.confirmed));
    lastFillExpectationKeys = new Set();
    renderProfile();
    renderVerifyResult(response.result);
  } catch (error) {
    elements.result.textContent = error.message;
    setBadge("核验失败", "warn");
  } finally {
    setBusy(false);
  }
}

async function updateSetting(key, value) {
  settings = await saveSettings({ ...settings, [key]: value });
}

async function init() {
  const [cached, loadedSettings] = await Promise.all([chrome.storage.local.get("resumeHelperProfileV1"), getSettings()]);
  // Existing cache may be displayed during recovery, but never supplies an operation.
  profile = Array.isArray(cached.resumeHelperProfileV1?.entries)
    ? cached.resumeHelperProfileV1 : structuredClone(DEFAULT_PROFILE);
  settings = loadedSettings;
  try { await refreshProfileFromCanonical(); } catch (_) {}
  elements.overwriteExisting.checked = settings.overwriteExisting;
  await syncFilledMarkersForActiveTab(false);
  renderProfile();

  elements.search.addEventListener("input", renderProfile);
  elements.scan.addEventListener("click", scanPage);
  elements.fill.addEventListener("click", fillPage);
  elements.verify.addEventListener("click", verifyPage);
  elements.undo.addEventListener("click", undoFill);
  elements.grantSite.addEventListener("click", grantCurrentSite);
  elements.overwriteExisting.addEventListener("change", (event) => updateSetting("overwriteExisting", event.target.checked));
  elements.options.addEventListener("click", () => chrome.runtime.openOptionsPage());

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "RESUME_HELPER_TARGET_CHANGED") renderTargetStatus(message.target);
  });

  chrome.tabs.onActivated?.addListener(() => {
    syncFilledMarkersForActiveTab().catch(() => {});
  });

  try {
    await refreshAccessStatus();
    const prepared = await runCommand("prepareTargeting");
    renderTargetStatus(prepared.result);
  } catch (_) {
    renderTargetStatus(null);
  }

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === "local" && changes.resumeHelperProfileV1) {
      if (JSON.stringify(changes.resumeHelperProfileV1.newValue) !== JSON.stringify(profile)) {
        try { await refreshProfileFromCanonical(); } catch (_) {}
      }
    }
    if (area === "local" && changes.resumeHelperSettingsV1) {
      settings = await getSettings();
      elements.overwriteExisting.checked = settings.overwriteExisting;
    }
  });
}

init().catch((error) => {
  elements.result.textContent = `初始化失败：${error.message}`;
});
