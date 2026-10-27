(function initResumeHelperCore(root, factory) {
  const api = factory();
  root.ResumeHelperCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCore() {
  "use strict";

  const STOP_WORDS = new Set(["请输入", "请选择", "信息", "填写", "选填", "必填", "你的", "您的"]);

  function normalize(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[\s\u00a0:：()（）【】\[\]_/\\|·,，.。;；-]+/g, "")
      .replace(/[?？*＊]/g, "")
      .trim();
  }

  function tokenize(value) {
    const normalized = normalize(value);
    if (!normalized) return [];
    const tokens = normalized.match(/[a-z0-9]+|[\u4e00-\u9fff]{2,}/g) || [];
    return tokens.filter((token) => !STOP_WORDS.has(token));
  }

  function scoreAlias(context, alias) {
    const target = normalize(context);
    const candidate = normalize(alias);
    if (!target || !candidate) return 0;
    if (target === candidate) return 100;
    if (target.startsWith(candidate) || target.endsWith(candidate)) return 96;
    if (target.includes(candidate)) return candidate.length >= 4 ? 94 : 90;
    if (candidate.includes(target) && target.length >= 3) return 88;

    // 以下为连续区间：没有整体包含关系时，按重叠比例给 40–85 分，不再有 70 分地板。
    const targetTokens = new Set(tokenize(target));
    const aliasTokens = tokenize(candidate);
    if (!aliasTokens.length) return 0;
    const overlap = aliasTokens.filter((token) => targetTokens.has(token)).length;
    if (overlap) return Math.round(40 + 45 * (overlap / aliasTokens.length));
    return bigramScore(target, candidate);
  }

  // 中文词之间没有空格，「所在单位」与「工作单位」按词切分完全不重叠；
  // 改用二字片段覆盖率兜底，覆盖一半以上才计分（40–80）。
  function bigrams(value) {
    const result = new Set();
    for (const run of value.match(/[一-鿿]{2,}/g) || []) {
      for (let index = 0; index < run.length - 1; index += 1) result.add(run.slice(index, index + 2));
    }
    return result;
  }

  function bigramScore(target, candidate) {
    const aliasGrams = bigrams(candidate);
    if (aliasGrams.size < 2) return 0;
    const targetGrams = bigrams(target);
    let hits = 0;
    for (const gram of aliasGrams) if (targetGrams.has(gram)) hits += 1;
    const coverage = hits / aliasGrams.size;
    return coverage >= 0.5 ? Math.round(40 + 40 * coverage) : 0;
  }

  function siteBoost(entry, context, site) {
    const normalized = normalize(context);
    let boost = 0;
    if (site === "mokahr" && Array.isArray(entry.siteAliases?.mokahr)) {
      boost = Math.max(0, ...entry.siteAliases.mokahr.map((alias) => scoreAlias(normalized, alias) - 86));
    }
    if (site === "zhiye" && Array.isArray(entry.siteAliases?.zhiye)) {
      boost = Math.max(0, ...entry.siteAliases.zhiye.map((alias) => scoreAlias(normalized, alias) - 86));
    }
    return Math.min(8, Math.max(0, boost));
  }

  function rankEntries(context, entries, site = "generic") {
    return entries
      .filter((entry) => entry.value !== "")
      .map((entry) => {
        const aliases = [entry.label, ...(entry.aliases || []), ...((entry.siteAliases || {})[site] || [])];
        const scoredAliases = aliases.map((alias) => ({ alias, score: scoreAlias(context, alias) }));
        const base = Math.max(0, ...scoredAliases.map((item) => item.score));
        const best = scoredAliases
          .filter((item) => item.score === base)
          .sort((a, b) => normalize(b.alias).length - normalize(a.alias).length)[0];
        const specificity = best ? normalize(best.alias).length : 0;
        return { entry, score: Math.min(100, base + siteBoost(entry, context, site)), specificity, alias: best?.alias || "" };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.specificity - a.specificity || a.entry.label.localeCompare(b.entry.label, "zh-CN"));
  }

  // 一个框的最终决定：分最高者胜出，其余达到阈值的列为候补；
  // 用户否决过的「框名 ⟷ 词条」组合直接跳过，由下一名接替。
  function rejectionKey(fieldName, entryId) {
    return `${normalize(fieldName)}::${entryId}`;
  }

  function resolveMatch(ranked, fieldName, options = {}) {
    const threshold = Number(options.threshold) || 0;
    const rejected = new Set(options.rejected || []);
    const pool = ranked.filter((item) => !rejected.has(rejectionKey(fieldName, item.entry.id)));
    const [winner, ...rest] = pool;
    if (!winner) return null;
    const alternates = rest
      .filter((item) => item.score >= threshold)
      .slice(0, 5)
      .map((item) => ({ entryId: item.entry.id, label: item.entry.label, score: item.score, alias: item.alias || "" }));
    const tied = rest[0] && rest[0].score === winner.score && rest[0].specificity === winner.specificity;
    return { ...winner, ambiguous: Boolean(tied), alternates };
  }

  // MokaHR 的白标部署：域名不是 mokahr.com，但表单是同一套。
  // 真正的判据是 DOM 指纹（见 fill.js 的 isMokaStructuredPage），这里只是让
  // 域名层也认得已知的白标，避免侧栏把它显示成「通用网页」。
  const MOKA_WHITE_LABEL_HOSTS = [
    "apply.careers.dji.com"
  ];

  function detectSite(hostname) {
    const host = String(hostname || "").toLowerCase();
    if (host === "app.mokahr.com" || host.endsWith(".mokahr.com")) return "mokahr";
    if (MOKA_WHITE_LABEL_HOSTS.includes(host)) return "mokahr";
    if (host === "zhiye.com" || host.endsWith(".zhiye.com")) return "zhiye";
    if (host.endsWith(".jobs.feishu.cn")) return "feishu";
    if (host === "xyz.51job.com") return "job51";
    if (host === "career.cmbchina.com") return "cmbchina";
    return "generic";
  }

  function formatValue(entry, inputType) {
    const value = entry.value;
    if (inputType === "date" && /^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
    if (inputType === "month" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
    if (inputType === "tel") return value.replace(/^\+86\s*/, "").replace(/\s+/g, "");
    return value;
  }

  function detectZhiyeTemplate(hostname) {
    const host = String(hostname || "").toLowerCase();
    if (host === "chinalife.zhiye.com") return "chinalife";
    if (host === "seyond.zhiye.com") return "seyond";
    if (host === "bosc.zhiye.com") return "bosc";
    if (host === "sanycampus.zhiye.com") return "sany";
    return host === "njzq.zhiye.com" ? "njzq" : "legacy";
  }

  return { normalize, tokenize, scoreAlias, rankEntries, resolveMatch, rejectionKey, detectSite, detectZhiyeTemplate, formatValue };
});
