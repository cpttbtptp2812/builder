window.addEventListener("__wire_sse__", (ev) => {
  if (!ev.detail) return;
  chrome.runtime.sendMessage({ type: "wire-frame", frame: ev.detail }).catch(() => {});
});
