const KEY = "wireFrames";
const MAX = 100;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "wire-frame") {
    const tabId = sender.tab?.id;
    chrome.storage.session.get(KEY).then(({ [KEY]: store }) => {
      const all = store || {};
      const list = all[tabId] || [];
      list.unshift({ ...msg.frame, tabId });
      all[tabId] = list.slice(0, MAX);
      chrome.storage.session.set({ [KEY]: all });
    });
    return false;
  }

  if (msg.type === "wire-list") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      const { [KEY]: store } = await chrome.storage.session.get(KEY);
      const list = tab?.id ? store?.[tab.id] || [] : [];
      sendResponse({ frames: list });
    });
    return true;
  }

  if (msg.type === "wire-clear") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      const { [KEY]: store } = await chrome.storage.session.get(KEY);
      const all = store || {};
      if (tab?.id) delete all[tab.id];
      await chrome.storage.session.set({ [KEY]: all });
      sendResponse({ ok: true });
    });
    return true;
  }
});
