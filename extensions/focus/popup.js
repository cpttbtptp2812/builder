async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const btn = document.getElementById("toggle");
  const status = document.getElementById("status");
  if (!tab?.id) return;

  try {
    const st = await chrome.tabs.sendMessage(tab.id, { type: "focus-status" });
    if (st?.active) {
      btn.textContent = "退出阅读模式";
      status.textContent = "";
    } else {
      btn.textContent = "进入阅读模式";
    }
  } catch {
    btn.textContent = "进入阅读模式";
    status.textContent = "若首次使用，请刷新页面";
  }
}

document.getElementById("toggle").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const status = document.getElementById("status");
  try {
    const st = await chrome.tabs.sendMessage(tab.id, { type: "focus-status" });
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: "focus-toggle",
      theme: "dark",
    });
    if (!res?.ok) {
      status.textContent = res?.error || "无法开启";
      return;
    }
    if (st?.active) window.close();
    else window.close();
  } catch {
    status.textContent = "请刷新页面后重试";
  }
});

refresh();
