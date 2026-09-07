/** ISOLATED world — 桥接页面事件到 background */
const CHANNEL = "__mirror_channel__";

window.addEventListener(CHANNEL, (ev) => {
  const detail = ev.detail;
  if (!detail) return;
  chrome.runtime.sendMessage({ type: "mirror-log", entry: detail }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg.type === "mirror-get-mocks") {
    chrome.storage.local.get("mirrorMocks").then(({ mirrorMocks }) => {
      sendResponse({ mocks: mirrorMocks || {} });
    });
    return true;
  }
});
