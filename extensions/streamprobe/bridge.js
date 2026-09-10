window.addEventListener("__streamprobe__", (ev) => {
  if (!ev.detail) return;
  chrome.runtime.sendMessage({ type: "sp-event", payload: ev.detail }).catch(() => {});
});
