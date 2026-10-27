import { ensureSeededProfile } from "./shared/storage.js";

const ACTION_CONTEXT_KEY = "resumeHelperActionContextV1";
let latestActionContext = null;

// MokaHR 的白标部署（例如 DJI 的 apply.careers.dji.com），表单仍是同一套。
const MOKA_WHITE_LABEL_HOSTS = [
  "apply.careers.dji.com"
];

function supportedSite(urlValue) {
  try {
    const url = new URL(urlValue);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.hostname === "app.mokahr.com" || url.hostname.endsWith(".mokahr.com")) {
      return { site: "mokahr", label: "MokaHR" };
    }
    if (MOKA_WHITE_LABEL_HOSTS.includes(url.hostname.toLowerCase())) {
      return { site: "mokahr", label: "MokaHR" };
    }
    if (url.hostname === "zhiye.com" || url.hostname.endsWith(".zhiye.com")) {
      return { site: "zhiye", label: "Zhiye" };
    }
    if (url.hostname.endsWith(".jobs.feishu.cn")) {
      return { site: "feishu", label: "飞书招聘" };
    }
    if (url.hostname === "xyz.51job.com" && url.pathname === "/External/MyResume/FillInResume.aspx") return { site: "job51", label: "51job" };
    if (url.hostname === "career.cmbchina.com") return { site: "cmbchina", label: "招商银行招聘" };
    return { site: "generic", label: url.hostname };
  } catch (_) {
    return null;
  }
}

async function configureExtension() {
  await ensureSeededProfile();
  // Let Chrome open the panel as part of the toolbar click itself. Calling
  // sidePanel.open() from a service worker is rejected in some reload/panel
  // states even when the click listener appears synchronous.
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(configureExtension);

chrome.runtime.onStartup.addListener(configureExtension);

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id || !/^https?:/i.test(tab.url || "")) return;
  latestActionContext = {
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url,
    createdAt: Date.now()
  };

  chrome.storage.session.set({ [ACTION_CONTEXT_KEY]: latestActionContext }).catch((error) => {
    console.warn("Unable to remember resume helper action context", error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_ACTIVE_TAB_ACCESS") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const stored = latestActionContext ? null : await chrome.storage.session.get(ACTION_CONTEXT_KEY);
      const context = latestActionContext || stored?.[ACTION_CONTEXT_KEY];
      const url = tab?.url || (context?.tabId === tab?.id ? context.url : "");
      const supported = supportedSite(url);
      // Ordinary HTTP(S) pages are declared in host_permissions, so access is
      // persistent after Chrome accepts the extension's install/update prompt.
      const persistent = Boolean(supported);
      sendResponse({
        ok: true,
        tabId: tab?.id || null,
        invokedForCurrentTab: Boolean(tab?.id && context?.tabId === tab.id),
        url,
        site: supported?.site || "generic",
        label: supported?.label || "当前网页",
        originPattern: null,
        defaultAccess: persistent,
        persistent
      });
    })().catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (message?.type !== "RUN_IN_ACTIVE_TAB") return false;

  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("无法确定当前标签页。");
    }
    if (tab.url && !/^https?:/i.test(tab.url)) {
      throw new Error("当前页面不是可填写的普通网页。Chrome 内部页面和扩展页面不支持注入。");
    }

    let sanyForm=false;
    if (tab.url) {
      const url = new URL(tab.url);
      sanyForm=url.hostname==='sanycampus.zhiye.com' && url.pathname==='/form';
      if (url.hostname === 'bosc.zhiye.com' && url.pathname === '/form') await chrome.scripting.executeScript({
        target: { tabId: tab.id }, world: 'MAIN', files: ['content/bosc.js','content/chinalife-readback.js']
      });
      if (['chinalife.zhiye.com','seyond.zhiye.com','sanycampus.zhiye.com'].includes(url.hostname) && url.pathname === '/form') await chrome.scripting.executeScript({
          target: { tabId: tab.id }, world: 'MAIN', files: sanyForm ? ['content/sany.js','content/chinalife-readback.js'] : ['content/chinalife-readback.js']
      });
      if(url.hostname==='xyz.51job.com'&&url.pathname==='/External/MyResume/FillInResume.aspx')await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['content/job51-readback.js']});
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["shared/matcher-core.js", "shared/category-runtime.js", "content/job51.js", "content/bosc.js", ...(sanyForm?["content/sany.js"]:[]), "content/fill.js"]
    });

    const result = await chrome.tabs.sendMessage(tab.id, {
      type: "RESUME_HELPER_COMMAND",
      command: message.command,
      payload: message.payload || {}
    });

    sendResponse({ ok: true, tabId: tab.id, url: tab.url, result });
  })().catch((error) => {
    const message = error?.message || String(error);
    const unsupportedPage = /不是可填写的普通网页|Chrome 内部页面|扩展页面不支持注入/.test(message);
    const accessError = /cannot access|permission|host permission|extensions gallery cannot be scripted/i.test(message);
    sendResponse({
      ok: false,
      code: unsupportedPage ? "UNSUPPORTED_PAGE" : accessError ? "PAGE_ACCESS_REQUIRED" : "PAGE_COMMAND_FAILED",
      error: message,
      hint: unsupportedPage
        ? "请切换到以 http:// 或 https:// 开头的招聘网页后再使用。"
        : accessError
          ? "当前网页访问权限未生效。请在扩展管理页确认新版的网站访问权限并重新加载此网页。"
          : "网页可能已刷新或控件结构发生变化，请重新扫描后再试。"
    });
  });

  return true;
});
