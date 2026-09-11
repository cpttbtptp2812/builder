/** ISOLATED world：接收 MAIN world postMessage，转发给 background */
window.addEventListener("message", (ev) => {
  if (ev.source !== window || !ev.data?.__streamprobe__ || !ev.data.detail) return;
  chrome.runtime.sendMessage({ type: "sp-event", payload: ev.data.detail }).catch(() => {});
});
