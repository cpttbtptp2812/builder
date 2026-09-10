async function load() {
  const res = await chrome.runtime.sendMessage({ type: "sp-get" });
  const el = document.getElementById("summary");
  if (!res?.ok) {
    el.textContent = "无法读取会话";
    return;
  }
  const { connections = [], frames = [] } = res.session || {};
  const msgFrames = frames.filter((f) => f.phase === "message").length;
  el.textContent = `${connections.length} 条连接 · ${msgFrames} 个消息帧`;
}

document.getElementById("open-panel").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "sp-open-panel" });
  window.close();
});

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "sp-clear" });
  load();
});

load();
