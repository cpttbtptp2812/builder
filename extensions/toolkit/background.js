import { buildJumpUrl } from "./clip-jump.js";
import {
  addLocalSnippet,
  canSyncDesktop,
  getLocalSnippets,
  setLocalSnippets,
} from "./clip-storage.js";

const API = "http://127.0.0.1:38472";
const WIRE_KEY = "wireFrames";
const WIRE_MAX = 100;

async function getToken() {
  const { clipHubToken } = await chrome.storage.local.get("clipHubToken");
  return clipHubToken || "";
}

async function api(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Clip-Token": token,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 ${res.status}`);
  return data;
}

async function capturePageAnchor(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const sel = window.getSelection();
      const text = sel?.toString?.() || "";
      let scrollY = window.scrollY;
      if (sel?.rangeCount) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.height > 0 || rect.width > 0) {
          scrollY = Math.round(window.scrollY + rect.top - window.innerHeight * 0.3);
        }
      }
      let textFragment = "";
      if (text.trim()) {
        const core = text.trim().slice(0, 150);
        textFragment =
          "#:~:text=" +
          encodeURIComponent(core)
            .replace(/-/g, "%2D")
            .replace(/!/g, "%21")
            .replace(/'/g, "%27")
            .replace(/\(/g, "%28")
            .replace(/\)/g, "%29")
            .replace(/~/g, "%7E");
      }
      return {
        scrollY,
        textFragment,
        pageUrl: location.href.split("#")[0],
        pageTitle: document.title,
      };
    },
  });
  return result;
}

async function notify(title, message) {
  try {
    await chrome.notifications.create(`clip-hub-${Date.now()}`, {
      type: "basic",
      title,
      message,
      priority: 2,
    });
  } catch {
    /* ignore */
  }
}

async function syncToDesktop(snippet) {
  if (!(await canSyncDesktop())) return snippet;
  try {
    return await api("/snippets", {
      method: "POST",
      body: JSON.stringify(snippet),
    });
  } catch {
    return snippet;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "clip-hub-save",
      title: "保存到 ClipHub（含页面位置）",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "clip-hub-save" || !info.selectionText || !tab?.id) return;

  let anchor = {
    scrollY: null,
    textFragment: "",
    pageUrl: tab.url?.split("#")[0] || "",
    pageTitle: tab.title || "",
  };
  try {
    anchor = await capturePageAnchor(tab.id);
  } catch {
    /* 部分页面无法注入脚本 */
  }

  const { clipHubPendingTags } = await chrome.storage.local.get("clipHubPendingTags");
  const pendingTags = Array.isArray(clipHubPendingTags) ? clipHubPendingTags : [];
  const hashTags = (info.selectionText.match(/#([\u4e00-\u9fa5\w-]+)/g) || []).map((t) =>
    t.slice(1),
  );
  const tags = [...new Set([...pendingTags, ...hashTags])];

  const snippet = {
    id: crypto.randomUUID(),
    title: anchor.pageTitle?.slice(0, 40) || tab.title?.slice(0, 40) || "网页片段",
    content: info.selectionText,
    pageUrl: anchor.pageUrl || tab.url?.split("#")[0] || "",
    pageTitle: anchor.pageTitle || tab.title || "",
    textFragment: anchor.textFragment || "",
    scrollY: anchor.scrollY ?? null,
    tags,
    createdAt: new Date().toISOString(),
  };

  await addLocalSnippet(snippet);
  await syncToDesktop(snippet);

  chrome.action.setBadgeText({ text: "✓" });
  chrome.action.setBadgeBackgroundColor({ color: "#0d9488" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1600);
  await notify("ClipHub", "已保存，点插件图标可跳回");
});

function waitTabReady(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendJumpToTab(tabId, item, attempt = 0) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "clip-hub-jump",
      scrollY: item.scrollY ?? null,
      text: item.content || "",
    });
    return true;
  } catch {
    if (attempt >= 6) return false;
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    return sendJumpToTab(tabId, item, attempt + 1);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "list") {
    (async () => {
      let items = await getLocalSnippets();
      let synced = false;
      if (await canSyncDesktop()) {
        try {
          const data = await api("/snippets");
          items = data.items?.length ? data.items : items;
          await setLocalSnippets(items);
          synced = true;
        } catch {
          /* 用本地列表 */
        }
      }
      sendResponse({ ok: true, items, synced });
    })();
    return true;
  }

  if (msg.type === "jump") {
    (async () => {
      const url = buildJumpUrl(msg.item);
      if (!url) {
        sendResponse({ ok: false, error: "该条目没有保存页面位置" });
        return;
      }
      const tab = await chrome.tabs.create({ url });
      await waitTabReady(tab.id);
      await sendJumpToTab(tab.id, msg.item);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "ping") {
    (async () => {
      const synced = await canSyncDesktop();
      sendResponse({ ok: true, synced, mode: synced ? "desktop" : "local" });
    })();
    return true;
  }

  if (msg.type === "env-get-host") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      let host = "";
      try {
        host = tab?.url ? new URL(tab.url).hostname : "";
      } catch {
        /* ignore */
      }
      sendResponse({ host, url: tab?.url || "" });
    });
    return true;
  }

  if (msg.type === "env-save") {
    chrome.storage.local.get("envProfiles").then(({ envProfiles = {} }) => {
      const next = { ...envProfiles, [msg.host]: msg.profile };
      chrome.storage.local.set({ envProfiles: next }).then(() => {
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, { type: "env-push" }).catch(() => {});
        } else {
          chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
            if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "env-push" }).catch(() => {});
          });
        }
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (msg.type === "env-load") {
    chrome.storage.local.get("envProfiles").then(({ envProfiles = {} }) => {
      sendResponse({ profile: envProfiles[msg.host] || null });
    });
    return true;
  }

  if (msg.type === "wire-frame") {
    const tabId = sender.tab?.id;
    chrome.storage.session.get(WIRE_KEY).then(({ [WIRE_KEY]: store }) => {
      const all = store || {};
      const list = all[tabId] || [];
      list.unshift({ ...msg.frame, tabId });
      all[tabId] = list.slice(0, WIRE_MAX);
      chrome.storage.session.set({ [WIRE_KEY]: all });
    });
    return false;
  }

  if (msg.type === "wire-list") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      const { [WIRE_KEY]: store } = await chrome.storage.session.get(WIRE_KEY);
      const list = tab?.id ? store?.[tab.id] || [] : [];
      sendResponse({ frames: list });
    });
    return true;
  }

  if (msg.type === "wire-clear") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      const { [WIRE_KEY]: store } = await chrome.storage.session.get(WIRE_KEY);
      const all = store || {};
      if (tab?.id) delete all[tab.id];
      await chrome.storage.session.set({ [WIRE_KEY]: all });
      sendResponse({ ok: true });
    });
    return true;
  }
});
