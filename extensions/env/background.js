chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "env-get-host") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      let host = "";
      try {
        host = tab?.url ? new URL(tab.url).hostname : "";
      } catch { /* ignore */ }
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
});
